import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { readImage } from '../server/media.js';
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
