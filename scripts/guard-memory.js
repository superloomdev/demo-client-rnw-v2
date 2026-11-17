// Info: What the guard counts as a process's memory, and when the system
// itself is out of room.
//
// Resident size (`ps` rss) is not a measure of memory. Under pressure the
// operating system compresses and swaps a process's pages as fast as the
// process allocates them: on 2026-11-17 a test process reached 367 GB with
// 2.1 GB resident, under a 3 GB ceiling that read rss, and nothing stopped
// it. The measure here is the footprint: resident plus compressed plus
// swapped memory. macOS reports it through `footprint`, Linux through
// `VmRSS` + `VmSwap` in /proc. A process counts as the larger of its
// resident size and its footprint, so a reading that fails never lowers
// the number.
//
// The guard also stops a run when the operating system reports critical
// memory pressure, whatever the per-process numbers say.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const FOOTPRINT_LINE = /\[(\d+)\]:.*Footprint:\s*(\d+)\s*B\b/;
const BYTES_PER_MB = 1024 * 1024;

// kern.memorystatus_vm_pressure_level: 1 normal, 2 warning, 4 critical
const PRESSURE_CRITICAL = 4;

// Linux has no pressure level; under this share of available memory the
// system is treated as critical
const LINUX_AVAILABLE_FLOOR = 0.03;


/********************************************************************
Parse the output of `footprint --noCategories -f bytes <pid>...`: one
header line per process, `name [pid]: 64-bit    Footprint: N B`.

@param {String} text - The command's output

@return {Map} - pid -> footprint in MB
*********************************************************************/
export function parseFootprints (text) {

  // Keep the header line of each process, skip everything else
  const footprints = new Map();
  for (const line of String(text).split('\n')) {
    const match = FOOTPRINT_LINE.exec(line);
    if (match !== null) {
      footprints.set(Number(match[1]), Number(match[2]) / BYTES_PER_MB);
    }
  }

  // Return what was found; a process with no line has no entry
  return footprints;

}


/********************************************************************
Parse one /proc/<pid>/status text into a footprint.

@param {String} text - The status file's text

@return {Number} - VmRSS + VmSwap in MB, 0 when neither is present
*********************************************************************/
export function parseProcStatus (text) {

  // Both fields are in kB
  let kilobytes = 0;
  for (const name of ['VmRSS', 'VmSwap']) {
    const match = new RegExp('^' + name + ':\\s*(\\d+)\\s*kB', 'm').exec(String(text));
    if (match !== null) {
      kilobytes += Number(match[1]);
    }
  }

  // Return the sum in MB
  return kilobytes / 1024;

}


/********************************************************************
The memory of each process: the larger of its resident size and its
footprint. A process with no footprint reading keeps its resident size.

@param {Map} residentMb  - pid -> resident MB
@param {Map} footprintMb - pid -> footprint MB (may lack pids)

@return {Map} - pid -> memory in MB
*********************************************************************/
export function mergeMemory (residentMb, footprintMb) {

  // Take the larger reading for every process the table named
  const memory = new Map();
  for (const [pid, resident] of residentMb) {
    const footprint = footprintMb.has(pid) ? footprintMb.get(pid) : 0;
    memory.set(pid, footprint > resident ? footprint : resident);
  }

  // Return one number per process
  return memory;

}


/********************************************************************
Whether the sample is past a ceiling, or the system is out of room.

@param {Object} sample - { maxMemoryMb, treeMb }
@param {Object} limits - { procMb, treeMb }
@param {Boolean} critical - The operating system reports critical pressure

@return {String|null} - 'memory', 'pressure', or null when the run goes on
*********************************************************************/
export function getMemoryVerdict (sample, limits, critical) {

  // The per-process ceiling names the fattest process; the tree ceiling
  // catches many small processes that are one runaway in aggregate
  if (sample.maxMemoryMb > limits.procMb || sample.treeMb > limits.treeMb) {
    return 'memory';
  }

  // The system floor: no per-process number is trusted over this
  if (critical === true) {
    return 'pressure';
  }

  // The run goes on
  return null;

}


/********************************************************************
The footprint of each named process, as the platform reports it.

@param {Array} pids - Process ids

@return {Map} - pid -> footprint in MB; empty when it cannot be read
*********************************************************************/
export function getFootprints (pids) {

  // Nothing to ask about
  if (pids.length === 0) {
    return new Map();
  }

  // macOS: one `footprint` call for the whole list. A pid that has just
  // exited is reported on stderr and the others are still answered
  if (process.platform === 'darwin') {
    try {
      const text = execFileSync('/usr/bin/footprint', ['--noCategories', '-f', 'bytes'].concat(pids.map(String)), {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000
      });
      return parseFootprints(text);
    } catch (error) {
      // A failed call still carries what it printed; with nothing printed
      // the caller falls back to resident size for this sample
      return parseFootprints(error !== null && error.stdout ? error.stdout : '');
    }
  }

  // Linux: one status file per process
  const footprints = new Map();
  if (process.platform === 'linux') {
    for (const pid of pids) {
      try {
        footprints.set(pid, parseProcStatus(readFileSync('/proc/' + pid + '/status', 'utf8')));
      } catch {
        // The process is gone: it has no footprint
      }
    }
  }

  // Any other platform: no reading, the caller keeps resident size
  return footprints;

}


/********************************************************************
Whether the operating system reports critical memory pressure.

@return {Boolean} - True when the system is out of room
*********************************************************************/
export function isPressureCritical () {

  // macOS publishes a pressure level
  if (process.platform === 'darwin') {
    try {
      const level = execFileSync('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000
      });
      return Number(level.trim()) >= PRESSURE_CRITICAL;
    } catch {
      // No reading: the per-process ceilings still apply
      return false;
    }
  }

  // Linux: the share of memory still available
  if (process.platform === 'linux') {
    try {
      return isLinuxMemoryCritical(readFileSync('/proc/meminfo', 'utf8'));
    } catch {
      // No reading: the per-process ceilings still apply
      return false;
    }
  }

  // Any other platform has no signal
  return false;

}


/********************************************************************
Whether a /proc/meminfo text shows the system under the floor.

@param {String} text - The meminfo file's text

@return {Boolean} - True when available memory is under the floor
*********************************************************************/
export function isLinuxMemoryCritical (text) {

  // Both fields are needed; without them there is no signal
  const total = /^MemTotal:\s*(\d+)\s*kB/m.exec(String(text));
  const available = /^MemAvailable:\s*(\d+)\s*kB/m.exec(String(text));
  if (total === null || available === null || Number(total[1]) === 0) {
    return false;
  }

  // Compare the share with the floor
  return Number(available[1]) / Number(total[1]) < LINUX_AVAILABLE_FLOOR;

}
