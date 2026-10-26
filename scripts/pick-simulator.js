// Info: Reads `xcrun simctl list devices available -j` on stdin and prints
// the UDID of the first available iPhone on the newest iOS runtime. For
// `ipad` it prints the first available `iPad Pro 11-inch` on the newest
// runtime that has one - the web references walk its 834/1194 room, so no
// other iPad gives a fair walk. The native gate uses it instead of naming
// a device, because a runner image's simulator set changes between image
// versions.

let input = '';
process.stdin.on('data', function (chunk) {
  input += chunk;
});
process.stdin.on('end', function () {

  // No simulator list means no Xcode simulator runtime on this machine
  if (input.trim() === '') {
    process.stderr.write('pick-simulator: empty input; run with `xcrun simctl list devices available -j |`\n');
    process.exit(1);
  }

  // Rank the iOS runtimes newest first by their version in the identifier
  const devices = JSON.parse(input).devices;
  const version = function (runtime) {
    const match = runtime.match(/iOS-(\d+)-(\d+)/);
    return match ? Number(match[1]) * 1000 + Number(match[2]) : -1;
  };
  const runtimes = Object.keys(devices).filter(function (runtime) {
    return version(runtime) >= 0;
  }).sort(function (a, b) {
    return version(b) - version(a);
  });

  // Take the first available device of the requested kind
  const kind = process.argv[2] === 'ipad' ? 'iPad Pro 11-inch' : 'iPhone';
  for (const runtime of runtimes) {
    const phone = devices[runtime].find(function (device) {
      return device.isAvailable !== false && device.name.indexOf(kind) === 0;
    });
    if (phone) {
      process.stderr.write('pick-simulator: ' + phone.name + ' (' + runtime + ')\n');
      process.stdout.write(phone.udid + '\n');
      return;
    }
  }

  process.stderr.write(process.argv[2] === 'ipad'
    ? 'pick-simulator: no iPad Pro 11-inch simulator (the web references walk its 834/1194 room)\n'
    : 'pick-simulator: no available ' + kind + ' simulator\n');
  process.exit(1);

});
