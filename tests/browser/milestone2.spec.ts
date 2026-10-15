import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Point, PuzzleInteraction, RailwayInteraction, SceneDefinition } from '../../src/content/model';
import { clearLine, isSafe } from '../../src/world/geometry';

const manifest = JSON.parse(readFileSync('public/content/game.json', 'utf8'));
const scenes: SceneDefinition[] = manifest.sceneFiles.map((file: string) => JSON.parse(readFileSync('public/' + file, 'utf8')));
const railway = scenes.find((scene) => scene.id === 'korea-railway')!.interactions[0] as RailwayInteraction;
const garage = scenes.find((scene) => scene.id === 'austin-francine')!.interactions.find((interaction) => interaction.kind === 'vehicle-exit')!;
const madeira = scenes.find((scene) => scene.id === 'madeira')!;
const finale = madeira.interactions.find((interaction) => interaction.kind === 'ending')!;
const madeiraPath = { leftTop: 150, leftBottom: 265, center: 485, rightTop: 790, top: 155, bottom: 360 };
type Debug = {
  mode: string; sceneId: string; leaderId: string; target: string | null; flags: string[]; completed: string[];
  leader: { x: number; y: number }; follower: { x: number; y: number };
  counters: Record<string, number>; scrapbookPages: Record<string, number>; puzzleSelections: Record<string, string[]>;
  travelMode: string; vehicleId: string | null; railwayId: string | null;
  vehicle: { x: number; y: number } | null; railway: { x: number; y: number } | null;
  directions: Record<string, string>; bouquet: { x: number; y: number; depth: number } | null;
};
async function state(page: Page): Promise<Debug> {
  await expect(page.locator('canvas')).toHaveAttribute('data-debug', /.+/);
  return JSON.parse((await page.locator('canvas').getAttribute('data-debug'))!);
}
async function readTo(page: Page, target: string) {
  await page.goto('./?reader=1');
  await expect(page.getByRole('heading', { name: 'Read our story', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  for (const scene of scenes) {
    if (scene.id === target) break;
    for (const interaction of scene.interactions) {
      await page.locator('[data-action="reader-open"][data-interaction-id="' + interaction.id + '"]').click();
      await page.getByRole('button', { name: 'Mark this stop read', exact: true }).click();
    }
    await page.locator('[data-action="advance"]').click();
  }
  await expect(page.locator('#chapter-title')).toHaveText('Our dreamy GN world');
  await page.getByRole('button', { name: 'Return to the map', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(async () => (await state(page)).sceneId).toBe(target);
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  await expect(page.locator('#interaction-title')).toHaveText(scenes.find((scene) => scene.id === target)!.title);
  await expect(page.locator('#interaction-description')).toHaveText('Walk to an E marker, then press E or click.');
}
async function guide(page: Page) {
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.getByRole('button', { name: 'Bring us to the next dreamy stop' }).click();
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
}
async function next(page: Page, scene: string) {
  await page.locator('[data-action="advance"]').click();
  await expect.poll(async () => (await state(page)).sceneId).toBe(scene);
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  await expect(page.locator('#chapter-title')).toHaveText('Our dreamy GN world');
}
async function memory(page: Page, asset?: RegExp) {
  await guide(page);
  const target = (await state(page)).target;
  const interaction = scenes.flatMap((scene) => scene.interactions).find((item) => item.id === target);
  if (interaction?.requiredLeaderId && interaction.requiredLeaderId !== (await state(page)).leaderId) await page.keyboard.press('q');
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).mode).toMatch(/^(speaking|reading)$/);
  if ((await state(page)).mode === 'speaking') await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.memory-picture img')).toHaveCount(1);
  if (asset) await expect(page.locator('.memory-picture img')).toHaveAttribute('src', asset);
  await expect(page.locator('.photo-navigation')).toHaveCount(0);
  await page.keyboard.press('e');
}
async function remainingMemories(page: Page, sceneId: string) {
  const scene = scenes.find((item) => item.id === sceneId)!;
  for (const interaction of scene.interactions) {
    if ((await state(page)).flags.includes(interaction.setsFlag)) continue;
    await memory(page, 'memory' in interaction && interaction.memory
      ? new RegExp((interaction.memory.themedAsset ?? interaction.memory.originalAsset)!.replaceAll('.', '\\.') + '$')
      : undefined);
  }
  await expect.poll(async () => (await state(page)).mode).toBe('checkpoint');
}
// Follow the authored curved road and its shoulders, with room for real keyboard stopping, rather than cutting through the gardens.
function madeiraRoute(start: Point, destination: Point): Point[] {
  const key = (point: Point) => `${point.x},${point.y}`;
  const walkable = (point: Point) => [[0, 0], [-4, 0], [4, 0], [0, -4], [0, 4]]
    .every(([dx, dy]) => isSafe({ x: point.x + dx, y: point.y + dy }, madeira.obstacles));
  const anchor = (point: Point) => {
    const candidates = [-10, -5, 0, 5, 10].flatMap((dx) => [-10, -5, 0, 5, 10]
      .map((dy) => ({ x: Math.round(point.x / 5) * 5 + dx, y: Math.round(point.y / 5) * 5 + dy })))
      .filter((candidate) => {
        // A real foot can rest exactly against a wall; leave that shared edge into the clear road.
        const departure = { x: point.x + (candidate.x - point.x) * .001, y: point.y + (candidate.y - point.y) * .001 };
        return walkable(candidate) && isSafe(departure, madeira.obstacles) && clearLine(departure, candidate, madeira.obstacles);
      });
    const nearest = candidates.sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
    if (!nearest) throw new Error('No safe Madeira road anchor');
    return nearest;
  };
  const first = anchor(start); const last = anchor(destination);
  const queue = [first]; const previous = new Map<string, Point | null>([[key(first), null]]);
  for (let index = 0; index < queue.length && !previous.has(key(last)); index++) {
    const current = queue[index];
    for (const [dx, dy] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (!previous.has(key(next)) && walkable(next) && clearLine(current, next, madeira.obstacles)) {
        previous.set(key(next), current); queue.push(next);
      }
    }
  }
  if (!previous.has(key(last))) throw new Error('No path along the Madeira road');
  const steps: Point[] = [];
  for (let point: Point | null = last; point; point = previous.get(key(point))!) steps.unshift(point);
  const turns = steps.filter((point, index) => index === 0 || index === steps.length - 1
    || steps[index - 1].x !== steps[index + 1].x && steps[index - 1].y !== steps[index + 1].y);
  return [...turns, destination];
}
async function moveTo(page: Page, x: number, y: number, actor: 'leader' | 'vehicle' = 'leader') {
  const before = await state(page);
  const route = before.sceneId === 'madeira' && actor === 'leader'
    ? madeiraRoute(before.leader, { x, y }) : [{ x, y }];
  for (const point of route) await moveDirect(page, point.x, point.y, actor);
}
async function moveDirect(page: Page, x: number, y: number, actor: 'leader' | 'vehicle') {
  for (const axis of ['x', 'y'] as const) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const delta = (axis === 'x' ? x : y) - (await state(page))[actor]![axis];
      if (Math.abs(delta) < 5) break;
      const key = axis === 'x' ? delta > 0 ? 'd' : 'a' : delta > 0 ? 's' : 'w';
      await page.keyboard.down(key);
      try {
        await page.waitForFunction(({ axis, goal, sign, actor }) => {
          const debug = JSON.parse(document.querySelector('canvas')!.dataset.debug!);
          return (debug[actor][axis] - goal) * sign >= -3;
        }, { axis, goal: axis === 'x' ? x : y, sign: Math.sign(delta), actor });
      } finally { await page.keyboard.up(key); }
      await page.waitForTimeout(80);
    }
  }
  await expect.poll(async () => Math.hypot((await state(page))[actor]!.x - x, (await state(page))[actor]!.y - y)).toBeLessThan(18);
}
async function clickObject(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * x / 960, box.y + box.height * y / 540);
}
async function visitPhoto(page: Page, id: string, actor: 'leader' | 'vehicle' = 'leader') {
  const interaction = scenes.flatMap((scene) => scene.interactions).find((item) => item.id === id)!;
  await moveTo(page, interaction.approach.x, interaction.approach.y, actor);
  await clickObject(page, interaction.position.x, interaction.position.y);
  await expect.poll(async () => (await state(page)).mode).toMatch(/^(speaking|reading)$/);
  if ((await state(page)).mode === 'speaking') await page.keyboard.press('e');
  await expect(page.locator('.memory-picture img')).toHaveCount(1);
  const memory = 'memory' in interaction ? interaction.memory : undefined;
  if (!memory) throw new Error('Expected a photo at ' + id);
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', new RegExp((memory.themedAsset ?? memory.originalAsset)!.replaceAll('.', '\\.') + '$'));
  await page.keyboard.press('e');
}
async function park(page: Page) {
  await moveTo(page, garage.approach.x, garage.approach.y, 'vehicle');
  await clickObject(page, garage.position.x, garage.position.y);
  await expect.poll(async () => (await state(page)).travelMode).toBe('walking');
}
async function decodedPhoto(page: Page) {
  const image = page.locator('.memory-picture img');
  await expect(image).toHaveCount(1);
  await expect.poll(async () => image.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await image.evaluate((element) => (element as HTMLImageElement).decode());
}
const smurf = scenes.find((scene) => scene.id === 'korea-smurf')!.interactions[0] as PuzzleInteraction;
function floorPosition(letter: string) {
  const index = smurf.letters.indexOf(letter);
  return { x: 314 + index % 5 * 74, y: 181 + Math.floor(index / 5) * 54 };
}
async function floorLetter(page: Page, letter: string, keyboard = false) {
  const position = floorPosition(letter);
  await moveTo(page, position.x, position.y);
  if (keyboard) await page.keyboard.press('e'); else await clickObject(page, position.x, position.y);
}
async function finishBook(page: Page) {
  await guide(page); await page.keyboard.press('e');
  await expect(page.locator('.scrapbook-page-number')).toHaveText('Page 1 of 5');
  const stationary = (await state(page)).leader; const leader = (await state(page)).leaderId;
  for (let pageIndex = 1; pageIndex < 5; pageIndex++) {
    await page.keyboard.press('d');
    await expect(page.locator('.scrapbook-page-number')).toHaveText('Page ' + (pageIndex + 1) + ' of 5');
    if (pageIndex === 1 || pageIndex === 4) {
      await expect.poll(async () => page.locator('.memory-picture img').evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
      await page.locator('.memory-picture img').evaluate((image) => (image as HTMLImageElement).decode());
      await page.screenshot({ path: 'art-work/qa/norway-page-' + (pageIndex + 1) + '.png', fullPage: true });
    }
  }
  expect((await state(page)).leaderId).toBe(leader);
  expect((await state(page)).leader).toEqual(stationary);
  await page.keyboard.press('e');
}

test('complete revised journey: every pedal moves, map puzzle, distinct photos, five-page book and merged Austin', async ({ page }) => {
  test.setTimeout(150000);
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await readTo(page, 'korea-railway');
  await guide(page); await page.keyboard.press('q'); await page.keyboard.press('e');
  await expect(page.locator('#speech-bubble')).toContainText("I'm tired :(");
  expect((await state(page)).railwayId).toBeNull();
  await page.keyboard.press('q'); await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).travelMode).toBe('railway');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-rail-2-themed\.webp$/);
  expect((await state(page)).counters['railway-car'] ?? 0).toBe(0);
  await decodedPhoto(page);
  await page.screenshot({ path: 'art-work/qa/railway-boarding-zero-pedals.png', fullPage: true });
  await test.info().attach('railway-boarding-state', { body: JSON.stringify(await state(page)), contentType: 'application/json' });
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  const initialRail = (await state(page)).railway!;
  await page.keyboard.down('e'); await page.keyboard.down('e'); await page.waitForTimeout(80);
  expect((await state(page)).counters['railway-car']).toBe(1);
  await page.keyboard.up('e');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Read our story at your pace' }).click();
  await page.getByRole('button', { name: 'Return to the map', exact: true }).click();
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect((await state(page)).counters['railway-car']).toBe(1);
  expect((await state(page)).railway!.x).toBeCloseTo(initialRail.x + 57.5, 0);
  for (let count = 2; count <= 12; count++) {
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).counters['railway-car']).toBe(count);
    await expect.poll(async () => (await state(page)).mode).toBe(count % 4 === 0 ? 'reading' : 'exploring');
    expect((await state(page)).railway!.x).toBeCloseTo(initialRail.x + count * 57.5, 0);
    if (count % 4 === 0) {
      await expect(page.locator('.memory-picture img')).toHaveCount(1);
      const stop = railway.stops[count / 4 - 1];
      await expect(page.locator('.memory-picture img')).toHaveAttribute('src', new RegExp(stop.memory.themedAsset!.replaceAll('.', '\\.') + '$'));
      if (count === 12) {
        await expect(page.getByRole('heading', { name: stop.memory.label, exact: true })).toBeVisible();
        expect((await state(page)).travelMode).toBe('walking');
        expect((await state(page)).railwayId).toBeNull();
        await decodedPhoto(page);
        await page.screenshot({ path: 'art-work/qa/railway-final-photo-on-foot.png', fullPage: true });
        await test.info().attach('railway-last-photo-state', { body: JSON.stringify(await state(page)), contentType: 'application/json' });
      } else expect((await state(page)).travelMode).toBe('railway');
      await expect(page.locator('.picture-toggle-hint')).toContainText('Click the picture to view the original');
      await page.keyboard.press('e');
      await expect.poll(async () => (await state(page)).mode).toBe(count === 12 ? 'checkpoint' : 'exploring');
    }
  }
  expect((await state(page)).flags).toContain('railway-finished');
  await next(page, 'korea-smurf');
  await guide(page); await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect.poll(async () => (await state(page)).puzzleSelections['smurf-floor']).toEqual(['K']);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).puzzleSelections['smurf-floor']).toEqual([]);
  await floorLetter(page, 'A');
  for (const letter of smurf.solution) await floorLetter(page, letter);
  expect((await state(page)).flags).not.toContain('smurf-solved');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await floorLetter(page, 'A');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-smurf-themed\.webp$/);
  await page.keyboard.press('e');
  await next(page, 'korea-petite-france');
  await remainingMemories(page, 'korea-petite-france');
  await next(page, 'austin-museum');
  await memory(page); await memory(page);
  await guide(page);
  if ((await state(page)).leaderId !== 'person-a') await page.keyboard.press('q');
  await page.keyboard.press('e');
  await expect(page.locator('#speech-bubble')).toHaveAttribute('data-speaker-id', 'person-b');
  await expect(page.locator('#speech-bubble')).toContainText('I want to take a silly mirror pic');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await state(page)).flags).not.toContain('museum-sprinkles-seen');
  await page.keyboard.press('q'); await page.keyboard.press('e');
  if ((await state(page)).mode === 'speaking') await page.keyboard.press('e');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-museum-2-themed\.webp$/);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).mode).toBe('checkpoint');
  await next(page, 'norway-scrapbook');
  await page.screenshot({ path: 'art-work/qa/norway-map-latest.png', fullPage: true });
  await finishBook(page);
  await next(page, 'austin-francine');
  await guide(page);
  if ((await state(page)).leaderId !== 'person-b') await page.keyboard.press('q');
  await expect.poll(async () => (await state(page)).leaderId).toBe('person-b');
  const entryCar = (await state(page)).vehicle!;
  await clickObject(page, entryCar.x, entryCar.y - 28);
  await expect(page.locator('#speech-bubble')).toContainText("I'm passenger princess!");
  await expect(page.locator('#speech-bubble')).toHaveAttribute('data-speaker-id', 'person-b');
  expect((await state(page)).vehicleId).toBeNull();
  await page.keyboard.press('q');
  await expect.poll(async () => (await state(page)).leaderId).toBe('person-a');
  await clickObject(page, entryCar.x, entryCar.y - 28);
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-francine-themed\.webp$/);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).travelMode).toBe('vehicle');
  await page.keyboard.down('d');
  const speed = await page.evaluate(async () => {
    const snapshot = () => JSON.parse(document.querySelector<HTMLCanvasElement>('canvas')!.dataset.debug!);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const before = { x: snapshot().vehicle.x, time: performance.now() };
    let after = before;
    while (after.time - before.time < 500) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      after = { x: snapshot().vehicle.x, time: performance.now() };
    }
    return (after.x - before.x) / (after.time - before.time) * 1000;
  });
  await page.keyboard.up('d');
  // Allow frame sampling tolerance while rejecting the former 195 px/s speed.
  expect(speed).toBeGreaterThan(255); expect(speed).toBeLessThan(325);
  await page.keyboard.press('q'); expect((await state(page)).leaderId).toBe('person-a');
  await moveTo(page, 785, 400, 'vehicle');
  await clickObject(page, 810, 420);
  await expect(page.locator('#speech-bubble')).toContainText('We forgot to plug Francine in!');
  await expect(page.locator('#speech-bubble')).toHaveAttribute('data-speaker-id', 'person-b');
  expect((await state(page)).vehicleId).toBe('francine');
  expect((await state(page)).flags).not.toContain('maa-arrived');
  await moveTo(page, 340, 272, 'vehicle');
  await page.keyboard.press('e'); await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-goodwin-themed\.webp$/); await page.keyboard.press('e');
  await moveTo(page, 600, 272, 'vehicle');
  await page.keyboard.press('e'); await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-citizenship-themed\.webp$/); await page.keyboard.press('e');
  await park(page);
  await expect.poll(async () => (await state(page)).travelMode).toBe('walking');
  await page.screenshot({ path: 'art-work/qa/apartment-garage-latest.png', fullPage: true });
  await page.keyboard.press('e'); await expect(page.locator('#speech-bubble')).toContainText('I got the fob!');
  expect((await state(page)).flags).not.toContain('maa-entered');
  await page.keyboard.press('q'); await page.keyboard.press('e');
  await expect(page.locator('#speech-bubble')).toHaveAttribute('data-speaker-id', 'person-b');
  await page.keyboard.press('e');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-snuromi-themed\.webp$/);
  await page.keyboard.press('e');
  await remainingMemories(page, 'austin-francine');
  await next(page, 'madeira');
  await memory(page); await memory(page); await memory(page);
  await guide(page); await page.keyboard.press('e');
  await expect(page.locator('.final-letter')).toHaveCount(0);
  await page.keyboard.press('d');
  await expect(page.locator('.final-letter p')).toHaveText(finale.letter);
  await page.keyboard.press('e');
  await expect(page.getByText(madeira.checkpoint.title, { exact: true })).toBeVisible();
  expect((await state(page)).completed).toEqual(scenes.map((scene) => scene.id));
  await next(page, 'madeira');
  await page.keyboard.press('e'); await expect(page.locator('.final-letter')).toBeVisible();
  await page.keyboard.press('e'); await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect(errors).toEqual([]);
});

