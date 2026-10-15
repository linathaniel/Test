import { clearLine, isSafe } from '../world/geometry';

export type CharacterId = 'person-a' | 'person-b';
export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type CharacterDefinition = { id: CharacterId; name: string; color: string; hair: string };
export type Manifest = {
  schemaVersion: 1; title: string; subtitle: string; greeting: string;
  characters: CharacterDefinition[]; sceneFiles: string[];
};
export type SceneTheme = 'garden' | 'korea' | 'railway' | 'smurf' | 'france' | 'museum' | 'norway' | 'austin' | 'cafe' | 'madeira';
export type MemoryTheme = 'garden' | 'flowers' | 'katsu' | 'ice-cream' | 'railway' | 'smurf' | 'france' | 'museum' | 'norway' | 'citizenship' | 'francine' | 'cafe' | 'madeira';
export type MemoryDefinition = {
  id: string; scene: MemoryTheme; label: string; caption: string;
  themedAsset?: string; originalAsset?: string; alt?: string;
  additionalPhotos?: MemoryPhoto[];
};
export type MemoryPhoto = { label: string; caption: string; alt?: string; themedAsset?: string; originalAsset?: string };
export type Choice = {
  id: string; label: string; description: string; response: string; accepted: boolean; color: string;
  position?: Point; approach?: Point;
};
export type ObjectVisual = 'envelope' | 'flowers' | 'restaurant' | 'closed' | 'delivery' | 'ice-cream' | 'railway' | 'puzzle' | 'postcard' | 'scrapbook' | 'car' | 'building' | 'door' | 'garage' | 'table' | 'viewpoint' | 'castle' | 'proposal' | 'photo-booth' | 'lake' | 'house' | 'line-dance' | 'france-tower' | 'france-statue' | 'france-room' | 'museum-jukebox' | 'museum-arches' | 'museum-mirror';
export type InteractionBase = {
  id: string; label: string; visual: ObjectVisual;
  position: Point; approach: Point; radius: number; requiredLeaderId?: CharacterId;
  wrongLeaderText?: string; requires: string[]; lockedText?: string; lockedSpeakerId?: CharacterId; setsFlag: string;
  prerequisiteOverrides?: { missingFlag: string; text: string; speakerId: CharacterId }[];
  title: string; text: string; speakerId?: CharacterId; wrongLeaderSpeakerId?: CharacterId;
  requiredTravel?: 'walking' | 'vehicle';
  wrongTravelText?: string; wrongTravelSpeakerId?: CharacterId;
};
export type Interaction = InteractionBase & (
  { kind: 'memory'; memory: MemoryDefinition } | { kind: 'choice'; options: Choice[]; memory?: MemoryDefinition }
  | { kind: 'naming' } | { kind: 'dialogue' }
  | { kind: 'railway'; boardingMemory?: MemoryDefinition; pedalsPerSegment: number; stops: { position: Point; signPosition?: Point; signApproach?: Point; disembark?: boolean; memory: MemoryDefinition }[] }
  | { kind: 'puzzle'; letters: string[]; solution: string[]; memory: MemoryDefinition }
  | { kind: 'scrapbook'; pages: MemoryDefinition[]; pageLeaderIds?: (CharacterId | null)[] }
  | { kind: 'vehicle'; driverId: CharacterId; memory?: MemoryDefinition }
  | { kind: 'vehicle-exit' } | { kind: 'access'; memory?: MemoryDefinition }
  | { kind: 'ending'; memory: MemoryDefinition; letter: string; eRevealsFinalPhoto?: boolean }
);
export type RailwayInteraction = Extract<Interaction, { kind: 'railway' }>;
export type PuzzleInteraction = Extract<Interaction, { kind: 'puzzle' }>;
export type ScrapbookInteraction = Extract<Interaction, { kind: 'scrapbook' }>;
export type VehicleInteraction = Extract<Interaction, { kind: 'vehicle' }>;
export type MemoryInteraction = Extract<Interaction, { kind: 'memory' | 'puzzle' | 'ending' }>;
export function hasMemory(interaction: Interaction): interaction is MemoryInteraction {
  return interaction.kind === 'memory' || interaction.kind === 'puzzle' || interaction.kind === 'ending';
}
export type SceneDefinition = {
  id: string; title: string; eyebrow: string; description: string; theme: SceneTheme;
  spawn: { leader: Point; companion: Point }; obstacles: Rect[]; interactions: Interaction[];
  backgroundAsset?: string;
  vehicle?: { id: string; position: Point; exit: Point };
  completionFlags: string[]; nextSceneId: string | null;
  checkpoint: { title: string; text: string; button: string };
};
export type Story = { manifest: Manifest; scenes: SceneDefinition[] };

