import Phaser from 'phaser';
import type { CharacterId, Point, Rect } from '../content/model';
import { isSafe } from './geometry';

/** One movable drawing for both modes; game rules stay in the session coordinator. */
export class TravelVehicle {
  readonly container: Phaser.GameObjects.Container;
  private occupants: Phaser.GameObjects.Image[];
  private facing = 1;
  constructor(scene: Phaser.Scene, readonly kind: 'car' | 'railway', position: Point) {
    const g = scene.add.graphics();
    if (kind === 'car') {
      g.fillStyle(0x4b5e68, 0.16).fillEllipse(0, 7, 121, 21);
      g.fillStyle(0x45575f).fillRoundedRect(-48, -17, 15, 25, 5).fillRoundedRect(28, -17, 15, 25, 5);
      g.fillStyle(0x79a8c1).fillRoundedRect(-56, -48, 112, 43, 13);
      g.fillStyle(0x6394b0).fillRoundedRect(-39, -67, 69, 40, 11);
      g.fillStyle(0xd6e5e6).fillRoundedRect(-32, -59, 25, 25, 5).fillRoundedRect(-2, -59, 25, 25, 5);
      g.fillStyle(0xacc6d0).fillRoundedRect(28, -43, 19, 18, 5);
      g.lineStyle(2, 0x447d9a).lineBetween(-1, -29, -1, -10);
      g.fillStyle(0x3b697f).fillRoundedRect(-12, -24, 8, 3, 1).fillRoundedRect(20, -24, 8, 3, 1);
      g.fillStyle(0xffecbb).fillRoundedRect(48, -31, 8, 12, 3);
      g.fillStyle(0xcbb794).fillRoundedRect(-56, -31, 5, 12, 2);
      g.fillStyle(0xcad9dc).fillRoundedRect(-58, -11, 115, 6, 3);
    } else if (scene.textures.exists('railcar-illustrated')) {
      // This raster keeps the red canopy, four seats and pedal chassis from the owner's reference.
    } else {
      g.fillStyle(0x665843, 0.15).fillEllipse(0, 12, 114, 18);
      g.fillStyle(0x665346).fillCircle(-32, 7, 11).fillCircle(33, 7, 11);
      g.fillStyle(0xc6b399).fillCircle(-32, 7, 5).fillCircle(33, 7, 5);
      g.fillStyle(0xd57760).fillRoundedRect(-57, -42, 114, 43, 11);
      g.fillStyle(0xb95543).fillRoundedRect(-54, -17, 109, 20, 6);
      g.fillStyle(0xf3c8a0).fillRoundedRect(-42, -55, 35, 19, 5).fillRoundedRect(9, -55, 35, 19, 5);
      g.fillStyle(0xecae85).fillRoundedRect(-39, -48, 29, 15, 4).fillRoundedRect(12, -48, 29, 15, 4);
      g.lineStyle(3, 0x8f6550).lineBetween(-45, -27, 45, -27);
      g.fillStyle(0xf2d3a8).fillRoundedRect(41, -29, 14, 7, 3);
      g.lineStyle(3, 0x835f4b).lineBetween(-18, -2, -18, 8).lineBetween(-18, 8, -8, 8);
    }
    const occupant = (id: CharacterId, x: number) => {
      const key = 'actor-' + id;
      const sheet = scene.textures.get(key).frameTotal > 2;
      return scene.add.image(x, -26, key, sheet ? 0 : undefined).setOrigin(0.5, 1).setDisplaySize(sheet ? 36 : 26, 36);
    };
    this.occupants = [occupant('person-a', kind === 'railway' ? -4 : -21), occupant('person-b', kind === 'railway' ? 33 : 17)];
    if (kind === 'railway') this.occupants.forEach((actor) => actor.setY(-10).setCrop(0, 0, actor.frame.width, actor.frame.height * .74));
    // Faces sit above the body so both people remain recognisable in transport.
    const drawing: Phaser.GameObjects.GameObject = kind === 'railway' && scene.textures.exists('railcar-illustrated')
      ? scene.add.image(0, 12, 'railcar-illustrated').setOrigin(.5, 1).setDisplaySize(150, 112)
      : g;
    if (drawing !== g) g.destroy();
    this.container = scene.add.container(position.x, position.y, [drawing, ...this.occupants]);
    this.setOccupants(false); this.place(position);
  }
  position(): Point { return { x: this.container.x, y: this.container.y }; }
  place(point: Point) { this.container.setPosition(point.x, point.y).setDepth(point.y + 10); }
  setOccupants(visible: boolean) { this.occupants.forEach((actor) => actor.setVisible(visible)); }
  faceOccupantsTogether() {
    this.occupants.forEach((actor, index) => { if (actor.texture.frameTotal > 2) actor.setFrame(index === 0 ? 12 : 8); });
  }
  seats(): Record<CharacterId, Point> {
    return {
      'person-a': { x: this.container.x + (this.kind === 'railway' ? -4 : -21) * this.facing, y: this.container.y - (this.kind === 'railway' ? 10 : 26) },
      'person-b': { x: this.container.x + (this.kind === 'railway' ? 33 : 17) * this.facing, y: this.container.y - (this.kind === 'railway' ? 10 : 26) },
    };
  }
  update(vector: Point, deltaMs: number, obstacles: Rect[]) {
    const step = Math.min(deltaMs, 50) / 1000 * 292.5;
    const current = this.position();
    // The attached MAA garage sits near the east edge, within the walking world's bounds.
    const x = Math.max(96, Math.min(888, current.x + vector.x * step));
    const y = Math.max(136, Math.min(466, current.y + vector.y * step));
    // Explicit barriers still apply; sliding keeps recovery simple at their corners.
    if (isSafe({ x, y: current.y }, obstacles)) this.container.x = x;
    if (isSafe({ x: this.container.x, y }, obstacles)) this.container.y = y;
    if (vector.x) { this.facing = vector.x < 0 ? -1 : 1; this.container.setScale(this.facing, 1); }
    this.container.setDepth(this.container.y + 10);
  }
  destroy() { this.container.destroy(); }
}
