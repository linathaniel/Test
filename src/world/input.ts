import { direction } from './geometry';

export class WorldInput {
  readonly held = new Set<string>();
  private pressed = new Set<string>();
  private abort = new AbortController();
  constructor(private action: (code: string) => void, private canMove: () => boolean, private blur: () => void, private ownsMovementKeys: () => boolean = () => false) {
    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Escape'].includes(event.code)) return;
      if (event.repeat || this.pressed.has(event.code)) { event.preventDefault(); return; }
      this.pressed.add(event.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
        if (this.ownsMovementKeys()) { event.preventDefault(); this.action(event.code); }
        else if (this.canMove()) { this.held.add(event.code); event.preventDefault(); }
      } else { event.preventDefault(); this.action(event.code); }
    }, { signal: this.abort.signal });
    window.addEventListener('keyup', (event) => { this.held.delete(event.code); this.pressed.delete(event.code); }, { signal: this.abort.signal });
    window.addEventListener('blur', () => { this.clear(); this.pressed.clear(); this.blur(); }, { signal: this.abort.signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); this.pressed.clear(); this.blur(); } }, { signal: this.abort.signal });
  }
  vector() { return direction(this.held); }
  clear() { this.held.clear(); }
  destroy() { this.abort.abort(); this.held.clear(); this.pressed.clear(); }
}