const SCENE_THEMES = ['garden', 'korea', 'railway', 'smurf', 'france', 'museum', 'norway', 'austin', 'cafe', 'madeira'];
const MEMORY_THEMES = ['garden', 'flowers', 'katsu', 'ice-cream', 'railway', 'smurf', 'france', 'museum', 'norway', 'citizenship', 'francine', 'cafe', 'madeira'];
const VISUALS = ['envelope', 'flowers', 'restaurant', 'closed', 'delivery', 'ice-cream', 'railway', 'puzzle', 'postcard', 'scrapbook', 'car', 'building', 'door', 'garage', 'table', 'viewpoint', 'castle', 'proposal', 'photo-booth', 'lake', 'house', 'line-dance', 'france-tower', 'france-statue', 'france-room', 'museum-jukebox', 'museum-arches', 'museum-mirror'];
const KINDS = ['memory', 'choice', 'naming', 'dialogue', 'railway', 'puzzle', 'scrapbook', 'vehicle', 'vehicle-exit', 'access', 'ending'];
const fail = (message: string): never => { throw new Error(`Content: ${message}`); };
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be nonempty text`);
}
function array(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
}
function number(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} must be finite`);
}
function integer(value: unknown, label: string) {
  number(value, label);
  if (!Number.isInteger(value) || value < 1) fail(`${label} must be a positive integer`);
}
function character(value: unknown, label: string) {
  if (value !== 'person-a' && value !== 'person-b') fail(`unknown ${label}`);
}
function point(value: unknown, label: string) {
  const p = record(value, label); number(p.x, `${label}.x`); number(p.y, `${label}.y`);
  if (p.x < 62 || p.x > 898 || p.y < 104 || p.y > 474) fail(`${label} is outside walkable bounds`);
}
function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) fail(`${label} contains duplicate IDs`);
}
function validateSpatialRoutes(scene: SceneDefinition, safePoints: Point[]) {
  if (!scene.obstacles.length) return;
  if (safePoints.some((p) => !isSafe(p, scene.obstacles))) fail('spawn/approach collides with an obstacle');
  for (const interaction of scene.interactions) {
    const lines = interaction.kind === 'choice'
      ? interaction.options.map((option) => ({ from: option.approach ?? interaction.approach, to: option.position ?? interaction.position }))
      : [{ from: interaction.approach, to: interaction.position }];
    if (lines.some(({ from, to }) => !clearLine(from, to, scene.obstacles))) fail(`blocked approach line for ${interaction.id}`);
  }
  // A compressed grid follows obstacle edges and authored points instead of sampling every pixel.
  const xs = [...new Set([63, 897, ...safePoints.map((p) => p.x), ...scene.obstacles.flatMap((r) => [r.x - 12, r.x + r.width + 12])])].filter((x) => x >= 63 && x <= 897).sort((a, b) => a - b);
  const ys = [...new Set([106, 474, ...safePoints.map((p) => p.y), ...scene.obstacles.flatMap((r) => [r.y - 1, r.y + r.height + 12])])].filter((y) => y >= 106 && y <= 474).sort((a, b) => a - b);
  const expanded = scene.obstacles.map((r) => ({ x: r.x - 11, y: r.y, width: r.width + 22, height: r.height + 11 }));
  const key = (x: number, y: number) => `${x},${y}`;
  const start = { x: xs.indexOf(scene.spawn.leader.x), y: ys.indexOf(scene.spawn.leader.y) };
  const queue = [start]; const reached = new Set([key(start.x, start.y)]);
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index]; const point = { x: xs[node.x], y: ys[node.y] };
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const next = { x: node.x + dx, y: node.y + dy };
      if (next.x < 0 || next.x >= xs.length || next.y < 0 || next.y >= ys.length || reached.has(key(next.x, next.y))) continue;
      const nextPoint = { x: xs[next.x], y: ys[next.y] };
      if (isSafe(nextPoint, scene.obstacles) && clearLine(point, nextPoint, expanded)) { reached.add(key(next.x, next.y)); queue.push(next); }
    }
  }
  if (safePoints.some((p) => !reached.has(key(xs.indexOf(p.x), ys.indexOf(p.y))))) fail(`unreachable spawn/approach in ${scene.id}`);
}
function memory(value: unknown, label = 'memory') {
  const m = record(value, label);
  for (const key of ['id', 'label', 'caption']) text(m[key], `${label}.${key}`);
  if (!MEMORY_THEMES.includes(String(m.scene))) fail('unknown memory illustration');
  for (const key of ['themedAsset', 'originalAsset']) if (m[key] !== undefined) validatePath(m[key]);
  if (m.alt !== undefined) text(m.alt, `${label}.alt`);
  if (m.additionalPhotos !== undefined) {
    array(m.additionalPhotos, 'additionalPhotos');
    m.additionalPhotos.forEach((value, index) => {
      const photo = record(value, `photo ${index}`);
      for (const key of ['label', 'caption']) text(photo[key], `photo.${key}`);
      if (photo.alt !== undefined) text(photo.alt, 'photo.alt');
      for (const key of ['themedAsset', 'originalAsset']) if (photo[key] !== undefined) validatePath(photo[key]);
    });
  }
}
export function validatePath(value: unknown): asserts value is string {
  text(value, 'path');
  if (!/^[a-z0-9][a-z0-9/_.-]*$/.test(value) || value.includes('..')) fail(`unsafe relative path ${value}`);
}
export function validateManifest(value: unknown): asserts value is Manifest {
  const m = record(value, 'manifest');
  if (m.schemaVersion !== 1) fail('unsupported schemaVersion');
  for (const key of ['title', 'subtitle', 'greeting']) text(m[key], key);
  array(m.characters, 'characters'); array(m.sceneFiles, 'sceneFiles');
  if (m.characters.length !== 2 || !m.sceneFiles.length) fail('need two characters and at least one scene');
  const ids = m.characters.map((item) => {
    const c = record(item, 'character'); character(c.id, 'character');
    text(c.name, 'name');
    for (const key of ['color', 'hair']) if (!/^#[0-9a-f]{6}$/i.test(String(c[key]))) fail(`invalid character ${key}`);
    return c.id as string;
  });
  unique(ids, 'characters'); m.sceneFiles.forEach(validatePath); unique(m.sceneFiles as string[], 'sceneFiles');
}
export function validateScene(value: unknown): asserts value is SceneDefinition {
  const s = record(value, 'scene');
  for (const key of ['id', 'title', 'eyebrow', 'description']) text(s[key], key);
  if (!SCENE_THEMES.includes(String(s.theme))) fail('invalid theme');
  if (s.backgroundAsset !== undefined) validatePath(s.backgroundAsset);
  const spawn = record(s.spawn, 'spawn'); point(spawn.leader, 'leader spawn'); point(spawn.companion, 'companion spawn');
  array(s.obstacles, 'obstacles'); array(s.interactions, 'interactions'); array(s.completionFlags, 'completionFlags');
  if (!s.interactions.length || !s.completionFlags.length) fail('scene must have interactions and completion flags');
  s.completionFlags.forEach((f) => text(f, 'completion flag'));
  if (s.vehicle !== undefined) {
    const vehicle = record(s.vehicle, 'vehicle'); text(vehicle.id, 'vehicle.id');
    point(vehicle.position, 'vehicle position'); point(vehicle.exit, 'vehicle exit');
  }
  s.obstacles.forEach((item) => {
    const r = record(item, 'obstacle');
    for (const k of ['x', 'y', 'width', 'height']) number(r[k], `obstacle.${k}`);
    if ((r.width as number) <= 0 || (r.height as number) <= 0 || (r.x as number) < 0 || (r.y as number) < 0 || (r.x as number) + (r.width as number) > 960 || (r.y as number) + (r.height as number) > 540) fail('invalid obstacle bounds');
  });
  s.interactions.forEach((item) => {
    const i = record(item, 'interaction');
    for (const key of ['id', 'label', 'setsFlag', 'title', 'text']) text(i[key], key);
    if (!KINDS.includes(String(i.kind))) fail('unknown interaction kind');
    if (!VISUALS.includes(String(i.visual))) fail('unknown object visual');
    point(i.position, 'object'); point(i.approach, 'approach'); number(i.radius, 'radius');
    if (i.radius < 30 || i.radius > 120) fail('interaction radius must be 30–120');
    if (Math.hypot((i.position as Point).x - (i.approach as Point).x, (i.position as Point).y - (i.approach as Point).y) > i.radius) fail('approach is outside interaction range');
    array(i.requires, 'requires'); i.requires.forEach((f) => text(f, 'required flag')); unique(i.requires as string[], 'required flags');
    if (i.prerequisiteOverrides !== undefined) {
      array(i.prerequisiteOverrides, 'prerequisiteOverrides');
      i.prerequisiteOverrides.forEach((value) => {
        const override = record(value, 'prerequisite override');
        text(override.missingFlag, 'override missing flag'); text(override.text, 'override text'); character(override.speakerId, 'override speaker');
      });
      unique((i.prerequisiteOverrides as NonNullable<Interaction['prerequisiteOverrides']>).map((override) => override.missingFlag), 'override flags');
    }
    if (i.requiredLeaderId !== undefined) { character(i.requiredLeaderId, 'required leader'); text(i.wrongLeaderText, 'wrongLeaderText'); }
    for (const key of ['speakerId', 'wrongLeaderSpeakerId', 'wrongTravelSpeakerId', 'lockedSpeakerId']) if (i[key] !== undefined) character(i[key], key);
    if (i.wrongTravelText !== undefined) text(i.wrongTravelText, 'wrongTravelText');
    if (i.requiredTravel !== undefined && i.requiredTravel !== 'walking' && i.requiredTravel !== 'vehicle') fail('unknown travel requirement');
    if (['memory', 'puzzle', 'ending'].includes(String(i.kind)) || i.memory !== undefined) memory(i.memory);
    if (i.kind === 'choice') {
      array(i.options, 'options'); if (i.options.length < 2 || i.options.length > 4) fail('choice needs 2–4 options');
      i.options.forEach((option) => {
        const o = record(option, 'option');
        for (const key of ['id', 'label', 'description', 'response']) text(o[key], `option.${key}`);
        if (typeof o.accepted !== 'boolean' || !/^#[0-9a-f]{6}$/i.test(String(o.color))) fail('invalid choice result/color');
        if (o.position !== undefined) point(o.position, 'option position');
        if (o.approach !== undefined) {
          point(o.approach, 'option approach');
          if (!o.position || Math.hypot((o.position as Point).x - (o.approach as Point).x, (o.position as Point).y - (o.approach as Point).y) > (i.radius as number)) fail('option approach outside range');
        }
      });
      unique((i.options as Choice[]).map((o) => o.id), 'choice options');
      if (!(i.options as Choice[]).some((o) => o.accepted)) fail('choice has no accepted option');
    }
    if (i.kind === 'railway') {
      if (i.boardingMemory !== undefined) memory(i.boardingMemory, 'railway boarding memory');
      integer(i.pedalsPerSegment, 'pedalsPerSegment');
      if ((i.pedalsPerSegment as number) > 20) fail('too many pedals per segment');
      array(i.stops, 'railway stops'); if (!i.stops.length) fail('railway needs stops');
      i.stops.forEach((item, index) => {
        const stop = record(item, 'railway stop'); point(stop.position, 'railway stop position'); memory(stop.memory, `stop ${index} memory`);
        if (stop.disembark !== undefined && typeof stop.disembark !== 'boolean') fail('railway disembark must be boolean');
        if (stop.signPosition !== undefined) point(stop.signPosition, 'railway sign position');
        if (stop.signApproach !== undefined) {
          point(stop.signApproach, 'railway sign approach');
          if (!stop.signPosition || Math.hypot((stop.signPosition as Point).x - (stop.signApproach as Point).x, (stop.signPosition as Point).y - (stop.signApproach as Point).y) > 72) fail('railway sign approach outside range');
        }
      });
    }
    if (i.kind === 'puzzle') {
      array(i.letters, 'puzzle letters'); array(i.solution, 'puzzle solution');
      if (i.letters.length !== 25 || !i.letters.every((letter) => typeof letter === 'string' && /^[A-Y]$/.test(letter))) fail('puzzle needs the 25 letters A–Y');
      unique(i.letters as string[], 'puzzle letters'); unique(i.solution as string[], 'puzzle solution');
      if (i.solution.length !== 5 || !['S', 'M', 'U', 'R', 'F'].every((letter) => (i.solution as string[]).includes(letter))) fail('puzzle solution must contain SMURF');
    }
    if (i.kind === 'scrapbook') {
      array(i.pages, 'scrapbook pages'); if (!i.pages.length) fail('scrapbook needs pages'); i.pages.forEach((page, index) => memory(page, `page ${index}`));
      if (i.pageLeaderIds !== undefined) {
        array(i.pageLeaderIds, 'pageLeaderIds'); if (i.pageLeaderIds.length !== i.pages.length) fail('page leader count mismatch');
        i.pageLeaderIds.forEach((id) => { if (id !== null) character(id, 'page leader'); });
      }
    }
    if (i.kind === 'vehicle') {
      character(i.driverId, 'driver'); if (!s.vehicle) fail('vehicle interaction needs scene vehicle');
      if (i.requiredLeaderId !== i.driverId || i.requiredTravel !== 'walking') fail('vehicle must require its driver and walking');
    }
    if (i.kind === 'vehicle-exit' && (!s.vehicle || i.requiredTravel !== 'vehicle')) fail('vehicle exit needs vehicle travel');
    if (i.kind === 'ending') {
      text(i.letter, 'ending letter');
      if (i.eRevealsFinalPhoto !== undefined && typeof i.eRevealsFinalPhoto !== 'boolean') fail('ending E reveal must be boolean');
      if (i.eRevealsFinalPhoto === true && !(i.memory as MemoryDefinition).additionalPhotos?.length) fail('ending E reveal needs an additional photo');
    }
  });
  const typed = value as SceneDefinition;
  unique(typed.interactions.map((i) => i.id), 'interactions');
  unique(typed.interactions.map((i) => i.setsFlag), 'produced flags');
  unique(typed.completionFlags, 'completion flags');
  const produced = new Set(typed.interactions.map((i) => i.setsFlag));
  typed.completionFlags.forEach((f) => { if (!produced.has(f)) fail(`unknown completion flag ${f}`); });
  const safePoints = [typed.spawn.leader, typed.spawn.companion, ...typed.interactions.flatMap((i) => [i.approach, ...(i.kind === 'choice' ? i.options.flatMap((o) => o.approach ? [o.approach] : []) : []), ...(i.kind === 'railway' ? i.stops.map((stop) => stop.position) : [])]), ...(typed.vehicle ? [typed.vehicle.position, typed.vehicle.exit] : [])];
  validateSpatialRoutes(typed, safePoints);
  const checkpoint = record(s.checkpoint, 'checkpoint');
  for (const key of ['title', 'text', 'button']) text(checkpoint[key], `checkpoint.${key}`);
  if (s.nextSceneId !== null) text(s.nextSceneId, 'nextSceneId');
}
export function validateStory(story: Story) {
  validateManifest(story.manifest); story.scenes.forEach(validateScene);
  if (story.manifest.sceneFiles.length !== story.scenes.length) fail('scene file count mismatch');
  unique(story.scenes.map((s) => s.id), 'scenes');
  unique(story.scenes.flatMap((s) => s.interactions.map((i) => i.id)), 'global interactions');
  unique(story.scenes.flatMap((s) => s.interactions.map((i) => i.setsFlag)), 'global flags');
  const memoryIds = story.scenes.flatMap((s) => s.interactions.flatMap((i) => i.kind === 'railway' ? [...(i.boardingMemory ? [i.boardingMemory.id] : []), ...i.stops.map((stop) => stop.memory.id)] : i.kind === 'scrapbook' ? i.pages.map((page) => page.id) : ('memory' in i && i.memory ? [i.memory.id] : [])));
  unique(memoryIds, 'memories');
  const available = new Set<string>();
  story.scenes.forEach((s, index) => {
    if (s.nextSceneId !== (story.scenes[index + 1]?.id ?? null)) fail(`scene chain broken at ${s.id}`);
    const remaining = [...s.interactions];
    while (remaining.length) {
      const reachable = remaining.findIndex((i) => i.requires.every((f) => available.has(f)) && (i.prerequisiteOverrides ?? []).every((override) => available.has(override.missingFlag)));
      if (reachable < 0) fail(`cyclic/missing prerequisites in ${s.id}`);
      available.add(remaining[reachable].setsFlag); remaining.splice(reachable, 1);
    }
  });
}