test('reader completes all 35 distinct photo memories without downloading the renderer', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = []; const engineRequests: string[] = []; const photos = new Set<string>();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (/phaser|WorldScene/.test(request.url())) engineRequests.push(request.url()); });
  await page.goto('./?reader=1');
  await page.getByRole('button', { name: 'Text size: normal' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text-scale', 'large');
  await page.locator('[data-interaction-id="welcome-card"]').click();
  await page.keyboard.press('e');
  await page.locator('[data-interaction-id="welcome-card"]').click();
  await expect(page.getByRole('button', { name: 'Mark this stop read' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to stops' }).click();
  for (const scene of scenes) {
    for (const interaction of scene.interactions) {
      await page.locator('[data-action="reader-open"][data-interaction-id="' + interaction.id + '"]').click();
      const pictures = page.locator('.memory-picture img');
      if (interaction.kind === 'railway') await expect(pictures).toHaveCount(4);
      if (interaction.kind === 'scrapbook') await expect(pictures).toHaveCount(5);
      if (await page.getByRole('button', { name: 'Show original view', exact: true }).count()) {
        await page.getByRole('button', { name: 'Show original view', exact: true }).first().click();
      }
      for (const picture of await pictures.all()) {
        const src = (await picture.getAttribute('src'))!;
        expect(src).toMatch(/\/annivgame\/assets\/memories\/.*-original\.webp$/);
        photos.add(src);
      }
      await page.getByRole('button', { name: 'Mark this stop read', exact: true }).click();
    }
    await page.locator('[data-action="advance"]').click();
    await expect(page.locator('#chapter-title')).toHaveText('Our dreamy GN world');
  }
  expect(photos.size).toBe(35);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.locator('[data-interaction-id="cristo-rei"]').click();
  await expect(page.locator('.final-letter p')).toHaveText(finale.letter);
  await expect(page.getByRole('button', { name: 'Already read' })).toBeVisible();
  expect(errors).toEqual([]); expect(engineRequests).toEqual([]);
});

test('rail photo signs and the car remain closed to replay until the whole journey is complete', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await readTo(page, 'korea-railway');
  await guide(page); await page.keyboard.press('e');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-rail-2-themed\.webp$/);
  expect((await state(page)).counters['railway-car'] ?? 0).toBe(0);
  await page.keyboard.press('e');
  for (let count = 1; count <= 12; count++) {
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).counters['railway-car']).toBe(count);
    await expect.poll(async () => (await state(page)).mode).toBe(count % 4 === 0 ? 'reading' : 'exploring');
    if (count % 4 === 0) await page.keyboard.press('e');
  }
  await expect(page.getByRole('button', { name: 'Walk back to the photo signs', exact: true })).toHaveCount(0);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).sceneId).toBe('korea-smurf');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.getByRole('dialog').locator('[data-action="travel-scene"][data-scene-id="korea-railway"]').click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('korea-railway');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  const beforeEnding = await state(page);
  const firstSign = railway.stops[0];
  await moveTo(page, firstSign.signApproach!.x, firstSign.signApproach!.y);
  await clickObject(page, firstSign.signPosition!.x, firstSign.signPosition!.y);
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await state(page)).flags).toEqual(beforeEnding.flags);
  const carBefore = (await state(page)).railway!;
  await moveTo(page, carBefore.x, carBefore.y + 42);
  await clickObject(page, carBefore.x, carBefore.y - 30);
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await state(page)).counters['railway-car']).toBe(12);
  expect((await state(page)).railwayId).toBeNull();

  await page.getByRole('button', { name: 'Read story', exact: true }).click();
  for (const scene of scenes.slice(scenes.findIndex((scene) => scene.id === 'korea-smurf'))) {
    for (const interaction of scene.interactions) {
      await page.locator('[data-action="reader-open"][data-interaction-id="' + interaction.id + '"]').click();
      await page.getByRole('button', { name: 'Mark this stop read', exact: true }).click();
    }
    await page.keyboard.press('e');
  }
  await page.getByRole('button', { name: 'Return to the map', exact: true }).click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('madeira');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect((await state(page)).completed).toEqual(scenes.map((scene) => scene.id));
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.getByRole('dialog').locator('[data-action="travel-scene"][data-scene-id="korea-railway"]').click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('korea-railway');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  await page.screenshot({ path: 'art-work/qa/wooden-rail-signs-after-ending.png', fullPage: true });
  await page.keyboard.press('q');
  await expect.poll(async () => (await state(page)).leaderId).toBe('person-b');
  const progress = await state(page);
  for (const [index, stop] of railway.stops.entries()) {
    await moveTo(page, stop.signApproach!.x, stop.signApproach!.y);
    await expect.poll(async () => (await state(page)).target).toBe('railway-car:stop:' + index);
    if (index % 2 === 0) await clickObject(page, stop.signPosition!.x, stop.signPosition!.y);
    else await page.keyboard.press('e');
    await expect(page.locator('.memory-picture img')).toHaveAttribute('src', new RegExp(stop.memory.themedAsset!.replaceAll('.', '\\.') + '$'));
    expect((await state(page)).railwayId).toBeNull();
    expect((await state(page)).travelMode).toBe('walking');
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).mode).toBe('exploring');
    const replayed = await state(page);
    expect(replayed.flags).toEqual(progress.flags);
    expect(replayed.completed).toEqual(progress.completed);
    expect(replayed.counters).toEqual(progress.counters);
  }
  const car = (await state(page)).railway!;
  await moveTo(page, car.x, car.y + 42);
  await clickObject(page, car.x, car.y - 30);
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-rail-2-themed\.webp$/);
  expect((await state(page)).travelMode).toBe('walking');
  expect((await state(page)).railwayId).toBeNull();
  await page.keyboard.press('e');
  expect((await state(page)).flags).toEqual(progress.flags);
  expect((await state(page)).completed).toEqual(progress.completed);
  expect((await state(page)).counters).toEqual(progress.counters);
});

