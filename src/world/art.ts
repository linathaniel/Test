import Phaser from 'phaser';
import type { CharacterDefinition, SceneDefinition } from '../content/model';
import { characterRows } from './characterAssets';

const colors = { ink: 0x644638, cream: 0xf9f0dc, peach: 0xefc3ac, green: 0x879975 };
export function generateCharacters(scene: Phaser.Scene, characters: CharacterDefinition[]) {
  for (const character of characters) {
    const key = `actor-${character.id}`;
    if (scene.textures.exists(key)) {
      // A missing raster asset still leaves the small generated fallback playable.
      if (scene.textures.get(key).frameTotal > 2) {
        for (const [direction, row] of Object.entries(characterRows)) {
          const animation = `${key}-${direction}`;
          if (!scene.anims.exists(animation)) scene.anims.create({
            key: animation,
            frames: [1, 2, 3, 2].map((column) => ({ key, frame: row * 4 + column })),
            frameRate: 8,
            repeat: -1,
          });
        }
      }
      continue;
    }
    const g = scene.make.graphics({ x: 0, y: 0 });
    const color = Number.parseInt(character.color.slice(1), 16);
    const hair = Number.parseInt(character.hair.slice(1), 16);
    g.fillStyle(0x5e5542, 0.14).fillEllipse(26, 67, 36, 10);
    g.fillStyle(hair).fillRoundedRect(11, 9, 30, character.id === 'person-b' ? 44 : 31, 13);
    g.fillStyle(color).fillRoundedRect(12, 36, 28, 26, 10);
    g.fillStyle(0xf2c8a4).fillEllipse(26, 27, 24, 28);
    g.fillStyle(hair).fillEllipse(26, 17, 29, 19);
    g.fillStyle(0xf2c8a4).fillEllipse(26, 29, 24, 21);
    g.fillStyle(hair).fillEllipse(16, 17, 11, 14);
    g.fillStyle(colors.ink).fillCircle(21, 29, 1.5).fillCircle(31, 29, 1.5);
    g.fillStyle(0xe7a38b, 0.8).fillEllipse(17, 34, 5, 3).fillEllipse(35, 34, 5, 3);
    g.lineStyle(1, 0x9e6150).beginPath().arc(26, 33, 3, 0, Math.PI).strokePath();
    g.fillStyle(0xe8cfac).fillRoundedRect(13, 55, 9, 13, 3).fillRoundedRect(30, 55, 9, 13, 3);
    g.fillStyle(0x584638).fillRoundedRect(11, 64, 12, 5, 2).fillRoundedRect(29, 64, 12, 5, 2);
    g.fillStyle(0xf9e4c8).fillRoundedRect(9, 39, 5, 15, 3).fillRoundedRect(38, 39, 5, 15, 3);
    g.fillStyle(0xf6e6d2).fillTriangle(21, 37, 26, 42, 31, 37);
    g.generateTexture(key, 52, 72); g.destroy();
  }
}

