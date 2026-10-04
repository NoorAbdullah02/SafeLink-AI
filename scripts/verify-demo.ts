import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demos } from '../shared/types.js';
import { localScan } from '../server/engine.js';
import { readImage } from '../server/media.js';

// Controlled integration checks, not an accuracy evaluation or live provider test.
const localLanguages = resolve('work/ocr-data');
if (!process.env.OCR_LANG_PATH) {
  try {
    await access(resolve(localLanguages, 'eng.traineddata.gz'));
    await access(resolve(localLanguages, 'ben.traineddata.gz'));
    process.env.OCR_LANG_PATH = localLanguages;
  } catch {
    throw new Error(
      'Run pnpm ocr:prepare first, or set OCR_LANG_PATH to preloaded language files.',
    );
  }
}
const results = demos.map((sample) => {
  const result = localScan(sample.text, sample.kind);
  return {
    title: sample.title,
    score: result.score,
    level: result.level,
    evidence: result.evidence.map((item) => item.id),
  };
});
assert(results[0].evidence.includes('credentials'));
assert(results[1].evidence.includes('prize'));
assert(results[2].evidence.some((id) => id.startsWith('brand:')));
assert.equal(results[3].score, 0);

const qr = await readImage(await readFile('demo-assets/controlled-qr.png'), 'qr');
assert.equal(qr, 'https://bkash-verify.example/login');
const screenshot = await readImage(
  await readFile('demo-assets/controlled-message.png'),
  'screenshot',
);
assert.match(screenshot, /PIN/i);
assert.match(screenshot, /bkash-verify\.example/i);
const qrResult = localScan(qr, 'qr');
const screenshotResult = localScan(screenshot, 'screenshot');
assert(screenshotResult.evidence.some((item) => item.id === 'credentials'));
console.log(
  JSON.stringify(
    {
      purpose: 'Controlled demo integration only; no accuracy measurement',
      externalProviders: 'Not called',
      examples: results,
      qr: { decoded: qr, score: qrResult.score, level: qrResult.level },
      screenshot: {
        extractedPinAndDomain: true,
        score: screenshotResult.score,
        level: screenshotResult.level,
        evidence: screenshotResult.evidence.map((item) => item.id),
      },
    },
    null,
    2,
  ),
);
