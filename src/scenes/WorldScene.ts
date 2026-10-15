import Phaser from 'phaser';
import type { CharacterId, ObjectVisual, Point, RailwayInteraction } from '../content/model';
import { gateInteraction, type Session } from '../state/session';
import type { WorldInput } from '../world/input';
import { drawObject, drawPuzzleFlowers, drawRailwaySign, drawWorld, generateCharacters } from '../world/art';
import { PlayerPair } from '../world/playerPair';
import { TravelVehicle } from '../world/vehicle';
import { characterAssets } from '../world/characterAssets';
import { puzzleCell } from '../world/puzzleFloor';
import { isNearby, interactionTargets, type InteractionTarget } from '../world/interactions';

export type WorldBridge = {
  session: Session; input: WorldInput;
  onTarget: (target: InteractionTarget | null) => void;
  onInteract: (target: InteractionTarget) => void;
  onFrame: (actors: Record<CharacterId, Point>) => void;
  onReady: () => void;
};
const landmarkClickAreas: Partial<Record<ObjectVisual, { width: number; height: number; offsetY: number }>> = {
  'france-tower': { width: 110, height: 170, offsetY: -40 },
  'france-statue': { width: 140, height: 135, offsetY: -35 },
  'france-room': { width: 140, height: 150, offsetY: -35 },
  'museum-jukebox': { width: 140, height: 180, offsetY: 5 },
  'museum-arches': { width: 160, height: 230, offsetY: -5 },
  'museum-mirror': { width: 130, height: 250, offsetY: -80 },
  castle: { width: 150, height: 140, offsetY: -50 },
};
export class WorldScene extends Phaser.Scene {
  pair!: PlayerPair;
  private target: InteractionTarget | null = null;
  private ring!: Phaser.GameObjects.Ellipse;
  private markers = new Map<string, { container: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }>();
  private bouquet?: Phaser.GameObjects.Graphics;
  private vehicle?: TravelVehicle;
  private railway?: TravelVehicle;
  private railTween?: Phaser.Tweens.Tween;
  private railBoarded = false;
  private vehicleBoarded = false;
  private puzzleLights?: Phaser.GameObjects.Graphics;
  private puzzleLetters: Phaser.GameObjects.Text[] = [];
  private preparedSceneId = '';
  private readonly captureArt = import.meta.env.DEV && new URLSearchParams(location.search).has('capture-art');
  constructor(private bridge: WorldBridge) { super('world'); }
  preload() {
    for (const asset of characterAssets) {
      if (!this.textures.exists(asset.key)) this.load.spritesheet(asset.key, import.meta.env.BASE_URL + asset.path, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
    }
    const definition = this.bridge.session.scene;
    this.preparedSceneId = definition.id;
    if (definition.interactions.some((interaction) => interaction.kind === 'railway') && !this.textures.exists('railcar-illustrated')) this.load.image('railcar-illustrated', import.meta.env.BASE_URL + 'assets/vehicles/railcar.webp');
    if (!this.captureArt && definition.backgroundAsset && !this.textures.exists('backdrop-' + definition.id)) this.load.image('backdrop-' + definition.id, import.meta.env.BASE_URL + definition.backgroundAsset);
  }
  create() {
    const definition = this.bridge.session.scene;
    // The independent reader may advance while these textures are downloading.
    // Load that chapter before reporting the map ready, rather than caching a stale fallback.
    if (definition.id !== this.preparedSceneId) { this.scene.restart(); return; }
    this.railTween = undefined; this.railBoarded = false; this.vehicleBoarded = false;
    this.vehicle = undefined; this.railway = undefined; this.puzzleLetters = [];
    this.physics.world.setBounds(52, 96, 856, 388);
    generateCharacters(this, this.bridge.session.story.manifest.characters);
    drawWorld(this, this.captureArt ? { ...definition, backgroundAsset: undefined } : definition);
    // Only explicitly authored collision rectangles are installed. Decorative art never creates bodies.
    const obstacles = definition.obstacles.map((rect) => {
      const zone = this.add.zone(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height);
      this.physics.add.existing(zone, true); return zone;
    });
    this.pair = new PlayerPair(this, definition, this.bridge.session.state.leaderId);
    if (obstacles.length) this.physics.add.collider(Object.values(this.pair.actors), obstacles);
    if (definition.vehicle) this.vehicle = new TravelVehicle(this, 'car', definition.vehicle.position);
    const rail = definition.interactions.find((interaction) => interaction.kind === 'railway');
    if (rail?.kind === 'railway') this.railway = new TravelVehicle(this, 'railway', this.railPosition(rail, this.bridge.session.state.counters[rail.id] ?? 0));
    const puzzle = definition.interactions.find((interaction) => interaction.kind === 'puzzle');
    if (puzzle) {
      this.puzzleLights = this.add.graphics().setDepth(-70);
      puzzle.letters.forEach((letter, index) => {
        const { x, y } = puzzleCell(index);
        const text = this.add.text(x, y, letter, { fontSize: '22px', color: '#52758a', fontFamily: 'Segoe UI, sans-serif', fontStyle: 'bold' }).setOrigin(0.5).setDepth(-60);
        this.puzzleLetters.push(text);
      });
      drawPuzzleFlowers(this);
    } else this.puzzleLights = undefined;
    this.ring = this.add.ellipse(0, 0, 41, 14).setStrokeStyle(2, 0xa58c62).setDepth(600);
    for (const target of interactionTargets(definition.interactions)) {
      if (target.interaction.kind === 'puzzle') {
        this.add.zone(target.position.x, target.position.y, 66, 46).setInteractive({ useHandCursor: true })
          .on('pointerdown', () => { if (this.bridge.session.state.mode === 'exploring') this.bridge.onInteract(target); });
        continue;
      }
      const option = target.interaction.kind === 'choice' ? target.interaction.options.find((o) => o.id === target.optionId) : undefined;
      if (target.stopIndex !== undefined) drawRailwaySign(this, target.position.x, target.position.y);
      else if (this.captureArt || !definition.backgroundAsset || !this.textures.exists('backdrop-' + definition.id)) {
        if (target.interaction.id === 'maa-access') drawObject(this, 'door', target.position.x - 30, target.position.y - 40, 'maa-building');
        const prop = drawObject(this, target.interaction.visual, target.position.x, target.position.y, option?.id ?? target.interaction.id);
        if (definition.theme === 'madeira' && target.interaction.visual === 'table') prop.setScale(.6);
      }
      else if (target.interaction.id === 'maa-access') drawObject(this, 'door', target.position.x, target.position.y, target.interaction.id);
      const clickArea = landmarkClickAreas[target.interaction.visual];
      const zone = this.add.zone(target.position.x, target.position.y + (clickArea?.offsetY ?? (target.optionId ? -15 : -6)), clickArea?.width ?? (target.optionId ? 66 : 82), clickArea?.height ?? (target.optionId ? 110 : 70)).setDepth(target.interaction.kind === 'vehicle' ? 500 : 0).setInteractive({ useHandCursor: true });
      const activate = () => { if (this.bridge.session.state.mode === 'exploring' && this.isTargetAvailable(target)) this.bridge.onInteract(this.currentTarget(target)); };
      zone.on('pointerdown', activate);
      const badge = this.add.circle(0, 0, 15, 0xfffbec).setStrokeStyle(2, 0xa87658);
      const text = this.add.text(0, -1, 'E', { fontSize: '17px', color: '#79543f', fontFamily: 'Segoe UI, sans-serif', fontStyle: 'bold' }).setOrigin(0.5);
      const container = this.add.container(target.position.x, target.position.y - 55, [badge, text]).setDepth(650);
      container.setSize(32, 32).setInteractive({ useHandCursor: true });
      container.on('pointerdown', activate);
      this.markers.set(target.id, { container, text, zone });
    }
    this.bouquet = this.add.graphics().setDepth(650);
    this.target = null;
    const unsubscribe = this.bridge.session.subscribe((state) => {
      if (state.leaderId !== this.pair.snapshot().leaderId) { this.pair.switchLeader(state.leaderId); if (this.railBoarded) this.railway?.faceOccupantsTogether(); }
      if (state.vehicleId) this.enterVehicle(); else if (this.vehicleBoarded) this.exitVehicle();
      if (state.railwayId && this.railway) {
        this.railBoarded = true; this.railway.setOccupants(true); this.pair.seat(this.railway.seats());
      } else if (this.railBoarded && this.railway) {
        this.railTween?.remove(); this.railTween = undefined;
        if (rail?.kind === 'railway') this.railway.place(this.railPosition(rail, state.counters[rail.id] ?? 0));
        this.railBoarded = false; this.railway.setOccupants(false);
        const p = this.railway.position(); this.pair.leaveSeat({ x: p.x, y: Math.min(474, p.y + 55) });
      }
      if (state.mode !== 'exploring') { this.pair.stop(); this.physics.pause(); } else this.physics.resume();
      if (state.mode === 'travelling') this.railTween?.resume();
      else if (state.mode === 'paused' || state.mode === 'reader') this.railTween?.pause();
      this.updateMarkers(); this.updatePuzzle();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe(); this.bridge.input.clear(); this.railTween?.remove(); this.railTween = undefined;
      this.markers.clear(); this.target = null; this.bridge.onTarget(null);
    });
    this.updateMarkers(); this.updatePuzzle(); this.bridge.onReady();
  }
  private updatePuzzle() {
    if (!this.puzzleLights) return;
    const puzzle = this.bridge.session.scene.interactions.find((interaction) => interaction.kind === 'puzzle');
    if (!puzzle) return;
    const selected = this.bridge.session.state.puzzleSelections[puzzle.id] ?? [];
    this.puzzleLights.clear();
    puzzle.letters.forEach((letter, index) => {
      const lit = selected.includes(letter); const correct = puzzle.solution.includes(letter);
      const { x, y } = puzzleCell(index);
      this.puzzleLights!.fillStyle(lit ? correct ? 0x86bed7 : 0xdb9a95 : 0xf3efda).fillRoundedRect(x - 33, y - 23, 66, 46, 6);
      this.puzzleLights!.lineStyle(2, lit ? correct ? 0x4f94b5 : 0xba6e6c : 0xa5c4ca).strokeRoundedRect(x - 33, y - 23, 66, 46, 6);
      this.puzzleLetters[index]?.setColor(lit ? correct ? '#245c79' : '#7e3937' : '#52758a');
    });
  }
  private updateMarkers() {
    for (const target of interactionTargets(this.bridge.session.scene.interactions)) {
      const done = this.bridge.session.state.flags.includes(target.interaction.setsFlag);
      const counter = this.bridge.session.state.counters[target.interaction.id] ?? 0;
      const marker = this.markers.get(target.id);
      if (marker) {
        const available = this.isTargetAvailable(target);
        marker.container.setVisible(available); marker.zone.setVisible(available);
        if (marker.zone.input) marker.zone.input.enabled = available;
        marker.text.setText(target.stopIndex !== undefined ? 'E' : done ? '✓' : target.interaction.kind === 'railway' && this.railBoarded ? String(counter % target.interaction.pedalsPerSegment) : 'E').setColor(done && target.stopIndex === undefined ? '#607760' : '#79543f');
      }
    }
  }
  getTarget() {
    if (this.pair && this.bridge.session.state.mode === 'exploring' && this.preparedSceneId === this.bridge.session.scene.id) this.refreshTarget();
    return this.target;
  }
  private refreshTarget() {
    const { state, scene } = this.bridge.session;
    const position = this.vehicleBoarded && this.vehicle ? this.vehicle.position() : this.pair.position();
    const nearby = interactionTargets(scene.interactions)
      .filter((item) => this.isTargetAvailable(item))
      .filter((item) => !this.vehicleBoarded || item.interaction.kind !== 'vehicle')
      .map((item) => this.currentTarget(item))
      .filter((item) => isNearby(item, position, scene.obstacles))
      .sort((a, b) => Math.hypot(a.position.x - position.x, a.position.y - position.y) - Math.hypot(b.position.x - position.x, b.position.y - position.y) || a.id.localeCompare(b.id));
    const target = this.railBoarded
      ? interactionTargets(scene.interactions).map((item) => this.currentTarget(item)).find((item) => item.interaction.id === state.railwayId) ?? null
      : nearby.find((item) => !state.flags.includes(item.interaction.setsFlag) && gateInteraction(item.interaction, state) === 'ready')
        ?? (state.completedSceneIds.includes(scene.id) ? nearby.find((item) => gateInteraction(item.interaction, state) === 'ready') : undefined)
        ?? nearby.find((item) => !state.flags.includes(item.interaction.setsFlag)) ?? nearby[0] ?? null;
    const changed = target?.id !== this.target?.id;
    this.target = target;
    if (changed) this.bridge.onTarget(target);
  }
  private isTargetAvailable(target: InteractionTarget) {
    const state = this.bridge.session.state;
    if (target.interaction.kind === 'vehicle') return !state.vehicleId;
    if (target.interaction.kind === 'vehicle-exit') return Boolean(state.vehicleId);
    if (target.interaction.kind === 'railway') {
      const completed = state.flags.includes(target.interaction.setsFlag);
      return target.stopIndex !== undefined ? completed && this.bridge.session.journeyComplete : !completed || this.bridge.session.journeyComplete;
    }
    return target.stopIndex === undefined || state.flags.includes(target.interaction.setsFlag);
  }
  private currentTarget(target: InteractionTarget): InteractionTarget {
    if (target.stopIndex !== undefined) return target;
    const transport = target.interaction.kind === 'vehicle' ? this.vehicle : target.interaction.kind === 'railway' ? this.railway : undefined;
    if (!transport) return target;
    const position = transport.position();
    return {
      ...target, position,
      approach: {
        x: Math.max(63, Math.min(897, position.x + target.approach.x - target.position.x)),
        y: Math.max(106, Math.min(474, position.y + target.approach.y - target.position.y)),
      },
    };
  }
  canReach(target: InteractionTarget) {
    if (!this.isTargetAvailable(target)) return false;
    if (target.interaction.id === this.bridge.session.state.railwayId) return true;
    return isNearby(this.currentTarget(target), this.vehicleBoarded && this.vehicle ? this.vehicle.position() : this.pair.position(), this.bridge.session.scene.obstacles);
  }
  guide(target: InteractionTarget) {
    if (this.isRailMoving()) return;
    target = this.currentTarget(target);
    if (this.vehicleBoarded && this.vehicle) {
      this.vehicle.place(target.approach); this.pair.seat(this.vehicle.seats());
    } else if (this.railBoarded) {
      // The only active target while seated is the car itself. Help preserves its stop.
      if (this.railway) this.pair.seat(this.railway.seats());
    } else this.pair.place(target.approach);
  }
  enterVehicle() {
    if (!this.vehicle) return;
    this.vehicleBoarded = true; this.vehicle.setOccupants(true); this.pair.seat(this.vehicle.seats());
  }
  exitVehicle() {
    if (!this.vehicle || !this.vehicleBoarded) return;
    this.vehicleBoarded = false; this.vehicle.setOccupants(false);
    const parking = this.bridge.session.scene.interactions.find((interaction) => interaction.kind === 'vehicle-exit');
    if (parking) this.vehicle.place(parking.position);
    const p = this.vehicle.position();
    this.pair.leaveSeat(this.bridge.session.scene.vehicle?.exit ?? { x: p.x, y: Math.min(474, p.y + 55) });
  }
  stopTravel() { this.pair?.stop(); this.railTween?.pause(); }
  isRailMoving() { return Boolean(this.railTween); }
  private railPosition(interaction: RailwayInteraction, count: number): Point {
    if (count <= 0) return interaction.position;
    count = Math.min(count, interaction.stops.length * interaction.pedalsPerSegment);
    const segment = Math.floor((count - 1) / interaction.pedalsPerSegment);
    const previous = segment === 0 ? interaction.position : interaction.stops[segment - 1].position;
    const stop = interaction.stops[segment];
    const fraction = ((count - 1) % interaction.pedalsPerSegment + 1) / interaction.pedalsPerSegment;
    return { x: previous.x + (stop.position.x - previous.x) * fraction, y: previous.y + (stop.position.y - previous.y) * fraction };
  }
  travelRailPedal(interaction: RailwayInteraction, count: number, onArrive: () => void) {
    const segment = Math.floor((count - 1) / interaction.pedalsPerSegment);
    const stop = interaction.stops[segment];
    if (!this.railway || !stop || this.railTween) return;
    this.railway.setOccupants(true); this.railBoarded = true;
    const start = this.railway.position();
    const destination = this.railPosition(interaction, count);
    this.railTween = this.tweens.add({
      targets: this.railway.container, x: destination.x, y: destination.y,
      duration: this.bridge.session.state.reducedMotion ? 80 : Math.max(200, Math.hypot(destination.x - start.x, destination.y - start.y) / 150 * 1000),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.railTween = undefined;
        this.railway!.place(destination); this.pair.seat(this.railway!.seats()); onArrive();
      },
    });
  }
  update(_time: number, delta: number) {
    const { state, scene } = this.bridge.session;
    if (!this.pair || this.preparedSceneId !== scene.id) return;
    if (state.mode === 'exploring') {
      if (this.vehicleBoarded && this.vehicle) {
        this.vehicle.update(this.bridge.input.vector(), delta, scene.obstacles); this.pair.seat(this.vehicle.seats());
      } else if (!this.railBoarded) this.pair.update(this.bridge.input.vector(), delta, state.reducedMotion);
      this.refreshTarget();
    } else this.pair.stop();
    if (this.railBoarded && this.railway) {
      this.railway.container.setDepth(this.railway.container.y + 10); this.pair.seat(this.railway.seats());
    }
    this.ring.setVisible(!this.vehicleBoarded && !this.railBoarded).setPosition(this.pair.leader.x, this.pair.leader.y - 2);
    for (const [id, marker] of this.markers) {
      const active = id === this.target?.id;
      marker.container.setScale(active ? 1.15 : 1).setAlpha(active ? 1 : 0.87);
      if (this.railway && id === 'railway-car') {
        marker.container.setPosition(this.railway.container.x, this.railway.container.y - 92);
        marker.zone.setPosition(this.railway.container.x, this.railway.container.y - 30);
      }
      if (this.vehicle && scene.interactions.find((interaction) => interaction.id === id)?.kind === 'vehicle') {
        marker.container.setPosition(this.vehicle.container.x, this.vehicle.container.y - 88);
        marker.zone.setPosition(this.vehicle.container.x, this.vehicle.container.y - 28);
        marker.container.setVisible(!this.vehicleBoarded);
      }
    }
    this.bouquet!.clear();
    const carryingFlowers = state.flags.includes('flowers-bought') && !this.vehicleBoarded && !this.railBoarded && scene.theme === 'korea';
    if (carryingFlowers) {
      const nathaniel = this.pair.actors['person-a'];
      const facing = this.pair.snapshot().directions['person-a'];
      const handX = { south: 9, north: -9, west: -6, east: 6 }[facing];
      // The wrapper's tip meets his hand; the flowers sit just above it.
      this.bouquet!.setPosition(nathaniel.x + handX, nathaniel.y - 36).setScale(.85).setDepth(nathaniel.depth + (facing === 'north' ? -1 : 1));
      this.bouquet!.fillStyle(0x94b6c7).fillCircle(-4, -4, 4).fillCircle(3, -7, 4);
      this.bouquet!.fillStyle(0xf6eddc).fillCircle(6, -1, 4).fillCircle(-1, 1, 4);
      this.bouquet!.fillStyle(0xdbba98).fillTriangle(-7, 1, 8, 1, 1, 13);
    }
    if (this.captureArt) {
      Object.values(this.pair.actors).forEach((actor) => actor.setVisible(false));
      this.ring.setVisible(false); this.bouquet!.setVisible(false);
      this.vehicle?.container.setVisible(false); this.railway?.container.setVisible(false);
      this.markers.forEach((marker) => marker.container.setVisible(false));
      this.children.list.forEach((child) => { if (child instanceof Phaser.GameObjects.Text) child.setVisible(false); });
    }
    this.bridge.onFrame({
      'person-a': { x: this.pair.actors['person-a'].x, y: this.pair.actors['person-a'].y },
      'person-b': { x: this.pair.actors['person-b'].x, y: this.pair.actors['person-b'].y },
    });
    if (import.meta.env.DEV) this.game.canvas.dataset.debug = JSON.stringify({
      ...this.pair.snapshot(), mode: state.mode, sceneId: scene.id, target: this.target?.id ?? null,
      flags: state.flags, completed: state.completedSceneIds, counters: state.counters,
      puzzleSelections: state.puzzleSelections, scrapbookPages: state.scrapbookPages,
      vehicleId: state.vehicleId, railwayId: state.railwayId,
      travelMode: this.vehicleBoarded ? 'vehicle' : this.railBoarded ? 'railway' : 'walking',
      vehicle: this.vehicle?.position() ?? null, railway: this.railway?.position() ?? null,
      bouquet: carryingFlowers ? { x: this.bouquet!.x, y: this.bouquet!.y, depth: this.bouquet!.depth } : null,
    });
  }
}
