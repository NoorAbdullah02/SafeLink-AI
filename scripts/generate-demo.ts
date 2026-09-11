import { mkdir } from 'node:fs/promises';
import QRCode from 'qrcode';
import sharp from 'sharp';
await mkdir('demo-assets', { recursive: true });
await QRCode.toFile('demo-assets/controlled-qr.png', 'https://bkash-verify.example/login', {
  width: 650,
  margin: 4,
});
const svg = `<svg width="1200" height="760" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="760" fill="#f5f7fa"/><rect x="70" y="70" width="1060" height="620" rx="25" fill="white"/><g font-family="Arial" fill="#182b35"><text x="120" y="155" font-size="32" font-weight="bold">SafeLink AI - Controlled OCR Test</text><text x="120" y="245" font-size="35">Apnar bKash account bondho hoye jabe!</text><text x="120" y="315" font-size="35">Ekhoni apnar PIN din.</text><text x="120" y="385" font-size="35">https://bkash-verify.example/login</text><text x="120" y="520" font-size="23">Reserved example domain. No real malicious URL.</text><text x="120" y="570" font-size="23">This screenshot uses the normal OCR and risk engine.</text></g></svg>`;
await sharp(Buffer.from(svg)).png().toFile('demo-assets/controlled-message.png');
console.log('Controlled QR and OCR images created.');
