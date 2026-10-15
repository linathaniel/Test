import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { SceneDefinition } from '../../src/content/model';

const firstDate = JSON.parse(readFileSync('public/content/scenes/korea-first-date.json', 'utf8')) as SceneDefinition;
const closedRestaurant = firstDate.interactions.find((interaction) => interaction.id === 'closed-restaurant')!;

type Debug = { mode: string; sceneId: string; target: string | null; leaderId: string; leader: { x: number; y: number }; follower: { x: number; y: number }; flags: string[]; completed: string[]; trailLength: number; directions: Record<string, string> };
async function state(page: Page): Promise<Debug> {
  await expect(page.locator('canvas')).toHaveAttribute('data-debug', /.+/);
  return JSON.parse((await page.locator('canvas').getAttribute('data-debug'))!);
}
async function start(page: Page) {
  await page.goto('./');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
}
async function guide(page: Page) {
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.getByRole('button', { name: 'Bring us to the next dreamy stop' }).click();
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
}
async function walkTo(page: Page, x: number, y: number) {
  for (const axis of ['x', 'y'] as const) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const delta = (axis === 'x' ? x : y) - (await state(page)).leader[axis];
      if (Math.abs(delta) < 5) break;
      const key = axis === 'x' ? (delta > 0 ? 'd' : 'a') : (delta > 0 ? 's' : 'w');
      await page.keyboard.down(key); await page.waitForTimeout(Math.abs(delta) / 135 * 1000); await page.keyboard.up(key);
      await page.waitForTimeout(100);
    }
  }
  await expect.poll(async () => Math.hypot((await state(page)).leader.x - x, (await state(page)).leader.y - y)).toBeLessThan(18);
}
async function clickObject(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * x / 960, box.y + box.height * y / 540);
}
async function intro(page: Page, customize = false) {
  await guide(page); await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'What should we call each other?' })).toBeVisible();
  if (customize) {
    await page.getByLabel('His name', { exact: true }).fill('Alex');
    await page.getByLabel('Her name', { exact: true }).fill('Sam');
    await page.getByLabel('A dreamy greeting').fill('Three years, and our next adventure.');
  }
  await page.getByRole('button', { name: 'These are our names' }).click();
  await expect(page.getByText('Our adventure begins', { exact: true })).toBeVisible();
  if (customize) await expect(page.getByText('Three years, and our next adventure.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: "Let's go to Korea" }).click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('korea-first-date');
}
async function expectSpeech(page: Page, speaker: string, text: string) {
  const bubble = page.locator('#speech-bubble');
  await expect(bubble).toBeVisible(); await expect(bubble).toHaveAttribute('data-speaker-id', speaker);
  await expect(bubble).toContainText(text);
  const debug = await state(page);
  const actor = debug.leaderId === speaker ? debug.leader : debug.follower;
  const tail = await bubble.evaluate((element) => {
    const width = element.closest('.world-frame')!.clientWidth;
    const left = parseFloat((element as HTMLElement).style.left);
    const tailX = parseFloat((element as HTMLElement).style.getPropertyValue('--tail-x'));
    return { x: left - (element as HTMLElement).offsetWidth / 2 + tailX, width };
  });
  expect(Math.abs(tail.x - actor.x / 960 * tail.width)).toBeLessThan(3);
}

test('loads straight into the map and reaches naming only through the bottom-right letter', async ({ page }) => {
  await start(page);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await state(page)).leader).toEqual({ x: 190, y: 190 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Our dreamy GN world');
  await expect(page.locator('aside')).toHaveCount(0);
  await expect(page.locator('#interaction-description')).toHaveText('Walk to an E marker, then press E or click.');
  await expect(page.locator('.walk-tutorial')).toContainText('WASD');
  await expect(page.locator('.direction-keys kbd')).toHaveCount(4);
  await expect(page.locator('.key-up')).toHaveText('↑W');
  await expect(page.locator('.key-left')).toHaveText('←A');
  await expect(page.locator('.key-down')).toHaveText('↓S');
  await expect(page.locator('.key-right')).toHaveText('→D');
  await page.screenshot({ path: 'test-results/intro-map.png', fullPage: true });
  await clickObject(page, 805, 429);
  await expect(page.locator('#toast')).toContainText('Walk closer');
  await walkTo(page, 793, 461);
  await expect(page.locator('#interaction-description')).toHaveText('Walk to an E marker, then press E or click.');
  await clickObject(page, 805, 374); // The large E marker is also clickable.
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('His name')).toBeVisible();
  await page.screenshot({ path: 'test-results/letter-naming.png', fullPage: true });
  await page.getByRole('button', { name: 'Close naming menu', exact: true }).click();
  expect((await state(page)).flags).toEqual([]);
});