function tree(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number) {
  g.fillStyle(0x635241, 0.12).fillEllipse(x + 4, y + size * 0.5, size * 0.8, 12);
  g.fillStyle(0x9a7855).fillRoundedRect(x - 5, y, 10, size * 0.48, 4);
  g.fillStyle(color).fillCircle(x, y - 14, size * 0.38).fillCircle(x - size * 0.22, y, size * 0.28).fillCircle(x + size * 0.23, y - 1, size * 0.29);
  g.fillStyle(0xffefc1, 0.16).fillCircle(x - size * 0.12, y - size * 0.25, size * 0.18);
}
function flowers(g: Phaser.GameObjects.Graphics, x: number, y: number, color = 0xe6a99e, count = 5) {
  for (let i = 0; i < count; i++) {
    const fx = x + Math.cos(i * 2.1) * 13; const fy = y + Math.sin(i * 2.1) * 8;
    g.lineStyle(2, 0x78836d).lineBetween(fx, fy, x, y + 25);
    g.fillStyle(color).fillCircle(fx, fy, 5);
    g.fillStyle(0xf9e2a2).fillCircle(fx, fy, 2);
  }
}
function bench(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(0xc8ae87).fillRoundedRect(x, y - 18, 112, 10, 4).fillRoundedRect(x, y - 4, 112, 20, 4);
  g.fillStyle(0x8a7455).fillRoundedRect(x + 10, y + 12, 6, 23, 2).fillRoundedRect(x + 96, y + 12, 6, 23, 2);
  g.lineStyle(1, 0xb29169).lineBetween(x + 3, y + 3, x + 108, y + 3);
}
function label(scene: Phaser.Scene, x: number, y: number, text: string, size = 15, color = '#665141') {
  return scene.add.text(x, y, text, { fontFamily: 'Georgia, serif', fontSize: size, color, align: 'center' }).setOrigin(0.5);
}
export function drawWorld(scene: Phaser.Scene, definition: SceneDefinition) {
  const backdrop = 'backdrop-' + definition.id;
  if (definition.backgroundAsset && scene.textures.exists(backdrop)) {
    scene.add.image(480, 270, backdrop).setDisplaySize(960, 540).setDepth(-100);
    return;
  }
  const g = scene.add.graphics().setDepth(-100);
  g.fillStyle(0xf4ead3).fillRect(0, 0, 960, 540);
  g.fillStyle(0xe5e7cc).fillRoundedRect(24, 27, 912, 487, 28);
  g.fillStyle(0xf7efdb).fillRoundedRect(49, 78, 862, 414, 30);
  if (definition.theme === 'garden') {
    g.fillStyle(0xe6e2c1).fillRoundedRect(640, 133, 222, 330, 62);
    g.fillStyle(0xf3e8cd).fillRoundedRect(653, 143, 196, 310, 52);
    g.lineStyle(2, 0xd2c09e, 0.5);
    for (let y = 197; y < 382; y += 26) g.lineBetween(792, y, 799, y + 8);
    for (const [x, y, size, color] of [[98, 135, 86, 0x9bab87], [255, 136, 79, 0xb6b590], [502, 120, 92, 0x9bab87], [113, 414, 68, 0xb7b58d], [438, 426, 82, 0xa4ac82], [884, 266, 54, 0xb2b390]]) tree(g, x, y, size, color);
    bench(g, 153, 265); bench(g, 489, 270);
    flowers(g, 334, 263); flowers(g, 613, 383, 0xcbabce); flowers(g, 336, 407, 0xe2b180);
    g.fillStyle(0xc3ae89).fillRoundedRect(762, 410, 87, 23, 6);
    g.fillStyle(0xb49977).fillRoundedRect(771, 430, 6, 24, 2).fillRoundedRect(836, 430, 6, 24, 2);
  } else if (definition.theme === 'korea') {
    g.fillStyle(0xe8d7b9).fillRoundedRect(52, 258, 854, 83, 20);
    g.fillStyle(0xf7ead2).fillRoundedRect(60, 266, 838, 65, 18);
    g.fillStyle(0xe8d7b9).fillRoundedRect(343, 296, 225, 187, 28);
    g.fillStyle(0xf7ead2).fillRoundedRect(352, 306, 207, 169, 24);
    // The flower window: three actual displayed bouquets, each has its own hit target.
    g.fillStyle(0xb4c0a1).fillRoundedRect(73, 109, 314, 145, 12);
    g.fillStyle(0xf2e6cb).fillRoundedRect(88, 143, 283, 108, 5);
    g.fillStyle(0xa7bbb3).fillRoundedRect(102, 165, 252, 77, 6);
    g.fillStyle(0xd8cba7).fillRoundedRect(95, 241, 266, 12, 4);
    g.fillStyle(0xe8d4b0).fillRoundedRect(68, 139, 325, 23, 5);
    for (let x = 72; x < 389; x += 36) g.fillStyle(0x8ea38a).fillRoundedRect(x, 139, 18, 30, 3);
    g.lineStyle(3, 0xd0d0b5).lineBetween(185, 165, 185, 240).lineBetween(270, 165, 270, 240);
    // Closed restaurant: a rolled-down shutter and a padlock, no invented shop name.
    g.fillStyle(0xbb9884).fillRoundedRect(550, 103, 248, 150, 11);
    g.fillStyle(0xead8bc).fillRoundedRect(564, 141, 220, 109, 5);
    g.fillStyle(0xadb0a7).fillRoundedRect(632, 148, 87, 94, 4);
    g.lineStyle(2, 0x828c85);
    for (let y = 154; y < 240; y += 10) g.lineBetween(634, y, 716, y);
    g.fillStyle(0x899993).fillRoundedRect(581, 159, 36, 65, 4).fillRoundedRect(733, 159, 33, 65, 4);
    g.lineStyle(2, 0xf3e1b9).strokeCircle(599, 187, 9);
    g.lineBetween(586, 178, 586, 197).lineBetween(612, 178, 612, 197);
    g.lineBetween(583, 177, 583, 184).lineBetween(589, 177, 589, 184).lineBetween(583, 184, 589, 184);
    g.fillStyle(0xc6926f).fillRoundedRect(545, 131, 258, 22, 4);
    g.lineStyle(3, 0x675c4b).beginPath().arc(675, 211, 8, Math.PI, 0).strokePath();
    g.fillStyle(0xcaa767).fillRoundedRect(665, 210, 20, 19, 3);
    g.fillStyle(0x776244).fillCircle(675, 218, 2);
    // Delivery-only counter: takeaway bags, food boxes, and a scooter.
    g.fillStyle(0xc9ab7b).fillRoundedRect(66, 317, 253, 133, 11);
    g.fillStyle(0xf2dfb9).fillRoundedRect(79, 345, 227, 99, 5);
    g.fillStyle(0x687f75).fillRoundedRect(91, 353, 200, 60, 3);
    g.fillStyle(0xb79b74).fillRoundedRect(87, 411, 207, 16, 3);
    for (const x of [112, 164, 214]) {
      g.fillStyle(0xe8c898).fillRoundedRect(x, 383, 28, 29, 3);
      g.lineStyle(2, 0xc09e71).beginPath().arc(x + 14, 383, 8, Math.PI, 0).strokePath();
    }
    g.fillStyle(0xe8d5b0).fillRoundedRect(245, 398, 35, 13, 2).fillRoundedRect(247, 382, 31, 13, 2);
    g.fillStyle(0x6b7c75).fillRoundedRect(61, 337, 262, 19, 3);
    g.fillStyle(0x64756e).fillCircle(317, 449, 9).fillCircle(356, 449, 9);
    g.fillStyle(0xc9876a).fillRoundedRect(311, 426, 44, 19, 5);
    g.fillStyle(0xa87359).fillRoundedRect(310, 403, 28, 24, 3);
    g.lineStyle(3, 0x64756e).lineBetween(350, 429, 357, 410).lineBetween(352, 410, 361, 410);
    // Katsu: open door, red noren curtains, and a visible breaded cutlet plate.
    g.fillStyle(0xc18f73).fillRoundedRect(635, 286, 258, 132, 12);
    g.fillStyle(0xf0dac0).fillRoundedRect(649, 318, 231, 94, 5);
    g.fillStyle(0x5f736b).fillRoundedRect(667, 330, 65, 68, 5).fillRoundedRect(811, 330, 55, 68, 5);
    g.fillStyle(0x775b47).fillRoundedRect(747, 326, 53, 89, 4);
    g.fillStyle(0xe2ba92).fillRoundedRect(628, 310, 271, 20, 5);
    g.fillStyle(0xc58772).fillRoundedRect(747, 326, 24, 38, 2).fillRoundedRect(776, 326, 24, 38, 2);
    g.fillStyle(0xf7eccf).fillEllipse(697, 375, 49, 25);
    g.fillStyle(0xcfa160).fillRoundedRect(681, 368, 27, 10, 3);
    g.lineStyle(2, 0xf4ddb0).lineBetween(688, 367, 688, 379).lineBetween(696, 367, 696, 379).lineBetween(704, 367, 704, 379);
    g.fillStyle(0x94a17b).fillCircle(714, 372, 6);
    tree(g, 858, 171, 76, 0xd3a15d); tree(g, 498, 397, 51, 0xc7ad79);
    flowers(g, 424, 451, 0xe9b3a0);
  } else if (definition.theme === 'railway') {
    g.fillStyle(0xf2dfb9).fillRoundedRect(49, 78, 862, 414, 30);
    g.fillStyle(0xe8cda3).fillRoundedRect(63, 315, 834, 83, 24);
    for (let x = 83; x < 888; x += 28) g.fillStyle(0xb89573).fillRoundedRect(x, 343, 8, 25, 2);
    g.lineStyle(4, 0x968774).lineBetween(74, 348, 893, 348).lineBetween(74, 364, 893, 364);
    g.lineStyle(1, 0xf8edcf).lineBetween(74, 350, 893, 350).lineBetween(74, 366, 893, 366);
    for (const [x, y, size, color] of [[91, 216, 95, 0xd3905e], [246, 209, 89, 0xdbad64], [351, 206, 98, 0xb7745a], [619, 151, 95, 0xd49667], [852, 214, 93, 0xcfa562], [186, 424, 74, 0xc48c63], [670, 428, 67, 0xccad72]]) tree(g, x, y, size, color);
    g.fillStyle(0xa9c4bd).fillEllipse(514, 265, 218, 66);
    g.lineStyle(2, 0xe6e6ce).lineBetween(452, 252, 543, 252).lineBetween(500, 270, 578, 270);
    g.fillStyle(0xaf9277).fillRoundedRect(729, 204, 84, 117, 38);
    g.fillStyle(0x786957).fillRoundedRect(744, 237, 54, 84, 28);
    g.fillStyle(0xbba083).fillRoundedRect(721, 303, 100, 16, 4);
    label(scene, 494, 458, 'Four dreamy pedals between each memory', 16, '#947552');
  } else if (definition.theme === 'smurf') {
    g.fillStyle(0xbed8df).fillRoundedRect(49, 78, 862, 414, 30);
    g.fillStyle(0xe1f0ec).fillRoundedRect(72, 109, 816, 358, 22);
    g.fillStyle(0x89b3c2).fillRoundedRect(87, 118, 133, 291, 18).fillRoundedRect(742, 118, 133, 291, 18);
    for (const x of [150, 809]) {
      g.fillStyle(0xe6e5c8).fillRoundedRect(x - 18, 322, 36, 62, 8);
      g.fillStyle(0x94bad3).fillEllipse(x, 320, 89, 56);
      g.fillStyle(0xf8f4dc).fillCircle(x - 17, 312, 7).fillCircle(x + 14, 317, 9).fillCircle(x + 3, 302, 5);
      g.fillStyle(0x537f95).fillRoundedRect(x - 6, 347, 13, 36, 5);
    }
    g.fillStyle(0x91b8c7).fillRoundedRect(260, 139, 405, 324, 22);
    g.fillStyle(0xd5e6e6).fillRoundedRect(271, 150, 383, 302, 16);
    // The actual letter tiles are drawn by WorldScene and mirror the activity panel state.
  } else if (definition.theme === 'france') {
    g.fillStyle(0xe7e5c8).fillRoundedRect(49, 78, 862, 414, 30);
    g.fillStyle(0xe5ceb0).fillRoundedRect(90, 286, 769, 81, 25);
    g.fillStyle(0xf6e7cf).fillRoundedRect(96, 294, 757, 65, 22);
    g.fillStyle(0xe5ceb0).fillRoundedRect(429, 290, 101, 176, 25);
    g.fillStyle(0xf6e7cf).fillRoundedRect(438, 299, 83, 158, 19);
    for (const [x, y, size, color] of [[113, 192, 73, 0xa6af86], [418, 170, 69, 0x91a37b], [853, 191, 77, 0xb7b68b], [309, 418, 57, 0xa4ae82], [794, 429, 57, 0xa2ad83]]) tree(g, x, y, size, color);
    flowers(g, 666, 432, 0xd4a0a2); flowers(g, 703, 438, 0xf0c27d);
    bench(g, 81, 422);
    g.fillStyle(0xa3b9aa).fillEllipse(546, 399, 81, 32);
    g.fillStyle(0xe1cfaf).fillEllipse(546, 405, 88, 18);
    g.fillStyle(0xb7c4b5).fillEllipse(546, 398, 70, 16);
  } else if (definition.theme === 'museum') {
    g.fillStyle(0xeabec0).fillRoundedRect(49, 78, 862, 414, 30);
    g.fillStyle(0xf5d8d5).fillRoundedRect(72, 106, 816, 362, 24);
    g.fillStyle(0xe0a7ae).fillRoundedRect(83, 116, 153, 299, 27).fillRoundedRect(721, 116, 153, 299, 27);
    for (let x = 112; x < 870; x += 53) g.fillStyle(x % 2 ? 0xf0c7cc : 0xeab8c0).fillRoundedRect(x, 109, 17, 347, 8);
    g.fillStyle(0xf9ece0).fillRoundedRect(272, 182, 367, 235, 29);
    g.fillStyle(0xf3c1c7).fillRoundedRect(287, 197, 337, 205, 21);
    for (let i = 0; i < 44; i++) {
      const x = 311 + i * 61 % 290; const y = 215 + i * 43 % 157;
      g.fillStyle([0xbc9ab7, 0xefb567, 0x9dbbaf, 0xc98d98][i % 4]).fillRoundedRect(x, y, 10, 4, 2);
    }
    label(scene, 461, 449, 'A whole room of pink', 16, '#986777');
  } else if (definition.theme === 'norway') {
    g.fillStyle(0x617c85).fillRoundedRect(49, 78, 862, 414, 30);
    g.fillStyle(0x405f6a).fillRoundedRect(65, 98, 830, 373, 22);
    for (let i = 0; i < 31; i++) g.fillStyle(0xf7e9c8, 0.8).fillCircle(93 + i * 127 % 770, 114 + i * 41 % 115, i % 3 ? 1 : 2);
    for (let band = 0; band < 3; band++) {
      const points = [{ x: 110, y: 142 + band * 16 }];
      for (let x = 110; x <= 850; x += 32) points.push({ x, y: 153 + band * 16 + Math.sin(x / 94 + band) * 28 });
      for (let x = 850; x >= 110; x -= 32) points.push({ x, y: 175 + band * 15 + Math.sin(x / 94 + band) * 28 });
      g.fillStyle([0x92bca5, 0x88b9b3, 0xa4aeca][band], 0.24).fillPoints(points.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
    }
    g.fillStyle(0x8badae).fillTriangle(86, 324, 209, 209, 357, 324).fillTriangle(249, 325, 407, 228, 587, 325).fillTriangle(601, 325, 765, 200, 886, 325);
    g.fillStyle(0xd3ded3).fillTriangle(170, 245, 209, 209, 247, 239).fillTriangle(725, 239, 765, 200, 798, 245);
    g.fillStyle(0xbfd0c5).fillRoundedRect(74, 326, 812, 146, 29);
    g.fillStyle(0xd8dfc8).fillEllipse(453, 407, 305, 91);
    for (const [x, y] of [[109, 374], [834, 364], [717, 432]]) tree(g, x, y, 65, 0x668d80);
    // Decorative reindeer and sled mirror the optional painted backdrop.
    g.fillStyle(0x9c8064).fillEllipse(223, 330, 63, 27).fillRoundedRect(193, 299, 17, 35, 6).fillEllipse(188, 304, 28, 16);
    g.fillStyle(0xe4d3af).fillEllipse(203, 323, 14, 21);
    for (const x of [203, 216, 239, 247]) g.fillStyle(0x806a55).fillRoundedRect(x, 337, 5, 21, 2);
    g.lineStyle(3, 0xa78d6e).lineBetween(186, 299, 185, 274).lineBetween(196, 299, 201, 277).lineBetween(185, 285, 175, 277).lineBetween(201, 286, 210, 279);
    g.fillStyle(0x715e4f).fillCircle(182, 303, 2);
    g.lineStyle(2, 0xc58b70).lineBetween(216, 317, 316, 343);
    g.fillStyle(0xa48667).fillRoundedRect(292, 330, 60, 17, 7);
    g.lineStyle(4, 0x8b735b).lineBetween(288, 354, 355, 354).lineBetween(288, 354, 281, 344).lineBetween(298, 346, 298, 354).lineBetween(341, 346, 341, 354);
    g.fillStyle(0x927655).fillRoundedRect(785, 295, 31, 24, 2).fillTriangle(781, 295, 801, 282, 820, 295);
    label(scene, 801, 299, 'M', 9, '#dfbf67');
    label(scene, 481, 283, 'A few pages under the northern lights', 16, '#eef0d7');
  } else if (definition.theme === 'austin') {
    g.fillStyle(0xe1dfcb).fillRoundedRect(49, 78, 862, 414, 30);
    g.fillStyle(0xb4b5a8).fillRoundedRect(60, 302, 838, 115, 25);
    g.fillStyle(0xc9c8b9).fillRoundedRect(70, 311, 818, 98, 19);
    g.lineStyle(3, 0xf8ecd1);
    for (let x = 89; x < 880; x += 68) g.lineBetween(x, 365, x + 28, 365);
    g.fillStyle(0xe1cfb1).fillRoundedRect(61, 280, 837, 24, 5).fillRoundedRect(61, 417, 837, 24, 5);
    tree(g, 112, 219, 57, 0xa7b08d); tree(g, 470, 454, 58, 0xb0b58f); tree(g, 864, 227, 50, 0xa7b18d);
    flowers(g, 606, 459, 0xe4baa1);
  } else if (definition.theme === 'cafe') {
    g.fillStyle(0xd5c9b6).fillRoundedRect(49, 78, 862, 414, 30);
    g.fillStyle(0xf1e4ce).fillRoundedRect(71, 104, 818, 365, 18);
    g.fillStyle(0xe9d3b8).fillRoundedRect(84, 117, 790, 93, 9);
    g.fillStyle(0xa9c6c3).fillRoundedRect(617, 123, 202, 77, 8);
    g.lineStyle(4, 0xf8ecd4).lineBetween(716, 123, 716, 200).lineBetween(618, 158, 818, 158);
    g.fillStyle(0xd5ae92).fillRoundedRect(119, 230, 177, 102, 17);
    g.fillStyle(0xe9c5a7).fillRoundedRect(126, 215, 163, 54, 16).fillRoundedRect(111, 248, 37, 83, 12).fillRoundedRect(270, 248, 37, 83, 12);
    g.fillStyle(0xf6e8d2).fillRoundedRect(163, 224, 42, 34, 9).fillRoundedRect(218, 224, 42, 34, 9);
    g.fillStyle(0xdac6ad).fillRoundedRect(335, 258, 379, 173, 26);
    g.lineStyle(2, 0xc6ac8b).strokeRoundedRect(346, 269, 356, 150, 20);
    g.fillStyle(0xbaa284).fillRoundedRect(117, 392, 92, 21, 5);
    g.fillStyle(0xdbe0ba).fillRoundedRect(133, 374, 52, 16, 4);
    tree(g, 810, 388, 49, 0x9ead8a);
    label(scene, 463, 455, 'Something made with love', 17, '#8e735b');
  } else if (definition.theme === 'madeira') {
    g.fillStyle(0xb4ced0).fillRoundedRect(49, 78, 862, 414, 30);
    g.fillStyle(0xd8d8b8).fillRoundedRect(80, 127, 839, 351, 24);
    g.fillStyle(0xf0e2c6).fillRoundedRect(95, 140, 810, 290, 18).fillRoundedRect(800, 413, 105, 52, 9);
    // The two enclosed gardens leave a coastal loop and a broad path down the middle.
    for (const bed of definition.obstacles.filter((rect) => rect.x > 0 && rect.y > 0 && rect.x + rect.width < 960 && rect.y + rect.height < 540)) {
      g.fillStyle(0xb4a283).fillRoundedRect(bed.x - 2, bed.y - 2, bed.width + 4, bed.height + 4, 13);
      g.fillStyle(0x91a079).fillRoundedRect(bed.x + 4, bed.y + 4, bed.width - 8, bed.height - 8, 10);
      g.lineStyle(3, 0xd3c6a5).strokeRoundedRect(bed.x + 1, bed.y + 1, bed.width - 2, bed.height - 2, 12);
      tree(g, bed.x + 53, bed.y + 82, 43, 0x80936f);
      tree(g, bed.x + bed.width - 47, bed.y + 75, 40, 0x9ba77e);
      flowers(g, bed.x + bed.width / 2, bed.y + 99, 0xd9a295, 4);
    }
    g.lineStyle(3, 0xb7a98c).lineBetween(95, 157, 95, 416).lineBetween(905, 157, 905, 456).lineBetween(110, 430, 800, 430).lineBetween(800, 430, 800, 465).lineBetween(800, 465, 897, 465);
    g.lineStyle(2, 0xe9d9ba).lineBetween(95, 158, 95, 415).lineBetween(905, 158, 905, 455).lineBetween(111, 429, 800, 429).lineBetween(801, 430, 801, 464).lineBetween(801, 464, 896, 464);
    for (let x = 120; x < 790; x += 44) g.fillStyle(0xd4c3a5).fillRoundedRect(x - 3, 424, 6, 14, 2);
    for (let y = 220; y < 410; y += 48) {
      g.fillStyle(0xd4c3a5).fillRoundedRect(91, y, 8, 13, 2).fillRoundedRect(901, y, 8, 13, 2);
      g.lineStyle(1, 0xeaf0dc, .6).lineBetween(58, y + 22, 76, y + 22).lineBetween(923, y + 22, 938, y + 22);
    }
    g.lineStyle(1, 0xd9c9ab, .65);
    for (let y = 170; y < 420; y += 25) g.lineBetween(451, y, 509, y);
    for (const x of [280, 360, 585, 665]) g.lineBetween(x, 405, x + 14, 405).lineBetween(x, 175, x + 14, 175);
  }
  for (let i = 0; i < 22; i++) {
    const x = 67 + ((i * 107) % 824); const y = 112 + ((i * 83) % 364);
    g.fillStyle(definition.theme === 'garden' ? 0xd8cb9e : 0xd3aa74, 0.6).fillEllipse(x, y, 4, 2);
  }
}
export function drawObject(scene: Phaser.Scene, visual: string, x: number, y: number, optionId?: string) {
  const g = scene.add.graphics({ x, y }).setDepth(y);
  if (visual === 'france-tower') {
    g.fillStyle(0x907854, .15).fillEllipse(0, 12, 91, 19);
    g.lineStyle(6, 0xcaa655).lineBetween(-38, 4, -7, -92).lineBetween(38, 4, 7, -92).lineBetween(-7, -92, 0, -117).lineBetween(0, -117, 7, -92);
    g.lineStyle(3, 0xe4c97f);
    for (let i = 0; i < 5; i++) {
      const w = 33 - i * 5.5; const y = -8 - i * 17;
      g.lineBetween(-w, y, w, y).lineBetween(-w, y, w - 5.5, y - 17).lineBetween(w, y, -w + 5.5, y - 17);
    }
    g.fillStyle(0xd6b865).fillRoundedRect(-42, -1, 19, 10, 2).fillRoundedRect(23, -1, 19, 10, 2);
  } else if (visual === 'france-statue') {
    g.fillStyle(0xc4bca4).fillRoundedRect(-70, -9, 98, 16, 5).fillRoundedRect(-62, -36, 82, 22, 4);
    g.fillStyle(0xa49b86).fillRoundedRect(-59, 6, 7, 15, 2).fillRoundedRect(10, 6, 7, 15, 2);
    g.fillStyle(0xa3a888).fillRoundedRect(34, -8, 35, 23, 3);
    g.fillStyle(0x76a36f).fillRoundedRect(39, -54, 24, 44, 6).fillRoundedRect(40, -16, 8, 18, 3).fillRoundedRect(55, -16, 8, 18, 3);
    g.fillStyle(0xe8c86b).fillCircle(51, -68, 13).fillTriangle(38, -72, 49, -86, 55, -74).fillTriangle(49, -75, 61, -86, 64, -72);
    g.fillStyle(0xc87e6b).fillRoundedRect(39, -56, 26, 7, 3).fillTriangle(58, -52, 76, -44, 57, -40);
    g.lineStyle(2, 0xeadfca).lineBetween(-56, -35, -52, -87).lineBetween(-52, -77, -68, -85).lineBetween(-52, -68, -37, -82);
    g.fillStyle(0xb7786d).fillCircle(-63, -77, 5).fillCircle(-37, -81, 4);
  } else if (visual === 'france-room') {
    g.fillStyle(0x92a7b5).fillRoundedRect(-56, -89, 112, 99, 7);
    g.fillStyle(0x4d7096).fillRoundedRect(-47, -79, 94, 79, 5);
    g.fillStyle(0xe0bd66);
    for (const [x, y] of [[-29, -61], [4, -49], [30, -65], [-18, -27], [26, -20]]) {
      g.fillTriangle(x, y - 6, x - 5, y + 3, x + 5, y + 3).fillTriangle(x, y + 6, x - 5, y - 3, x + 5, y - 3);
    }
    g.fillStyle(0xdccba6).fillRoundedRect(-61, 1, 122, 12, 4);
  } else if (visual === 'museum-jukebox') {
    g.fillStyle(0xc980a0).fillRoundedRect(-8, -93, 67, 99, 28);
    g.lineStyle(4, 0xffe5c3).strokeRoundedRect(0, -84, 51, 78, 23);
    g.fillStyle(0xb97795).fillRoundedRect(11, -54, 30, 40, 5);
    g.lineStyle(2, 0xf2b9ce);
    for (let y = -49; y < -16; y += 7) g.lineBetween(14, y, 38, y);
    g.fillStyle(0xf6d4d7).fillRoundedRect(-55, -29, 33, 35, 5);
    g.fillStyle(0xffefd9).fillEllipse(-39, -31, 40, 16).fillCircle(-39, -44, 15);
    g.fillStyle(0xdca8be).fillCircle(-43, -47, 8);
  } else if (visual === 'museum-arches') {
    g.fillStyle(0xe6acc4).fillRoundedRect(-58, -116, 116, 124, 8);
    for (let i = 0; i < 4; i++) {
      const w = 104 - i * 22; const h = 112 - i * 16;
      g.lineStyle(4, i % 2 ? 0xffecde : 0xf99fc5).strokeRoundedRect(-w / 2, 5 - h, w, h, w / 2);
    }
  } else if (visual === 'museum-mirror') {
    g.fillStyle(0xe9becb).fillRoundedRect(-48, -108, 98, 119, 8);
    for (let i = 0; i < 14; i++) g.fillStyle([0xd391ac, 0xf1d080, 0x93bbae][i % 3]).fillRoundedRect(-43 + i * 19 % 85, -96 + i * 31 % 91, 7, 3, 2);
    g.fillStyle(0xbc769b).fillRoundedRect(-26, -111, 52, 120, 25);
    g.fillStyle(0xc5d3df).fillRoundedRect(-20, -104, 40, 104, 20);
    g.lineStyle(3, 0xeb9ac0).lineBetween(-9, -90, 6, -57).lineBetween(6, -57, -9, -27).lineBetween(-9, -27, 3, -3);
    g.lineStyle(2, 0xf4e7db).lineBetween(5, -95, 12, -57).lineBetween(12, -57, 5, -25);
  } else if (visual === 'envelope') {
    g.fillStyle(0xa78d66, 0.16).fillEllipse(0, 17, 74, 15);
    g.fillStyle(0xfdf4e3).fillRoundedRect(-31, -23, 62, 43, 5);
    g.lineStyle(2, 0xbfa584).strokeRoundedRect(-31, -23, 62, 43, 5);
    g.lineBetween(-29, -20, 0, 3).lineBetween(0, 3, 29, -20);
    g.fillStyle(0xc88070).fillCircle(0, 3, 7);
    g.fillStyle(0xfceade).fillCircle(-2, 2, 2).fillCircle(2, 2, 2).fillTriangle(-4, 3, 4, 3, 0, 7);
  } else if (visual === 'flowers') {
    const petals = optionId === 'ugly' ? [0xb39160, 0x809470, 0xc58c7a] : optionId === 'roses' ? [0x86aec4, 0xf8f3e5, 0x8ab1c9] : [0x679bab, 0x7bafbc, 0x5d92a3];
    for (let i = 0; i < 7; i++) {
      const fx = Math.cos(i * 2.1) * 17; const fy = -21 + Math.sin(i * 2.1) * 10;
      g.lineStyle(2, 0x78836d).lineBetween(fx, fy, 0, 16);
      g.fillStyle(petals[i % petals.length]);
      if (optionId === 'tulips') {
        g.fillEllipse(fx, fy, 8, 15).fillEllipse(fx - 4, fy - 2, 5, 10).fillEllipse(fx + 4, fy - 2, 5, 10);
      } else {
        g.fillCircle(fx, fy, 7).fillCircle(fx - 4, fy - 3, 5).fillCircle(fx + 4, fy - 3, 5);
        g.fillStyle(0xf1d9a0).fillCircle(fx, fy, 2);
      }
    }
    g.fillStyle(optionId === 'ugly' ? 0xab986f : 0xe5ceac).fillTriangle(-23, -4, 23, -4, 0, 25);
    g.lineStyle(2, 0xbc8874).lineBetween(-10, 9, 9, 9);
  } else if (visual === 'ice-cream') {
    g.fillStyle(0x685742, 0.12).fillEllipse(0, 14, 96, 14);
    g.fillStyle(0xdba6a7).fillRoundedRect(-42, -62, 84, 72, 8);
    g.fillStyle(0xf7e1c9).fillRoundedRect(-47, -75, 94, 19, 6);
    for (let sx = -42; sx < 42; sx += 24) g.fillStyle(0xd596a2).fillRoundedRect(sx, -75, 12, 23, 3);
    g.fillStyle(0xe9c691).fillTriangle(-13, -18, 13, -18, 0, 4);
    g.fillStyle(0xf4e4d1).fillCircle(0, -23, 14);
    g.fillStyle(0xbba5c4).fillCircle(-8, -38, 13);
    g.fillStyle(0xedbfbe).fillCircle(12, -39, 12);
    g.fillStyle(0xf8edcf).fillCircle(4, -53, 11);
  } else if (visual === 'postcard') {
    const garden = optionId?.includes('garden');
    if (optionId?.startsWith('museum-')) {
      g.fillStyle(0xd49eaa).fillEllipse(0, 1, 174, 89);
      g.fillStyle(0xffe9da).fillEllipse(0, -7, 174, 85);
      g.fillStyle(0xeec1c6).fillEllipse(0, -9, 147, 61);
      for (let i = 0; i < 28; i++) {
        const sx = -63 + i * 31 % 123; const sy = -30 + i * 17 % 37;
        g.fillStyle([0xbca1c1, 0xecb066, 0x9eb9ae, 0xcc8c9c][i % 4]).fillRoundedRect(sx, sy, 8, 4, 2);
      }
      g.lineStyle(4, 0xf5e9db).lineBetween(-65, -15, -65, 23).lineBetween(-40, -10, -40, 27).lineBetween(-65, 3, -40, 8).lineBetween(-65, 17, -40, 21);
    } else if (garden) {
      g.fillStyle(0xc7bb97).fillRoundedRect(-47, -10, 94, 21, 6);
      g.lineStyle(4, 0xb4a485).strokeRoundedRect(-43, -71, 86, 82, 36);
      for (let i = 0; i < 8; i++) flowers(g, -39 + i * 11, -62 + Math.sin(i) * 8, [0xe7ada8, 0xedc987, 0xb69db9][i % 3], 2);
    } else {
      g.fillStyle(0x65513e, 0.13).fillEllipse(0, 16, 151, 18);
      g.fillStyle(0xddbc9b).fillRoundedRect(-68, -103, 136, 114, 7);
      g.fillStyle(0xb68469).fillTriangle(-79, -103, 0, -151, 79, -103);
      g.fillStyle(0xf2dac0).fillRoundedRect(-58, -96, 116, 105, 5);
      g.lineStyle(5, 0xa5785f).lineBetween(-55, -61, 55, -61).lineBetween(0, -95, 0, 8).lineBetween(-53, -94, -4, -62).lineBetween(4, -94, 52, -62);
      g.fillStyle(0x8eafa8).fillRoundedRect(-45, -53, 25, 34, 4).fillRoundedRect(19, -53, 25, 34, 4);
      g.fillStyle(0xb7916e).fillRoundedRect(-12, -44, 25, 54, 4);
      g.fillStyle(0xc78c77).fillRoundedRect(-45, -23, 25, 6, 2).fillRoundedRect(19, -23, 25, 6, 2);
    }
  } else if (visual === 'scrapbook') {
    g.fillStyle(0x74604c, 0.18).fillEllipse(0, 17, 120, 21);
    g.fillStyle(0xaf9273).fillRoundedRect(-61, -5, 122, 20, 6);
    g.fillStyle(0xbe8578).fillRoundedRect(-48, -48, 96, 47, 7);
    g.fillStyle(0xfff0d5).fillRoundedRect(-42, -44, 40, 39, 3).fillRoundedRect(3, -44, 40, 39, 3);
    g.lineStyle(2, 0xa4baaa).lineBetween(-31, -15, -18, -36).lineBetween(-18, -36, -9, -16);
    g.fillStyle(0x9ab9b7).fillRoundedRect(9, -35, 28, 19, 3);
    g.fillStyle(0xe5c999).fillCircle(27, -28, 4);
    g.lineStyle(2, 0x947157).lineBetween(0, -44, 0, -6);
  } else if (visual === 'building') {
    const citizenship = optionId?.includes('citizenship');
    const maa = optionId?.includes('maa');
    const width = citizenship ? 137 : 147;
    g.fillStyle(0x8a7157, 0.12).fillEllipse(0, 13, width + 16, 20);
    g.fillStyle(citizenship ? 0xd6c6aa : maa ? 0xb1baaa : 0xaeb2b4).fillRoundedRect(-width / 2, -124, width, 134, 8);
    g.fillStyle(0xefe0c7).fillRoundedRect(-width / 2 - 5, -130, width + 10, 13, 4);
    for (const row of [-99, -66]) for (const column of [-48, -16, 16, 48]) {
      g.fillStyle(0x89a9a2).fillRoundedRect(column - 10, row, 20, 23, 3);
      g.lineStyle(1, 0xf2e5cd).lineBetween(column, row + 2, column, row + 20);
    }
    g.fillStyle(0x786a56).fillRoundedRect(-18, -30, 36, 40, 4);
    g.fillStyle(0xcbd4c2).fillRoundedRect(-13, -26, 26, 30, 3);
    if (citizenship) {
      g.fillStyle(0xe9d7b2).fillTriangle(-79, -130, 0, -163, 79, -130);
      g.fillStyle(0xb69973).fillCircle(0, -145, 8);
      for (const column of [-60, 60]) g.fillStyle(0xe8d9bb).fillRoundedRect(column - 4, -117, 8, 126, 3);
    }
    label(scene, x, y - 43, citizenship ? 'CITIZENSHIP' : maa ? 'MAA' : 'Goodwin', 10, '#655745').setDepth(y + 1);
  } else if (visual === 'garage') {
    g.fillStyle(0x7a7865, .15).fillEllipse(0, 12, 78, 17);
    g.fillStyle(0xd3cbb6).fillRoundedRect(-34, -62, 70, 72, 5);
    g.fillStyle(0xaeb5a2).fillRoundedRect(-34, -60, 70, 65, 4);
    g.fillStyle(0xe8ddc2).fillRoundedRect(-40, -66, 80, 11, 3);
    g.fillStyle(0x655f50).fillRoundedRect(-25, -48, 50, 55, 3);
    g.fillStyle(0x818174).fillRoundedRect(-22, -45, 44, 51, 2);
    g.fillStyle(0xc2c5b3).fillRoundedRect(-27, -51, 54, 15, 2);
    g.lineStyle(1, 0x969b89).lineBetween(-25, -46, 25, -46).lineBetween(-25, -41, 25, -41);
    g.fillStyle(0xdbd2bf).fillRoundedRect(-28, 3, 56, 9, 2);
    g.fillStyle(0xe1d5ba, .7).fillPoints([[-28, 12], [28, 12], [37, 34], [-37, 34]].map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
    g.lineStyle(1, 0xc2b79c, .65).lineBetween(-28, 21, 28, 21);
  } else if (visual === 'door') {
    if (optionId?.includes('access')) {
      g.fillStyle(0xceb894, 0.25).fillEllipse(0, 13, 41, 12);
      g.lineStyle(3, 0xc4a177).strokeCircle(0, -23, 9);
      g.fillStyle(0x687967).fillRoundedRect(-13, -18, 26, 38, 6);
      g.fillStyle(0xbed0ae).fillCircle(0, -5, 6);
      g.fillStyle(0xdfe6ca).fillRoundedRect(-5, 7, 10, 3, 1);
    } else {
      g.fillStyle(0xafb4a2).fillRoundedRect(-73, -182, 146, 193, 8);
      g.fillStyle(0xe8ddc2).fillRoundedRect(-80, -186, 160, 12, 4);
      for (const row of [-163, -122]) for (const column of [-47, 0, 47]) g.fillStyle(0x91ada7).fillRoundedRect(column - 14, row, 28, 29, 4);
      g.fillStyle(0x7e775f).fillRoundedRect(-25, -84, 50, 91, 6);
      g.fillStyle(0xd8d1af).fillRoundedRect(-20, -78, 40, 79, 3);
      g.fillStyle(0xa4b9aa).fillRoundedRect(-14, -70, 28, 38, 4);
      g.fillStyle(0xb98c66).fillCircle(13, -23, 3);
      label(scene, x, y - 94, 'MAA', 12, '#65755f').setDepth(y + 1);
    }
  } else if (visual === 'photo-booth') {
    g.fillStyle(0x98756f, .18).fillEllipse(0, 14, 78, 15);
    g.fillStyle(0xd09b9e).fillRoundedRect(-35, -80, 70, 90, 8);
    g.fillStyle(0xf6e6d2).fillRoundedRect(-40, -88, 80, 17, 5);
    g.fillStyle(0x654d53).fillRoundedRect(-25, -64, 50, 68, 4);
    g.fillStyle(0xaa738c).fillRoundedRect(-24, -64, 18, 67, 3).fillRoundedRect(7, -64, 18, 67, 3);
    g.fillStyle(0xf8eed8).fillRoundedRect(-11, -48, 22, 17, 3);
    g.fillStyle(0x756778).fillCircle(0, -39, 5);
  } else if (visual === 'lake') {
    g.fillStyle(0xd8c8a4).fillEllipse(0, -12, 146, 60);
    g.fillStyle(0x86bfc6).fillEllipse(0, -17, 128, 44);
    g.lineStyle(2, 0xcee9de).lineBetween(-38, -22, -8, -22).lineBetween(8, -13, 34, -13);
    g.fillStyle(0xc6a676).fillRoundedRect(42, -4, 32, 8, 3).fillRoundedRect(48, -33, 9, 37, 3);
  } else if (visual === 'house' || visual === 'line-dance') {
    g.fillStyle(0x826c54, .14).fillEllipse(0, 12, 116, 20);
    g.fillStyle(visual === 'house' ? 0xe3c6a5 : 0xb58b67).fillRoundedRect(-49, -70, 98, 79, 6);
    g.fillStyle(0xaf7656).fillTriangle(-60, -70, 0, -112, 60, -70);
    g.fillStyle(0x6d8c8c).fillRoundedRect(-12, -43, 24, 50, 4);
    for (const column of [-34, 25]) g.fillStyle(0xa4c2ba).fillRoundedRect(column, -52, 20, 23, 3);
    if (visual === 'house') {
      g.fillStyle(0xfcf6e6).fillEllipse(27, 3, 16, 20).fillCircle(27, -9, 8).fillTriangle(20, -11, 25, -20, 27, -11).fillTriangle(27, -11, 32, -20, 34, -11);
      g.fillStyle(0x66564c).fillCircle(24, -9, 1).fillCircle(30, -9, 1);
    } else {
      g.fillStyle(0xf3d39f).fillRoundedRect(-17, -89, 20, 24, 3).fillRoundedRect(-17, -69, 33, 8, 3);
      label(scene, x + 30, y - 79, '♪', 24).setDepth(y + 1);
    }
  } else if (visual === 'table') {
    g.fillStyle(0x81694d, 0.12).fillEllipse(0, 28, 166, 33);
    g.fillStyle(0xae8b67).fillRoundedRect(-55, -6, 10, 45, 4).fillRoundedRect(45, -6, 10, 45, 4);
    g.fillStyle(0xd5b189).fillRoundedRect(-77, -42, 154, 62, 20);
    g.fillStyle(0xebd6b3).fillRoundedRect(-72, -39, 144, 48, 17);
    g.fillStyle(0xfff3da).fillEllipse(-29, -15, 44, 22).fillEllipse(29, -15, 44, 22);
    g.fillStyle(0xbfa276).fillRoundedRect(-42, -21, 28, 10, 4).fillRoundedRect(18, -21, 25, 10, 4);
    g.fillStyle(0x8ca06f).fillCircle(-19, -15, 6).fillCircle(40, -13, 5);
    g.fillStyle(0xf2e5cb).fillEllipse(-1, -24, 17, 13);
    g.fillStyle(0x987c58).fillEllipse(-1, -25, 12, 8);
    g.lineStyle(2, 0xf2e5cb).strokeCircle(9, -23, 4);
  } else if (visual === 'castle') {
    g.fillStyle(0x6d7169, .15).fillEllipse(0, 12, 146, 22);
    g.fillStyle(0x9fa297).fillRoundedRect(-66, -93, 132, 105, 4);
    g.fillStyle(0xc4c4b5).fillRoundedRect(-61, -88, 122, 96, 3);
    for (const x of [-60, -34, -8, 18, 44]) g.fillStyle(0xb9bbad).fillRect(x, -103, 16, 19);
    for (const x of [-70, 47]) {
      g.fillStyle(0x969e92).fillRoundedRect(x, -112, 25, 121, 4);
      for (let dx = 0; dx < 25; dx += 9) g.fillStyle(0xb6baaa).fillRect(x + dx, -122, 7, 15);
      g.fillStyle(0x5d7066).fillRoundedRect(x + 9, -89, 7, 23, 4);
    }
    g.lineStyle(1, 0x898e84, .5);
    for (let y = -78; y < 5; y += 17) {
      g.lineBetween(-43, y, 43, y);
      for (let x = -38 + ((y + 78) % 34 ? 12 : 0); x < 42; x += 24) g.lineBetween(x, y, x, y + 16);
    }
    g.fillStyle(0x667366).fillRoundedRect(-19, -46, 38, 58, 17);
    g.fillStyle(0x83917a).fillRoundedRect(-14, -41, 28, 53, 12);
    g.fillStyle(0xe2d6b8).fillRoundedRect(-27, 5, 54, 12, 3);
  } else if (visual === 'viewpoint' || visual === 'proposal') {
    g.fillStyle(0x668073, 0.16).fillEllipse(0, 16, 56, 14);
    g.fillStyle(visual === 'proposal' ? 0xc7867c : 0xbf936c).fillCircle(0, -19, 16).fillTriangle(-13, -11, 13, -11, 0, 14);
    g.fillStyle(0xf9edcf).fillCircle(0, -20, 9);
    if (visual === 'proposal') {
      g.fillStyle(0xadab8a).fillRoundedRect(-6, -55, 12, 20, 3).fillRoundedRect(-23, -49, 46, 6, 2).fillCircle(0, -63, 6);
      g.fillStyle(0xe4d9bb).fillRoundedRect(-13, -38, 26, 8, 3);
    } else {
      g.fillStyle(0xe0b988).fillCircle(0, -21, 3);
      g.lineStyle(2, 0xf9edcf).lineBetween(-5, -25, -2, -28).lineBetween(2, -28, 5, -25);
    }
  }
  return g;
}

/** Distinct flowers provide the only clue above the escape-room floor. */
export function drawPuzzleFlowers(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(-65);
  for (let i = 0; i < 5; i++) {
    const x = 350 + i * 64; const y = 127;
    g.lineStyle(3, 0x7d977b).lineBetween(x, y + 7, x, y + 22);
    g.fillStyle(0x97ac82).fillEllipse(x - 5, y + 15, 11, 5);
    g.fillStyle(0x71aaca);
    for (let p = 0; p < 5; p++) g.fillCircle(x + Math.cos(p * Math.PI * 2 / 5) * 7, y + Math.sin(p * Math.PI * 2 / 5) * 7, 6);
    g.fillStyle(0xb8d7df).fillCircle(x, y, 5);
    g.fillStyle(0xf4e3b4).fillCircle(x, y, 2.5);
  }
}

/** A separate postcard stand marks a photograph added to an existing painted location. */
export function drawMemoryProp(scene: Phaser.Scene, x: number, y: number, theme: string) {
  const g = scene.add.graphics({ x, y }).setDepth(y);
  g.fillStyle(0x735d48, .16).fillEllipse(0, 11, 65, 13);
  g.fillStyle(0xb99a73).fillRoundedRect(-3, -20, 6, 34, 2);
  g.fillStyle(0xfff0d4).fillRoundedRect(-29, -49, 58, 43, 5);
  g.lineStyle(2, 0xc4aa84).strokeRoundedRect(-29, -49, 58, 43, 5);
  g.fillStyle(theme === 'museum' ? 0xe9b7c5 : 0xacc9bf).fillRoundedRect(-24, -44, 48, 29, 3);
  g.fillStyle(0xf1d09c).fillCircle(13, -37, 5);
  g.fillStyle(theme === 'museum' ? 0xc290b7 : 0x8ca07c).fillTriangle(-24, -15, -6, -36, 11, -15).fillTriangle(-1, -15, 12, -29, 24, -15);
}

/** Wooden park landmarks become replay targets only after the journey's ending. */
export function drawRailwaySign(scene: Phaser.Scene, x: number, y: number) {
  const g = scene.add.graphics({ x, y }).setDepth(y);
  g.fillStyle(0x735d48, .13).fillEllipse(3, 12, 73, 14);
  g.fillStyle(0x9c7851).fillRoundedRect(-25, -9, 8, 27, 2).fillRoundedRect(18, -9, 8, 27, 2);
  g.lineStyle(1, 0xc5a173, .75).lineBetween(-23, 2, -23, 16).lineBetween(20, 2, 20, 16);
  g.fillStyle(0x8f6847).fillRoundedRect(-36, -30, 73, 37, 3);
  g.fillStyle(0xc09a69).fillPoints([[-35, -32], [30, -33], [36, -29], [34, 2], [-32, 4], [-36, 0]].map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
  g.fillStyle(0xd3b080, .55).fillRoundedRect(-33, -30, 66, 5, 2).fillRoundedRect(-32, -8, 65, 4, 1);
  g.lineStyle(1, 0x8b6546, .55).lineBetween(-32, -20, 33, -21).lineBetween(-32, -9, 33, -10);
  for (const [left, right, y] of [[-29, -7, -26], [1, 28, -24], [-29, 18, -15], [-17, 31, -4]]) {
    g.lineStyle(1, 0x956d49, .45).lineBetween(left, y, right, y + .8);
  }
  g.lineStyle(1, 0x8d6849, .5).strokeEllipse(-12, -14, 9, 3).strokeEllipse(23, -26, 6, 2);
  for (const x of [-23, 23]) for (const y of [-27, -3]) g.fillStyle(0x866c50, .75).fillCircle(x, y, 1.4);
  g.fillStyle(0xbfa16a, .5).fillEllipse(-27, 15, 16, 7).fillEllipse(27, 15, 15, 6);
  g.lineStyle(1, 0x8b9462, .65).lineBetween(-30, 17, -33, 11).lineBetween(-28, 17, -27, 10).lineBetween(30, 17, 33, 12);
}
