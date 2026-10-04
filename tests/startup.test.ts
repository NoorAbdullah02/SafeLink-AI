import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

test('an occupied port reports startup failure and exits unsuccessfully', { timeout: 20000 }, async () => {
  const occupied = createServer();
  await new Promise<void>((resolve, reject) => {
    occupied.once('error', reject);
    // Windows can allow separate loopback/wildcard bindings on the same port.
    // Occupy the exact address used by the entry point.
    occupied.listen(0, '0.0.0.0', () => resolve());
  });
  const address = occupied.address();
  assert(address && typeof address !== 'string');
  const childEnv: NodeJS.ProcessEnv = { ...process.env, PORT: String(address.port), DEMO_MEMORY: 'true', NODE_ENV: 'test' };
  // This is the application process, not a nested Node test worker.
  delete childEnv.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: process.cwd(),
    env: childEnv,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', (data) => { stdout += data; });
  child.stderr.on('data', (data) => { stderr += data; });
  const timer = setTimeout(() => child.kill(), 15000);
  try {
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    assert.equal(exitCode, 1, stderr);
    assert.match(stderr, /failed to start.*EADDRINUSE/);
    assert(!stdout.includes('SafeLink API http://'));
  } finally {
    clearTimeout(timer);
    child.kill();
    await new Promise<void>((resolve) => occupied.close(() => resolve()));
  }
});
