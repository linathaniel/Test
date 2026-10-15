import type { CharacterId } from '../content/model';

/** Raster sheets share a stable 4 × 4 layout: south, north, west, east. */
export const characterAssets: { id: CharacterId; key: string; path: string; frameWidth: number; frameHeight: number }[] = [
  { id: 'person-a', key: 'actor-person-a', path: 'assets/characters/nathaniel-walk.webp', frameWidth: 256, frameHeight: 256 },
  { id: 'person-b', key: 'actor-person-b', path: 'assets/characters/gracie-walk.webp', frameWidth: 256, frameHeight: 256 },
];

export type CharacterDirection = 'south' | 'north' | 'west' | 'east';
export const characterRows: Record<CharacterDirection, number> = { south: 0, north: 1, west: 2, east: 3 };
export const actorSize = { width: 52, height: 72 } as const;
