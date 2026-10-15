import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('production starts on the map and loads the updated scene flow under the GitHub project base', async ({ page }) => {
  const failures: string[] = []; const errors: string[] = [];
  page.on('response', (response) => { if (response.status() >= 400) failures.push(response.url()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('canvas')).not.toHaveAttribute('data-debug');
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.getByRole('button', { name: 'Bring us to the next dreamy stop' }).click();
  await expect(page.getByRole('button', { name: 'Read the letter' })).toBeEnabled();
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'What should we call each other?' })).toBeVisible();
  await page.getByRole('button', { name: 'These are our names' }).click();
  await page.getByRole('button', { name: "Let's go to Korea" }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Our dreamy GN world');
  await expect(page.locator('#interaction-title')).toHaveText('Our first date');
  await expect(page.getByRole('button', { name: 'Pause & help' })).toBeEnabled();
  await page.getByRole('button', { name: 'Pause & help' }).click();
  await page.getByRole('button', { name: 'Bring us to the next dreamy stop' }).click();
  await expect(page.getByRole('button', { name: 'Choose bouquet' })).toBeEnabled();
  await page.keyboard.press('e');
  await expect(page.locator('#speech-bubble')).toContainText('those are ugly');
  await expect(page.locator('#speech-bubble')).toHaveAttribute('data-speaker-id', 'person-b');
  expect(failures).toEqual([]); expect(errors).toEqual([]);
});

test('production reader loads real photo assets under the project base and completes the full story', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = []; const failures: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) failures.push(response.url()); });
  const manifest = JSON.parse(readFileSync('public/content/game.json', 'utf8'));
  const originals = new Set<string>();
  await page.goto('./?reader=1');
  for (const file of manifest.sceneFiles) {
    const scene = JSON.parse(readFileSync('public/' + file, 'utf8'));
    for (const interaction of scene.interactions) {
      await page.locator('[data-interaction-id="' + interaction.id + '"]').click();
      const pictures = page.locator('.memory-picture img');
      for (const picture of await pictures.all()) {
        await expect(picture).toHaveAttribute('src', /\/annivgame\/assets\/memories\/.*\.webp$/);
        await expect.poll(async () => picture.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await expect(picture).toHaveCSS('object-fit', 'contain');
      }
      if (interaction.kind === 'railway') await expect(pictures).toHaveCount(4);
      if (interaction.kind === 'scrapbook') await expect(pictures).toHaveCount(5);
      if (interaction.id === 'austin-photo-booth') {
        await expect(pictures).toHaveCount(1);
        await expect(page.getByRole('button', { name: 'Original photo', exact: true })).toHaveCount(1);
      }
      if (await page.getByRole('button', { name: 'Show original view', exact: true }).count()) {
        await page.getByRole('button', { name: 'Show original view', exact: true }).first().click();
      }
      for (const picture of await pictures.all()) {
        const src = (await picture.getAttribute('src'))!;
        expect(src).toMatch(/\/annivgame\/assets\/memories\/.*-original\.webp$/);
        originals.add(src);
        await expect.poll(async () => picture.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      }
      if (interaction.kind === 'ending') await expect(page.locator('.final-letter p')).toHaveText(interaction.letter);
      await page.getByRole('button', { name: 'Mark this stop read', exact: true }).click();
    }
    await page.locator('[data-action="advance"]').click();
    await expect(page.locator('#chapter-title')).toHaveText('Our dreamy GN world');
  }
  expect(originals.size).toBe(35);
  await page.getByRole('button', { name: 'Return to the map', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('canvas')).not.toHaveAttribute('data-debug');
  await expect(page.locator('#chapter-title')).toHaveText('Our dreamy GN world');
  await expect(page.locator('#interaction-title')).toHaveText('Madeira');
  await page.locator('#world-travel [data-scene-id="austin-francine"]').click();
  await expect(page.locator('#interaction-title')).toHaveText('Francine and settling in');
  expect(errors).toEqual([]); expect(failures).toEqual([]);
});
