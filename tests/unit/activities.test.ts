import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type Interaction, type PuzzleInteraction, type RailwayInteraction, type ScrapbookInteraction, type Story, type VehicleInteraction, validateStory } from '../../src/content/model';
import { gateInteraction, Session } from '../../src/state/session';

const manifest = JSON.parse(readFileSync('public/content/game.json', 'utf8'));
const story: Story = { manifest, scenes: manifest.sceneFiles.map((file: string) => JSON.parse(readFileSync(`public/${file}`, 'utf8'))) };
function at(sceneId: string) {
  const session = new Session(story);
  while (session.scene.id !== sceneId) {
    for (const interaction of session.scene.interactions) session.completeInReader(interaction);
    if (!session.advance()) throw new Error(`Could not reach ${sceneId}`);
  }
  session.update({ mode: 'exploring' }); return session;
}
function find<T extends Interaction>(session: Session, id: string): T {
  return session.scene.interactions.find((interaction) => interaction.id === id) as T;
}
function* permutations<T>(items: T[]): Generator<T[]> {
  if (!items.length) { yield []; return; }
  for (let index = 0; index < items.length; index++) {
    for (const rest of permutations(items.filter((_, position) => position !== index))) yield [items[index], ...rest];
  }
}

describe('activity content contracts', () => {
  it('keeps the complete authored chain and explicit-only obstacles', () => {
    expect(story.scenes.map((scene) => scene.id)).toEqual(['introduction', 'korea-first-date', 'korea-railway', 'korea-smurf', 'korea-petite-france', 'austin-museum', 'norway-scrapbook', 'austin-francine', 'madeira']);
    expect(story.scenes.filter((scene) => scene.id !== 'madeira').every((scene) => scene.obstacles.length === 0)).toBe(true);
    expect(() => validateStory(story)).not.toThrow();
  });
  it('validates the proposal E reveal opt-in and requires a final photo to reveal', () => {
    const ending = story.scenes.at(-1)!.interactions.find((interaction) => interaction.kind === 'ending')!;
    expect(ending.kind === 'ending' && ending.eRevealsFinalPhoto).toBe(true);
    expect(story.scenes.at(-1)!.checkpoint.text).toContain('Previous chapter / Next chapter');
    const broken = structuredClone(story);
    const proposal = broken.scenes.at(-1)!.interactions.find((interaction) => interaction.kind === 'ending') as Extract<Interaction, { kind: 'ending' }>;
    (proposal as unknown as { eRevealsFinalPhoto: unknown }).eRevealsFinalPhoto = 'true';
    expect(() => validateStory(broken)).toThrow('E reveal must be boolean');
    proposal.eRevealsFinalPhoto = true; delete proposal.memory.additionalPhotos;
    expect(() => validateStory(broken)).toThrow('E reveal needs an additional photo');
    proposal.eRevealsFinalPhoto = false;
    expect(() => validateStory(broken)).not.toThrow();
  });
  it('rejects duplicated/missing floor letters and a different solution', () => {
    const broken = structuredClone(story);
    const puzzle = broken.scenes[3].interactions[0] as PuzzleInteraction;
    puzzle.letters[0] = puzzle.letters[1];
    expect(() => validateStory(broken)).toThrow('puzzle letters');
    puzzle.letters = [...(story.scenes[3].interactions[0] as PuzzleInteraction).letters];
    puzzle.letters[0] = 'Z'; expect(() => validateStory(broken)).toThrow('A–Y');
    puzzle.letters = [...(story.scenes[3].interactions[0] as PuzzleInteraction).letters];
    puzzle.solution = ['S', 'M', 'U', 'R', 'A']; expect(() => validateStory(broken)).toThrow('SMURF');
  });
  it('rejects invalid railway cadence, stop placement, and page roles', () => {
    const broken = structuredClone(story);
    const railway = broken.scenes[2].interactions[0] as RailwayInteraction;
    railway.pedalsPerSegment = 1.5; expect(() => validateStory(broken)).toThrow('integer');
    railway.pedalsPerSegment = 4; railway.stops[0].position.x = 999; expect(() => validateStory(broken)).toThrow('bounds');
    const bookStory = structuredClone(story);
    (bookStory.scenes[6].interactions[0] as ScrapbookInteraction).pageLeaderIds = ['person-a'];
    expect(() => validateStory(bookStory)).toThrow('page leader count');
  });
  it('rejects driving fixtures without a vehicle or the correct driver gate', () => {
    const broken = structuredClone(story); delete broken.scenes[7].vehicle;
    expect(() => validateStory(broken)).toThrow('scene vehicle');
    const wrongDriver = structuredClone(story);
    (wrongDriver.scenes[7].interactions[0] as VehicleInteraction).requiredLeaderId = 'person-b';
    expect(() => validateStory(wrongDriver)).toThrow('its driver');
  });
  it('provides three safe replay signs plus the boarding photo and rejects an unreachable sign approach', () => {
    const rail = story.scenes[2].interactions[0] as RailwayInteraction;
    expect(rail.stops.map((stop) => stop.position.x)).toEqual([385, 615, 845]);
    expect(rail.stops.map((stop) => stop.signPosition)).toEqual([385, 615, 845].map((x) => ({ x, y: 430 })));
    expect(rail.stops.map((stop) => stop.signApproach)).toEqual([385, 615, 845].map((x) => ({ x, y: 465 })));
    expect(rail.boardingMemory?.originalAsset).toBe('assets/memories/real-rail-2-original.webp');
    expect(rail.stops.map((stop) => stop.memory.originalAsset)).toEqual([1, 3, 4].map((number) => 'assets/memories/real-rail-' + number + '-original.webp'));
    expect(rail.stops.map((stop) => stop.disembark ?? false)).toEqual([false, false, true]);
    const broken = structuredClone(story);
    (broken.scenes[2].interactions[0] as RailwayInteraction).stops[0].signApproach = { x: 600, y: 465 };
    expect(() => validateStory(broken)).toThrow('sign approach outside range');
  });
  it('gives every photo its own interaction except the katsu album, five-page book and proposal sequence', () => {
    const memories = story.scenes.flatMap((scene) => scene.interactions.flatMap((interaction) =>
      interaction.kind === 'railway' ? [...interaction.boardingMemory ? [interaction.boardingMemory] : [], ...interaction.stops.map((stop) => stop.memory)]
        : interaction.kind === 'scrapbook' ? interaction.pages
          : 'memory' in interaction && interaction.memory ? [interaction.memory] : []));
    const grouped = memories.filter((memory) => memory.additionalPhotos?.length);
    expect(grouped.map((memory) => memory.id)).toEqual(['katsu', 'madeira-proposal']);
    const originals = memories.flatMap((memory) => [memory.originalAsset, ...memory.additionalPhotos?.map((photo) => photo.originalAsset) ?? []]);
    expect(originals).toHaveLength(35); expect(new Set(originals).size).toBe(35);
    expect((story.scenes[6].interactions[0] as ScrapbookInteraction).pages).toHaveLength(5);
    expect(story.scenes.reduce((count, scene) => count + scene.interactions.length, 0)).toBe(30);
  });
  it('keeps the exact greeting, dreamy title, and clue-free puzzle instruction', () => {
    expect(story.manifest.title).toBe('Our dreamy GN world');
    expect(story.manifest.greeting).toBe('Three years of adventure and hardship. Three years of love and laughter. Three years of you and me.');
    const puzzle = story.scenes[3].interactions[0];
    expect(puzzle.text).not.toMatch(/S, M|solution|hint/i);
    expect(story.scenes[7].title).toBe('Francine and settling in');
    expect(story.scenes[8].title).toBe('Madeira');
    expect((story.scenes[2].interactions[0] as RailwayInteraction).stops[2].memory.label).toBe('Another fall foliage date!');
  });
});

