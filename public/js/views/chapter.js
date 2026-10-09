// Destination: header + the stages (big chunks of flying) inside it.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { getChapter, chaptersOrdered, paragraphsForChapter, legsForParagraph, legsForChapter, getPhoto, flownProgress } from '../state.js';
import { api } from '../api.js';
import { openChapterForm, openParagraphForm } from '../ui/forms.js';
import { confirmDialog, toast } from '../ui/dialog.js';
import { lazyImg } from '../lazy.js';
import { mediaUrl } from '../ui/photo.js';
import { crumbs } from '../ui/stepper.js';
import { ghostBox, ghostSchematic } from '../ui/ghost.js';
import { emptyState, editButton, primaryButton, ghostButton } from './common.js';
import { statusPill } from './book.js';
import { navigate } from '../router.js';

// Derive a stage's status from its legs.
function paragraphStatus(legs) {
  const p = flownProgress(legs);
  if (p.total === 0) return 'planned';
  if (p.flown === p.total) return 'complete';
  if (p.flown > 0) return 'in-progress';
  return 'planned';
}

function legStatusLabel(status) {
  return status === 'complete' ? '✓ Flown' : status === 'in-progress' ? 'In progress' : 'Planned';
}

export function renderChapter(app) {
  const chapter = getChapter(app.route.param);
  if (!chapter) return emptyState({ mark: 'book', title: 'Destination not found', message: 'It may have been moved to Trash.' });

  const index = chaptersOrdered().findIndex((c) => c.id === chapter.id);
  const num = String(index + 1).padStart(2, '0');
  const paragraphs = paragraphsForChapter(chapter.id);
  const chapterLegs = legsForChapter(chapter.id);
  const prog = flownProgress(chapterLegs);

  const wrap = el('div', {});
  wrap.append(crumbs([{ label: chapter.title }]));

  // Header
  const del = ghostButton(' Delete destination', 'trash', async () => {
    const ok = await confirmDialog({ title: 'Delete destination', message: `Move “${chapter.title}” to Trash? Its stages and legs stay in the database and can be restored.`, confirmLabel: 'Move to Trash', danger: true });
    if (!ok) return;
    await api.chapters.remove(chapter.id);
    toast('Destination moved to Trash');
    navigate('/book');
    await app.refresh();
  });
  const head = el('div', { class: 'chapter-head' },
    el('div', {},
      el('div', { class: 'eyebrow', text: `Destination ${num}${chapter.subtitle ? ' · ' + chapter.subtitle : ''}` }),
      el('h1', { text: chapter.title }),
      chapter.summary ? el('div', { class: 'summary', text: chapter.summary }) : null,
      el('div', { class: 'chiprow', style: { marginTop: '14px' } },
        editButton(() => openChapterForm({ chapter, onSaved: () => app.refresh() })), del),
    ),
    el('div', { class: 'right' },
      statusPill(chapter.status),
      chapter.career_tag ? el('span', { class: 'career-chip', text: chapter.career_tag }) : null,
      el('div', { class: 'muted', text: `${prog.flown} of ${prog.total} legs flown` }),
    ),
  );
  wrap.append(head);

  // Stages
  const toc = el('div', { class: 'toc-head' },
    el('div', {},
      el('div', { class: 'eyebrow', text: 'Stages · big chunks of flying' }),
      el('h2', { text: `${paragraphs.length} ${paragraphs.length === 1 ? 'stage' : 'stages'}` }),
    ),
    el('div', { class: 'chiprow' },
      el('span', { class: 'hint', text: 'Tap a stage to open its page.' }),
      primaryButton(' New stage', 'plus', () => openParagraphForm({ chapterId: chapter.id, nextOrder: paragraphs.length, onSaved: () => app.refresh() })),
    ),
  );
  wrap.append(toc);

  if (!paragraphs.length) {
    wrap.append(ghostBox({
      title: 'No stages yet',
      text: 'A stage is a big chunk of flying — a crossing, a tour, a leg home. Add one and its legs line up inside it.',
      visual: ghostSchematic(false),
    }));
    return wrap;
  }

  const list = el('div', { class: 'para-list' });
  paragraphs.forEach((p, i) => list.append(paragraphRow(p, i)));
  wrap.append(list);
  return wrap;
}

function paragraphRow(p, index) {
  const legs = legsForParagraph(p.id);
  const status = paragraphStatus(legs);
  const first = legs[0];
  const last = legs[legs.length - 1];
  const route = first ? `${first.dep_icao || '—'} → ${(last && (last.arr_icao || last.dep_icao)) || '—'}` : 'No legs yet';

  const cover = el('div', { class: 'para-cover' });
  const heroPhoto = getPhoto(p.hero_photo_id);
  if (heroPhoto && heroPhoto.thumb_key) cover.append(lazyImg(mediaUrl(heroPhoto.thumb_key), { alt: '' }));
  else cover.append(el('span', { class: 'tag', text: 'Cover' }));

  const chips = el('div', { class: 'leg-chips' });
  if (legs.length) {
    for (const l of legs) {
      chips.append(el('span', {
        class: 'leg-chip ' + (l.status === 'flown' ? 'flown' : 'planned'),
        text: `L${l.number ?? ''} ${l.dep_icao || '—'}→${l.arr_icao || '—'}`.replace('L ', 'L'),
      }));
    }
  } else {
    chips.append(el('span', { class: 'leg-chip planned', text: 'No legs yet' }));
  }

  const row = el('div', { class: 'para-row' },
    cover,
    el('div', {},
      el('div', { class: 'eyebrow', text: `Stage ${String(index + 1).padStart(2, '0')} · ${route}` }),
      el('h3', { text: p.title }),
      statusPill(status),
    ),
    el('div', { class: 'para-right' },
      el('div', { class: 'eyebrow', text: `Legs · ${legs.length} ${legs.length === 1 ? 'leg' : 'legs'}` }),
      chips,
    ),
  );
  row.addEventListener('click', () => navigate(`/paragraph/${p.id}`));
  return row;
}
