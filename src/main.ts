import type Phaser from 'phaser';
import './styles.css';
import { loadStory } from './content/load';
import { type Interaction, type MemoryDefinition, type RailwayInteraction } from './content/model';
import { gateInteraction, Session, type Profile } from './state/session';
import { WorldInput } from './world/input';
import { AppUI } from './ui/app';
import type { WorldScene } from './scenes/WorldScene';
import { interactionTargets, type InteractionTarget } from './world/interactions';

async function boot() {
  const story = await loadStory();
  const session = new Session(story);
  let game: Phaser.Game | undefined;
  let world: WorldScene | undefined;
  let active: Interaction | null = null;
  let committed = false;
  let checkpointAfterMemory = false;
  let originalView = false;
  let restarting = false;
  let railStop = 0;
  let readerRoute = false;
  let readerDetail: Interaction | null = null;
  let suspendedRail: RailwayInteraction | null = null;
  let renderedSceneId = '';
  let rendererFailed = false;
  let worldStarting = false;
  let ui: AppUI;
  const lifecycle = new AbortController();
  const clearMovement = () => { input.clear(); world?.pair?.stop(); world?.stopTravel(); };
  const memoryFor = (interaction: Interaction): MemoryDefinition | undefined => {
    if ('memory' in interaction) return interaction.memory;
    if (interaction.kind === 'railway') return railStop < 0 ? interaction.boardingMemory : interaction.stops[railStop]?.memory;
    if (interaction.kind === 'scrapbook') return interaction.pages[session.state.scrapbookPages[interaction.id] ?? 0];
    return undefined;
  };
  const showActiveMemory = () => {
    if (!active) return;
    if (active.kind === 'ending') ui.showEnding(active, originalView);
    else {
      const memory = memoryFor(active);
      if (memory) ui.showMemoryDefinition(memory, active.kind === 'railway' ? memory.label : active.title, originalView);
    }
  };
  const openMemory = () => {
    if (!active || session.state.mode !== 'speaking') return;
    if (active.kind === 'dialogue' || active.kind === 'access' && !active.memory) {
      const interaction = active; active = null; ui.clearSpeech();
      if (session.finish(interaction)) ui.showCheckpoint();
      else session.update({ mode: 'exploring' });
      return;
    }
    ui.clearSpeech(); session.update({ mode: 'reading' }); showActiveMemory();
  };
  const showReaderList = () => {
    if (!readerRoute && world?.isRailMoving() && active?.kind === 'railway') suspendedRail = active;
    clearMovement(); ui.clearSpeech(); active = null; readerDetail = null; checkpointAfterMemory = false;
    readerRoute = true; session.update({ mode: 'reader' }); ui.showReader();
  };
  const close = () => {
    if (readerRoute) {
      if (session.state.mode === 'checkpoint') return;
      if (readerDetail) { showReaderList(); return; }
      readerRoute = false; ui.dismiss(); readerDetail = null;
      if (rendererFailed) { session.update({ mode: 'paused' }); ui.loadingError('The story reader is available while the map is unavailable.'); }
      else if (!game || renderedSceneId !== session.state.sceneId) startWorld();
      else {
        if (suspendedRail && !session.state.flags.includes(suspendedRail.setsFlag) && world?.isRailMoving()) {
          active = suspendedRail; session.update({ mode: 'travelling' });
        } else session.update({ mode: 'exploring' });
        suspendedRail = null; ui.focusWorld();
      }
      return;
    }
    if (session.state.mode === 'checkpoint') return;
    if (session.state.mode === 'paused') { resume(); return; }
    if (session.state.mode === 'puzzle') {
      ui.dismiss(); active = null; session.update({ mode: 'exploring' }); clearMovement(); ui.focusWorld(); return;
    }
    if (session.state.mode === 'scrapbook') {
      const interaction = active; active = null; ui.dismiss(); clearMovement();
      if (interaction?.kind === 'scrapbook' && session.finish(interaction)) ui.showCheckpoint();
      else { session.update({ mode: 'exploring' }); ui.focusWorld(); }
      return;
    }
    if (session.state.mode !== 'reading') return;
    clearMovement(); ui.dismiss();
    const interaction = active; active = null;
    if (checkpointAfterMemory) {
      checkpointAfterMemory = false; session.update({ mode: 'checkpoint' }); ui.showCheckpoint(); return;
    }
    if (interaction && committed) {
      if (interaction.kind === 'ending' && !ui.hasSeenFinalPhoto(interaction.memory)) {
        session.update({ mode: 'exploring' }); ui.focusWorld(); return;
      }
      if (interaction.kind === 'railway') session.update({ railwayId: null });
      const checkpoint = session.finish(interaction);
      if (checkpoint) ui.showCheckpoint(); else { session.update({ mode: 'exploring' }); ui.focusWorld(); }
    } else { session.update({ mode: 'exploring' }); ui.focusWorld(); }
  };
  const pause = () => {
    if (!['exploring', 'travelling'].includes(session.state.mode)) return;
    clearMovement(); session.update({ mode: 'paused' }); restarting = false; ui.showPause();
  };
  const resume = () => {
    clearMovement(); ui.dismiss(); restarting = false;
    // An interrupted railway animation resumes to the same memory without another pedal.
    session.update({ mode: active?.kind === 'railway' && world?.isRailMoving() ? 'travelling' : 'exploring' });
    ui.focusWorld();
  };
  const switchLeader = () => {
    if (session.state.vehicleId) { ui.toast('Park and step out before switching who leads.'); return; }
    if (!['exploring', 'scrapbook'].includes(session.state.mode)) return;
    clearMovement(); ui.clearToast(); session.setLeader(session.state.leaderId === 'person-a' ? 'person-b' : 'person-a');
    if (active?.kind === 'scrapbook' && session.state.mode === 'scrapbook') ui.showScrapbook(active, session.state.scrapbookPages[active.id] ?? 0, originalView);
    else ui.focusWorld();
  };
  const showGate = (interaction: Interaction) => {
    const override = interaction.prerequisiteOverrides?.find((item) => !session.state.flags.includes(item.missingFlag));
    if (override) { ui.speak(override.speakerId, session.interpolate(override.text)); return true; }
    const gate = gateInteraction(interaction, session.state);
    if (gate === 'ready') return false;
    const message = gate === 'locked' ? interaction.lockedText ?? 'there were other things to do first!'
      : gate === 'wrong-travel' ? interaction.wrongTravelText ?? (interaction.requiredTravel === 'vehicle' ? 'Let’s take the car here.' : 'Step out of the car here first.')
      : interaction.wrongLeaderText ?? 'Let the other person lead here. Press Q to switch.';
    ui.speak((gate === 'locked' ? interaction.lockedSpeakerId : gate === 'wrong-travel' ? interaction.wrongTravelSpeakerId : undefined) ?? interaction.wrongLeaderSpeakerId ?? interaction.speakerId ?? session.state.leaderId, session.interpolate(message));
    return true;
  };
  const pedal = (interaction: RailwayInteraction) => {
    if (showGate(interaction)) return;
    clearMovement(); active = interaction; originalView = false;
    const result = session.pedal(interaction);
    if (!result.accepted) return;
    if (result.stopIndex !== null) railStop = result.stopIndex;
    committed = result.stopIndex === interaction.stops.length - 1;
    session.update({ mode: 'travelling' });
    const arrive = () => {
      if (active?.id !== interaction.id || readerRoute) return;
      if (result.stopIndex === null) { session.update({ mode: 'exploring' }); ui.focusWorld(); }
      else {
        session.update({ mode: 'reading', ...(interaction.stops[result.stopIndex].disembark ? { railwayId: null } : {}) });
        showActiveMemory();
      }
    };
    if (world) world.travelRailPedal(interaction, result.count, arrive); else arrive();
  };
  const interact = (candidate?: InteractionTarget) => {
    if (session.state.mode !== 'exploring' || !world?.pair) return;
    if (session.state.railwayId) {
      const rail = session.scene.interactions.find((i) => i.id === session.state.railwayId);
      if (rail?.kind === 'railway') { pedal(rail); return; }
    }
    const target = candidate ?? world.getTarget();
    if (!target) { ui.toast('Walk toward an E marker, then press E or click.'); return; }
    if (!world.canReach(target)) { ui.toast('Walk closer to ' + target.label.toLowerCase() + '.'); return; }
    const interaction = target.interaction;
    if (interaction.kind === 'railway' && target.stopIndex !== undefined) {
      if (!session.journeyComplete || !session.state.flags.includes(interaction.setsFlag) || !interaction.stops[target.stopIndex]) return;
      clearMovement(); active = interaction; railStop = target.stopIndex; originalView = false; committed = false;
      ui.clearSpeech(); session.update({ mode: 'reading' }); showActiveMemory(); return;
    }
    if (interaction.kind === 'railway' && session.state.flags.includes(interaction.setsFlag)) {
      if (!session.journeyComplete) return;
      clearMovement(); active = interaction; railStop = interaction.boardingMemory ? -1 : 0; originalView = false; committed = false;
      ui.clearSpeech(); session.update({ mode: 'reading' }); showActiveMemory(); return;
    }
    if (showGate(interaction)) return;
    clearMovement();
    if (interaction.kind === 'choice') {
      if (session.state.flags.includes(interaction.setsFlag)) {
        if (interaction.memory && target.optionId === session.state.choices[interaction.id]) {
          active = interaction; originalView = false; committed = false; session.update({ mode: 'reading' }); showActiveMemory();
        } else ui.speak('person-b', "I'm hangry");
        return;
      }
      const option = interaction.options.find((choice) => choice.id === target.optionId);
      if (!option) return;
      session.recordChoice(interaction.id, option.id);
      if (option.accepted) session.finish(interaction);
      if (option.accepted && interaction.memory) {
        active = interaction; originalView = false; committed = false;
        session.update({ mode: 'speaking' }); ui.speak(interaction.speakerId ?? 'person-b', option.response, true);
      } else ui.speak(interaction.speakerId ?? 'person-b', option.response);
      return;
    }
    if (interaction.kind === 'dialogue' || interaction.kind === 'access' && !interaction.memory) {
      const wouldComplete = session.scene.completionFlags.every((flag) => flag === interaction.setsFlag || session.state.flags.includes(flag));
      if (wouldComplete && !session.state.completedSceneIds.includes(session.scene.id)) {
        active = interaction; session.update({ mode: 'speaking' });
        ui.speak(interaction.speakerId ?? session.state.leaderId, session.interpolate(interaction.text), true, 'Continue our story'); return;
      }
      const checkpoint = session.finish(interaction);
      ui.speak(interaction.speakerId ?? session.state.leaderId, session.interpolate(interaction.text));
      if (checkpoint) ui.showCheckpoint();
      return;
    }
    if (interaction.kind === 'vehicle') {
      const wasComplete = session.state.completedSceneIds.includes(session.scene.id);
      if (session.enterVehicle(interaction)) {
        world.enterVehicle(); ui.clearSpeech();
        const completedNow = !wasComplete && session.state.completedSceneIds.includes(session.scene.id);
        if (interaction.memory) { active = interaction; originalView = false; committed = false; checkpointAfterMemory = completedNow; session.update({ mode: 'reading' }); showActiveMemory(); }
        else if (completedNow) { session.update({ mode: 'checkpoint' }); ui.showCheckpoint(); }
        else ui.focusWorld();
      }
      return;
    }
    if (interaction.kind === 'vehicle-exit') {
      const wasComplete = session.state.completedSceneIds.includes(session.scene.id);
      if (session.exitVehicle(interaction)) {
        world.exitVehicle(); ui.clearSpeech();
        if (!wasComplete && session.state.completedSceneIds.includes(session.scene.id)) ui.showCheckpoint(); else ui.focusWorld();
      }
      return;
    }
    if (interaction.kind === 'railway') {
      ui.clearSpeech();
      const count = session.state.counters[interaction.id] ?? 0;
      const reachedStop = count > 0 && count % interaction.pedalsPerSegment === 0
        ? interaction.stops[count / interaction.pedalsPerSegment - 1] : undefined;
      if (reachedStop) {
        // Chapter travel can interrupt a stop's arrival. Reopen it without consuming another pedal.
        active = interaction; railStop = count / interaction.pedalsPerSegment - 1;
        originalView = false; committed = railStop === interaction.stops.length - 1;
        session.update({ railwayId: reachedStop.disembark ? null : interaction.id, mode: 'reading' });
        showActiveMemory();
      } else if (interaction.boardingMemory) {
        active = interaction; railStop = -1; originalView = false; committed = false;
        session.update({ railwayId: interaction.id, mode: 'reading' }); showActiveMemory();
      } else { session.update({ railwayId: interaction.id }); ui.focusWorld(); }
      return;
    }
    active = interaction; originalView = false; committed = ['memory', 'ending', 'access'].includes(interaction.kind);
    if (interaction.kind === 'puzzle') {
      if (session.state.flags.includes(interaction.setsFlag)) { committed = true; session.update({ mode: 'reading' }); showActiveMemory(); }
      else if (target.letter) {
        if (session.toggleTile(interaction, target.letter)) { committed = true; session.update({ mode: 'reading' }); showActiveMemory(); }
        else { active = null; ui.focusWorld(); }
      }
      return;
    }
    if (interaction.kind === 'scrapbook') {
      if (!session.openScrapbook(interaction)) { ui.speak(session.state.leaderId, 'Let the other person open this page. Press Q to switch.'); active = null; return; }
      session.update({ mode: 'scrapbook' }); ui.showScrapbook(interaction, session.state.scrapbookPages[interaction.id] ?? 0); return;
    }
    if (interaction.kind === 'naming') { session.update({ mode: 'reading' }); ui.showNaming(); }
    else if (interaction.speakerId) {
      session.update({ mode: 'speaking' }); ui.speak(interaction.speakerId, session.interpolate(interaction.text), true);
    } else { session.update({ mode: 'reading' }); showActiveMemory(); }
  };
  async function startWorld() {
    if (worldStarting) return;
    worldStarting = true;
    session.update({ mode: 'loading' }); clearMovement();
    if (!game) {
      try {
        const [engine, sceneModule] = await Promise.all([import('phaser'), import('./scenes/WorldScene')]);
        if (lifecycle.signal.aborted) { worldStarting = false; return; }
        const Phaser = engine.default;
        world = new sceneModule.WorldScene({
          session, input, onTarget: (target) => ui.setTarget(target), onInteract: interact,
          onFrame: (actors) => ui.updateActors(actors),
          onReady: () => {
            worldStarting = false; renderedSceneId = session.state.sceneId;
            if (!readerRoute) { session.update({ mode: 'exploring' }); ui.focusWorld(); }
          },
        });
        game = new Phaser.Game({
          type: Phaser.AUTO, width: 960, height: 540, parent: ui.worldHost,
          backgroundColor: '#f7efdc', scene: [world],
          physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          render: { antialias: true, roundPixels: false }, audio: { noAudio: true },
        });
        game.canvas.addEventListener('webglcontextlost', () => {
          rendererFailed = true; checkpointAfterMemory = false; clearMovement(); session.update({ mode: 'paused' });
          ui.loadingError('The map paused. You can continue through Read our story.');
        }, { signal: lifecycle.signal });
      } catch (error) {
        worldStarting = false; rendererFailed = true;
        if (lifecycle.signal.aborted || readerRoute) return;
        session.update({ mode: 'paused' });
        ui.loadingError(error instanceof Error ? error.message : 'Please try reopening the page.');
      }
    } else world!.scene.restart();
  }
  function advance() {
    if (session.state.mode !== 'checkpoint') return;
    ui.dismiss(); ui.clearSpeech(); clearMovement(); active = null; checkpointAfterMemory = false;
    const next = session.advance();
    if (readerRoute) { showReaderList(); return; }
    if (next) world?.scene.restart(); else ui.focusWorld();
  }
  const explore = () => {
    if (readerRoute || session.state.mode !== 'checkpoint') return;
    clearMovement(); ui.dismiss(); ui.clearSpeech(); active = null; committed = false;
    session.update({ mode: 'exploring' }); ui.focusWorld();
  };
  const scrapbookPage = (delta: number) => {
    if (active?.kind !== 'scrapbook' || session.state.mode !== 'scrapbook') return;
    session.turnPage(active, delta); originalView = false;
    ui.showScrapbook(active, session.state.scrapbookPages[active.id] ?? 0);
  };
  const travelScene = (id: string) => {
    if (!['exploring', 'paused', 'reader'].includes(session.state.mode)) return;
    clearMovement();
    if (!session.visit(id)) return;
    active = null; readerDetail = null; suspendedRail = null; restarting = false; checkpointAfterMemory = false;
    ui.dismiss(); ui.clearSpeech(); ui.setTarget(null);
    if (readerRoute) showReaderList(); else startWorld();
  };
  const input = new WorldInput((code) => {
    if (code === 'KeyE') {
      if (session.state.mode === 'speaking') openMemory();
      else if (session.state.mode === 'checkpoint') advance();
      else if (session.state.mode === 'reading' && active?.kind === 'ending' && active.eRevealsFinalPhoto && ui.advanceEndingPhotoOnInteract()) return;
      else if (['reading', 'scrapbook', 'puzzle', 'reader'].includes(session.state.mode)) close();
      else if (session.state.mode === 'exploring') interact();
    } else if (code === 'KeyQ') switchLeader();
    else if ((code === 'KeyA' || code === 'KeyD') && ['scrapbook', 'reading'].includes(session.state.mode)) {
      const delta = code === 'KeyA' ? -1 : 1;
      if (session.state.mode === 'scrapbook') scrapbookPage(delta); else ui.turnPhoto(delta);
    }
    else if (code === 'Escape') {
      if (session.state.mode === 'exploring' || session.state.mode === 'travelling') pause();
      else if (session.state.mode === 'paused') resume();
      else if (['reading', 'scrapbook', 'puzzle', 'reader'].includes(session.state.mode)) close();
      else if (session.state.mode === 'speaking') { active = null; ui.clearSpeech(); session.update({ mode: 'exploring' }); }
    }
  }, () => session.state.mode === 'exploring' && !session.state.railwayId,
  () => { if (session.state.mode === 'exploring' || session.state.mode === 'travelling') pause(); },
  () => ['scrapbook', 'reading'].includes(session.state.mode));
  ui = new AppUI(session, {
    name: (profile: Profile) => {
      if (active?.kind !== 'naming') return;
      session.name(profile); committed = true; close();
    },
    interact, switchLeader, pause, resume, close, advance, explore, openMemory, travelScene,
    restart: () => {
      if (!restarting) { restarting = true; ui.showRestart(); return; }
      clearMovement(); ui.dismiss(); ui.clearSpeech(); active = null; readerDetail = null; suspendedRail = null;
      ui.resetAlbums();
      renderedSceneId = '';
      checkpointAfterMemory = false;
      session.restart(); restarting = false;
      if (readerRoute) showReaderList(); else startWorld();
    },
    guide: () => {
      const next = session.scene.interactions.find((i) => !session.state.flags.includes(i.setsFlag)) ?? session.scene.interactions[0];
      const target = interactionTargets([next])[0];
      resume(); world?.guide(target); ui.focusWorld();
    },
    toggleMemory: () => {
      originalView = !originalView;
      if (readerRoute && readerDetail) ui.showReaderDetail(readerDetail, originalView);
      else if (active?.kind === 'scrapbook' && session.state.mode === 'scrapbook') ui.showScrapbook(active, session.state.scrapbookPages[active.id] ?? 0, originalView);
      else if (session.state.mode === 'reading') showActiveMemory();
    },
    puzzleTile: (letter: string) => {
      const puzzle = session.scene.interactions.find((interaction) => interaction.kind === 'puzzle');
      if (!puzzle || session.state.mode !== 'exploring') return;
      const target = interactionTargets([puzzle]).find((target) => target.letter === letter);
      if (target) interact(target);
    },
    scrapbookPage, readStory: showReaderList,
    readerOpen: (id: string) => {
      if (!readerRoute || session.state.mode !== 'reader') return;
      const available = story.scenes.filter((scene) => session.reachableSceneIds.includes(scene.id)).flatMap((scene) => scene.interactions);
      const interaction = available.find((i) => i.id === id);
      if (!interaction || !interaction.requires.every((flag) => session.state.flags.includes(flag))) return;
      readerDetail = interaction; originalView = false; ui.showReaderDetail(interaction);
    },
    readerDone: () => {
      if (!readerRoute || !readerDetail || session.state.mode !== 'reader') return;
      const interaction = readerDetail;
      const owner = story.scenes.find((scene) => scene.interactions.includes(interaction));
      if (owner && owner.id !== session.scene.id) {
        clearMovement();
        if (!session.visit(owner.id)) return;
        suspendedRail = null; ui.setTarget(null);
      }
      if (session.completeInReader(interaction)) { readerDetail = null; ui.showReaderCheckpoint(); }
      else showReaderList();
    },
    textSize: () => {
      session.update({ textScale: session.state.textScale === 'normal' ? 'large' : 'normal' });
      if (readerRoute) { if (readerDetail) ui.showReaderDetail(readerDetail, originalView); else ui.showReader(); }
      else ui.showPause();
    },
  });
  if (new URLSearchParams(location.search).has('reader')) showReaderList(); else startWorld();
  if (import.meta.hot) import.meta.hot.dispose(() => {
    lifecycle.abort(); input.destroy(); ui.destroy(); game?.destroy(true);
  });
}

boot().catch((error: unknown) => {
  const root = document.getElementById('app')!;
  const panel = document.createElement('main'); panel.className = 'boot-error';
  const title = document.createElement('h1'); title.textContent = 'Our world needs a moment.';
  const message = document.createElement('p'); message.textContent = error instanceof Error ? error.message : 'Could not load our dreamy journey.';
  const retry = document.createElement('button'); retry.className = 'primary'; retry.textContent = 'Try again'; retry.onclick = () => location.reload();
  panel.append(title, message, retry); root.replaceChildren(panel);
});