describe('first-date food reminders and roles', () => {
  it('prioritizes Nathaniel’s missing-flowers reminder and preserves the supplied Gracie lines', () => {
    const session = at('korea-first-date');
    const food = ['closed-restaurant', 'delivery-restaurant', 'katsu', 'ice-cream'].map((id) => find(session, id));
    session.update({ flags: ['closed-visited', 'delivery-visited', 'katsu-shared'] });
    for (const stop of food) {
      expect(gateInteraction(stop, session.state)).toBe('locked');
      expect(session.completeInReader(stop)).toBe(false);
      const reminder = stop.id === 'delivery-restaurant' ? 'OOPS I forgot to get baby nice flowers' : 'OOPS I forgot to get her nice flowers';
      expect(stop.prerequisiteOverrides).toEqual([{ missingFlag: 'flowers-bought', text: reminder, speakerId: 'person-a' }]);
    }
    session.update({ flags: [] });
    const flowers = find(session, 'flower-shop'); session.setLeader('person-b');
    expect(gateInteraction(flowers, session.state)).toBe('wrong-leader');
    expect(flowers.wrongLeaderText).toBe("shouldn't you know which flowers I like?");
    session.setLeader('person-a'); session.recordChoice(flowers.id, 'roses'); session.finish(flowers);
    for (const id of ['closed-restaurant', 'delivery-restaurant']) {
      const stop = find(session, id); session.setLeader('person-b');
      expect(gateInteraction(stop, session.state)).toBe('wrong-leader');
      expect(stop.wrongLeaderText).toBe("shouldn't you be leading us on our first date?");
      expect(stop.wrongLeaderSpeakerId).toBe('person-b');
      session.setLeader('person-a'); session.finish(stop);
    }
    expect(find(session, 'delivery-restaurant').text).toBe('this place is delivery only!');
    expect(find(session, 'delivery-restaurant').speakerId).toBe('person-b');
    expect(find(session, 'katsu').wrongLeaderText).toBe('let me find a place.');
  });
});