test('partial five-page scrapbook resumes without role gates; parked Francine can be re-entered', async ({ page }) => {
  test.setTimeout(60000);
  await readTo(page, 'norway-scrapbook');
  await guide(page); await page.keyboard.press('e'); await page.keyboard.press('d'); await page.keyboard.press('e');
  expect((await state(page)).flags).not.toContain('norway-read');
  await page.keyboard.press('q'); await page.keyboard.press('e');
  await expect(page.locator('.scrapbook-page-number')).toHaveText('Page 2 of 5');
  for (let pageIndex = 2; pageIndex < 5; pageIndex++) await page.keyboard.press('d');
  await page.keyboard.press('e');
  await next(page, 'austin-francine');
  await guide(page);
  if ((await state(page)).leaderId !== 'person-a') await page.keyboard.press('q');
  await page.keyboard.press('e'); await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-francine-themed\.webp$/); await page.keyboard.press('e');
  await memory(page); await memory(page);
  await guide(page); await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).travelMode).toBe('walking');
  const vehicle = (await state(page)).vehicle!;
  await clickObject(page, vehicle.x - 28, vehicle.y - 8);
  await expect.poll(async () => (await state(page)).travelMode).toBe('vehicle');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-francine-themed\.webp$/);
  await page.keyboard.press('e'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Begin again', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, begin again' }).click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('introduction');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect((await state(page)).flags).toEqual([]); expect((await state(page)).vehicleId).toBeNull();
  expect((await state(page)).counters).toEqual({});
});

