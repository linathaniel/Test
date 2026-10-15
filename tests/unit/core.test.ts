import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateStory, validatePath, type Story, type Interaction } from '../../src/content/model';
import { gateInteraction, Session } from '../../src/state/session';
import { clearLine, direction, isSafe } from '../../src/world/geometry';
import { interactionTargets, isNearby, nearestInteraction } from '../../src/world/interactions';

const manifest = JSON.parse(readFileSync('public/content/game.json', 'utf8'));
const story: Story = { manifest, scenes: manifest.sceneFiles.map((file: string) => JSON.parse(readFileSync(`public/${file}`, 'utf8'))) };
function startDate() {
  const session = new Session(story);
  session.update({ mode: 'reading' }); session.finish(story.scenes[0].interactions[0]); session.advance();
  session.update({ mode: 'exploring' }); return session;
}
const date = story.scenes[1];
const flowers = date.interactions.find((i) => i.id === 'flower-shop')!;
const closed = date.interactions.find((i) => i.id === 'closed-restaurant')!;
const delivery = date.interactions.find((i) => i.id === 'delivery-restaurant')!;
const katsu = date.interactions.find((i) => i.id === 'katsu')!;
const iceCream = date.interactions.find((i) => i.id === 'ice-cream')!;
describe('story contracts', () => {
  it('validates all nine authored scene fixtures', () => expect(() => validateStory(story)).not.toThrow());
  it('rejects scene loops instead of silently stranding progress', () => {
    const broken = structuredClone(story); broken.scenes[0].nextSceneId = broken.scenes[0].id;
    expect(() => validateStory(broken)).toThrow('scene chain');
  });
  it('rejects impossible prerequisite chains', () => {
    const broken = structuredClone(story); broken.scenes[1].interactions[0].requires = ['katsu-shared'];
    expect(() => validateStory(broken)).toThrow('prerequisites');
  });
  it('rejects an invalid leader and explicitly blocked spawn', () => {
    const broken = structuredClone(story); (broken.scenes[1].interactions[0] as unknown as { requiredLeaderId: string }).requiredLeaderId = 'someone-else';
    expect(() => validateStory(broken)).toThrow('unknown required leader');
    const blocked = structuredClone(story); blocked.scenes[1].obstacles.push({ x: 390, y: 275, width: 40, height: 30 });
    expect(() => validateStory(blocked)).toThrow('collides');
  });
  it('does not permit external or traversal asset paths', () => {
    for (const path of ['../photo.jpg', '/photo.jpg', 'https://example.com/a.png', 'C:\\photo.png']) expect(() => validatePath(path)).toThrow();
  });
  it('limits barriers to the authored Madeira route and keeps decorative scenery elsewhere free', () => {
    expect(story.scenes.filter((scene) => scene.id !== 'madeira').every((scene) => scene.obstacles.length === 0)).toBe(true);
    expect(story.scenes.find((scene) => scene.id === 'madeira')!.obstacles.length).toBeGreaterThan(0);
    expect(story.scenes[0].interactions[0].kind).toBe('naming');
    expect(story.scenes[0].spawn.leader.x).toBeLessThan(240);
    expect(story.scenes[0].spawn.leader.y).toBeLessThan(210);
  });
  it('rejects an unknown speaker rather than anchoring text to the wrong character', () => {
    const broken = structuredClone(story); (broken.scenes[1].interactions[0] as unknown as { speakerId: string }).speakerId = 'shopkeeper';
    expect(() => validateStory(broken)).toThrow('speakerId');
  });
  it('rejects a disconnected Madeira promenade even when every approach point is individually clear', () => {
    const broken = structuredClone(story);
    broken.scenes.find((scene) => scene.id === 'madeira')!.obstacles.push({ x: 95, y: 260, width: 810, height: 20 });
    expect(() => validateStory(broken)).toThrow('unreachable spawn/approach');
  });
  it('rejects a blocked interaction ray even when the approach can be reached', () => {
    const broken = structuredClone(story);
    broken.scenes.find((scene) => scene.id === 'madeira')!.obstacles.push({ x: 470, y: 160, width: 20, height: 5 });
    expect(() => validateStory(broken)).toThrow('blocked approach line');
  });
});
describe('progress and role gates', () => {
  it('requires flowers, closed restaurant, delivery counter, then her leadership', () => {
    const session = startDate();
    expect(gateInteraction(closed, session.state)).toBe('locked');
    expect(gateInteraction(delivery, session.state)).toBe('locked');
    expect(gateInteraction(katsu, session.state)).toBe('locked');
    session.recordChoice(flowers.id, 'roses'); session.finish(flowers);
    expect(gateInteraction(closed, session.state)).toBe('ready');
    expect(session.finish(delivery)).toBe(false); expect(session.state.flags).not.toContain('delivery-visited');
    session.finish(closed);
    expect(gateInteraction(delivery, session.state)).toBe('ready');
    expect(gateInteraction(katsu, session.state)).toBe('locked');
    session.finish(delivery);
    expect(gateInteraction(katsu, session.state)).toBe('wrong-leader');
    expect(session.finish(katsu)).toBe(false); expect(session.state.flags).not.toContain('katsu-shared');
    session.setLeader('person-b'); expect(gateInteraction(katsu, session.state)).toBe('ready');
    expect(session.finish(katsu)).toBe(false); expect(session.state.flags).toContain('katsu-shared');
    expect(session.state.mode).toBe('exploring');
    expect(gateInteraction(iceCream, session.state)).toBe('ready');
    expect(session.finish(iceCream)).toBe(true); expect(session.state.mode).toBe('checkpoint');
    expect(katsu.speakerId).toBe('person-b'); expect(katsu.wrongLeaderSpeakerId).toBe('person-b');
  });
  it('rejected/unselected bouquets cannot complete an interaction', () => {
    const session = startDate();
    expect(session.finish(flowers)).toBe(false);
    session.recordChoice(flowers.id, 'ugly'); expect(session.finish(flowers)).toBe(false);
    session.recordChoice(flowers.id, 'tulips'); expect(session.finish(flowers)).toBe(false);
    expect(session.state.flags).not.toContain('flowers-bought');
  });
  it('completion is idempotent and cannot skip a checkpoint', () => {
    const session = new Session(story); expect(session.advance()).toBe(false);
    session.finish(story.scenes[0].interactions[0]); expect(session.state.completedSceneIds).toEqual(['introduction']);
    session.finish(story.scenes[0].interactions[0]); expect(session.state.completedSceneIds).toEqual(['introduction']);
    session.update({ mode: 'checkpoint' }); expect(session.advance()).toBe(true); expect(session.advance()).toBe(false);
  });
  it('restart/new session has no persisted flags but can keep current greeting', () => {
    const session = startDate(); session.name({ names: { 'person-a': 'Alex', 'person-b': 'Sam' }, greeting: 'Our note' });
    session.restart(); expect(session.state.flags).toEqual([]); expect(session.state.sceneId).toBe('introduction');
    expect(session.state.profile.greeting).toBe('Our note'); expect(new Session(story).state.flags).toEqual([]);
  });
  it('interpolates names without inventing dialogue', () => {
    const session = new Session(story);
    expect(session.interpolate('{person-b}: {greeting}')).toContain(story.manifest.greeting);
  });
});
describe('movement and interaction geometry', () => {
  it('connects every Madeira approach along the promenade while keeping garden and coastal shortcuts blocked', () => {
    const island = story.scenes.find((scene) => scene.id === 'madeira')!;
    const queue = [island.spawn.leader]; const reached = new Set([`${queue[0].x},${queue[0].y}`]);
    for (let index = 0; index < queue.length; index++) {
      const point = queue[index];
      for (const [dx, dy] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) {
        const next = { x: point.x + dx, y: point.y + dy }; const key = `${next.x},${next.y}`;
        if (!reached.has(key) && isSafe(next, island.obstacles) && clearLine(point, next, island.obstacles)) { reached.add(key); queue.push(next); }
      }
    }
    for (const point of [island.spawn.leader, island.spawn.companion, ...island.interactions.flatMap((interaction) => [interaction.approach, interaction.position])]) {
      expect(isSafe(point, island.obstacles)).toBe(true);
      expect(reached.has(`${point.x},${point.y}`)).toBe(true);
    }
    for (const interaction of island.interactions) expect(isNearby(interaction, interaction.approach, island.obstacles)).toBe(true);
    for (const point of [{ x: 80, y: 310 }, { x: 300, y: 310 }, { x: 650, y: 310 }, { x: 925, y: 310 }]) expect(isSafe(point, island.obstacles)).toBe(false);
    expect(clearLine({ x: 155, y: 310 }, { x: 480, y: 310 }, island.obstacles)).toBe(false);
  });
  it('normalizes diagonals, and opposing keys cancel', () => {
    expect(Math.hypot(...Object.values(direction(new Set(['KeyW', 'KeyD']))))).toBeCloseTo(1);
    expect(direction(new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD']))).toEqual({ x: 0, y: 0 });
  });
  it('rejects interactions across an authored obstacle and accepts a clear approach', () => {
    expect(clearLine({ x: 0, y: 5 }, { x: 20, y: 5 }, [{ x: 8, y: 0, width: 4, height: 10 }])).toBe(false);
    expect(isNearby(flowers, flowers.approach, date.obstacles)).toBe(true);
    expect(isNearby(flowers, { x: 182, y: 394 }, date.obstacles)).toBe(false);
  });
  it('selects the closest eligible target deterministically', () => {
    const one = { ...closed, id: 'a', position: { x: 20, y: 110 }, radius: 80 } as Interaction;
    const two = { ...closed, id: 'b', position: { x: 20, y: 110 }, radius: 80 } as Interaction;
    expect(nearestInteraction([two, one], { x: 10, y: 110 }, [])?.id).toBe('a');
  });
  it('exposes three separate window targets so E and clicks choose the same bouquet', () => {
    const targets = interactionTargets([flowers]);
    expect(targets.map((target) => target.optionId)).toEqual(['ugly', 'roses', 'tulips']);
    expect(new Set(targets.map((target) => target.position.x)).size).toBe(3);
    for (const target of targets) expect(nearestInteraction([flowers], target.approach, [])?.id).toBe(target.id);
  });
});
