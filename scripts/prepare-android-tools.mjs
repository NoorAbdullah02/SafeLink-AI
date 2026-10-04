import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Portable, checksum-pinned official dependencies. No machine settings change.
// Android SDK download/use requires the owner's agreement to Google's SDK terms.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'work', 'android-downloads');
const packages = [
  {
    name: 'OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip',
    url: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip',
    sha256: 'e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0',
    source:
      'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows',
  },
  {
    name: 'commandlinetools-win-15859902_latest.zip',
    url: 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip',
    sha256: '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a',
    source: 'https://developer.android.com/studio',
  },
  {
    name: 'gradle-9.3.1-all.zip',
    url: 'https://services.gradle.org/distributions/gradle-9.3.1-all.zip',
    sha256: '17f277867f6914d61b1aa02efab1ba7bb439ad652ca485cd8ca6842fccec6e43',
    source: 'https://services.gradle.org/distributions/gradle-9.3.1-all.zip.sha256',
  },
];

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function download(item) {
  const destination = path.join(directory, item.name);
  try {
    if ((await digest(destination)) === item.sha256) {
      console.log(`${item.name}: existing archive checksum verified`);
      return;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const response = await fetch(item.url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok || !response.body) throw new Error(`${item.name}: HTTP ${response.status}`);
  const temporary = `${destination}.part`;
  let received = 0;
  let lastProgress = Date.now();
  const progress = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (Date.now() - lastProgress >= 15_000) {
        console.log(`${item.name}: ${(received / 1_048_576).toFixed(1)} MiB received`);
        lastProgress = Date.now();
      }
      callback(null, chunk);
    },
  });
  console.log(`Downloading ${item.name} from official distribution`);
  await pipeline(Readable.fromWeb(response.body), progress, createWriteStream(temporary));
  if ((await digest(temporary)) !== item.sha256)
    throw new Error(`${item.name}: checksum mismatch; archive was not installed`);
  await rename(temporary, destination);
  console.log(`${item.name}: ${(received / 1_048_576).toFixed(1)} MiB, SHA-256 verified`);
}

await mkdir(directory, { recursive: true });
await Promise.all(packages.map(download));
await writeFile(
  path.join(directory, 'sources.json'),
  JSON.stringify({ checkedAt: new Date().toISOString(), packages }, null, 2),
);
console.log(`Verified archives saved to ${directory}`);
