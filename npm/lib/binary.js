'use strict';

// Resolves and downloads the prebuilt grain binary for the current platform
// from GitHub Releases. Shared by the postinstall pre-fetch and the bin launcher.

const https = require('https');
const fs = require('fs');
const path = require('path');

const VERSION = require('../package.json').version;
const REPO = 'kresimirgalic/grain';

// Map Node's platform/arch to the release asset naming (Go's GOOS/GOARCH).
function target() {
  const os = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[process.platform];
  const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
  if (!os || !arch) return null;
  const ext = os === 'windows' ? '.exe' : '';
  return { os, arch, ext, asset: `grain-${os}-${arch}${ext}` };
}

function binPath() {
  const t = target();
  const name = 'grain' + (t && t.ext ? t.ext : '');
  return path.join(__dirname, '..', 'vendor', name);
}

// GitHub release downloads redirect to a CDN, so follow redirects manually.
function download(url, dest, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    if (redirects > 10) return reject(new Error('too many redirects'));
    const req = https.get(url, { headers: { 'User-Agent': 'grain-npm', Accept: 'application/octet-stream' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return download(res.headers.location, dest, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      }
      const tmp = dest + '.download';
      const file = fs.createWriteStream(tmp);
      res.pipe(file);
      file.on('finish', () => file.close(() => {
        try { fs.renameSync(tmp, dest); resolve(); } catch (e) { reject(e); }
      }));
      file.on('error', (e) => { try { fs.unlinkSync(tmp); } catch (_) {} reject(e); });
    });
    req.on('error', reject);
  });
}

// Ensure the binary exists locally, downloading it if needed. Returns its path.
async function ensure() {
  const t = target();
  if (!t) {
    throw new Error(
      'grain: unsupported platform ' + process.platform + '/' + process.arch +
      '. Build from source: https://github.com/' + REPO
    );
  }
  const dest = binPath();
  if (fs.existsSync(dest)) return dest;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const url = 'https://github.com/' + REPO + '/releases/download/v' + VERSION + '/' + t.asset;
  await download(url, dest);
  if (t.ext !== '.exe') fs.chmodSync(dest, 0o755);
  return dest;
}

module.exports = { ensure, binPath, target, VERSION, REPO };