describe('museum mirror role', () => {
  it('requires Gracie for the mirror photo and gives her supplied wrong-leader line', () => {
    const session = at('austin-museum');
    session.completeInReader(find(session, 'museum-pink')); session.completeInReader(find(session, 'museum-more-pink'));
    const mirror = find(session, 'museum-sprinkles');
    expect(gateInteraction(mirror, session.state)).toBe('wrong-leader');
    expect(mirror.wrongLeaderText).toBe('I want to take a silly mirror pic');
    expect(mirror.wrongLeaderSpeakerId).toBe('person-b');
    session.setLeader('person-b'); expect(session.finish(mirror)).toBe(true);
  });
});

describe('railway cadence and recovery', () => {
  it('requires the male pedaler and four intentional actions per scenic stop', () => {
    const session = at('korea-railway');
    const rail = find<RailwayInteraction>(session, 'railway-car');
    session.update({ railwayId: rail.id }); session.setLeader('person-b');
    expect(session.pedal(rail)).toEqual({ accepted: false, stopIndex: null, count: 0, progress: 0 });
    expect(session.state.counters[rail.id]).toBeUndefined(); expect(rail.wrongLeaderText).toBe("I'm tired :(");
    session.setLeader('person-a');
    for (let stop = 0; stop < 3; stop++) {
      for (let press = 0; press < 4; press++) {
        const count = stop * 4 + press + 1;
        expect(session.pedal(rail)).toEqual({ accepted: true, stopIndex: press === 3 ? stop : null, count, progress: count / 12 });
        expect(session.state.mode).toBe('travelling');
        expect(session.pedal(rail).accepted).toBe(false);
        expect(session.state.counters[rail.id]).toBe(count);
        session.update({ mode: 'exploring' });
      }
      expect(session.state.counters[rail.id]).toBe((stop + 1) * 4);
      if (stop < 2) expect(session.finish(rail)).toBe(false);
    }
    expect(session.pedal(rail).accepted).toBe(false); expect(session.finish(rail)).toBe(true);
    expect(session.state.flags).toContain('railway-finished');
  });
  it('does not finish a train that was only boarded', () => {
    const session = at('korea-railway'); const rail = find<RailwayInteraction>(session, 'railway-car');
    expect(session.pedal(rail).accepted).toBe(false);
    session.update({ railwayId: rail.id }); expect(session.finish(rail)).toBe(false);
    expect(session.state.completedSceneIds).not.toContain('korea-railway');
  });
});

