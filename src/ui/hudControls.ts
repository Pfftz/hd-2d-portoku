import type { AppStateController } from '../state/appState.ts';

export interface HudControlsHandle {
  focusArchiveButton: () => void;
  dispose: () => void;
}

export function createHudControls(
  hudRoot: HTMLElement,
  appState: AppStateController,
): HudControlsHandle {
  hudRoot.replaceChildren();

  const cornerGroup = document.createElement('div');
  cornerGroup.className = 'hud-corner-controls';

  const archiveBtn = document.createElement('button');
  archiveBtn.type = 'button';
  archiveBtn.id = 'archive-toggle-btn';
  archiveBtn.className = 'jrpg-btn';
  archiveBtn.textContent = 'Index / Archive';

  const whisperEl = document.createElement('p');
  whisperEl.id = 'whisper-cue';
  whisperEl.textContent = 'Click anywhere to begin';
  whisperEl.dataset.visible = 'true';

  cornerGroup.appendChild(archiveBtn);
  hudRoot.append(cornerGroup, whisperEl);

  const stopPointer = (event: Event): void => {
    event.stopPropagation();
  };

  const onArchiveClick = (event: Event): void => {
    event.stopPropagation();
    appState.openArchive();
  };

  archiveBtn.addEventListener('pointerdown', stopPointer);
  archiveBtn.addEventListener('pointerup', stopPointer);
  archiveBtn.addEventListener('click', onArchiveClick);

  const unsubscribe = appState.subscribe((state) => {
    const showHud = state.mode !== 'FALLBACK_ARCHIVE';
    hudRoot.hidden = !showHud;
    whisperEl.dataset.visible = state.whisperVisible ? 'true' : 'false';
    whisperEl.setAttribute('aria-hidden', state.whisperVisible ? 'false' : 'true');
  });

  return {
    focusArchiveButton() {
      archiveBtn.focus();
    },
    dispose() {
      unsubscribe();
      archiveBtn.removeEventListener('pointerdown', stopPointer);
      archiveBtn.removeEventListener('pointerup', stopPointer);
      archiveBtn.removeEventListener('click', onArchiveClick);
    },
  };
}
