import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { readImage, recognizeScreenshot } from '../server/media.js';
test('actual QR decoding returns the encoded destination', async () => {
  const url = 'https://bkash-verify.example/login';
  const buffer = await QRCode.toBuffer(url, { width: 500, margin: 4 });
  assert.equal(await readImage(buffer, 'qr'), url);
});
test('QR content need not be a URL', async () => {
  const text = 'Meet at the library at 5pm';
  const buffer = await QRCode.toBuffer(text, { width: 500 });
  assert.equal(await readImage(buffer, 'qr'), text);
});

test('OCR deadline includes initialization and terminates a worker created too late', async () => {
  let stopped = 0, recognizeCalls = 0;
  const worker = {
    recognize: async () => { recognizeCalls++; return { data: { text: 'Test text' } }; },
    terminate: async () => { stopped++; },
  };
  let release: ((value: typeof worker) => void) | undefined;
  const pending = new Promise<typeof worker>((resolve) => { release = resolve; });
  await assert.rejects(recognizeScreenshot(Buffer.from('sample'), () => pending, 20), /OCR timed out/);
  release!(worker);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(stopped, 1);
  assert.equal(recognizeCalls, 0);
});

test('OCR terminates its worker after a recognition failure', async () => {
  let stopped = false;
  await assert.rejects(recognizeScreenshot(Buffer.from('sample'), async () => ({
    recognize: async () => { throw new Error('Controlled recognition failure'); },
    terminate: async () => { stopped = true; },
  })), /Controlled recognition failure/);
  assert.equal(stopped, true);
});
