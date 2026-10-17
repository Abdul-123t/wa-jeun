import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  assert(address && typeof address === 'object');
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return address.port;
}

const port = await availablePort();
const origin = `http://127.0.0.1:${port}`;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const server = spawn(npmCommand, ['start'], {
  cwd: process.cwd(),
  env: {
    PATH: process.env.PATH,
    NODE_ENV: 'production',
    WAJEUN_CLIENT_IP_MODE: 'direct',
    PORT: String(port),
    // Keep this smoke test entirely local even when the developer has a .env.
    SUPABASE_URL: '',
    SUPABASE_SECRET_KEY: '',
    SUPABASE_SERVICE_ROLE_KEY: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverExited = false;
server.once('exit', () => { serverExited = true; });

try {
  let health;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (serverExited) throw new Error('Production server exited before becoming ready.');
    try {
      health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
      break;
    } catch {
      await delay(250);
    }
  }
  assert(health, 'Production server did not become ready.');
  assert.equal(health.status, 200, 'Production health endpoint responds successfully.');
  assert.match(health.headers.get('content-type') || '', /application\/json/i, 'Health endpoint is JSON.');
  const healthBody = await health.json();
  assert.equal(healthBody.status, 'configuration-required', 'Unconfigured production is reported as unavailable rather than using local development storage.');
  assert.equal(healthBody.storageMode, 'unconfigured-production', 'Smoke test runs production mode without Supabase credentials.');
  console.log('PASS production health endpoint (200 JSON; no Supabase connection)');

  for (const [assetPath, contentType] of [
    ['/brand/wa-jeun-logo.webp', /image\/webp/i],
    ['/brand/wa-jeun-logo.png', /image\/png/i],
    ['/brand/wa-jeun-icon-192.png', /image\/png/i],
    ['/brand/favicon.ico', /image\/vnd\.microsoft\.icon|image\/x-icon/i],
    ['/brand/favicon-32.png', /image\/png/i],
    ['/brand/favicon-16.png', /image\/png/i],
    ['/brand/apple-touch-icon.png', /image\/png/i]
  ]) {
    const response = await fetch(`${origin}${assetPath}`);
    assert.equal(response.status, 200, `Brand asset ${assetPath} is served by the production build.`);
    assert.match(response.headers.get('content-type') || '', contentType, `Brand asset ${assetPath} has the expected image type.`);
    assert.ok(Number(response.headers.get('content-length')) > 0, `Brand asset ${assetPath} is not empty.`);
  }
  console.log('PASS official logo, icon, favicon, and Apple touch icon are served by the production build');

  const registeredApi = await fetch(`${origin}/api/vendor/dashboard`);
  assert.equal(registeredApi.status, 401, 'Registered protected API route keeps its auth response.');
  assert.match(registeredApi.headers.get('content-type') || '', /application\/json/i, 'Registered API route is JSON, not the SPA.');
  console.log('PASS registered API route remains Express JSON (401)');

  const unknownApi = await fetch(`${origin}/api/does-not-exist`);
  assert.equal(unknownApi.status, 404, 'Unknown API route is not swallowed by the SPA fallback.');
  assert.match(unknownApi.headers.get('content-type') || '', /application\/json/i, 'Unknown API route returns JSON.');
  assert.equal((await unknownApi.json()).error, 'API endpoint not found.');
  console.log('PASS unknown API route returns JSON 404');

  for (const route of ['/account', '/vendor', '/admin', '/vendors/example/menu']) {
    const response = await fetch(`${origin}${route}`);
    const html = await response.text();
    assert.equal(response.status, 200, `${route} serves the SPA for direct navigation.`);
    assert.match(response.headers.get('content-type') || '', /text\/html/i, `${route} returns the SPA HTML.`);
    assert.match(html, /<div id="root"><\/div>/, `${route} serves the built app entry point.`);
    console.log(`PASS frontend deep link ${route}`);
  }
} finally {
  if (!serverExited) {
    server.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => server.once('exit', resolve)),
      delay(3000)
    ]);
    if (!serverExited) server.kill('SIGKILL');
  }
}
