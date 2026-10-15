import { validateManifest, validateScene, validateStory, type Story } from './model';

export function assetUrl(path: string): string {
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.origin)).href;
}
async function read(path: string): Promise<unknown> {
  const response = await fetch(assetUrl(path));
  if (!response.ok) throw new Error(`Could not load story content (${response.status}). Please retry.`);
  return response.json();
}
export async function loadStory(): Promise<Story> {
  const manifest = await read('content/game.json'); validateManifest(manifest);
  const scenes = await Promise.all(manifest.sceneFiles.map(async (path) => {
    const scene = await read(path); validateScene(scene); return scene;
  }));
  const story = { manifest, scenes }; validateStory(story); return story;
}