test('Petite France accepts reverse photo order and Gracie asks to stay when the final pin is early', async ({ page }) => {
  test.setTimeout(60000);
  await readTo(page, 'korea-petite-france');
  await moveTo(page, 480, 452); await clickObject(page, 480, 410);
  await expect(page.locator('#speech-bubble')).toContainText('I wanna stay and look at things');
  await expect(page.locator('#speech-bubble')).toHaveAttribute('data-speaker-id', 'person-b');
  expect((await state(page)).flags).not.toContain('france-goodbye');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await moveTo(page, 720, 455); await page.keyboard.press('q');
  await expect.poll(async () => (await state(page)).leaderId).toBe('person-b');
  await clickObject(page, 720, 415);
  await expect(page.locator('#speech-bubble')).toContainText('I got an idea for a pic...');
  await expect(page.locator('#speech-bubble')).toHaveAttribute('data-speaker-id', 'person-a');
  expect((await state(page)).flags).not.toContain('france-together-seen');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.keyboard.press('q');
  await expect.poll(async () => (await state(page)).leaderId).toBe('person-a');
  for (const id of ['france-together', 'france-garden', 'france-around', 'france-village']) await visitPhoto(page, id);
  expect((await state(page)).flags).not.toContain('france-goodbye');
  await page.screenshot({ path: 'art-work/qa/unordered-france.png', fullPage: true });
  await visitPhoto(page, 'france-goodbye');
  await expect(page.getByRole('heading', { name: 'Petite France, remembered', exact: true })).toBeVisible();
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).sceneId).toBe('austin-museum');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
});

test('MAA early and car-purchase last complete Austin; revisiting still permits driving and optional parking', async ({ page }) => {
  test.setTimeout(120000);
  await readTo(page, 'austin-francine');
  await visitPhoto(page, 'austin-line-dancing');
  await visitPhoto(page, 'austin-pj-house');
  await page.keyboard.press('q');
  await expect.poll(async () => (await state(page)).leaderId).toBe('person-b');
  await visitPhoto(page, 'maa-access');
  expect((await state(page)).flags).toContain('maa-entered');
  expect((await state(page)).flags).not.toContain('maa-arrived');
  for (const id of ['citizenship', 'austin-photo-booth', 'austin-birthday-lake', 'goodwin']) await visitPhoto(page, id);
  expect((await state(page)).vehicleId).toBeNull();
  expect((await state(page)).completed).not.toContain('austin-francine');
  await page.keyboard.press('q');
  await expect.poll(async () => (await state(page)).leaderId).toBe('person-a');
  await moveTo(page, 150, 412); await clickObject(page, 150, 370);
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-francine-themed\.webp$/);
  expect((await state(page)).completed).toContain('austin-francine');
  expect((await state(page)).flags).not.toContain('maa-arrived');
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'Francine and settling in, remembered', exact: true })).toBeVisible();
  const completed = await state(page);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).sceneId).toBe('madeira');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.getByRole('dialog').locator('[data-action="travel-scene"][data-scene-id="austin-francine"]').click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('austin-francine');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  const parked = (await state(page)).vehicle!;
  await moveTo(page, parked.x, Math.min(474, parked.y + 42));
  await clickObject(page, parked.x, parked.y);
  await expect.poll(async () => (await state(page)).vehicleId).toBe('francine');
  if ((await state(page)).mode === 'reading') await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  const start = (await state(page)).vehicle!;
  await page.keyboard.down('d'); await page.waitForTimeout(250); await page.keyboard.up('d');
  expect((await state(page)).vehicle!.x).toBeGreaterThan(start.x + 25);
  await visitPhoto(page, 'austin-pj-house', 'vehicle');
  await park(page);
  await expect.poll(async () => (await state(page)).travelMode).toBe('walking');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect((await state(page)).flags).toEqual([...completed.flags, 'maa-arrived']);
  expect((await state(page)).completed).toEqual(completed.completed);
  expect((await state(page)).counters).toEqual(completed.counters);
  await page.screenshot({ path: 'art-work/qa/free-order-austin.png', fullPage: true });
});