describe('recoverable letter puzzle', () => {
  it('requires all SMURF letters and zero extra red letters', () => {
    const session = at('korea-smurf'); const puzzle = find<PuzzleInteraction>(session, 'smurf-floor');
    expect(session.finish(puzzle)).toBe(false); expect(session.toggleTile(puzzle, 'Z')).toBe(false);
    session.toggleTile(puzzle, 'A');
    for (const letter of puzzle.solution) expect(session.toggleTile(puzzle, letter)).toBe(false);
    expect(session.finish(puzzle)).toBe(false); expect(session.state.flags).not.toContain('smurf-solved');
    expect(session.toggleTile(puzzle, 'A')).toBe(true); expect(session.finish(puzzle)).toBe(true);
  });
  it('does not complete when one blue letter is missing', () => {
    const session = at('korea-smurf'); const puzzle = find<PuzzleInteraction>(session, 'smurf-floor');
    for (const letter of puzzle.solution.slice(1)) session.toggleTile(puzzle, letter);
    expect(session.finish(puzzle)).toBe(false);
    expect(session.toggleTile(puzzle, 'S')).toBe(true);
  });
});

describe('scrapbook paging', () => {
  it('presents five single photos without changing leader and marks only visited pages', () => {
    const session = at('norway-scrapbook'); const book = find<ScrapbookInteraction>(session, 'norway-book');
    expect(session.openScrapbook(book)).toBe(true); expect(session.state.scrapbookVisited[book.id]).toEqual([0]);
    expect(session.turnPage(book, -1)).toBe(false); expect(session.turnPage(book, 2)).toBe(false);
    expect(session.finish(book)).toBe(false);
    for (let page = 1; page < 5; page++) {
      expect(session.turnPage(book, 1)).toBe(true);
      expect(session.state.scrapbookPages[book.id]).toBe(page);
      if (page < 4) expect(session.finish(book)).toBe(false);
    }
    expect(session.state.leaderId).toBe('person-a');
    expect(session.state.scrapbookVisited[book.id]).toEqual([0, 1, 2, 3, 4]);
    expect(session.turnPage(book, 1)).toBe(false); expect(session.finish(book)).toBe(true);
  });
  it('resumes a partially read book with either leader', () => {
    const session = at('norway-scrapbook'); const book = find<ScrapbookInteraction>(session, 'norway-book');
    session.openScrapbook(book); session.setLeader('person-b'); session.turnPage(book, 1);
    session.setLeader('person-a'); expect(session.openScrapbook(book)).toBe(true);
    session.setLeader('person-b'); expect(session.openScrapbook(book)).toBe(true);
    expect(session.state.scrapbookPages[book.id]).toBe(1); expect(session.finish(book)).toBe(false);
  });
});

