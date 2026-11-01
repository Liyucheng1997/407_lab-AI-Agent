// 界面：章节导航、讲解卡、翻页器、点击说明卡
import { h } from './dom.js';
import { iconSvg } from '../core/icons.js';
import { INFO } from '../story/info.js';

export function createUI({ chapters, onGo }) {
  const nav = document.getElementById('chapters');
  const narration = document.getElementById('narration');
  const pager = document.getElementById('pager');
  const info = document.getElementById('infocard');

  /* 章节导航 */
  nav.append(h('div', { class: 'nav-title' }, '目录'));
  const navItems = chapters.map((c, i) =>
    h('button', { class: 'nav-item', onclick: () => onGo(i) }, [h('span', { class: 'nav-num tabular' }, String(i).padStart(2, '0')), h('span', { class: 'nav-name' }, c.nav)]),
  );
  nav.append(...navItems);

  /* 翻页器 */
  const prev = h('button', { class: 'btn pager-btn', onclick: () => onGo(current - 1), html: `${iconSvg('left', 16)}<span>上一章</span>` });
  const next = h('button', { class: 'btn btn-primary pager-btn', onclick: () => onGo(current + 1), html: `<span>下一章</span>${iconSvg('right', 16)}` });
  const dots = h(
    'div',
    { class: 'dots' },
    chapters.map((c, i) => h('button', { class: 'dot', title: c.nav, onclick: () => onGo(i) })),
  );
  pager.append(prev, dots, next);

  let current = 0;

  function renderChapter(i, ctx) {
    current = i;
    const c = chapters[i];
    navItems.forEach((n, k) => n.classList.toggle('active', k === i));
    [...dots.children].forEach((d, k) => d.classList.toggle('active', k === i));
    prev.disabled = i === 0;
    next.disabled = i === chapters.length - 1;
    next.querySelector('span').textContent = i === chapters.length - 1 ? '已到结尾' : `下一章 · ${chapters[i + 1].nav}`;

    const body = h('div', { class: 'nar-inner' }, [
      h('div', { class: 'nar-tag' }, c.tag),
      h('h1', { class: 'nar-title', html: c.title }),
      h('p', { class: 'nar-lead', html: c.lead }),
    ]);
    if (c.points?.length) {
      body.append(
        h(
          'ul',
          { class: 'points' },
          c.points.map(([icon, html]) => h('li', {}, [h('span', { class: 'pt-ico', html: iconSvg(icon, 15) }), h('span', { html })])),
        ),
      );
    }
    const widget = h('div', { class: 'widget' });
    body.append(widget);
    if (c.analogy) body.append(h('div', { class: 'analogy' }, [h('div', { class: 'analogy-tag' }, '打个比方'), h('p', { html: c.analogy })]));
    if (c.examples) body.append(h('p', { class: 'examples', html: c.examples }));
    narration.replaceChildren(body);
    narration.scrollTop = 0;
    body.classList.add('enter');
    c.widget?.(widget, ctx);
  }

  // 只重绘小部件（状态切换时用）
  function renderWidget(i, ctx) {
    const c = chapters[i];
    const old = narration.querySelector('.widget');
    const widget = h('div', { class: 'widget' });
    old.replaceWith(widget);
    c.widget?.(widget, ctx);
  }

  /* 说明卡 */
  function showInfo(id) {
    const d = INFO[id];
    if (!d) return;
    info.replaceChildren(
      h('button', { class: 'modal-x info-x', onclick: hideInfo, html: iconSvg('x', 14) }),
      h('div', { class: 'info-tag' }, d.tag),
      h('div', { class: 'info-title' }, d.title),
      h('p', { class: 'info-body' }, d.body),
      d.facts ? h('ul', { class: 'info-facts' }, d.facts.map((f) => h('li', {}, f))) : null,
      d.eg ? h('p', { class: 'info-eg' }, d.eg) : null,
    );
    info.classList.remove('show');
    void info.offsetWidth;
    info.classList.add('show');
  }
  function hideInfo() {
    info.classList.remove('show');
  }

  return { renderChapter, renderWidget, showInfo, hideInfo };
}
