#!/usr/bin/env node
// Adapted from DayuanJiang/next-ai-draw-io (99ced88e), Apache-2.0. See docs/licenses/next-ai-drawio-LICENSE.
/**
 * Downloads the draw.io web app into public/drawio.
 *
 * The app embeds this copy from its own origin. Same origin lets the page
 * call the draw.io editor directly (highlight AI changes, read the selection,
 * undo AI edits, custom toolbar), which a cross-origin iframe does not allow.
 *
 * Runs before `dev` and `build`. It does nothing when the pinned version is
 * already present. An incompatible cached version fails the build.
 *
 * The release asset (draw.war) is a zip file; it is unpacked with node:zlib
 * so no extra dependency is needed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readDrawioVersion, readZipEntries, sha256 } from './drawio-zip.mjs';

// The pinned release and the SHA-256 of its draw.war, as GitHub lists it
// (drawio-version.json in this repository)
const {
  version: DRAWIO_VERSION,
  sha256: DRAWIO_SHA256,
  downloadUrl: DOWNLOAD_URL,
} = readDrawioVersion();
const DEST = path.join(process.cwd(), 'public', 'drawio');
const STAMP = path.join(DEST, '.version');

function log(message) {
  console.log(`[fetch-drawio] ${message}`);
}

function readStamp() {
  try {
    return fs.readFileSync(STAMP, 'utf8').trim();
  } catch {
    return null;
  }
}

async function main() {
  if (
    readStamp() === DRAWIO_VERSION &&
    fs.existsSync(path.join(DEST, 'index.html'))
  )
    return;

  log(`Downloading draw.io ${DRAWIO_VERSION} ...`);
  let buf;
  try {
    const res = await fetch(DOWNLOAD_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${DOWNLOAD_URL}`);
    buf = Buffer.from(await res.arrayBuffer());
    // The copy runs on the app's own origin: it must be the real release
    const actual = sha256(buf);
    if (actual !== DRAWIO_SHA256) {
      throw new Error(`draw.war checksum mismatch (got ${actual})`);
    }
  } catch (error) {
    console.error(
      `[fetch-drawio] Could not install pinned editor: ${error.message}`
    );
    process.exit(1);
  }

  // Unpack next to the target, then swap it in
  const tmp = `${DEST}.tmp-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  let files = 0;
  for (const { name, data } of readZipEntries(buf)) {
    if (name.startsWith('WEB-INF/') || name.startsWith('META-INF/')) {
      continue;
    }
    const target = path.join(tmp, name);
    if (!target.startsWith(tmp + path.sep)) {
      throw new Error(`Unsafe path in archive: ${name}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    files++;
  }
  fs.writeFileSync(path.join(tmp, '.version'), `${DRAWIO_VERSION}\n`);

  fs.rmSync(DEST, { recursive: true, force: true });
  fs.renameSync(tmp, DEST);
  log(`Installed ${files} files into public/drawio`);
}

main().catch((error) => {
  console.error(`[fetch-drawio] ${error.stack || error}`);
  process.exit(1);
});