describe('vehicle travel and apartment roles', () => {
  it('completes with MAA early and the car photo last without a hidden parking requirement', () => {
    const session = at('austin-francine');
    session.setLeader('person-b'); session.finish(find(session, 'maa-access'));
    for (const photo of session.scene.interactions.filter((interaction) => interaction.kind === 'memory').reverse()) session.finish(photo);
    session.setLeader('person-a'); expect(session.enterVehicle(find<VehicleInteraction>(session, 'francine-car'))).toBe(true);
    expect(session.state.flags).not.toContain('maa-arrived');
    expect(session.scene.completionFlags.filter((flag) => !session.state.flags.includes(flag))).toEqual([]);
    expect(session.state.completedSceneIds).toContain('austin-francine');
  });
  it('completes every ordinary-photo permutation and MAA insertion position without requiring parking', () => {
    const city = story.scenes.find((scene) => scene.id === 'austin-francine')!;
    const photos = city.interactions.filter((interaction) => interaction.kind === 'memory');
    let routes = 0;
    for (const order of permutations(photos)) {
      for (let maaPosition = 0; maaPosition <= order.length; maaPosition++) {
        const session = new Session(story); session.update({ sceneId: city.id, mode: 'exploring' }); session.setLeader('person-b');
        const access = find(session, 'maa-access');
        for (let position = 0; position <= order.length; position++) {
          if (position === maaPosition) session.finish(access);
          if (position < order.length) session.finish(order[position]);
        }
        expect(session.state.completedSceneIds).toEqual([]);
        session.setLeader('person-a'); expect(session.enterVehicle(find<VehicleInteraction>(session, 'francine-car'))).toBe(true);
        expect(session.state.completedSceneIds).toEqual([city.id]);
        expect(session.state.flags).not.toContain('maa-arrived');
        expect(session.exitVehicle(find<Extract<Interaction, { kind: 'vehicle-exit' }>>(session, 'maa-exit'))).toBe(true);
        expect(session.state.completedSceneIds).toEqual([city.id]);
        routes++;
      }
    }
    expect(routes).toBe(5040);
  });
  it('allows Austin photos in arbitrary order and keeps driver/fob roles on completed-world re-entry', () => {
    const session = at('austin-francine');
    const car = find<VehicleInteraction>(session, 'francine-car'); const goodwin = find(session, 'goodwin'); const citizenship = find(session, 'citizenship');
    const exit = find<Extract<Interaction, { kind: 'vehicle-exit' }>>(session, 'maa-exit'); const access = find(session, 'maa-access');
    expect(exit.visual).toBe('garage'); expect(exit.position.x).toBeGreaterThan(access.position.x);
    expect(Math.hypot(session.scene.vehicle!.exit.x - exit.position.x, session.scene.vehicle!.exit.y - exit.position.y)).toBeLessThan(exit.radius);
    session.setLeader('person-b'); expect(session.enterVehicle(car)).toBe(false); expect(session.state.vehicleId).toBeNull();
    expect(car.wrongLeaderText).toBe("Hey, I got my license, but I'm passenger princess!");
    expect(gateInteraction(access, session.state)).toBe('ready');
    expect(session.finish(access)).toBe(false); expect(session.state.flags).toContain('maa-entered');
    session.setLeader('person-a'); expect(session.finish(car)).toBe(false); expect(session.enterVehicle(car)).toBe(true);
    expect(session.state.vehicleId).toBe('francine'); expect(session.state.flags).toContain('francine-entered'); expect(session.enterVehicle(car)).toBe(false);
    expect(session.exitVehicle(exit)).toBe(true);
    expect(session.state.vehicleId).toBeNull(); expect(gateInteraction(access, session.state)).toBe('wrong-leader');
    expect(session.finish(access)).toBe(false);
    expect(session.state.flags).toContain('maa-entered');
    expect('memory' in access && access.memory?.originalAsset).toBe('assets/memories/real-snuromi-original.webp');
    session.finish(citizenship);
    for (const extra of session.scene.interactions.filter((i) => i.id.startsWith('austin-')).reverse()) session.finish(extra);
    expect(session.finish(goodwin)).toBe(true);
    expect(session.state.completedSceneIds).toContain('austin-francine');
    expect(access.wrongLeaderText).toBe('I got the fob!');
    const flags = [...session.state.flags]; const completed = [...session.state.completedSceneIds];
    session.update({ mode: 'exploring' });
    expect(session.enterVehicle(car)).toBe(true); expect(session.exitVehicle(exit)).toBe(true);
    expect(session.state.flags).toEqual(flags); expect(session.state.completedSceneIds).toEqual(completed);
  });
  it('allows every Austin photo on foot or driving and rejects fob access while driving', () => {
    const session = at('austin-francine'); const car = find<VehicleInteraction>(session, 'francine-car'); const goodwin = find(session, 'goodwin');
    const photos = session.scene.interactions.filter((i) => i.kind === 'memory');
    expect(photos).toHaveLength(6);
    for (const photo of photos) expect(gateInteraction(photo, session.state)).toBe('ready');
    session.enterVehicle(car);
    for (const photo of photos) expect(gateInteraction(photo, session.state)).toBe('ready');
    expect(session.finish(goodwin)).toBe(false); expect(session.state.flags).toContain('goodwin-visited');
    const access = find(session, 'maa-access'); session.setLeader('person-b');
    expect(gateInteraction(access, session.state)).toBe('wrong-travel'); expect(session.finish(access)).toBe(false);
  });
  it('reminds Gracie to plug Francine in before the MAA exit prerequisite is complete', () => {
    const session = at('austin-francine'); const access = find(session, 'maa-access');
    session.enterVehicle(find<VehicleInteraction>(session, 'francine-car'));
    expect(session.state.flags).not.toContain('maa-arrived');
    expect(gateInteraction(access, session.state)).toBe('wrong-travel');
    expect(access.wrongTravelText).toBe('We forgot to plug Francine in!');
    expect(access.wrongTravelSpeakerId).toBe('person-b');
    expect(session.finish(access)).toBe(false);
  });
});