test('E continues reader checkpoints without closing the reader or repeating a held key', async ({ page }) => {
  await page.goto('./?reader=1');
  await page.locator('[data-interaction-id="welcome-card"]').click();
  await page.getByRole('button', { name: 'Mark this stop read', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Our adventure begins', exact: true })).toBeVisible();
  await page.keyboard.down('e'); await page.keyboard.down('e');
  await expect(page.getByRole('heading', { name: 'Read our story', exact: true })).toBeVisible();
  await expect(page.locator('#interaction-title')).toHaveText('Our first date');
  await page.keyboard.up('e');
  for (const interaction of scenes.find((scene) => scene.id === 'korea-first-date')!.interactions) {
    await page.locator('[data-interaction-id="' + interaction.id + '"]').click();
    await page.getByRole('button', { name: 'Mark this stop read', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'A first date to remember', exact: true })).toBeVisible();
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'Read our story', exact: true })).toBeVisible();
  await expect(page.locator('#interaction-title')).toHaveText('Fall foliage railway park');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('missing image preserves caption and supports retry; content load failure can retry', async ({ page }) => {
  let imageRequests = 0;
  await page.route('**/content/scenes/korea-first-date.json', async (route) => {
    const response = await route.fetch(); const scene = await response.json();
    scene.interactions.find((i: { id: string }) => i.id === 'katsu').memory.themedAsset = 'images/retry-photo.png';
    await route.fulfill({ response, json: scene });
  });
  await page.route('**/images/retry-photo.png*', async (route) => {
    imageRequests++;
    if (imageRequests === 1) await route.fulfill({ status: 404, body: 'Missing' });
    else await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0mQAAAAASUVORK5CYII=', 'base64') });
  });
  await page.goto('./?reader=1');
  for (const id of ['welcome-card', 'flower-shop', 'closed-restaurant', 'delivery-restaurant']) {
    await page.locator('[data-interaction-id="' + id + '"]').click();
    await page.getByRole('button', { name: 'Mark this stop read' }).click();
    if (id === 'welcome-card') await page.locator('[data-action="advance"]').click();
  }
  await page.locator('[data-interaction-id="katsu"]').click();
  await expect(page.locator('.image-fallback').first()).toBeVisible();
  await expect(page.getByText('Flowers, katsu, and the beginning of us.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry picture' }).first().click();
  await expect(page.locator('.memory-picture img').first()).toBeVisible();
  expect(imageRequests).toBe(2);
  await page.unroute('**/content/scenes/korea-first-date.json');
  let fail = true;
  await page.route('**/content/game.json', async (route) => {
    if (fail) await route.fulfill({ status: 503, body: 'Unavailable' }); else await route.continue();
  });
  await page.goto('./'); await expect(page.getByText('Our world needs a moment.', { exact: true })).toBeVisible();
  fail = false; await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('canvas')).toBeVisible();
});

test('all 25 map letters work by click or E without a puzzle menu or written hint', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 640, height: 360 });
  await readTo(page, 'korea-smurf'); await guide(page);
  await expect(page.locator('#interaction-description')).toHaveText('Walk to an E marker, then press E or click.');
  await expect(page.locator('.map-guidance')).not.toContainText('S · M · U · R · F');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  for (const letter of smurf.letters) {
    await floorLetter(page, letter, letter === 'K');
    await expect.poll(async () => (await state(page)).puzzleSelections['smurf-floor']).toContain(letter);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await floorLetter(page, letter, letter === 'K');
    await expect.poll(async () => (await state(page)).puzzleSelections['smurf-floor']).not.toContain(letter);
  }
  for (const letter of smurf.solution) await floorLetter(page, letter);
  const dialog = (await page.getByRole('dialog').boundingBox())!;
  expect(dialog.y).toBeGreaterThanOrEqual(0); expect(dialog.y + dialog.height).toBeLessThanOrEqual(360);
  await page.getByRole('button', { name: 'Continue', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Smurf escape room, remembered' })).toBeVisible();
});

