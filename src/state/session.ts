import type { CharacterId, Interaction, PuzzleInteraction, RailwayInteraction, SceneDefinition, ScrapbookInteraction, Story, VehicleInteraction } from '../content/model';

export type Mode = 'loading' | 'exploring' | 'speaking' | 'reading' | 'paused' | 'checkpoint' | 'travelling' | 'puzzle' | 'scrapbook' | 'reader';
export type Profile = { names: Record<CharacterId, string>; greeting: string };
export type SessionState = {
  mode: Mode; sceneId: string; leaderId: CharacterId; flags: string[]; completedSceneIds: string[];
  choices: Record<string, string>; profile: Profile; reducedMotion: boolean; textScale: 'normal' | 'large';
  counters: Record<string, number>; puzzleSelections: Record<string, string[]>;
  scrapbookPages: Record<string, number>; scrapbookVisited: Record<string, number[]>;
  vehicleId: string | null; railwayId: string | null;
};
export type Gate = 'ready' | 'locked' | 'wrong-leader' | 'wrong-travel';
export function gateInteraction(interaction: Interaction, state: SessionState): Gate {
  if (interaction.prerequisiteOverrides?.some((override) => !state.flags.includes(override.missingFlag))) return 'locked';
  // A spoken reminder at MAA remains available while the exit prerequisite is unmet.
  if (interaction.wrongTravelText && interaction.requiredTravel === 'walking' && state.vehicleId) return 'wrong-travel';
  if (!interaction.requires.every((flag) => state.flags.includes(flag))) return 'locked';
  if (interaction.requiredLeaderId && interaction.requiredLeaderId !== state.leaderId) return 'wrong-leader';
  if (interaction.requiredTravel === 'vehicle' && !state.vehicleId || interaction.requiredTravel === 'walking' && state.vehicleId) return 'wrong-travel';
  return 'ready';
}
export function isSceneComplete(scene: SceneDefinition, flags: string[]) {
  return scene.completionFlags.every((flag) => flags.includes(flag));
}
export function isPuzzleSolved(interaction: PuzzleInteraction, selected: string[]) {
  return selected.length === interaction.solution.length && interaction.solution.every((letter) => selected.includes(letter));
}
export class Session {
  state: SessionState;
  private listeners = new Set<(state: SessionState) => void>();
  constructor(readonly story: Story) { this.state = this.initial(); }
  private initial(profile?: Profile): SessionState {
    return {
      mode: 'loading', sceneId: this.story.scenes[0].id, leaderId: 'person-a', flags: [], completedSceneIds: [], choices: {},
      counters: {}, puzzleSelections: {}, scrapbookPages: {}, scrapbookVisited: {}, vehicleId: null, railwayId: null, textScale: 'normal',
      profile: profile ?? { names: { 'person-a': this.story.manifest.characters[0].name, 'person-b': this.story.manifest.characters[1].name }, greeting: this.story.manifest.greeting },
      reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  }
  get scene() { return this.story.scenes.find((s) => s.id === this.state.sceneId)!; }
  get journeyComplete(): boolean {
    return this.story.scenes.every((scene) => this.state.completedSceneIds.includes(scene.id));
  }
  get reachableSceneIds(): string[] {
    const firstUnfinished = this.story.scenes.findIndex((scene) => !this.state.completedSceneIds.includes(scene.id));
    const frontier = firstUnfinished < 0 ? this.story.scenes.length - 1 : firstUnfinished;
    return this.story.scenes.slice(0, frontier + 1).map((scene) => scene.id);
  }
  subscribe(fn: (state: SessionState) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  update(patch: Partial<SessionState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((fn) => fn(this.state)); }
  name(profile: Profile) { this.update({ profile }); }
  setLeader(id: CharacterId) { this.update({ leaderId: id }); }
  recordChoice(id: string, choice: string) { this.update({ choices: { ...this.state.choices, [id]: choice } }); }
  private available(interaction: Interaction) {
    return this.scene.interactions.includes(interaction) && gateInteraction(interaction, this.state) === 'ready';
  }
  private commit(interaction: Interaction): boolean {
    if (this.state.flags.includes(interaction.setsFlag)) return false;
    const flags = [...this.state.flags, interaction.setsFlag];
    const newlyComplete = isSceneComplete(this.scene, flags) && !this.state.completedSceneIds.includes(this.scene.id);
    this.update({ flags, mode: newlyComplete ? 'checkpoint' : 'exploring', completedSceneIds: newlyComplete ? [...this.state.completedSceneIds, this.scene.id] : this.state.completedSceneIds });
    return newlyComplete;
  }
  pedal(interaction: RailwayInteraction): { accepted: boolean; stopIndex: number | null; count: number; progress: number } {
    const count = this.state.counters[interaction.id] ?? 0;
    const total = interaction.stops.length * interaction.pedalsPerSegment;
    if (!this.available(interaction) || this.state.railwayId !== interaction.id || this.state.mode !== 'exploring' || count >= total) return { accepted: false, stopIndex: null, count, progress: count / total };
    const next = count + 1;
    const stopIndex = next % interaction.pedalsPerSegment === 0 ? next / interaction.pedalsPerSegment - 1 : null;
    this.update({ counters: { ...this.state.counters, [interaction.id]: next }, mode: 'travelling' });
    return { accepted: true, stopIndex, count: next, progress: next / total };
  }
  toggleTile(interaction: PuzzleInteraction, letter: string): boolean {
    if (!this.available(interaction) || !interaction.letters.includes(letter)) return false;
    const previous = this.state.puzzleSelections[interaction.id] ?? [];
    const selected = previous.includes(letter) ? previous.filter((value) => value !== letter) : [...previous, letter];
    this.update({ puzzleSelections: { ...this.state.puzzleSelections, [interaction.id]: selected } });
    return isPuzzleSolved(interaction, selected);
  }
  openScrapbook(interaction: ScrapbookInteraction): boolean {
    return this.presentPage(interaction, this.state.scrapbookPages[interaction.id] ?? 0);
  }
  private presentPage(interaction: ScrapbookInteraction, page: number): boolean {
    if (!this.available(interaction) || page < 0 || page >= interaction.pages.length || !Number.isInteger(page)) return false;
    const leader = interaction.pageLeaderIds?.[page];
    if (leader && leader !== this.state.leaderId) return false;
    const previous = this.state.scrapbookVisited[interaction.id] ?? [];
    this.update({
      scrapbookPages: { ...this.state.scrapbookPages, [interaction.id]: page },
      scrapbookVisited: { ...this.state.scrapbookVisited, [interaction.id]: previous.includes(page) ? previous : [...previous, page] },
    });
    return true;
  }
  turnPage(interaction: ScrapbookInteraction, delta: number): boolean {
    if (!Number.isInteger(delta) || Math.abs(delta) > 1) return false;
    return this.presentPage(interaction, (this.state.scrapbookPages[interaction.id] ?? 0) + delta);
  }
  enterVehicle(interaction: VehicleInteraction): boolean {
    if (!this.available(interaction) || this.state.vehicleId || interaction.driverId !== this.state.leaderId || !this.scene.vehicle) return false;
    this.commit(interaction);
    this.update({ vehicleId: this.scene.vehicle.id, mode: 'exploring' });
    return true;
  }
  exitVehicle(interaction: Extract<Interaction, { kind: 'vehicle-exit' }>): boolean {
    if (!this.available(interaction) || !this.scene.vehicle || this.state.vehicleId !== this.scene.vehicle.id) return false;
    this.commit(interaction);
    this.update({ vehicleId: null, mode: this.state.mode === 'checkpoint' ? 'checkpoint' : 'exploring' });
    return true;
  }
  finish(interaction: Interaction): boolean {
    if (!this.available(interaction)) return false;
    if (interaction.kind === 'choice' && !interaction.options.some((option) => option.id === this.state.choices[interaction.id] && option.accepted)) return false;
    if (interaction.kind === 'railway' && (this.state.counters[interaction.id] ?? 0) !== interaction.stops.length * interaction.pedalsPerSegment) return false;
    if (interaction.kind === 'puzzle' && !isPuzzleSolved(interaction, this.state.puzzleSelections[interaction.id] ?? [])) return false;
    if (interaction.kind === 'scrapbook' && !(interaction.pages.every((_, index) => this.state.scrapbookVisited[interaction.id]?.includes(index)))) return false;
    if (interaction.kind === 'vehicle' || interaction.kind === 'vehicle-exit') return false;
    return this.commit(interaction);
  }
  completeInReader(interaction: Interaction): boolean {
    if (!this.scene.interactions.includes(interaction) || !interaction.requires.every((flag) => this.state.flags.includes(flag)) || interaction.prerequisiteOverrides?.some((override) => !this.state.flags.includes(override.missingFlag))) return false;
    // The deliberately selected reading route supplies equivalent completion without spatial controls.
    if (interaction.kind === 'choice') this.recordChoice(interaction.id, interaction.options.find((option) => option.accepted)!.id);
    if (interaction.kind === 'railway') this.update({ counters: { ...this.state.counters, [interaction.id]: interaction.stops.length * interaction.pedalsPerSegment }, railwayId: null });
    if (interaction.kind === 'puzzle') this.update({ puzzleSelections: { ...this.state.puzzleSelections, [interaction.id]: [...interaction.solution] } });
    if (interaction.kind === 'scrapbook') this.update({
      scrapbookPages: { ...this.state.scrapbookPages, [interaction.id]: interaction.pages.length - 1 },
      scrapbookVisited: { ...this.state.scrapbookVisited, [interaction.id]: interaction.pages.map((_, index) => index) },
    });
    if (interaction.kind === 'vehicle') this.update({ vehicleId: this.scene.vehicle?.id ?? null });
    if (interaction.kind === 'vehicle-exit') this.update({ vehicleId: null });
    return this.commit(interaction);
  }
  visit(sceneId: string): boolean {
    if (!this.reachableSceneIds.includes(sceneId) || sceneId === this.state.sceneId) return false;
    this.update({ sceneId, mode: 'loading', vehicleId: null, railwayId: null }); return true;
  }
  advance(): boolean {
    if ((this.state.mode !== 'checkpoint' && !this.state.completedSceneIds.includes(this.scene.id)) || !isSceneComplete(this.scene, this.state.flags)) return false;
    if (!this.scene.nextSceneId) { this.update({ mode: 'exploring' }); return false; }
    return this.visit(this.scene.nextSceneId);
  }
  restart() {
    const { profile, reducedMotion, textScale } = this.state;
    this.state = { ...this.initial(profile), reducedMotion, textScale };
    this.listeners.forEach((fn) => fn(this.state));
  }
  interpolate(value: string) {
    return value.replace(/\{(person-a|person-b|greeting)\}/g, (_, key: string) => key === 'greeting' ? this.state.profile.greeting : this.state.profile.names[key as CharacterId]);
  }
}
