import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { validateManifest, validateScene, validateStory } from '../src/content/model';
import { characterAssets } from '../src/world/characterAssets';

const publicRoot = resolve('public');
const assets = new Set<string>();
function exactPublicFile(path: string) {
  let directory = publicRoot;
  for (const part of path.split('/')) {
    if (!readdirSync(directory).includes(part)) throw new Error(`Missing or case-mismatched public file: ${path}`);
    directory = join(directory, part);
  }
  if (!statSync(directory).isFile()) throw new Error(`Public asset is not a file: ${path}`);
  assets.add(path);
}
function inspect(value: unknown) {
  if (Array.isArray(value)) { value.forEach(inspect); return; }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    if ('caption' in object) {
      if (!object.originalAsset || !object.alt) throw new Error(`Memory photo needs originalAsset and alt: ${object.label}`);
      if (!object.themedAsset && object.originalAsset !== 'assets/memories/real-austin-1-original.webp') throw new Error(`Memory photo needs a themed pair: ${object.label}`);
    }
    for (const [key, item] of Object.entries(object)) {
      if (key.endsWith('Asset') && typeof item === 'string') exactPublicFile(item);
      else inspect(item);
    }
  } else if (typeof value === 'string' && /placeholder|\[Your anniversary/i.test(value)) throw new Error(`Unfinished release content: ${value}`);
}

const manifest: unknown = JSON.parse(readFileSync(resolve('public/content/game.json'), 'utf8'));
validateManifest(manifest);
const scenes = manifest.sceneFiles.map((file) => {
  exactPublicFile(file);
  const value: unknown = JSON.parse(readFileSync(resolve('public', file), 'utf8'));
  validateScene(value); return value;
});
validateStory({ manifest, scenes });
scenes.forEach(inspect);
characterAssets.forEach((asset) => exactPublicFile(asset.path));
exactPublicFile('assets/vehicles/railcar.webp');
const inventory = JSON.parse(readFileSync(resolve('public/content/assets.json'), 'utf8')) as {
  assets: { path: string; bytes: number; width: number; height: number }[];
};
for (const path of [...assets].filter((path) => path.startsWith('assets/'))) {
  const entry = inventory.assets.find((entry) => entry.path === path);
  if (!entry || entry.bytes !== statSync(resolve(publicRoot, path)).size || !Number.isInteger(entry.width) || !Number.isInteger(entry.height) || entry.width <= 0 || entry.height <= 0) throw new Error(`Stale asset inventory for ${path}; run scripts/prepare-asset-manifest.py.`);
  const sheet = characterAssets.find((asset) => asset.path === path);
  if (sheet && (entry.width !== sheet.frameWidth * 4 || entry.height !== sheet.frameHeight * 4)) throw new Error(`Invalid character sheet dimensions: ${path}`);
}
console.log(`Validated ${scenes.length} scenes, ${scenes.reduce((n, s) => n + s.interactions.length, 0)} interactions, leader gates, safe spawns, and the scene chain.`);
console.log(`Checked ${assets.size} exact-case public files and finished photo captions/alt text.`);