test('renderer module load failure leaves the reading route usable', async ({ page }) => {
  await page.route('**/src/scenes/WorldScene.ts*', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Our world needs a moment.' })).toBeVisible();
  await page.getByRole('button', { name: 'Read our story', exact: true }).click();
  await page.locator('[data-interaction-id="welcome-card"]').click();
  await page.getByRole('button', { name: 'Mark this stop read', exact: true }).click();
  await page.locator('[data-action="advance"]').click();
  await expect(page.locator('#chapter-title')).toHaveText('Our dreamy GN world');
  await expect(page.locator('#interaction-title')).toHaveText('Our first date');
  await expect(page.locator('[data-interaction-id="flower-shop"]')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('reader checkpoint survives renderer startup and failure happening in the background', async ({ page }) => {
  for (const failRenderer of [false, true]) {
    await page.unroute('**/src/scenes/WorldScene.ts*');
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    let settled = false;
    await page.route('**/src/scenes/WorldScene.ts*', async (route) => {
      await barrier;
      if (failRenderer) await route.abort(); else await route.continue();
      settled = true;
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'Read story', exact: true }).click();
    await page.locator('[data-interaction-id="welcome-card"]').click();
    await page.getByRole('button', { name: 'Mark this stop read', exact: true }).click();
    release(); await expect.poll(() => settled).toBe(true);
    if (!failRenderer) await expect(page.locator('canvas')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Our adventure begins', exact: true })).toBeVisible();
    await page.locator('[data-action="advance"]').click();
    await expect(page.locator('#interaction-title')).toHaveText('Our first date');
    await expect(page.locator('[data-interaction-id="flower-shop"]')).toBeVisible();
    if (!failRenderer) {
      await page.getByRole('button', { name: 'Return to the map', exact: true }).click();
      await expect.poll(async () => (await state(page)).mode).toBe('exploring');
      expect((await state(page)).sceneId).toBe('korea-first-date');
    }
  }
});

test('merged Austin pictures open separately and keep original-only photo-booth art distinct', async ({ page }) => {
  test.setTimeout(60000);
  await readTo(page, 'austin-francine');
  await page.getByRole('button', { name: 'Read story', exact: true }).click();
  for (const id of ['francine-car', 'goodwin', 'citizenship', 'maa-exit']) {
    await page.locator('[data-interaction-id="' + id + '"]').click();
    await page.getByRole('button', { name: 'Mark this stop read' }).click();
  }
  await page.locator('[data-interaction-id="maa-access"]').click();
  await expect(page.locator('.memory-picture img')).toHaveCount(1);
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-snuromi-themed\.webp$/);
  await expect(page.locator('.picture-toggle-hint')).toContainText('Click the picture to view the original');
  await page.locator('.memory-picture').click();
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-snuromi-original\.webp$/);
  await expect(page.locator('.memory-picture img')).toHaveCSS('object-fit', 'contain');
  await page.getByRole('button', { name: 'Mark this stop read' }).click();
  for (const [id, asset] of [
    ['austin-photo-booth', 'real-austin-1-original'],
    ['austin-birthday-lake', 'real-austin-2-themed'],
    ['austin-pj-house', 'real-austin-3-themed'],
    ['austin-line-dancing', 'real-austin-4-themed'],
  ]) {
    await page.locator('[data-interaction-id="' + id + '"]').click();
    await expect(page.locator('.memory-picture img')).toHaveCount(1);
    await expect(page.locator('.memory-picture img')).toHaveAttribute('src', new RegExp(asset + '\\.webp$'));
    await expect(page.locator('.photo-navigation')).toHaveCount(0);
    if (id === 'austin-photo-booth') {
      await expect(page.getByRole('button', { name: 'Original photo', exact: true })).toBeDisabled();
    }
    await page.getByRole('button', { name: 'Mark this stop read' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Francine and settling in, remembered' })).toBeVisible();
});

test('Madeira secretly reveals the proposal on E, preserves A/D and early-close behavior, and leaves other albums unchanged', async ({ page }) => {
  test.setTimeout(60000);
  await readTo(page, 'madeira');
  await memory(page); await memory(page); await memory(page);
  await guide(page); await page.keyboard.press('e');
  const image = page.locator('.memory-picture img');
  const stationary = (await state(page)).leader;
  await expect(image).toHaveAttribute('src', /portugal-before-proposal-themed\.webp$/);
  await expect(page.locator('.scrapbook-caption')).toHaveText(finale.memory.caption);
  await expect(page.locator('.final-letter')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect((await state(page)).flags).not.toContain('proposal-read');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: 'Close final memory', exact: true }).click();
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect((await state(page)).flags).not.toContain('proposal-read');
  await page.keyboard.press('e');
  await expect(page.locator('.ending-dialog')).not.toContainText('Press E');
  await expect(page.locator('.ending-dialog')).not.toContainText('E to');
  await page.keyboard.down('e'); await page.keyboard.down('e');
  await expect(image).toHaveAttribute('src', /portugal-proposal-themed\.webp$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await state(page)).flags).not.toContain('proposal-read');
  await page.keyboard.up('e');
  await expect(page.locator('.final-letter p')).toHaveText(finale.letter);
  await expect(page.locator('.scrapbook-caption')).toHaveCount(0);
  await page.keyboard.press('a');
  await expect(image).toHaveAttribute('src', /portugal-before-proposal-themed\.webp$/);
  await expect(page.locator('.final-letter')).toHaveCount(0);
  await page.keyboard.press('d');
  expect((await state(page)).leader).toEqual(stationary);
  await page.getByRole('button', { name: 'Show original view', exact: true }).click();
  await expect(image).toHaveAttribute('src', /portugal-proposal-original\.webp$/);
  await expect(page.locator('.final-letter p')).toHaveText(finale.letter);
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: madeira.checkpoint.title, exact: true })).toBeVisible();
  await expect(page.locator('.checkpoint-dialog')).toContainText(madeira.checkpoint.text);
  await page.screenshot({ path: 'art-work/qa/final-checkpoint-travel-guidance.png', fullPage: true });
  await next(page, 'madeira');
  await page.keyboard.press('e');
  await expect(page.locator('.final-letter p')).toHaveText(finale.letter);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect((await state(page)).completed).toHaveLength(9);
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.getByRole('dialog').locator('[data-action="travel-scene"][data-scene-id="korea-first-date"]').click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('korea-first-date');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  if ((await state(page)).leaderId !== 'person-b') await page.keyboard.press('q');
  await moveTo(page, 766, 447); await clickObject(page, 766, 404);
  await expect.poll(async () => (await state(page)).mode).toBe('speaking');
  await page.keyboard.press('e');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-date-1-themed\.webp$/);
  await expect(page.locator('.photo-navigation')).toContainText('1 / 2');
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('completed worlds support backward and forward traversal with preserved flags and no repeated checkpoints', async ({ page }) => {
  test.setTimeout(60000);
  await readTo(page, 'madeira');
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await expect(page.locator('[data-action="travel-scene"][data-scene-id="madeira"]')).toHaveCount(0);
  await page.locator('[data-action="travel-scene"][data-scene-id="introduction"]').click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('introduction');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  const flags = (await state(page)).flags;
  const completed = (await state(page)).completed;
  await page.locator('#world-travel [data-scene-id="korea-first-date"]').click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('korea-first-date');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  const previous = page.locator('#world-travel [data-scene-id="introduction"]');
  const following = page.locator('#world-travel [data-scene-id="korea-railway"]');
  await expect(previous).toHaveText(/Previous chapter/); await expect(following).toHaveText(/Next chapter/);
  const previousBox = (await previous.boundingBox())!; const followingBox = (await following.boundingBox())!;
  expect(Math.abs(previousBox.width - followingBox.width)).toBeLessThan(0.5);
  await moveTo(page, 478, 467); await clickObject(page, 478, 424);
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-ice-cream-themed\.webp$/);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect((await state(page)).flags).toEqual(flags); expect((await state(page)).completed).toEqual(completed);
  await page.locator('#world-travel [data-scene-id="introduction"]').click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('introduction');
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.locator('[data-action="travel-scene"][data-scene-id="madeira"]').click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('madeira');
  expect((await state(page)).flags).toEqual(flags);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Our dreamy GN world');
});

test('reading the unfinished frontier from an earlier world changes chapter before committing progress', async ({ page }) => {
  await readTo(page, 'korea-first-date');
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.locator('[data-action="travel-scene"][data-scene-id="introduction"]').click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('introduction');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  await page.getByRole('button', { name: 'Read story', exact: true }).click();
  await page.locator('[data-action="reader-open"][data-interaction-id="flower-shop"]').click();
  await page.getByRole('button', { name: 'Mark this stop read', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Read our story', exact: true })).toBeVisible();
  await expect(page.locator('#interaction-title')).toHaveText('Our first date');
  await page.getByRole('button', { name: 'Return to the map', exact: true }).click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('korea-first-date');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect((await state(page)).flags).toEqual(['welcome-read', 'flowers-bought']);
  expect((await state(page)).completed).toEqual(['introduction']);
  await guide(page); await page.keyboard.press('e');
  await expect(page.locator('#speech-bubble')).toContainText("It's closed");
  await expect.poll(async () => (await state(page)).flags.includes('closed-visited')).toBe(true);
  expect((await state(page)).flags).not.toContain('delivery-visited');
});

test('missing character and painted map assets preserve a playable map with fallback art', async ({ page }) => {
  const errors: string[] = []; const failedAssets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/content/scenes/introduction.json', async (route) => {
    const response = await route.fetch(); const scene = await response.json();
    scene.backgroundAsset = 'assets/worlds/missing-fallback-test.webp';
    await route.fulfill({ response, json: scene });
  });
  await page.route(/\/assets\/(characters\/.*|worlds\/missing-fallback-test\.webp)$/, async (route) => {
    failedAssets.push(route.request().url()); await route.fulfill({ status: 404, body: 'Missing asset' });
  });
  await page.goto('./'); await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect(failedAssets.filter((url) => url.includes('/characters/'))).toHaveLength(2);
  expect(failedAssets.some((url) => url.includes('missing-fallback-test'))).toBe(true);
  const before = (await state(page)).leader;
  await page.keyboard.down('s'); await page.waitForTimeout(300); await page.keyboard.up('s');
  expect((await state(page)).leader.y).toBeGreaterThan(before.y + 20);
  await page.keyboard.press('q'); await expect.poll(async () => (await state(page)).leaderId).toBe('person-b');
  await guide(page); await page.keyboard.press('e');
  await expect(page.getByLabel('His name')).toBeVisible();
  expect(errors).toEqual([]);
});

test('five-page photo navigation and large text fit a small viewport with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await readTo(page, 'norway-scrapbook');
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await expect(page.getByRole('button', { name: 'Gentle motion: on' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Text size: normal' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text-scale', 'large');
  await page.getByRole('button', { name: 'Bring us to the next dreamy stop' }).click();
  await page.keyboard.press('e');
  const dialog = (await page.getByRole('dialog').boundingBox())!;
  expect(dialog.y).toBeGreaterThanOrEqual(0); expect(dialog.y + dialog.height).toBeLessThanOrEqual(360);
  await expect(page.locator('.memory-picture img')).toHaveCSS('object-fit', 'contain');
  await page.getByRole('button', { name: 'Next photo D', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Next photo D', exact: true }).click();
  await expect(page.locator('.scrapbook-page-number')).toHaveText('Page 2 of 5');
  await page.keyboard.press('a');
  await expect(page.locator('.scrapbook-page-number')).toHaveText('Page 1 of 5');
  for (let index = 1; index < 5; index++) await page.keyboard.press('d');
  await page.getByRole('button', { name: 'Done reading', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Done reading', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A Norway scrapbook, remembered' })).toBeVisible();
});

test('reader advancement during art preload loads the current chapter background', async ({ page }) => {
  const assetRequests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/assets/')) assetRequests.push(request.url()); });
  let release!: () => void; const barrier = new Promise<void>((resolve) => { release = resolve; });
  for (const [file, asset] of [
    ['introduction.json', 'assets/worlds/preload-intro-test.webp'],
    ['korea-first-date.json', 'assets/worlds/preload-next-test.webp'],
  ]) {
    await page.route('**/content/scenes/' + file, async (route) => {
      const response = await route.fetch(); const scene = await response.json();
      scene.backgroundAsset = asset; await route.fulfill({ response, json: scene });
    });
  }
  await page.route('**/assets/characters/**', async (route) => { await barrier; await route.continue(); });
  await page.route('**/assets/worlds/preload-*-test.webp', async (route) => {
    await barrier;
    await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0mQAAAAASUVORK5CYII=', 'base64') });
  });
  try {
    await page.goto('./');
    await expect(page.locator('canvas')).toBeVisible();
    await expect.poll(() => assetRequests.some((url) => url.endsWith('/preload-intro-test.webp'))).toBe(true);
    await page.getByRole('button', { name: 'Read story', exact: true }).click();
    await page.locator('[data-interaction-id="welcome-card"]').click();
    await page.getByRole('button', { name: 'Mark this stop read', exact: true }).click();
    await page.locator('[data-action="advance"]').click();
    release();
    await expect(page.locator('canvas')).toHaveAttribute('data-debug', /"sceneId":"korea-first-date"/);
    await expect(page.getByRole('heading', { name: 'Read our story', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Return to the map', exact: true }).click();
    await expect.poll(async () => (await state(page)).mode).toBe('exploring');
    await expect.poll(() => assetRequests.some((url) => url.endsWith('/preload-next-test.webp'))).toBe(true);
    expect((await state(page)).completed).toEqual(['introduction']);
  } finally { release(); }
});

test('MAA before all other moments and a final lake photo complete Austin while walking or driving', async ({ page }) => {
  test.setTimeout(150000);
  for (const driving of [false, true]) {
    await readTo(page, 'austin-francine');
    await page.keyboard.press('q');
    await visitPhoto(page, 'maa-access');
    expect((await state(page)).flags).toContain('maa-entered');
    expect((await state(page)).flags).not.toContain('maa-arrived');
    for (const id of ['austin-line-dancing', 'austin-pj-house', 'citizenship', 'austin-photo-booth', 'goodwin']) await visitPhoto(page, id);
    await page.keyboard.press('q');
    await moveTo(page, 150, 412); await clickObject(page, 150, 370);
    await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-francine-themed\.webp$/);
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).travelMode).toBe('vehicle');
    if (!driving) {
      await park(page);
      await expect.poll(async () => (await state(page)).travelMode).toBe('walking');
    }
    expect((await state(page)).completed).not.toContain('austin-francine');
    await visitPhoto(page, 'austin-birthday-lake', driving ? 'vehicle' : 'leader');
    await expect.poll(async () => (await state(page)).mode).toBe('checkpoint');
    expect((await state(page)).completed).toContain('austin-francine');
    expect((await state(page)).flags).toContain('austin-birthday-lake-seen');
    if (driving) expect((await state(page)).flags).not.toContain('maa-arrived');
    await expect(page.getByRole('heading', { name: 'Francine and settling in, remembered', exact: true })).toBeVisible();
    await expect(page.locator('.checkpoint-dialog .modal-intro')).toHaveCount(0);
    await expect(page.locator('.checkpoint-dialog .modal-hint')).toHaveCount(0);
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).sceneId).toBe('madeira');
    await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  }
});

test('Nathaniel carries the bouquet in every direction and keeps it while following after Q', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await readTo(page, 'korea-first-date');
  await moveTo(page, 227, 281); await clickObject(page, 227, 239);
  await expect.poll(async () => (await state(page)).mode).toBe('speaking');
  await page.keyboard.press('e');
  await expect(page.locator('.memory-picture img')).toHaveCount(1);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  expect((await state(page)).flags).toContain('flowers-bought');
  await moveTo(page, 480, 335);
  const poses: Debug[] = [];
  const capture = async (direction: string, label = direction) => {
    await expect.poll(async () => (await state(page)).directions['person-a']).toBe(direction);
    const snapshot = await state(page); poses.push(snapshot);
    const nathaniel = snapshot.leaderId === 'person-a' ? snapshot.leader : snapshot.follower;
    expect(snapshot.bouquet, 'Accepted flowers must remain visibly attached to Nathaniel').not.toBeNull();
    expect(Math.abs(snapshot.bouquet!.x - nathaniel.x)).toBeLessThan(28);
    expect(snapshot.bouquet!.y).toBeGreaterThan(nathaniel.y - 60);
    expect(snapshot.bouquet!.y).toBeLessThan(nathaniel.y - 18);
    const canvas = (await page.locator('canvas').boundingBox())!;
    const left = Math.min(snapshot.leader.x, snapshot.follower.x) - 55;
    const top = Math.min(snapshot.leader.y, snapshot.follower.y) - 100;
    const width = Math.abs(snapshot.leader.x - snapshot.follower.x) + 110;
    const height = Math.abs(snapshot.leader.y - snapshot.follower.y) + 120;
    await page.screenshot({ path: 'art-work/qa/bouquet-hand-' + label + '.png', clip: {
      x: canvas.x + left / 960 * canvas.width, y: canvas.y + top / 540 * canvas.height,
      width: width / 960 * canvas.width, height: height / 540 * canvas.height,
    } });
  };
  for (const [key, duration, facing] of [['s', 180, 'south'], ['a', 250, 'west'], ['d', 500, 'east'], ['w', 450, 'north']] as const) {
    await page.keyboard.down(key);
    try { await page.waitForTimeout(duration); } finally { await page.keyboard.up(key); }
    await page.waitForTimeout(100); await capture(facing);
  }
  await page.keyboard.press('q');
  await expect.poll(async () => (await state(page)).leaderId).toBe('person-b');
  await page.keyboard.down('d');
  try { await page.waitForTimeout(800); } finally { await page.keyboard.up('d'); }
  await page.waitForTimeout(100); await capture('east', 'following-gracie');
  expect((await state(page)).flags).toContain('flowers-bought');
  await test.info().attach('actual-bouquet-poses', { body: JSON.stringify(poses, null, 2), contentType: 'application/json' });
});

