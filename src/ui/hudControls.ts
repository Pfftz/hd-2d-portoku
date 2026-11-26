import type { AppStateController } from '../state/appState.ts';

export interface HudControlsHandle {
  focusArchiveButton: () => void;
  dispose: () => void;
}

export function createHudControls(
  hudRoot: HTMLElement,
  appState: AppStateController,
  onAudioGesture?: () => void,
): HudControlsHandle {
  hudRoot.replaceChildren();

  const cornerGroup = document.createElement('div');
  cornerGroup.className = 'hud-corner-controls';

  const audioBtn = document.createElement('button');
  audioBtn.type = 'button';
  audioBtn.id = 'audio-toggle-btn';
  audioBtn.className = 'jrpg-btn';

  const archiveBtn = document.createElement('button');
  archiveBtn.type = 'button';
  archiveBtn.id = 'archive-toggle-btn';
  archiveBtn.className = 'jrpg-btn';
  archiveBtn.textContent = 'Index / Archive';

  const whisperEl = document.createElement('p');
  whisperEl.id = 'whisper-cue';
  whisperEl.textContent = 'Click anywhere to begin';
  whisperEl.dataset.visible = 'true';

  cornerGroup.append(audioBtn, archiveBtn);
  hudRoot.append(cornerGroup, whisperEl);

  const stopPointer = (event: Event): void => {
    event.stopPropagation();
  };

  const onAudioClick = (event: Event): void => {
    event.stopPropagation();
    const current = appState.getState();
    if (current.audioStatus === 'UNSTARTED' && current.mode === 'EXPLORING') {
      appState.wakeAudioFromIdle();
      onAudioGesture?.();
      return;
    }
    const next = appState.toggleMute();
    if (next === 'PLAYING') {
      onAudioGesture?.();
    }
  };

  const onArchiveClick = (event: Event): void => {
    event.stopPropagation();
    appState.openArchive();
  };

  audioBtn.addEventListener('pointerdown', stopPointer);
  audioBtn.addEventListener('pointerup', stopPointer);
  audioBtn.addEventListener('click', onAudioClick);
  archiveBtn.addEventListener('pointerdown', stopPointer);
  archiveBtn.addEventListener('pointerup', stopPointer);
  archiveBtn.addEventListener('click', onArchiveClick);

  const unsubscribe = appState.subscribe((state) => {
    const showHud = state.mode !== 'FALLBACK_ARCHIVE';
    hudRoot.hidden = !showHud;
    whisperEl.dataset.visible = state.whisperVisible ? 'true' : 'false';
    whisperEl.setAttribute('aria-hidden', state.whisperVisible ? 'false' : 'true');

    audioBtn.dataset.audioStatus = state.audioStatus;
    if (state.audioStatus === 'UNSTARTED') {
      const startedWalk = state.mode === 'EXPLORING';
      audioBtn.textContent = startedWalk ? 'Sound: Off' : 'Mute';
      audioBtn.setAttribute(
        'aria-label',
        startedWalk ? 'Enable sound' : 'Mute sound before starting',
      );
      audioBtn.setAttribute('aria-pressed', 'false');
    } else if (state.audioStatus === 'PLAYING') {
      audioBtn.textContent = 'Sound: On';
      audioBtn.setAttribute('aria-label', 'Mute sound');
      audioBtn.setAttribute('aria-pressed', 'true');
    } else {
      audioBtn.textContent = 'Sound: Muted';
      audioBtn.setAttribute('aria-label', 'Unmute sound');
      audioBtn.setAttribute('aria-pressed', 'false');
    }
  });

  return {
    focusArchiveButton() {
      archiveBtn.focus();
    },
    dispose() {
      unsubscribe();
      audioBtn.removeEventListener('pointerdown', stopPointer);
      audioBtn.removeEventListener('pointerup', stopPointer);
      audioBtn.removeEventListener('click', onAudioClick);
      archiveBtn.removeEventListener('pointerdown', stopPointer);
      archiveBtn.removeEventListener('pointerup', stopPointer);
      archiveBtn.removeEventListener('click', onArchiveClick);
    },
  };
}
