import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('work/ocr-data');
await mkdir(directory, { recursive: true });
for (const lang of ['eng', 'ben']) {
  const response = await fetch(
    `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,
    { signal: AbortSignal.timeout(60000) },
  );
  if (!response.ok) throw new Error(`Cannot download ${lang} language data.`);
  await writeFile(
    resolve(directory, `${lang}.traineddata.gz`),
    Buffer.from(await response.arrayBuffer()),
  );
}
console.log(`OCR languages prepared. Set OCR_LANG_PATH=${directory} in your local .env.`);