test('Madeira paths block sea and inland shortcuts while all three photo stops work in reverse order before the proposal', async ({ page }) => {
  test.setTimeout(150000);
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await readTo(page, 'madeira');
  await page.screenshot({ path: 'art-work/qa/madeira-loop-map-latest.png', fullPage: true });
  const checkFeet = async () => {
    const snapshot = await state(page);
    for (const actor of [snapshot.leader, snapshot.follower]) {
      expect(madeira.obstacles.some((rect) => actor.x > rect.x && actor.x < rect.x + rect.width
        && actor.y > rect.y && actor.y < rect.y + rect.height), 'Both people must remain on the island paths').toBe(false);
    }
  };
  const push = async (key: string) => {
    await page.keyboard.down(key);
    try { await page.waitForTimeout(900); } finally { await page.keyboard.up(key); }
    await page.waitForTimeout(80); await checkFeet();
    return (await state(page)).leader;
  };
  // The bottom garden bed prevents a direct shortcut toward the castle.
  const inland = await push('w');
  expect(inland.y).toBeGreaterThanOrEqual(353);
  expect(inland.y).toBeLessThan(360);
  await moveTo(page, 150, 195);
  expect((await push('a')).x).toBeGreaterThan(128);
  await moveTo(page, madeiraPath.center, madeiraPath.bottom);
  expect((await push('s')).y).toBeLessThan(383);
  await moveTo(page, 810, 305);
  expect((await push('d')).x).toBeLessThan(862);
  await moveTo(page, madeiraPath.center, madeiraPath.top);
  expect((await push('w')).y).toBeGreaterThan(138);
  await moveTo(page, 835, 420);
  expect((await state(page)).leader.y).toBeGreaterThan(413);
  expect((await push('s')).y).toBeLessThan(438);
  // Walk the left loop, then switch on it; the follower must stay on the same path.
  await moveTo(page, madeiraPath.leftTop, madeiraPath.top); await moveTo(page, 150, 195);
  await moveTo(page, 190, 275); await moveTo(page, madeiraPath.leftBottom, madeiraPath.bottom); await checkFeet();
  const originalLeader = (await state(page)).leaderId;
  await page.keyboard.press('q');
  await expect.poll(async () => (await state(page)).leaderId).not.toBe(originalLeader);
  await moveTo(page, madeiraPath.leftTop, madeiraPath.top); await moveTo(page, madeiraPath.rightTop, madeiraPath.top); await checkFeet();
  const denyProposal = async () => {
    await moveTo(page, finale.approach.x, finale.approach.y);
    await clickObject(page, finale.position.x, finale.position.y);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect((await state(page)).flags).not.toContain(finale.setsFlag);
    expect((await state(page)).mode).toBe('exploring');
    const photosSeen = (await state(page)).flags.filter((flag) => finale.requires.includes(flag)).length;
    await page.screenshot({ path: 'art-work/qa/madeira-cristo-locked-' + photosSeen + '-photos.png', fullPage: true });
  };
  await denyProposal();
  // Castle and lunch are both available before the meal, proving that no chain remains.
  await visitPhoto(page, 'madeira-view');
  expect((await state(page)).flags).not.toContain('madeira-garden-seen');
  expect((await state(page)).flags).not.toContain('madeira-coast-seen');
  await page.screenshot({ path: 'art-work/qa/madeira-loop-castle-latest.png', fullPage: true });
  await denyProposal();
  await visitPhoto(page, 'madeira-garden');
  await page.screenshot({ path: 'art-work/qa/madeira-lisbon-lunch-latest.png', fullPage: true });
  await denyProposal();
  await visitPhoto(page, 'madeira-coast'); await checkFeet();
  expect((await state(page)).completed).not.toContain('madeira');
  await moveTo(page, finale.approach.x, finale.approach.y);
  await page.screenshot({ path: 'art-work/qa/madeira-loop-before-proposal.png', fullPage: true });
  await clickObject(page, finale.position.x, finale.position.y);
  await expect.poll(async () => (await state(page)).mode).toBe('reading');
  await page.keyboard.press('e');
  await expect(page.locator('.final-letter p')).toHaveText(finale.letter);
  await decodedPhoto(page);
  await page.locator('.final-letter').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'art-work/qa/madeira-final-authored-letter.png', fullPage: true });
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: madeira.checkpoint.title, exact: true })).toBeVisible();
  expect((await state(page)).completed).toEqual(scenes.map((scene) => scene.id));
  expect(errors).toEqual([]);
});