describe('unordered Petite France visits', () => {
  it('requires Nathaniel for the lower-right photo and anchors his idea line to him', () => {
    const session = at('korea-petite-france'); const photo = find(session, 'france-together');
    session.setLeader('person-b');
    expect(gateInteraction(photo, session.state)).toBe('wrong-leader');
    expect(photo.wrongLeaderText).toBe('I got an idea for a pic...');
    expect(photo.wrongLeaderSpeakerId).toBe('person-a');
    expect(session.finish(photo)).toBe(false); expect(session.state.flags).not.toContain('france-together-seen');
    session.setLeader('person-a'); session.finish(photo);
    expect(session.state.flags).toContain('france-together-seen');
  });
  it('accepts the four photos in reverse order and locks the farewell until every one is seen', () => {
    const session = at('korea-petite-france'); const farewell = find(session, 'france-goodbye');
    const visits = session.scene.interactions.filter((i) => i.id !== farewell.id);
    expect(farewell.requires).toHaveLength(4);
    expect(farewell.lockedText).toBe('I wanna stay and look at things');
    expect(farewell.lockedSpeakerId).toBe('person-b');
    for (const visit of [...visits].reverse()) {
      expect(gateInteraction(farewell, session.state)).toBe('locked');
      expect(gateInteraction(visit, session.state)).toBe('ready');
      expect(session.finish(visit)).toBe(false);
    }
    expect(gateInteraction(farewell, session.state)).toBe('ready');
    expect(session.finish(farewell)).toBe(true);
  });
});

