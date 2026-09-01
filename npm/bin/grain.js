#!/usr/bin/env node
'use strict';

// Launcher: ensure the platform binary is present (download on first run if the
// postinstall was skipped or offline), then exec it, forwarding args + exit code.

const { spawn } = require('child_process');
const { ensure } = require('../lib/binary');

ensure().then((bin) => {
  const child = spawn(bin, process.argv.slice(2), { stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code == null ? 1 : code);
  });
  child.on('error', (err) => {
    console.error('grain: failed to run binary: ' + err.message);
    process.exit(1);
  });
}).catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
