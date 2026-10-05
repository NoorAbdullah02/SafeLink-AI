import sharp from 'sharp';
import jsQR from 'jsqr';
import { createWorker } from 'tesseract.js';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
let languageReady: Promise<string> | undefined;
function languageDirectory() {
  if (process.env.OCR_LANG_PATH) return Promise.resolve(resolve(process.env.OCR_LANG_PATH));
  if (!languageReady)
    languageReady = (async () => {
      const directory = resolve(tmpdir(), 'safelink-ocr-v1');
      await mkdir(directory, { recursive: true });
      for (const code of ['eng', 'ben']) {
        const file = resolve(directory, `${code}.traineddata.gz`);
        try {
          await access(file);
          continue;
        } catch {
          /* Download trusted public language data, never user content. */
        }
        const response = await fetch(
          `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${code}/4.0.0_best_int/${code}.traineddata.gz`,
          { signal: AbortSignal.timeout(15000) },
        );
        if (!response.ok)
          throw new Error(
            'OCR language download unavailable. Preload language files or paste the text.',
          );
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
      }
      return directory;
    })().catch((error) => {
      languageReady = undefined;
      throw error;
    });
  return languageReady;
}
let active = 0;
type OCRWorker = {
  recognize(image: Buffer): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
};
export async function recognizeScreenshot(
  image: Buffer,
  workerFactory: () => Promise<OCRWorker> = async () => createWorker(['eng', 'ben'], 1, {
    langPath: await languageDirectory(),
    errorHandler: () => {},
    cacheMethod: 'readOnly',
  }),
  timeoutMs = 30000,
): Promise<string> {
  let worker: OCRWorker | undefined;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        worker = await workerFactory();
        // Initialization can finish after the request deadline. Stop that worker too.
        if (expired) {
          await worker.terminate();
          throw new Error('OCR initialization timed out.');
        }
        const data = await worker.recognize(image);
        const text = data.data.text.trim();
        if (text.length < 3)
          throw new Error('No readable text found. Try a clearer screenshot or paste the text.');
        return text.slice(0, 10000);
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error('OCR timed out. Try a smaller, clearer screenshot or paste the text.'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (!expired && worker) await worker.terminate();
    else if (worker) void worker.terminate().catch(() => {});
    expired = true;
  }
}
export async function readImage(buffer: Buffer, kind: 'qr' | 'screenshot'): Promise<string> {
  if (active >= 2)
    throw Object.assign(new Error('Image scanner is busy. Please try again shortly.'), {
      status: 429,
    });
  active++;
  try {
    const meta = await sharp(buffer, { limitInputPixels: 12000000 }).metadata();
    if (!['png', 'jpeg', 'webp'].includes(meta.format || ''))
      throw new Error('Use a PNG, JPEG or WebP image.');
    if (kind === 'qr') {
      const { data, info } = await sharp(buffer, { limitInputPixels: 12000000 })
        .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      if (!decoded?.data)
        throw new Error('No readable QR code found. Use a clear, uncropped image.');
      return decoded.data;
    }
    const image = await sharp(buffer, { limitInputPixels: 12000000 })
      .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
    return await recognizeScreenshot(image);
  } finally {
    active--;
  }
}