test('all bouquets, required restaurant route, character speech, memory, checkpoints and refresh', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  const images: string[] = []; page.on('request', (request) => { if (request.resourceType() === 'image') images.push(request.url()); });
  await start(page); await intro(page, true);
  await clickObject(page, 766, 404);
  await expect(page.locator('#toast')).toContainText('Walk closer');
  await guide(page); await page.keyboard.press('e');
  await expectSpeech(page, 'person-b', 'those are ugly');
  expect((await state(page)).flags).not.toContain('flowers-bought');
  await clickObject(page, 143, 185); // The illustrated bouquet's upper petals are clickable, too.
  await expectSpeech(page, 'person-b', 'those are ugly');
  expect((await state(page)).flags).not.toContain('flowers-bought');
  await page.screenshot({ path: 'test-results/flowers-speech.png', fullPage: true });
  await expect(page.locator('#speech-bubble')).toBeHidden({ timeout: 4000 });
  await walkTo(page, 311, 281); await clickObject(page, 311, 239);
  await expectSpeech(page, 'person-b', 'I wish you chose these');
  await walkTo(page, 227, 281); await page.keyboard.press('e');
  await expectSpeech(page, 'person-b', 'A for effort');
  await expect.poll(async () => (await state(page)).flags.includes('flowers-bought')).toBe(true);
  await expect(page.locator('#speech-bubble')).toBeHidden({ timeout: 4000 });
  await expect(page.getByRole('button', { name: 'See this memory', exact: true })).toBeVisible();
  await page.keyboard.press('e');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-flowers-themed\.webp$/);
  await page.keyboard.press('e');
  const flowersFlags = (await state(page)).flags;
  await page.keyboard.press('e');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-flowers-themed\.webp$/);
  await page.keyboard.press('e');
  await walkTo(page, 143, 281); await clickObject(page, 143, 239);
  await expectSpeech(page, 'person-b', "I'm hangry");
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await state(page)).flags).toEqual(flowersFlags);

  await walkTo(page, 766, 447); await page.keyboard.press('e');
  await expectSpeech(page, 'person-b', "let's try the other restaurants first.");
  expect((await state(page)).flags).not.toContain('katsu-shared');
  await guide(page); await page.keyboard.press('e');
  await expectSpeech(page, 'person-a', closedRestaurant.text);
  await expect.poll(async () => (await state(page)).flags.includes('closed-visited')).toBe(true);
  await page.screenshot({ path: 'test-results/closed-restaurant.png', fullPage: true });
  await guide(page); await clickObject(page, 190, 428);
  await expectSpeech(page, 'person-b', 'this place is delivery only!');
  await expect.poll(async () => (await state(page)).flags.includes('delivery-visited')).toBe(true);
  await page.screenshot({ path: 'test-results/delivery-restaurant.png', fullPage: true });
  await guide(page); await page.keyboard.press('e');
  await expectSpeech(page, 'person-b', 'let me find a place.');
  await expect(page.locator('#speech-bubble')).not.toContainText('Press Q');
  expect((await state(page)).mode).toBe('exploring');
  await page.keyboard.press('q'); await expect.poll(async () => (await state(page)).leaderId).toBe('person-b');
  await page.getByRole('button', { name: 'Open memory' }).click();
  await expectSpeech(page, 'person-b', "you're lucky I like you");
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.screenshot({ path: 'test-results/katsu-speech.png', fullPage: true });
  await page.getByRole('button', { name: 'See this memory' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Show original view' }).click();
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-date-1-original\.webp$/);
  await expect(page.locator('.picture-view-label')).toHaveText('Original view');
  const seated = (await state(page)).leader;
  await expect(page.locator('.photo-navigation')).toContainText('1 / 2');
  await page.keyboard.press('d');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-date-2-original\.webp$/);
  await expect(page.locator('.photo-navigation')).toContainText('2 / 2');
  await page.keyboard.press('a');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-date-1-original\.webp$/);
  await page.locator('.memory-picture').click();
  await page.keyboard.press('d');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-date-2-themed\.webp$/);
  expect((await state(page)).leader).toEqual(seated);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).flags.includes('katsu-shared')).toBe(true);
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  await guide(page); await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'Ice cream after our first date' })).toBeVisible();
  await page.keyboard.press('e');
  await expect(page.getByText('A first date to remember', { exact: true })).toBeVisible();
  await expect.poll(async () => (await state(page)).completed).toEqual(['introduction', 'korea-first-date']);
  await page.getByRole('button', { name: 'To the railway' }).click();
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  await page.screenshot({ path: 'test-results/korea-complete.png', fullPage: true });
  await page.reload(); await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(async () => (await state(page)).sceneId).toBe('introduction');
  expect((await state(page)).flags).toEqual([]);
  expect(errors).toEqual([]);
  expect(images.length).toBeGreaterThan(0);
  const fetchedImages = images.filter((url) => url.startsWith('http'));
  expect(fetchedImages.length).toBeGreaterThan(0);
  expect(fetchedImages.every((url) => url.startsWith('http://127.0.0.1:5173/annivgame/assets/'))).toBe(true);
});

