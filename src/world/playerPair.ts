import Phaser from 'phaser';
import type { CharacterId, Point, SceneDefinition } from '../content/model';
import { isSafe } from './geometry';
import { actorSize, characterRows, type CharacterDirection } from './characterAssets';

export class PlayerPair {
  readonly actors: Record<CharacterId, Phaser.Physics.Arcade.Sprite>;
  private trail: Point[] = [];
  private lastRecorded: Point;
  private lastSafe: Record<CharacterId, Point>;
  private age = 0;
  private stuckTime = 0;
  private seated = false;
  private waitingAfterSwitch = false;
  private leaderId: CharacterId;
  private directions: Record<CharacterId, CharacterDirection> = { 'person-a': 'south', 'person-b': 'south' };
  constructor(private scene: Phaser.Scene, private definition: SceneDefinition, leaderId: CharacterId) {
    this.leaderId = leaderId;
    const createActor = (id: CharacterId) => {
      const key = `actor-${id}`;
      return scene.physics.add.sprite(0, 0, key, scene.textures.get(key).frameTotal > 2 ? 0 : undefined);
    };
    this.actors = {
      'person-a': createActor('person-a'),
      'person-b': createActor('person-b'),
    };
    this.lastSafe = { 'person-a': { ...definition.spawn.leader }, 'person-b': { ...definition.spawn.companion } };
    for (const actor of Object.values(this.actors)) {
      // Sheet frames are square; a square display keeps the illustrated people in proportion.
      // The generated fallback has its own 52 × 72 source aspect ratio.
      actor.setOrigin(0.5, 1).setDisplaySize(actor.texture.frameTotal > 2 ? actorSize.height : actorSize.width, actorSize.height).setCollideWorldBounds(true);
      // Authored barriers use the same 11px foot clearance as safe placement and following.
      const footWidth = (definition.obstacles.length ? 22 : 18) / actor.scaleX;
      const footHeight = (definition.obstacles.length ? 11 : 10) / actor.scaleY;
      actor.body!.setSize(footWidth, footHeight, false);
      (actor.body as Phaser.Physics.Arcade.Body).setOffset((actor.width - footWidth) / 2, actor.height - footHeight);
    }
    this.leader.setPosition(definition.spawn.leader.x, definition.spawn.leader.y);
    this.follower.setPosition(definition.spawn.companion.x, definition.spawn.companion.y);
    this.lastRecorded = this.position(); this.setBodies(); this.resetTrail();
  }
  get leader() { return this.actors[this.leaderId]; }
  get follower() { return this.actors[this.leaderId === 'person-a' ? 'person-b' : 'person-a']; }
  private setBodies() {
    for (const [id, actor] of Object.entries(this.actors)) {
      const body = actor.body as Phaser.Physics.Arcade.Body;
      body.enable = !this.seated && id === this.leaderId;
      if (body.enable) body.reset(actor.x, actor.y);
    }
  }
  position(): Point { return { x: this.leader.x, y: this.leader.y }; }
  private resetTrail() {
    this.trail = [{ x: this.follower.x, y: this.follower.y }, this.position()];
    this.lastRecorded = this.position(); this.stuckTime = 0;
  }
  switchLeader(id: CharacterId) {
    this.stop(); this.leaderId = id;
    if (!isSafe(this.position(), this.definition.obstacles)) {
      const safe = this.lastSafe[id]; this.leader.setPosition(safe.x, safe.y);
    }
    this.setBodies(); this.resetTrail();
    this.faceEachOther();
    this.waitingAfterSwitch = true;
  }
  private faceEachOther() {
    for (const id of ['person-a', 'person-b'] as CharacterId[]) {
      const actor = this.actors[id];
      const other = this.actors[id === 'person-a' ? 'person-b' : 'person-a'];
      const dx = other.x - actor.x; const dy = other.y - actor.y;
      this.directions[id] = Math.abs(dx) >= Math.abs(dy) ? dx < 0 ? 'west' : 'east' : dy < 0 ? 'north' : 'south';
    }
    this.stop();
  }
  place(point: Point) {
    if (!isSafe(point, this.definition.obstacles)) return;
    (this.leader.body as Phaser.Physics.Arcade.Body).reset(point.x, point.y);
    const candidates = [{ x: point.x - 40, y: point.y }, { x: point.x + 40, y: point.y }, { x: point.x, y: point.y + 40 }, this.definition.spawn.companion];
    const other = candidates.find((p) => isSafe(p, this.definition.obstacles))!;
    this.follower.setPosition(other.x, other.y); this.stop(); this.resetTrail(); this.waitingAfterSwitch = false;
  }
  /** Transport owns positions while walking sprites are hidden; speech still has real seats. */
  seat(points: Record<CharacterId, Point>) {
    this.stop(); this.seated = true;
    for (const id of ['person-a', 'person-b'] as CharacterId[]) {
      this.actors[id].setPosition(points[id].x, points[id].y).setVisible(false).setAngle(0);
      (this.actors[id].body as Phaser.Physics.Arcade.Body).enable = false;
    }
  }
  leaveSeat(point: Point) {
    this.seated = false;
    Object.values(this.actors).forEach((actor) => actor.setVisible(true));
    this.setBodies(); this.place(point);
  }
  stop() {
    if (this.leader.body) this.leader.setVelocity(0);
    for (const [id, actor] of Object.entries(this.actors)) {
      actor.anims.stop(); actor.setAngle(0);
      if (actor.texture.frameTotal > 2) actor.setFrame(characterRows[this.directions[id as CharacterId]] * 4);
    }
  }
  update(vector: Point, deltaMs: number, reducedMotion: boolean) {
    if (this.seated) return;
    if (vector.x || vector.y) this.waitingAfterSwitch = false;
    const dt = Math.min(deltaMs, 50) / 1000;
    this.age += dt;
    const followerBefore = { x: this.follower.x, y: this.follower.y };
    this.leader.setVelocity(vector.x * 135, vector.y * 135);
    const current = this.position();
    if (Math.hypot(current.x - this.lastRecorded.x, current.y - this.lastRecorded.y) >= 5) {
      this.trail.push(current); this.lastRecorded = current;
    }
    const separation = Math.hypot(this.leader.x - this.follower.x, this.leader.y - this.follower.y);
    let length = 0;
    for (let i = 1; i < this.trail.length; i++) length += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y);
    if (!this.waitingAfterSwitch && length > 42 && this.trail.length > 1) {
      const target = this.trail[1];
      const dx = target.x - this.follower.x; const dy = target.y - this.follower.y; const distance = Math.hypot(dx, dy);
      const step = Math.min(distance, dt * 157, length - 42);
      const next = { x: this.follower.x + dx / (distance || 1) * step, y: this.follower.y + dy / (distance || 1) * step };
      if (isSafe(next, this.definition.obstacles)) {
        this.follower.setPosition(next.x, next.y); this.trail[0] = next; this.stuckTime = 0;
        if (distance <= step + 0.5) this.trail.splice(1, 1);
      } else this.stuckTime += dt;
    }
    if (separation > 160 || this.stuckTime > 1.5 || this.trail.length > 100) {
      const safe = [...this.trail].reverse().find((p) => Math.hypot(p.x - current.x, p.y - current.y) >= 32 && isSafe(p, this.definition.obstacles));
      if (safe) {
        this.follower.setPosition(safe.x, safe.y);
        if (!reducedMotion) { this.follower.setAlpha(0.3); this.scene.tweens.add({ targets: this.follower, alpha: 1, duration: 220 }); }
      }
      this.resetTrail();
    }
    for (const [id, actor] of Object.entries(this.actors)) {
      if (isSafe(actor, this.definition.obstacles)) this.lastSafe[id as CharacterId] = { x: actor.x, y: actor.y };
      actor.setDepth(actor.y + 10);
      const movement = id === this.leaderId ? vector : { x: actor.x - followerBefore.x, y: actor.y - followerBefore.y };
      const moving = Math.abs(movement.x) + Math.abs(movement.y) > 0.01;
      const actorId = id as CharacterId;
      if (moving) this.directions[actorId] = Math.abs(movement.x) > Math.abs(movement.y)
        ? movement.x < 0 ? 'west' : 'east'
        : movement.y < 0 ? 'north' : 'south';
      if (actor.texture.frameTotal > 2) {
        const direction = this.directions[actorId];
        if (moving && !reducedMotion) actor.anims.play(`actor-${id}-${direction}`, true);
        else { actor.anims.stop(); actor.setFrame(characterRows[direction] * 4); }
        actor.setAngle(0);
      } else actor.setAngle(!reducedMotion && moving ? Math.sin(this.age * 14) * 2 : 0);
    }
  }
  snapshot() {
    return { leaderId: this.leaderId, leader: this.position(), follower: { x: this.follower.x, y: this.follower.y }, trailLength: this.trail.length, directions: { ...this.directions } };
  }
}
