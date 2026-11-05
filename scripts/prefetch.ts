/**
 * Download bundled data so the app (and especially Case Files) works offline.
 *
 *   NODE_USE_ENV_PROXY=1 npm run prefetch            # everything
 *   NODE_USE_ENV_PROXY=1 npm run prefetch -- points  # only points | regions | images
 *
 * Writes public/data/demo/** and public/data/manifest.json.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_CODES } from '../src/data/catalog';
import { gibsSnapshotUrl, gibsTileUrl, GIBS_LAYERS, OFFLINE_TILE_MAX_ZOOM } from '../src/data/gibs';
import type { Manifest } from '../src/data/loader';
import { FIRST_YEAR, fetchPointLive, fetchRegionalLive, lastCompleteYear } from '../src/data/power';
import { CASE_IMAGES } from '../src/content/caseImages';
import { PRESETS, TREND_REGIONS } from '../src/content/places';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data');
const only = process.argv[2];
const END = lastCompleteYear();

async function writeJson(rel: string, obj: unknown) {
  const p = join(DATA, rel);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(obj));
  return p;
}

async function loadManifest(): Promise<Manifest> {
  const p = join(DATA, 'manifest.json');
  if (existsSync(p)) return JSON.parse(await readFile(p, 'utf8')) as Manifest;
  return { generatedAt: '', apiVersion: '', points: [], regions: [], images: [] };
}

async function main() {
  const manifest = await loadManifest();

  if (!only || only === 'points') {
    manifest.points = [];
    for (const p of PRESETS) {
      const req = { lat: p.lat, lon: p.lon, params: ALL_CODES, start: FIRST_YEAR, end: END };
      process.stdout.write(`point ${p.id} … `);
      const d = await fetchPointLive(req);
      const file = `demo/points/${p.id}.json`;
      await writeJson(file, d);
      manifest.apiVersion = d.apiVersion;
      manifest.points.push({ id: p.id, lat: d.lat, lon: d.lon, file, start: d.start, end: d.end, params: Object.keys(d.params) });
      console.log(`ok (${d.end}, elev ${d.elevation} m)`);
    }
  }

  if (!only || only === 'regions') {
    manifest.regions = [];
    for (const r of TREND_REGIONS) {
      for (const param of r.params) {
        process.stdout.write(`region ${r.id} ${param} … `);
        const d = await fetchRegionalLive({ bbox: r.bbox, param, start: FIRST_YEAR, end: END });
        const file = `demo/regions/${r.id}-${param}.json`;
        await writeJson(file, d);
        manifest.regions.push({ id: `${r.id}-${param}`, param, bbox: d.bbox, file, start: d.start, end: d.end });
        console.log(`ok (${d.lats.length}×${d.lons.length} cells)`);
      }
    }
  }

  if (!only || only === 'images') {
    manifest.images = [];
    for (const img of CASE_IMAGES) {
      for (const date of img.dates) {
        const url = gibsSnapshotUrl(img.bbox, date, { width: 1000 });
        process.stdout.write(`image ${img.id} ${date} … `);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`GIBS ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const file = `demo/images/${img.id}-${date}.jpg`;
        const p = join(DATA, file);
        await mkdir(dirname(p), { recursive: true });
        await writeFile(p, buf);
        manifest.images.push({ id: `${img.id}-${date}`, file, date, layer: GIBS_LAYERS.modisTerra.id, bbox: img.bbox });
        console.log(`ok (${(buf.length / 1024).toFixed(0)} kB)`);
      }
    }
  }

  if (!only || only === 'tiles') {
    // Blue Marble z0–OFFLINE_TILE_MAX_ZOOM so the globe is never black without Wi-Fi.
    const jobs: [number, number, number][] = [];
    for (let z = 0; z <= OFFLINE_TILE_MAX_ZOOM; z++) for (let y = 0; y < 2 ** z; y++) for (let x = 0; x < 2 ** z; x++) jobs.push([z, y, x]);
    let done = 0;
    let bytes = 0;
    const worker = async () => {
      for (;;) {
        const job = jobs.shift();
        if (!job) return;
        const [z, y, x] = job;
        const url = gibsTileUrl(GIBS_LAYERS.blueMarble).replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x));
        const res = await fetch(url);
        if (!res.ok) throw new Error(`GIBS tile ${z}/${y}/${x}: ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const p = join(DATA, `demo/tiles/bm/${z}/${y}/${x}.jpeg`);
        await mkdir(dirname(p), { recursive: true });
        await writeFile(p, buf);
        bytes += buf.length;
        done++;
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    console.log(`tiles: ${done} Blue Marble tiles (${(bytes / 1048576).toFixed(1)} MB)`);
  }

  manifest.generatedAt = new Date().toISOString();
  await writeJson('manifest.json', manifest);
  console.log('manifest written:', manifest.points.length, 'points,', manifest.regions.length, 'regions,', manifest.images.length, 'images');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