test('decorative benches and shops do not block walking; switching and following stay bounded', async ({ page }) => {
  await start(page);
  await walkTo(page, 210, 310); await walkTo(page, 210, 200); // Through the decorative bench.
  expect((await state(page)).leader.y).toBeLessThan(220);
  const moved = await state(page);
  expect(Math.hypot(moved.leader.x - moved.follower.x, moved.leader.y - moved.follower.y)).toBeLessThan(75);
  await page.keyboard.press('q'); const swapped = await state(page);
  expect(swapped.leaderId).toBe('person-b'); expect(swapped.leader.x).toBeCloseTo(moved.follower.x, 0);
  expect(swapped.follower).toEqual(moved.leader);
  const horizontal = Math.abs(swapped.leader.x - swapped.follower.x) >= Math.abs(swapped.leader.y - swapped.follower.y);
  const facingLeader = horizontal ? swapped.follower.x < swapped.leader.x ? 'west' : 'east' : swapped.follower.y < swapped.leader.y ? 'north' : 'south';
  const opposite = { west: 'east', east: 'west', north: 'south', south: 'north' };
  expect(swapped.directions['person-b']).toBe(facingLeader);
  expect(swapped.directions['person-a']).toBe(opposite[facingLeader]);
  await page.keyboard.down('w'); await page.waitForTimeout(1500); await page.keyboard.up('w');
  expect((await state(page)).leader.y).toBeGreaterThanOrEqual(105);
  await page.keyboard.down('a'); await page.waitForTimeout(1800); await page.keyboard.up('a');
  expect((await state(page)).leader.x).toBeGreaterThanOrEqual(60);
  expect((await state(page)).trailLength).toBeLessThan(101);
  await intro(page);
  await guide(page);
  await walkTo(page, 143, 130); // Through the flower shop artwork.
  expect((await state(page)).leader.y).toBeLessThan(150);
});

test('typing names and held inputs cannot move or instantly close the menu', async ({ page }) => {
  await start(page); await guide(page);
  await page.keyboard.down('e'); await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.down('e'); await page.waitForTimeout(120); await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.up('e');
  await page.getByLabel('His name').fill('Wade');
  await page.getByLabel('Her name').fill('Sam');
  const before = await state(page);
  await page.getByRole('button', { name: 'Close naming menu', exact: true }).focus();
  await page.keyboard.down('d'); await page.waitForTimeout(250);
  expect((await state(page)).leader.x).toBeCloseTo(before.leader.x, 1);
  await page.getByRole('button', { name: 'These are our names' }).click();
  await page.getByRole('button', { name: "Let's go to Korea" }).click();
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  const stationary = await state(page);
  await page.waitForTimeout(250); expect((await state(page)).leader.x).toBeCloseTo(stationary.leader.x, 1);
  await page.keyboard.up('d');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Back to us' }).click();
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
});

test('restart returns straight to the map and keeps naming/menu input safe across teardown', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await start(page); await intro(page, true);
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.getByRole('button', { name: 'Begin again', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, begin again' }).click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('introduction');
  await expect.poll(async () => (await state(page)).mode).toBe('exploring');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await state(page)).flags).toEqual([]);
  await guide(page); await page.keyboard.press('e');
  await expect(page.getByLabel('His name')).toHaveValue('Alex');
  await expect(page.getByLabel('Her name')).toHaveValue('Sam');
  await page.getByLabel('His name').focus(); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await state(page)).flags).toEqual([]);
  await page.keyboard.press('e'); await page.getByRole('button', { name: 'These are our names' }).click();
  await page.getByRole('button', { name: "Let's go to Korea" }).click();
  await expect.poll(async () => (await state(page)).sceneId).toBe('korea-first-date');
  expect((await state(page)).completed).toEqual(['introduction']);
  await page.keyboard.press('q'); await expect.poll(async () => (await state(page)).leaderId).toBe('person-b');
  expect(errors).toEqual([]);
});

