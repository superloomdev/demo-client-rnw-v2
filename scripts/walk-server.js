// Info: Receives walker reports and holds the current walk command.
// `POST /report` writes the JSON body to `<out>/<platform>-<theme>[-<family>].json`
// and answers 200 with the file name; `GET /health` answers 200; `GET /reports`
// lists what was received. `POST /command` stores `{ theme, family }` (or
// `null`) and `GET /command` returns it: an app in autopilot mode polls it
// instead of receiving a deep link (iOS confirms custom-scheme links with a
// dialog no simulator command can tap). CORS is open so the web walker (a
// different origin) can post. Used by the native gate on CI and by the web
// e2e walker test.
//
// Usage: node scripts/walk-server.js [--port 8787] [--out test-results/walk]

import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = function (flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
};
const PORT = Number(arg('--port', '8787'));
const OUT = resolve(arg('--out', 'test-results/walk'));
const received = [];
let command = null;

mkdirSync(OUT, { recursive: true });

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type'
};


const server = createServer(function (req, res) {

  const path = req.url.split('?')[0];

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // Health and the received list
  if (req.method === 'GET' && path === '/health') {
    res.writeHead(200, Object.assign({ 'content-type': 'text/plain' }, CORS));
    res.end('ok');
    return;
  }
  if (req.method === 'GET' && path === '/reports') {
    res.writeHead(200, Object.assign({ 'content-type': 'application/json' }, CORS));
    res.end(JSON.stringify(received));
    return;
  }

  // The current command
  if (req.method === 'GET' && path === '/command') {
    res.writeHead(200, Object.assign({ 'content-type': 'application/json' }, CORS));
    res.end(JSON.stringify(command));
    return;
  }
  if (req.method === 'POST' && path === '/command') {
    let body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });
    req.on('end', function () {
      try {
        command = JSON.parse(body);
      } catch {
        res.writeHead(400, CORS);
        res.end('body is not JSON');
        return;
      }
      process.stdout.write('walk-server: command ' + JSON.stringify(command) + '\n');
      res.writeHead(200, Object.assign({ 'content-type': 'application/json' }, CORS));
      res.end(JSON.stringify(command));
    });
    return;
  }

  // A report
  if (req.method === 'POST' && path === '/report') {
    let body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });
    req.on('end', function () {
      let report;
      try {
        report = JSON.parse(body);
      } catch {
        res.writeHead(400, CORS);
        res.end('body is not JSON');
        return;
      }
      const name = [report.platform, report.theme].concat(report.family ? [report.family] : []).join('-') + '.json';
      writeFileSync(join(OUT, name), JSON.stringify(report, null, 2) + '\n');
      received.push(name);
      process.stdout.write('walk-server: received ' + name + '\n');
      res.writeHead(200, Object.assign({ 'content-type': 'application/json' }, CORS));
      res.end(JSON.stringify({ received: name }));
    });
    return;
  }

  res.writeHead(404, CORS);
  res.end('not found');

});

server.listen(PORT, function () {
  process.stdout.write('walk-server listening on http://localhost:' + PORT + ' -> ' + OUT + '\n');
});