describe('deliberate reader route and session lifecycle', () => {
  it('requires every active world before journey replay unlocks and retains that unlock only within the session', () => {
    const session = at('madeira');
    // Duplicate/unknown records cannot stand in for the still-unfinished ending.
    session.update({ completedSceneIds: [...session.state.completedSceneIds, 'retired-world', 'introduction'] });
    expect(session.journeyComplete).toBe(false);
    const ending = find(session, 'cristo-rei');
    for (const interaction of session.scene.interactions.filter((interaction) => interaction !== ending)) session.completeInReader(interaction);
    expect(session.journeyComplete).toBe(false);
    expect(session.completeInReader(ending)).toBe(true); expect(session.journeyComplete).toBe(true);
    expect(session.visit('korea-railway')).toBe(true); expect(session.journeyComplete).toBe(true);
    session.restart(); expect(session.journeyComplete).toBe(false);
    expect(new Session(story).journeyComplete).toBe(false);
  });
  it('finishes all scenes without movement while preserving their order and activity state', () => {
    const session = new Session(story); let checkpoints = 0;
    for (const scene of story.scenes) {
      expect(session.scene.id).toBe(scene.id);
      for (const interaction of scene.interactions) if (session.completeInReader(interaction)) checkpoints++;
      expect(session.state.mode).toBe('checkpoint'); session.advance();
    }
    expect(checkpoints).toBe(9); expect(session.state.completedSceneIds).toEqual(story.scenes.map((scene) => scene.id));
    expect(session.state.counters['railway-car']).toBe(12);
    expect(session.state.puzzleSelections['smurf-floor']).toEqual(['S', 'M', 'U', 'R', 'F']);
    expect(session.state.scrapbookVisited['norway-book']).toEqual([0, 1, 2, 3, 4]);
    expect(session.state.vehicleId).toBeNull(); expect(session.state.mode).toBe('exploring'); expect(session.scene.id).toBe('madeira');
  });
  it('reader still refuses missing prerequisites and future-scene interactions', () => {
    const session = at('korea-first-date'); const katsu = find(session, 'katsu');
    expect(session.completeInReader(katsu)).toBe(false); expect(session.state.flags).not.toContain('katsu-shared');
    const final = story.scenes.at(-1)!.interactions.at(-1)!;
    expect(session.completeInReader(final)).toBe(false); expect(session.finish(final)).toBe(false);
  });
  it('restart resets activities and checkpoints but retains names and accessibility settings', () => {
    const session = at('austin-francine'); session.completeInReader(find(session, 'francine-car'));
    session.update({ textScale: 'large', reducedMotion: true }); session.name({ names: { 'person-a': 'Alex', 'person-b': 'Sam' }, greeting: 'Our note' }); session.restart();
    expect(session.state.sceneId).toBe('introduction'); expect(session.state.flags).toEqual([]); expect(session.state.completedSceneIds).toEqual([]);
    expect(session.state.counters).toEqual({}); expect(session.state.puzzleSelections).toEqual({}); expect(session.state.scrapbookPages).toEqual({}); expect(session.state.vehicleId).toBeNull();
    expect(session.state.textScale).toBe('large'); expect(session.state.reducedMotion).toBe(true); expect(session.state.profile.greeting).toBe('Our note');
    expect(new Session(story).state.flags).toEqual([]);
  });
  it('revisits completed worlds and the current frontier without skipping ahead or duplicating progress', () => {
    const session = at('norway-scrapbook');
    const completed = [...session.state.completedSceneIds]; const flags = [...session.state.flags];
    expect(session.reachableSceneIds).toEqual(story.scenes.slice(0, 7).map((scene) => scene.id));
    expect(session.visit('madeira')).toBe(false); expect(session.visit('snuromi-cafe')).toBe(false);
    session.update({ vehicleId: 'francine', railwayId: 'railway-car' });
    expect(session.visit('korea-first-date')).toBe(true);
    expect(session.state.mode).toBe('loading'); expect(session.state.vehicleId).toBeNull(); expect(session.state.railwayId).toBeNull();
    expect(session.visit('korea-first-date')).toBe(false);
    session.update({ mode: 'exploring' });
    expect(session.advance()).toBe(true); expect(session.scene.id).toBe('korea-railway');
    expect(session.state.completedSceneIds).toEqual(completed); expect(session.state.flags).toEqual(flags);
    expect(session.visit('norway-scrapbook')).toBe(true); expect(session.advance()).toBe(false);
  });
  it('opens all worlds after the final checkpoint and keeps the current profile on revisits', () => {
    const session = at('madeira');
    for (const interaction of session.scene.interactions) session.completeInReader(interaction);
    session.advance();
    session.name({ names: { 'person-a': 'Alex', 'person-b': 'Sam' }, greeting: 'Our note' });
    expect(session.reachableSceneIds).toEqual(story.scenes.map((scene) => scene.id));
    expect(session.visit('introduction')).toBe(true); expect(session.visit('madeira')).toBe(true);
    expect(session.state.completedSceneIds).toHaveLength(9); expect(session.state.profile.greeting).toBe('Our note');
  });
});

describe('Madeira final-stop prerequisites', () => {
  it('allows the three memories in every order and keeps Cristo Rei locked until all are visited', () => {
    const island = story.scenes.find((scene) => scene.id === 'madeira')!;
    const stops = island.interactions.filter((interaction) => interaction.kind === 'memory');
    expect(stops.find((interaction) => interaction.id === 'madeira-view')!.visual).toBe('castle');
    let routes = 0;
    for (const order of permutations(stops)) {
      const session = at('madeira'); const finale = find(session, 'cristo-rei');
      for (const stop of order) {
        expect(gateInteraction(finale, session.state)).toBe('locked');
        expect(session.completeInReader(finale)).toBe(false);
        expect(gateInteraction(stop, session.state)).toBe('ready');
        session.finish(stop);
      }
      expect(gateInteraction(finale, session.state)).toBe('ready');
      expect(session.finish(finale)).toBe(true); routes++;
    }
    expect(routes).toBe(6);
  });
});