test('leaving during a fourth or eighth pedal reopens the reached photo on reboarding without an extra pedal', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await readTo(page, 'korea-railway');
  await guide(page); await page.keyboard.press('e');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-rail-2-themed\.webp$/);
  await page.keyboard.press('e');
  for (const boundary of [4, 8]) {
    for (let count = ((await state(page)).counters['railway-car'] ?? 0) + 1; count < boundary; count++) {
      await page.keyboard.press('e');
      await expect.poll(async () => (await state(page)).counters['railway-car']).toBe(count);
      await expect.poll(async () => (await state(page)).mode).toBe('exploring');
    }
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).counters['railway-car']).toBe(boundary);
    await expect.poll(async () => (await state(page)).mode).toBe('travelling');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').locator('[data-action="travel-scene"][data-scene-id="korea-first-date"]').click();
    await expect.poll(async () => (await state(page)).sceneId).toBe('korea-first-date');
    await expect.poll(async () => (await state(page)).mode).toBe('exploring');
    await page.locator('#world-travel [data-scene-id="korea-railway"]').click();
    await expect.poll(async () => (await state(page)).sceneId).toBe('korea-railway');
    await expect.poll(async () => (await state(page)).mode).toBe('exploring');
    const car = (await state(page)).railway!;
    expect(car.x).toBeCloseTo(155 + boundary * 57.5, 0);
    await moveTo(page, car.x, car.y + 42);
    await clickObject(page, car.x, car.y - 30);
    const stop = railway.stops[boundary / 4 - 1];
    await expect(page.locator('.memory-picture img')).toHaveAttribute('src', new RegExp(stop.memory.themedAsset!.replaceAll('.', '\\.') + '$'));
    expect((await state(page)).counters['railway-car']).toBe(boundary);
    expect((await state(page)).travelMode).toBe('railway');
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).mode).toBe('exploring');
    expect((await state(page)).counters['railway-car']).toBe(boundary);
    expect((await state(page)).flags).not.toContain('railway-finished');
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).counters['railway-car']).toBe(boundary + 1);
    await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  }
});


