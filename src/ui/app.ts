import type { CharacterId, Interaction, MemoryDefinition, MemoryPhoto, Point } from '../content/model';
import { gateInteraction, isSceneComplete, type Profile, type Session } from '../state/session';
import type { InteractionTarget } from '../world/interactions';

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!);
}
export type Actions = {
  name: (profile: Profile) => void; interact: () => void; switchLeader: () => void;
  pause: () => void; resume: () => void; close: () => void; advance: () => void; explore: () => void;
  restart: () => void; guide: () => void; toggleMemory: () => void; openMemory: () => void;
  puzzleTile: (letter: string) => void; scrapbookPage: (delta: number) => void;
  readStory: () => void; readerOpen: (interactionId: string) => void; readerDone: () => void; textSize: () => void;
  travelScene: (sceneId: string) => void;
};
export class AppUI {
  readonly worldHost: HTMLElement;
  private dialog: HTMLDialogElement;
  private target: InteractionTarget | null = null;
  private lastFocus: HTMLElement | null = null;
  private toastTimer = 0;
  private speechTimer = 0;
  private photoIndexes = new Map<string, number>();
  private viewedPhotos = new Map<string, Set<number>>();
  private repaintPhotos: (() => void) | null = null;
  private activeAlbum: MemoryDefinition | null = null;
  private currentEnding: Extract<Interaction, { kind: 'ending' }> | null = null;
  private actors: Record<CharacterId, Point> = { 'person-a': { x: 0, y: 0 }, 'person-b': { x: 0, y: 0 } };
  private abort = new AbortController();
  constructor(private session: Session, private actions: Actions) {
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.innerHTML = `
      <main class="app-shell">
        <header class="single-title"><span aria-hidden="true">✿</span><h1 id="chapter-title"></h1></header>
        <section class="world-frame" aria-label="Our story">
          <div id="world" tabindex="0" aria-label="Walk with WASD. Q switches who leads. E or a nearby object click interacts."></div>
          <div class="map-guidance"><span id="chapter-eyebrow" class="eyebrow"></span><strong id="interaction-title"></strong><span id="interaction-description"></span></div>
          <div class="walk-tutorial" id="walk-tutorial" hidden><strong>WASD to walk</strong><div class="direction-keys" aria-label="W moves up, A moves left, S moves down, D moves right"><kbd class="key-up"><span>↑</span>W</kbd><kbd class="key-left"><span>←</span>A</kbd><kbd class="key-down"><span>↓</span>S</kbd><kbd class="key-right"><span>→</span>D</kbd></div><span>Walk to the letter ↘<br>Press <kbd>E</kbd> to open it.</span></div>
          <div class="map-top-tools"><button class="quiet-button" data-action="read-story">Read story</button><button class="quiet-button" data-action="pause">Pause & help <kbd>Esc</kbd></button></div>
          <div class="map-tools"><button class="secondary" data-action="switch"><kbd>Q</kbd><span id="leader-name"></span> leads · switch</button><button id="interact-button" class="primary" data-action="interact"><span class="key-light">E</span><span id="interact-label">Interact</span></button></div>
          <button class="map-memory primary" data-action="open-memory" hidden><span class="key-light">E</span> See this memory</button>
          <div class="railway-hud" id="railway-hud" hidden><div><strong>Front car, together</strong><span id="railway-progress-text" aria-live="polite"></span></div><progress id="railway-progress" aria-label="Pedals to next railway stop" max="4" value="0"></progress><button class="primary" data-action="interact"><kbd>E</kbd> Pedal</button></div>
          <div class="speech-bubble" id="speech-bubble" role="status" aria-live="polite" hidden><span id="speech-name"></span><p id="speech-text"></p></div>
          <div id="toast" class="world-notice" role="status" aria-live="polite" hidden></div>
          <nav id="world-travel" class="world-travel" aria-label="Revisit our worlds" hidden></nav>
        </section>
        <div class="control-strip"><span><kbd>W A S D</kbd> Walk / drive</span><span><kbd>Q</kbd> Switch leader</span><span><kbd>E</kbd> Interact / close memory</span><span>or click a nearby object</span></div>
        <dialog id="story-dialog" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog>
      </main>`;
    this.worldHost = app.querySelector('#world')!;
    this.dialog = app.querySelector('#story-dialog')!;
    app.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!button || button.matches(':disabled')) return;
      const action = button.dataset.action!;
      if (action === 'toggle-memory') actions.toggleMemory();
      else if (action === 'photo-page') {
        this.turnPhoto(Number(button.dataset.delta));
      }
      else if (action === 'travel-scene') actions.travelScene(button.dataset.sceneId!);
      else if (action === 'puzzle-tile') actions.puzzleTile(button.dataset.letter!);
      else if (action === 'scrapbook-page') actions.scrapbookPage(Number(button.dataset.delta));
      else if (action === 'reader-open') actions.readerOpen(button.dataset.interactionId!);
      else if (action === 'retry-image') this.retryImage(button);
      else if (action === 'reload') location.reload();
      else if (action === 'motion') { session.update({ reducedMotion: !session.state.reducedMotion }); this.showPause(); }
      else ({
        interact: actions.interact, switch: actions.switchLeader, pause: actions.pause, resume: actions.resume,
        close: actions.close, advance: actions.advance, explore: actions.explore, restart: actions.restart, guide: actions.guide,
        'open-memory': actions.openMemory, 'read-story': actions.readStory, 'reader-done': actions.readerDone, 'text-size': actions.textSize,
      } as Record<string, () => void>)[action]?.();
    }, { signal: this.abort.signal });
    app.addEventListener('error', (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches('.memory-picture img')) return;
      image.hidden = true;
      const container = image.closest('.memory-asset')!;
      container.querySelector<HTMLElement>('.image-fallback')!.hidden = false;
      container.querySelector<HTMLButtonElement>('[data-action="retry-image"]')!.hidden = false;
    }, { capture: true, signal: this.abort.signal });
    app.addEventListener('load', (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches('.memory-picture img')) return;
      image.hidden = false;
      const container = image.closest('.memory-asset')!;
      container.querySelector<HTMLElement>('.image-fallback')!.hidden = true;
      container.querySelector<HTMLButtonElement>('[data-action="retry-image"]')!.hidden = true;
    }, { capture: true, signal: this.abort.signal });
    app.addEventListener('submit', (event) => {
      if ((event.target as HTMLElement).id !== 'naming-form') return;
      event.preventDefault();
      const a = app.querySelector<HTMLInputElement>('#name-a')!.value.trim() || 'Him';
      const b = app.querySelector<HTMLInputElement>('#name-b')!.value.trim() || 'Her';
      const greeting = app.querySelector<HTMLTextAreaElement>('#greeting')!.value.trim() || session.story.manifest.greeting;
      actions.name({ names: { 'person-a': a, 'person-b': b }, greeting });
    }, { signal: this.abort.signal });
    this.dialog.addEventListener('cancel', (event) => { event.preventDefault(); session.state.mode === 'paused' ? actions.resume() : actions.close(); }, { signal: this.abort.signal });
    session.subscribe(() => this.render()); this.render();
  }
  render() {
    const { state, scene } = this.session;
    document.documentElement.dataset.reducedMotion = String(state.reducedMotion);
    document.documentElement.dataset.textScale = state.textScale;
    this.text('chapter-title', this.session.story.manifest.title); this.text('chapter-eyebrow', scene.eyebrow);
    document.querySelector('.world-frame')!.classList.toggle('intro-world', scene.id === 'introduction');
    document.getElementById('walk-tutorial')!.hidden = scene.id !== 'introduction' || !['loading', 'exploring'].includes(state.mode) || state.completedSceneIds.includes(scene.id);
    this.text('leader-name', state.profile.names[state.leaderId]);
    document.querySelector<HTMLButtonElement>('[data-action="open-memory"]')!.hidden = state.mode !== 'speaking';
    document.querySelector<HTMLButtonElement>('[data-action="pause"]')!.disabled = !['exploring', 'travelling'].includes(state.mode);
    document.querySelector<HTMLButtonElement>('[data-action="switch"]')!.disabled = state.mode !== 'exploring' || Boolean(state.vehicleId);
    const railway = scene.interactions.find((i) => i.kind === 'railway' && i.id === state.railwayId);
    const railHud = document.getElementById('railway-hud')!;
    railHud.hidden = !railway || railway.kind !== 'railway' || !['exploring', 'travelling'].includes(state.mode);
    if (railway?.kind === 'railway') {
      const count = state.counters[railway.id] ?? 0;
      const reached = Math.floor(count / railway.pedalsPerSegment);
      const travelling = state.mode === 'travelling';
      const stop = Math.min(travelling ? Math.max(1, Math.ceil(count / railway.pedalsPerSegment)) : reached + 1, railway.stops.length);
      const remainder = count % railway.pedalsPerSegment;
      const pedals = remainder === 0 && count > 0 && ['travelling', 'reading'].includes(state.mode) ? railway.pedalsPerSegment : remainder;
      this.text('railway-progress-text', 'Stop ' + stop + ' of ' + railway.stops.length + ' · ' + pedals + '/' + railway.pedalsPerSegment + ' pedals' + (travelling ? ' · on our way' : ''));
      const bar = document.getElementById('railway-progress') as HTMLProgressElement;
      bar.max = railway.pedalsPerSegment; bar.value = pedals;
    }
    this.renderTarget(); this.renderTravel();
  }
  private text(id: string, value: string) { document.getElementById(id)!.textContent = value; }
  setTarget(target: InteractionTarget | null) { this.target = target; this.renderTarget(); }
  private renderTarget() {
    const { scene, state } = this.session;
    const target = this.target;
    const title = scene.title;
    const description = 'Walk to an E marker, then press E or click.';
    let buttonLabel = 'Interact';
    if (target) {
      const interaction = target.interaction;
      const gate = gateInteraction(interaction, state);
      if (target.stopIndex !== undefined && interaction.kind === 'railway') buttonLabel = 'Revisit photo';
      else if (interaction.kind === 'railway' && state.flags.includes(interaction.setsFlag)) buttonLabel = 'Open memory';
      else if (gate === 'wrong-leader') buttonLabel = 'Who should lead?';
      else if (gate === 'locked') buttonLabel = 'Take a look';
      else {
        buttonLabel = target.optionId ? 'Choose bouquet' : ({
          naming: 'Read the letter', memory: 'Open memory', railway: 'Take the front car', puzzle: 'Try the puzzle',
          scrapbook: 'Open scrapbook', vehicle: 'Get in', 'vehicle-exit': 'Park & get out', access: 'Enter together', ending: 'Our last dreamy stop',
        } as Record<string, string>)[interaction.kind] ?? 'Take a look';
        if (interaction.kind === 'puzzle') buttonLabel = state.flags.includes(interaction.setsFlag) ? 'Open memory' : 'Light tile';
      }
    }
    if (state.railwayId && ['exploring', 'travelling'].includes(state.mode)) buttonLabel = 'Pedal';
    this.text('interaction-title', title); this.text('interaction-description', description); this.text('interact-label', buttonLabel);
    document.querySelector<HTMLButtonElement>('#interact-button')!.disabled = state.mode !== 'travelling' && ((!target && !state.railwayId) || state.mode !== 'exploring');
  }
  private unlockedScenes() {
    return this.session.story.scenes.filter((scene) => this.session.reachableSceneIds.includes(scene.id));
  }
  private renderTravel() {
    const { scene, state, story } = this.session;
    const container = document.getElementById('world-travel')!;
    const visible = state.mode === 'exploring' && isSceneComplete(scene, state.flags);
    container.hidden = !visible;
    if (!visible) return;
    const index = story.scenes.indexOf(scene);
    const destinations = [story.scenes[index - 1], story.scenes[index + 1]];
    const unlocked = this.unlockedScenes();
    container.innerHTML = destinations.map((destination, direction) => destination && unlocked.includes(destination) ? '<button class="secondary" data-action="travel-scene" data-scene-id="' + escapeHtml(destination.id) + '" aria-label="' + (direction === 0 ? 'Previous chapter: ' : 'Next chapter: ') + escapeHtml(destination.title) + '">' + (direction === 0 ? '← Previous chapter' : 'Next chapter →') + '</button>' : '').join('');
    container.hidden = !container.childElementCount;
  }
  toast(message: string) {
    this.clearSpeech(); clearTimeout(this.toastTimer);
    const element = document.getElementById('toast')!; element.textContent = message; element.hidden = false;
    this.toastTimer = window.setTimeout(() => { element.hidden = true; }, 4500);
  }
  clearToast() { clearTimeout(this.toastTimer); document.getElementById('toast')!.hidden = true; }
  speak(speaker: CharacterId, message: string, keepOpen = false, continueLabel = 'See this memory') {
    this.clearToast(); clearTimeout(this.speechTimer);
    const element = document.getElementById('speech-bubble')!;
    element.dataset.speakerId = speaker; element.hidden = false;
    const continueButton = document.querySelector<HTMLButtonElement>('[data-action="open-memory"]')!;
    const key = document.createElement('span'); key.className = 'key-light'; key.textContent = 'E';
    continueButton.replaceChildren(key, document.createTextNode(' ' + continueLabel));
    continueButton.setAttribute('aria-label', continueLabel);
    this.text('speech-name', this.session.state.profile.names[speaker]);
    this.text('speech-text', message); this.positionSpeech();
    // A memory's continue button remains available after its spoken line fades.
    this.speechTimer = window.setTimeout(() => { element.hidden = true; }, 3150);
  }
  clearSpeech() { clearTimeout(this.speechTimer); document.getElementById('speech-bubble')!.hidden = true; }
  updateActors(actors: Record<CharacterId, Point>) { this.actors = actors; this.positionSpeech(); }
  private positionSpeech() {
    const element = document.getElementById('speech-bubble')!;
    if (element.hidden) return;
    const actor = this.actors[element.dataset.speakerId as CharacterId];
    const width = this.worldHost.clientWidth; const height = this.worldHost.clientHeight;
    const x = actor.x / 960 * width; const y = actor.y / 540 * height;
    const bubbleWidth = element.offsetWidth; const bubbleHeight = element.offsetHeight;
    const below = y - 75 / 540 * height - bubbleHeight < 12;
    const left = Math.max(bubbleWidth / 2 + 10, Math.min(width - bubbleWidth / 2 - 10, x));
    element.style.left = left + 'px';
    element.style.top = (below ? y + 15 / 540 * height : y - 75 / 540 * height) + 'px';
    element.classList.toggle('below', below);
    element.style.setProperty('--tail-x', (x - left + bubbleWidth / 2) + 'px');
  }
  focusWorld() { this.worldHost.focus({ preventScroll: true }); }
  private show(html: string, className = '') {
    if (className !== 'ending-dialog') this.currentEnding = null;
    this.clearToast();
    if (!this.dialog.open) this.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog.className = className; document.querySelector('#dialog-content')!.innerHTML = html;
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
  }
  dismiss() {
    this.activeAlbum = null; this.repaintPhotos = null; this.currentEnding = null;
    this.dialog.close();
    if (this.lastFocus?.isConnected && !this.lastFocus.closest('[hidden]')) this.lastFocus.focus({ preventScroll: true });
    else this.focusWorld();
  }
  private header(eyebrow: string, title: string, closeLabel = 'Close memory', closeAction = 'close') {
    return '<div class="modal-header"><span class="eyebrow">' + eyebrow + '</span><button class="icon-button" data-action="' + closeAction + '" aria-label="' + closeLabel + '">×</button></div><h2 id="dialog-title">' + escapeHtml(title) + '</h2>';
  }
  showNaming() {
    this.activeAlbum = null;
    const profile = this.session.state.profile;
    this.show('<form id="naming-form">' + this.header('A LETTER FOR THE TWO OF US', 'What should we call each other?', 'Close naming menu') + '<p class="modal-intro">A dreamy world for us. You get to name its two people.</p><div class="name-fields"><label>His name<input id="name-a" maxlength="30" value="' + escapeHtml(profile.names['person-a']) + '" autocomplete="off"></label><label>Her name<input id="name-b" maxlength="30" value="' + escapeHtml(profile.names['person-b']) + '" autocomplete="off"></label></div><label class="greeting-label">Edit our letter?<textarea id="greeting" maxlength="300" rows="2">' + escapeHtml(profile.greeting) + '</textarea></label><button class="primary wide" type="submit">These are our names ♡</button></form>', 'naming-dialog');
  }
  showMemory(interaction: Interaction, original = false) {
    if (interaction.kind !== 'memory') return;
    this.showMemoryDefinition(interaction.memory, interaction.title, original);
  }
  showMemoryDefinition(memory: MemoryDefinition, title: string, original = false) {
    this.activeAlbum = memory;
    this.repaintPhotos = () => this.showMemoryDefinition(memory, title, original);
    this.show(this.header('A PAGE FROM OUR JOURNEY', title) + this.memoryMarkup(memory, original) + this.memoryFooter(memory), 'memory-dialog');
  }
  private memoryFooter(memory: MemoryDefinition) {
    return '<div class="memory-footer"><p>' + escapeHtml(this.session.interpolate(this.photoFor(memory).caption)) + '</p><span class="key-small">E</span><span>Return to our dreamy world</span><button class="secondary" data-action="close">Continue</button></div>';
  }
  private photos(memory: MemoryDefinition): MemoryPhoto[] { return [memory, ...memory.additionalPhotos ?? []]; }
  private photoFor(memory: MemoryDefinition) {
    const photos = this.photos(memory);
    const index = Math.max(0, Math.min(this.photoIndexes.get(memory.id) ?? 0, photos.length - 1));
    this.photoIndexes.set(memory.id, index);
    return photos[index];
  }
  hasSeenFinalPhoto(memory: MemoryDefinition) { return this.viewedPhotos.get(memory.id)?.has(this.photos(memory).length - 1) ?? false; }
  resetAlbums() { this.photoIndexes.clear(); this.viewedPhotos.clear(); }
  advanceEndingPhotoOnInteract(): boolean {
    const ending = this.currentEnding;
    if (this.session.state.mode !== 'reading' || !ending?.eRevealsFinalPhoto || this.activeAlbum?.id !== ending.memory.id) return false;
    const index = this.photoIndexes.get(ending.memory.id) ?? 0;
    if (index >= this.photos(ending.memory).length - 1) return false;
    return this.turnPhoto(1);
  }
  turnPhoto(delta: number): boolean {
    const memory = this.activeAlbum;
    if (!this.dialog.open || !memory || !this.repaintPhotos || !Number.isInteger(delta) || Math.abs(delta) !== 1 || this.session.state.mode !== 'reading') return false;
    const current = this.photoIndexes.get(memory.id) ?? 0;
    const next = current + delta;
    if (next < 0 || next >= this.photos(memory).length) return false;
    this.photoIndexes.set(memory.id, next); this.repaintPhotos();
    this.dialog.querySelector<HTMLButtonElement>('[data-action="photo-page"][data-delta="' + delta + '"]:not(:disabled)')?.focus({ preventScroll: true });
    return true;
  }
  private memoryMarkup(memory: MemoryDefinition, original: boolean) {
    const photos = this.photos(memory);
    const photo = this.photoFor(memory);
    const index = this.photoIndexes.get(memory.id)!;
    const visited = this.viewedPhotos.get(memory.id) ?? new Set<number>(); visited.add(index); this.viewedPhotos.set(memory.id, visited);
    const navigation = photos.length < 2 ? '' : '<nav class="photo-navigation" aria-label="Photos in this memory"><button class="secondary" data-action="photo-page" data-memory-id="' + escapeHtml(memory.id) + '" data-delta="-1" ' + (index === 0 ? 'disabled' : '') + '><kbd>A</kbd> Previous photo</button><span aria-live="polite">' + (index + 1) + ' / ' + photos.length + '</span><button class="secondary" data-action="photo-page" data-memory-id="' + escapeHtml(memory.id) + '" data-delta="1" ' + (index === photos.length - 1 ? 'disabled' : '') + '>Next photo <kbd>D</kbd></button></nav>';
    return this.photoMarkup({ ...memory, themedAsset: undefined, originalAsset: undefined, alt: undefined, ...photo, additionalPhotos: undefined }, original) + navigation;
  }
  private photoMarkup(memory: MemoryDefinition, original: boolean) {
    const asset = original ? memory.originalAsset ?? memory.themedAsset : memory.themedAsset ?? memory.originalAsset;
    const paired = Boolean(memory.originalAsset && memory.themedAsset);
    const view = paired ? original ? 'Original view' : 'Themed view' : memory.originalAsset ? 'Original photo' : 'Illustrated photo';
    if (asset) {
      const url = new URL(asset, new URL(import.meta.env.BASE_URL, location.origin));
      const hint = paired ? '<span class="picture-toggle-hint">' + (original ? 'Click the picture to return to the themed view' : 'Click the picture to view the original') + '</span>' : '';
      return '<div class="memory-asset"><button class="memory-picture" ' + (paired ? 'data-action="toggle-memory"' : 'disabled') + ' aria-label="' + (paired ? original ? 'Show themed view' : 'Show original view' : view) + '"><img src="' + escapeHtml(url.href) + '" data-source="' + escapeHtml(url.href) + '" alt="' + escapeHtml(this.session.interpolate(memory.alt ?? memory.caption)) + '" decoding="async"><span class="image-fallback" hidden><span aria-hidden="true">✿</span><strong>The picture needs a moment.</strong><span>Your memory and caption are still here.</span></span><span class="picture-view-label">' + view + '</span>' + hint + '</button><button class="secondary retry-image" data-action="retry-image" hidden>Retry picture</button></div>';
    }
    const illustration = ({
      katsu: '<span class="picture-plate"><i></i><b></b></span>',
      railway: '<span class="picture-railcar" aria-hidden="true">♡</span>',
      smurf: '<span class="picture-mushroom" aria-hidden="true">♧</span>',
      norway: '<span class="picture-aurora" aria-hidden="true"></span>',
      francine: '<span class="picture-car" aria-hidden="true">♡</span>',
      madeira: '<span class="picture-ring" aria-hidden="true">◇</span>',
      museum: '<span class="picture-icecream" aria-hidden="true">♡</span>',
      'ice-cream': '<span class="picture-icecream" aria-hidden="true">♡</span>',
    } as Record<string, string>)[memory.scene] ?? '<span class="picture-envelope">♡</span>';
    return '<button class="memory-picture memory-' + escapeHtml(memory.scene) + ' ' + (original ? 'original-view' : '') + '" data-action="toggle-memory" aria-label="' + (original ? 'Show themed view' : 'Show original view') + '"><span class="picture-view-label">' + (original ? 'Original view · placeholder' : 'Themed view · placeholder') + '</span><span class="picture-sun"></span><span class="picture-hills"></span><span class="picture-flower flower-left">✿</span><span class="picture-flower flower-right">✿</span>' + illustration + '<span class="picture-note">' + (original ? 'A space for the real moment.' : escapeHtml(memory.label)) + '</span><span class="picture-toggle-hint">' + (original ? 'Click to return to the themed view' : 'Click the picture to view the original') + '</span></button>';
  }
  private readerPhotos(memory: MemoryDefinition, original: boolean, hideLastCaption = false) {
    const photos = this.photos(memory);
    return photos.map((photo, index) => '<section class="reader-memory"><h3>' + escapeHtml(photo.label) + '</h3>' + this.photoMarkup({ ...memory, themedAsset: undefined, originalAsset: undefined, alt: undefined, ...photo, additionalPhotos: undefined }, original) + (hideLastCaption && index === photos.length - 1 ? '' : '<p class="scrapbook-caption">' + escapeHtml(this.session.interpolate(photo.caption)) + '</p>') + '</section>').join('');
  }
  private retryImage(button: HTMLElement) {
    const container = button.closest('.memory-asset')!;
    const image = container.querySelector<HTMLImageElement>('img')!;
    const url = new URL(image.dataset.source!); url.searchParams.set('retry', String(Date.now()));
    image.src = url.href;
  }
  showPuzzle(interaction: Interaction) {
    // The letter tiles belong to the map and never open a separate menu.
    if (interaction.kind === 'puzzle' && this.dialog.open) this.dismiss();
  }
  showScrapbook(interaction: Interaction, pageIndex: number, original = false) {
    if (interaction.kind !== 'scrapbook') return;
    this.activeAlbum = null;
    this.repaintPhotos = () => this.showScrapbook(interaction, pageIndex, original);
    const index = Math.max(0, Math.min(pageIndex, interaction.pages.length - 1));
    const page = interaction.pages[index];
    const role = index === interaction.pages.length - 1 ? 'The last page. You can revisit earlier pages or finish reading.' : 'Turn the next page together.';
    const complete = interaction.pages.every((_, pageIndex) => this.session.state.scrapbookVisited[interaction.id]?.includes(pageIndex));
    const roleHint = role + (complete ? '' : ' Read all ' + interaction.pages.length + ' pages to complete this moment.');
    this.show(this.header('A FEW PAGES, TOGETHER', interaction.title, 'Close scrapbook') + '<div class="scrapbook-page-number" aria-live="polite">Page ' + (index + 1) + ' of ' + interaction.pages.length + '</div>' + this.photoMarkup(page, original) + '<p class="scrapbook-caption">' + escapeHtml(this.session.interpolate(page.caption)) + '</p><p class="scrapbook-role">' + escapeHtml(roleHint) + '</p><div class="scrapbook-navigation"><button class="secondary" data-action="scrapbook-page" data-delta="-1" ' + (index === 0 ? 'disabled' : '') + '><kbd>A</kbd> Previous photo</button><button class="primary" data-action="scrapbook-page" data-delta="1" ' + (index === interaction.pages.length - 1 ? 'disabled' : '') + '>Next photo <kbd>D</kbd></button></div><div class="memory-footer"><span class="key-small">E</span><span>Close scrapbook</span><button class="secondary" data-action="close">' + (complete ? 'Done reading' : 'Close for now') + '</button></div>', 'scrapbook-dialog');
  }
  showEnding(interaction: Interaction, original = false) {
    if (interaction.kind !== 'ending') return;
    this.currentEnding = interaction;
    this.activeAlbum = interaction.memory;
    this.repaintPhotos = () => this.showEnding(interaction, original);
    const image = this.memoryMarkup(interaction.memory, original);
    const atLast = (this.photoIndexes.get(interaction.memory.id) ?? 0) === this.photos(interaction.memory).length - 1;
    const letter = atLast ? '<section class="final-letter"><p>' + escapeHtml(this.session.interpolate(interaction.letter)) + '</p></section>' : '';
    const action = atLast ? '<button class="primary wide" data-action="close">Keep this moment ♡</button>' : '';
    const caption = atLast ? '' : '<p class="scrapbook-caption">' + escapeHtml(this.session.interpolate(this.photoFor(interaction.memory).caption)) + '</p>';
    this.show(this.header('MADEIRA · ONE LAST PAGE', interaction.title, 'Close final memory') + image + caption + letter + action, 'ending-dialog');
  }
  showCheckpoint() { this.checkpoint(false); }
  showReaderCheckpoint() { this.checkpoint(true); }
  private checkpoint(reader: boolean) {
    this.activeAlbum = null;
    const checkpoint = this.session.scene.checkpoint;
    const body = checkpoint.text === 'This moment is complete. The next part of our journey is ready.' ? '' : '<p class="modal-intro">' + escapeHtml(this.session.interpolate(checkpoint.text)) + '</p>';
    const revisit = !reader && this.session.journeyComplete && this.session.scene.interactions.some((interaction) => interaction.kind === 'railway') ? '<button class="secondary" data-action="explore">Walk back to the photo signs</button>' : '';
    this.show('<div class="checkpoint-flower" aria-hidden="true">✿</div><span class="eyebrow">A DREAMY CHECKPOINT</span><h2 id="dialog-title">' + escapeHtml(checkpoint.title) + '</h2>' + body + '<button class="primary" data-action="advance"><kbd class="key-light">E</kbd> ' + escapeHtml(checkpoint.button) + ' <span aria-hidden="true">↗</span></button>' + revisit, 'checkpoint-dialog');
  }
  showReader() {
    this.activeAlbum = null;
    const sections = this.unlockedScenes().map((scene) => {
      const stops = scene.interactions.filter((interaction) => interaction.requires.every((flag) => this.session.state.flags.includes(flag)));
      return '<section class="reader-chapter"><h3>' + escapeHtml(scene.title) + '</h3><div class="reader-stops">' + stops.map((interaction) => '<button class="reader-stop secondary" data-action="reader-open" data-interaction-id="' + escapeHtml(interaction.id) + '"><span>' + escapeHtml(interaction.label) + '</span><span class="reader-stop-state">' + (this.session.state.flags.includes(interaction.setsFlag) ? 'Read ✓' : 'Read this stop ↗') + '</span></button>').join('') + '</div></section>';
    }).join('');
    this.show(this.header('OUR STORY, AT YOUR PACE', 'Read our story', 'Close story reader') + '<p class="modal-intro">Read each unlocked stop, then choose “Mark this stop read” to continue. You can revisit earlier moments here.</p>' + sections + '<div class="reader-settings"><button class="secondary" data-action="text-size">Text size: ' + (this.session.state.textScale === 'large' ? 'large' : 'normal') + '</button><button class="secondary" data-action="close">Return to the map</button></div>', 'reader-dialog');
  }
  showReaderDetail(interaction: Interaction, original = false) {
    this.activeAlbum = null;
    this.repaintPhotos = () => this.showReaderDetail(interaction, original);
    const quote = interaction.speakerId ? '<p class="reader-quote"><strong>' + escapeHtml(this.session.state.profile.names[interaction.speakerId]) + ':</strong> ' + escapeHtml(this.session.interpolate(interaction.text)) + '</p>' : '<p class="modal-intro">' + escapeHtml(this.session.interpolate(interaction.text)) + '</p>';
    let content = quote;
    if (interaction.kind === 'choice') {
      content += '<ul class="reader-facts">' + interaction.options.map((option) => '<li><strong>' + escapeHtml(option.label) + '</strong><p>' + escapeHtml(option.description) + '</p><p>' + escapeHtml(this.session.state.profile.names[interaction.speakerId ?? 'person-b']) + ': ' + escapeHtml(option.response) + '</p></li>').join('') + '</ul>';
    } else if (interaction.kind === 'railway') {
      content += '<p class="modal-intro">The two of you take the front car. ' + interaction.pedalsPerSegment + ' pedals reach each memory stop.</p>' + (interaction.boardingMemory ? this.readerPhotos(interaction.boardingMemory, original) : '') + interaction.stops.map((stop) => this.readerPhotos(stop.memory, original)).join('');
    } else if (interaction.kind === 'puzzle') {
      content += '<p class="modal-intro">The floor tiles respond with colored light. The room opens when the arrangement is complete.</p>' + this.memoryMarkup(interaction.memory, original);
    } else if (interaction.kind === 'scrapbook') {
      content += interaction.pages.map((page) => this.readerPhotos(page, original)).join('');
    } else if (interaction.kind === 'memory' || interaction.kind === 'ending') {
      content += this.readerPhotos(interaction.memory, original, interaction.kind === 'ending');
      if (interaction.kind === 'ending') content += '<section class="final-letter"><p>' + escapeHtml(this.session.interpolate(interaction.letter)) + '</p></section>';
    } else if (interaction.kind === 'vehicle') {
      content += '<p class="modal-intro">' + escapeHtml(this.session.state.profile.names[interaction.driverId]) + ' drives here. In the map, use WASD and park by the next marker.</p>';
    }
    if ((interaction.kind === 'choice' || interaction.kind === 'vehicle' || interaction.kind === 'access') && interaction.memory) content += this.readerPhotos(interaction.memory, original);
    const done = this.session.state.flags.includes(interaction.setsFlag);
    this.show(this.header('A PAGE FROM OUR JOURNEY', interaction.title, 'Back to story reader', 'read-story') + content + '<div class="reader-detail-actions"><button class="secondary" data-action="read-story">Back to stops</button><button class="primary" data-action="' + (done ? 'read-story' : 'reader-done') + '">' + (done ? 'Already read ✓' : 'Mark this stop read') + '</button></div><p class="modal-hint">Closing or going back keeps your place and does not mark this stop read.</p>', 'reader-dialog reader-detail');
  }
  showPause() {
    this.activeAlbum = null;
    const travel = this.unlockedScenes().filter((scene) => scene.id !== this.session.scene.id).map((scene) => '<button class="secondary" data-action="travel-scene" data-scene-id="' + escapeHtml(scene.id) + '">' + escapeHtml(scene.title) + '</button>').join('');
    const visits = travel ? '<section class="pause-travel"><h3>Revisit our chapters</h3><div>' + travel + '</div></section>' : '';
    this.show(this.header('TAKE A BREATHER', "We're right here.", 'Resume', 'resume') + '<div class="help-grid"><span><kbd>W A S D</kbd> Walk / drive</span><span><kbd>Q</kbd> Switch who leads</span><span><kbd>E</kbd> Interact / close memory</span><span>Click nearby objects, too.</span><span><kbd>E</kbd> Pedal the railway</span><span><kbd>A / D</kbd> Previous / next photo</span></div><button class="secondary wide" data-action="guide">Bring us to the next dreamy stop ↗</button><button class="secondary wide pause-reader" data-action="read-story">Read our story at your pace</button><div class="pause-settings"><button class="quiet-button" data-action="motion" aria-pressed="' + this.session.state.reducedMotion + '">Gentle motion: ' + (this.session.state.reducedMotion ? 'on' : 'off') + '</button><button class="quiet-button" data-action="text-size">Text size: ' + (this.session.state.textScale === 'large' ? 'large' : 'normal') + '</button></div>' + visits + '<div class="pause-actions"><button class="primary" data-action="resume">Back to us</button><button class="quiet-button" data-action="restart">Begin again</button></div><p class="modal-hint">This dreamy journey starts over when you reopen or refresh.</p>', 'pause-dialog');
  }
  showRestart() {
    this.activeAlbum = null;
    this.show('<span class="eyebrow">A FRESH BEGINNING</span><h2 id="dialog-title">Start our story again?</h2><p class="modal-intro">Our names, greeting and comfort settings stay. This visit’s checkpoints begin again.</p><div class="pause-actions"><button class="primary" data-action="restart" data-confirm="true">Yes, begin again</button><button class="secondary" data-action="resume">Stay here</button></div>', 'pause-dialog');
  }
  loadingError(message: string) {
    this.activeAlbum = null;
    this.show('<span class="eyebrow">PAUSE</span><h2 id="dialog-title">Our little world needs a moment.</h2><p class="modal-intro">' + escapeHtml(message) + '</p><div class="pause-actions"><button class="primary" data-action="read-story">Read our story</button><button class="secondary" data-action="reload">Try again</button></div>', 'pause-dialog');
  }
  destroy() { this.abort.abort(); clearTimeout(this.toastTimer); clearTimeout(this.speechTimer); }
}
