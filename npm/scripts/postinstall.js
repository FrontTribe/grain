'use strict';

// Best-effort: pre-fetch the binary at install time so the first run is instant.
// NEVER fail the install — bin/grain.js downloads on first run if this is skipped
// (e.g. `npm install --ignore-scripts`) or the network is unavailable here.

const { ensure } = require('../lib/binary');

ensure().then(
  function () {},
  function (err) {
    console.warn('grain: could not pre-download the binary (' + (err && err.message ? err.message : err) + ').');
    console.warn('grain: it will be fetched automatically on first run.');
  }
);
