import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
const icon = await readFile('public/shield.svg');
for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  await sharp(icon)
    .resize(size, size)
    .png()
    .toFile(`mobile/android/app/src/main/res/mipmap-${density}/ic_launcher.png`);
}
const dir = 'mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset';
const contents = JSON.parse(await readFile(`${dir}/Contents.json`, 'utf8'));
for (const item of contents.images) {
  if (!item.filename) continue;
  const size = Math.round(Number(item.size.split('x')[0]) * Number(item.scale.replace('x', '')));
  await sharp(icon)
    .resize(size, size)
    .flatten({ background: '#19876b' })
    .png()
    .toFile(`${dir}/${item.filename}`);
}
console.log('SafeLink app icons generated.');