test('one-line title, in-world controls and naming fit a short laptop window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); await start(page);
  const help = await page.locator('.control-strip').boundingBox();
  expect(help!.y + help!.height).toBeLessThanOrEqual(720);
  const world = (await page.locator('.world-frame').boundingBox())!;
  const tools = (await page.locator('.map-tools').boundingBox())!;
  expect(tools.x).toBeGreaterThan(world.x); expect(tools.y + tools.height).toBeLessThan(world.y + world.height);
  await page.screenshot({ path: 'test-results/garden-laptop.png', fullPage: true });
  await guide(page); await page.keyboard.press('e');
  const dialog = await page.getByRole('dialog').boundingBox();
  expect(dialog!.y).toBeGreaterThanOrEqual(0); expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(720);
  await page.screenshot({ path: 'test-results/naming-laptop.png', fullPage: true });
});

test('first-date role and forgotten-flowers replies use the intended speaker without revealing Q instructions', async ({ page }) => {
  test.setTimeout(120000);
  await start(page); await intro(page);
  const originalFlags = (await state(page)).flags;
  for (const spot of [
    { x: 675, y: 242, approachY: 282, text: 'OOPS I forgot to get her nice flowers' },
    { x: 190, y: 428, approachY: 465, text: 'OOPS I forgot to get baby nice flowers' },
    { x: 766, y: 404, approachY: 447, text: 'OOPS I forgot to get her nice flowers' },
    { x: 478, y: 424, approachY: 467, text: 'OOPS I forgot to get her nice flowers' },
  ]) {
    await walkTo(page, spot.x, spot.approachY);
    await clickObject(page, spot.x, spot.y);
    await expectSpeech(page, 'person-a', spot.text);
    expect((await state(page)).flags).toEqual(originalFlags);
    await expect(page.locator('#interaction-description')).toHaveText('Walk to an E marker, then press E or click.');
  }
  await guide(page); await page.keyboard.press('q'); await page.keyboard.press('e');
  await expectSpeech(page, 'person-b', "shouldn't you know which flowers I like?");
  expect((await state(page)).flags).not.toContain('flowers-bought');
  await page.keyboard.press('q'); await walkTo(page, 227, 281); await clickObject(page, 227, 239);
  await expectSpeech(page, 'person-b', 'A for effort');
  await page.keyboard.press('e'); await page.keyboard.press('e');
  await walkTo(page, 675, 282); await page.keyboard.press('q'); await clickObject(page, 675, 242);
  await expectSpeech(page, 'person-b', "shouldn't you be leading us on our first date?");
  expect((await state(page)).flags).not.toContain('closed-visited');
  await page.keyboard.press('q'); await clickObject(page, 675, 242);
  await expectSpeech(page, 'person-a', closedRestaurant.text);
  await walkTo(page, 190, 465); await page.keyboard.press('q'); await clickObject(page, 190, 428);
  await expectSpeech(page, 'person-b', "shouldn't you be leading us on our first date?");
  expect((await state(page)).flags).not.toContain('delivery-visited');
  await page.keyboard.press('q'); await clickObject(page, 190, 428);
  await expectSpeech(page, 'person-b', 'this place is delivery only!');
  expect((await state(page)).flags).toContain('delivery-visited');
  await walkTo(page, 766, 447); await clickObject(page, 766, 404);
  await expectSpeech(page, 'person-b', 'let me find a place.');
  await expect(page.locator('#speech-bubble')).not.toContainText('Q');
  await expect(page.locator('#interaction-description')).toHaveText('Walk to an E marker, then press E or click.');
  await page.keyboard.press('q'); await clickObject(page, 766, 404);
  await expectSpeech(page, 'person-b', "you're lucky I like you");
  await page.keyboard.press('e');
  await expect(page.locator('.memory-picture img')).toHaveAttribute('src', /real-date-1-themed\.webp$/);
  await page.keyboard.press('e');
  expect((await state(page)).flags).toContain('katsu-shared');
});
