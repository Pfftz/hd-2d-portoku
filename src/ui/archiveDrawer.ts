import type { NodesDocument } from '../content/validateNodes.ts';
import type { AppStateController } from '../state/appState.ts';

export interface ArchiveDrawerHandle {
  closeDialogElement: () => void;
  dispose: () => void;
}

export function createArchiveDrawer(
  dialogEl: HTMLDialogElement,
  nodesDoc: NodesDocument,
  appState: AppStateController,
  onRestoreFocus: () => void,
): ArchiveDrawerHandle {
  dialogEl.replaceChildren();

  const header = document.createElement('div');
  header.className = 'archive-header';

  const title = document.createElement('h1');
  title.id = 'archive-title';
  title.className = 'archive-title';
  title.textContent = 'Index / Archive';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.id = 'archive-close-btn';
  closeBtn.className = 'jrpg-btn';
  closeBtn.textContent = 'Close [Esc]';

  header.append(title, closeBtn);
  dialogEl.appendChild(header);

  const fallbackBanner = document.createElement('p');
  fallbackBanner.id = 'archive-fallback-note';
  fallbackBanner.textContent =
    'Interactive 3D view is unavailable on this device. Reading semantic archive fallback.';
  fallbackBanner.hidden = true;
  dialogEl.appendChild(fallbackBanner);

  for (const node of nodesDoc.nodes) {
    const section = document.createElement('section');
    section.className = 'archive-section';

    const heading = document.createElement('h2');
    heading.textContent = node.title;
    section.appendChild(heading);

    for (const line of node.lines) {
      const p = document.createElement('p');
      p.textContent = line;
      section.appendChild(p);
    }

    if (node.works && node.works.length > 0) {
      const list = document.createElement('ul');
      list.className = 'archive-list';
      for (const work of node.works) {
        const li = document.createElement('li');
        const strong = document.createElement('strong');
        strong.textContent = work.title;
        li.appendChild(strong);

        for (const rLine of work.reflection) {
          const rp = document.createElement('p');
          rp.textContent = rLine;
          li.appendChild(rp);
        }

        const note = document.createElement('p');
        note.textContent = work.inspect.note;
        li.appendChild(note);

        const link = document.createElement('a');
        link.className = 'archive-link';
        link.href = work.inspect.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = work.inspect.linkLabel;
        li.appendChild(link);
        list.appendChild(li);
      }
      section.appendChild(list);
    }

    if (node.links && node.links.length > 0) {
      const linkList = document.createElement('ul');
      linkList.className = 'archive-list';
      for (const item of node.links) {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'archive-link';
        link.href = item.url;
        if (item.url.startsWith('https:')) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        link.textContent = item.label;
        li.appendChild(link);
        linkList.appendChild(li);
      }
      section.appendChild(linkList);
    }

    dialogEl.appendChild(section);
  }

  const meta = document.createElement('div');
  meta.className = 'archive-meta';
  const motionNote = document.createElement('p');
  motionNote.textContent = appState.getState().reducedMotion
    ? 'Reduced motion preference detected: scene motion is halted.'
    : 'Reduced motion preference: off.';
  meta.appendChild(motionNote);

  if (nodesDoc.audioCredit) {
    const audioP = document.createElement('p');
    audioP.textContent = `Audio: ${nodesDoc.audioCredit}`;
    meta.appendChild(audioP);
  }
  dialogEl.appendChild(meta);

  const stopPointer = (event: Event): void => {
    event.stopPropagation();
  };

  const onCloseClick = (event: Event): void => {
    event.stopPropagation();
    if (appState.getState().mode === 'FALLBACK_ARCHIVE') {
      return;
    }
    if (dialogEl.open) {
      dialogEl.close();
    }
    appState.closeArchive();
    onRestoreFocus();
  };

  const onCancel = (event: Event): void => {
    if (appState.getState().mode === 'FALLBACK_ARCHIVE') {
      event.preventDefault();
      return;
    }
    appState.closeArchive();
    onRestoreFocus();
  };

  dialogEl.addEventListener('pointerdown', stopPointer);
  dialogEl.addEventListener('pointerup', stopPointer);
  dialogEl.addEventListener('cancel', onCancel);
  closeBtn.addEventListener('click', onCloseClick);

  const unsubscribe = appState.subscribe((state) => {
    motionNote.textContent = state.reducedMotion
      ? 'Reduced motion preference detected: scene motion is halted.'
      : 'Reduced motion preference: off.';

    if (state.mode === 'FALLBACK_ARCHIVE') {
      dialogEl.classList.add('is-fallback');
      closeBtn.hidden = true;
      closeBtn.disabled = true;
      fallbackBanner.hidden = false;
      if (dialogEl.open) {
        dialogEl.close();
      }
      dialogEl.setAttribute('open', '');
      return;
    }

    dialogEl.classList.remove('is-fallback');
    closeBtn.hidden = false;
    closeBtn.disabled = false;
    fallbackBanner.hidden = true;

    if (state.mode === 'ARCHIVE_DRAWER') {
      if (!dialogEl.open && typeof dialogEl.showModal === 'function') {
        dialogEl.showModal();
      }
    } else if (dialogEl.open) {
      dialogEl.close();
    }
  });

  return {
    closeDialogElement() {
      if (dialogEl.open && appState.getState().mode !== 'FALLBACK_ARCHIVE') {
        dialogEl.close();
      }
    },
    dispose() {
      unsubscribe();
      dialogEl.removeEventListener('pointerdown', stopPointer);
      dialogEl.removeEventListener('pointerup', stopPointer);
      dialogEl.removeEventListener('cancel', onCancel);
      closeBtn.removeEventListener('click', onCloseClick);
    },
  };
}
