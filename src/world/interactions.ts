import type { Interaction, Point, Rect } from '../content/model';
import { clearLine } from './geometry';
import { puzzleCell } from './puzzleFloor';

export type InteractionTarget = {
  id: string; interaction: Interaction; optionId?: string; letter?: string; stopIndex?: number; label: string;
  position: Point; approach: Point; radius: number;
};
export function interactionTargets(interactions: Interaction[]): InteractionTarget[] {
  return interactions.flatMap<InteractionTarget>((interaction) => {
    if (interaction.kind === 'puzzle') {
      return interaction.letters.map((letter, index) => ({
        id: interaction.id + ':' + letter, interaction, letter, label: 'Letter ' + letter,
        position: puzzleCell(index), approach: puzzleCell(index), radius: 78,
      }));
    }
    if (interaction.kind === 'choice') {
      return interaction.options.map((option) => ({
        id: interaction.id + ':' + option.id, interaction, optionId: option.id, label: option.label,
        position: option.position ?? interaction.position, approach: option.approach ?? interaction.approach, radius: interaction.radius,
      }));
    }
    if (interaction.kind === 'railway') {
      return [
        { id: interaction.id, interaction, label: interaction.label, position: interaction.position, approach: interaction.approach, radius: interaction.radius },
        ...interaction.stops.map((stop, stopIndex) => {
          const position = stop.signPosition ?? { x: stop.position.x, y: Math.min(440, stop.position.y + 85) };
          return {
            id: interaction.id + ':stop:' + stopIndex, interaction, stopIndex, label: stop.memory.label,
            position, approach: stop.signApproach ?? { x: position.x, y: Math.min(474, position.y + 35) }, radius: 72,
          };
        }),
      ];
    }
    return [{ id: interaction.id, interaction, label: interaction.label, position: interaction.position, approach: interaction.approach, radius: interaction.radius }];
  });
}
export function isNearby(target: { position: Point; radius: number }, leader: Point, obstacles: Rect[]) {
  return Math.hypot(target.position.x - leader.x, target.position.y - leader.y) <= target.radius && clearLine(leader, target.position, obstacles);
}
export function nearestInteraction(interactions: Interaction[], leader: Point, obstacles: Rect[]): InteractionTarget | null {
  return interactionTargets(interactions).filter((target) => isNearby(target, leader, obstacles)).sort((a, b) => {
    const delta = Math.hypot(a.position.x - leader.x, a.position.y - leader.y) - Math.hypot(b.position.x - leader.x, b.position.y - leader.y);
    return delta || a.id.localeCompare(b.id);
  })[0] ?? null;
}
