/**
 * Architecture Evidence Explorer view:
 * - Lazily loads ./data/architecture-evidence.json
 * - Checks graph_snapshot_hash against active manifest.snapshot_hash
 * - Renders interactive SVG hotspots over the white-paper architecture diagram
 * - Layout presets (Balanced Split / Focus Diagram / Full Globe) + keyboard/pointer horizontal splitter
 * - Publication-grade zero-dependency DOM LaTeX renderer (fractions, cases, underbraces, scripts)
 * - Previews on hover/focus, pins on click/Enter/tap, clears on Escape
 */

import { renderKatexInto, FORMULA_SYMBOL_GLOSSARY } from './formula-symbols.js';

const STAGE_META = {
  A: { label: 'Stage A · Intake & Encoding', color: '#3F6FBF', badgeCls: 'badge-neural' },
  B: { label: 'Stage B · Latent World Model', color: '#82B366', badgeCls: 'badge-hybrid' },
  C: { label: 'Stage C · Action & Planning', color: '#9673A6', badgeCls: 'badge-symbolic' },
  D: { label: 'Stage D · Safety & Approval', color: '#B85450', badgeCls: 'badge-safety' },
  audit: { label: 'Audit & Post-Deployment', color: '#B85450', badgeCls: 'badge-safety' },
  external: { label: 'Real-World Boundary', color: '#C49E32', badgeCls: 'badge-human' },
};

const CAL_MAP = {
  A: '𝒜', B: 'ℬ', C: '𝒞', D: '𝒟', E: 'ℰ', F: 'ℱ', G: '𝒢', H: 'ℋ',
  I: 'ℐ', J: '𝒥', K: '𝒦', L: 'ℒ', M: 'ℳ', N: '𝒩', O: '𝒪', P: '𝒫',
  Q: '𝒬', R: 'ℛ', S: '𝒮', T: '𝒯', U: '𝒰', V: '𝒱', W: '𝒲', X: '𝒳', Y: '𝒴', Z: '𝒵',
};

const BB_MAP = { R: 'ℝ', E: '𝔼', P: 'ℙ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ' };

const SYMBOL_MAP = {
  le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', approx: '≈',
  cup: '∪', cap: '∩', in: '∈', notin: '∉', subseteq: '⊆', subset: '⊂',
  sum: '∑', prod: '∏', int: '∫', infty: '∞', cdot: '·', times: '×',
  to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', implies: '⇒',
  forall: '∀', exists: '∃', wedge: '∧', land: '∧', vee: '∨', lor: '∨',
  sim: '∼', mid: ' | ', neg: '¬', pm: '±',
  sigma: 'σ', tau: 'τ', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ',
  delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε', lambda: 'λ',
  mu: 'μ', pi: 'π', Pi: 'Π', Gamma: 'Γ', phi: 'φ', varphi: 'φ',
  psi: 'ψ', omega: 'ω', xi: 'ξ',
  sup: 'sup', inf: 'inf', log: 'log', arg: 'arg', min: 'min', max: 'max',
  quad: '  ', qquad: '   ',
};

function el(tag, attrs = {}, text = null) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'role' || k === 'tabindex') {
      node.setAttribute(k, String(v));
    } else {
      node[k] = v;
    }
  }
  if (text !== null && text !== undefined) node.textContent = String(text);
  return node;
}

/** Read a balanced {...} group starting at idx (pointing at '{'), returning { content, nextIdx } */
function readBraceGroup(src, idx) {
  if (src[idx] !== '{') return null;
  let depth = 0;
  let i = idx;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return { content: src.slice(idx + 1, i), nextIdx: i + 1 };
      }
    }
    i++;
  }
  return { content: src.slice(idx + 1), nextIdx: src.length };
}

/** Read next LaTeX argument: either {...} or single command/char */
function readArg(src, idx) {
  let i = idx;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (i >= src.length) return { content: '', nextIdx: i };
  if (src[i] === '{') return readBraceGroup(src, i);
  if (src[i] === '\\') {
    const m = src.slice(i).match(/^\\([A-Za-z]+|.)/);
    if (m) return { content: m[0], nextIdx: i + m[0].length };
  }
  return { content: src[i], nextIdx: i + 1 };
}

/**
 * Safe, zero-dependency recursive DOM LaTeX renderer.
 * Supports \frac, \begin{cases}, \underbrace, \mathcal, \mathbb, \mathbf,
 * \mathrm/\text/\textsf/\mathit/{\rm ...}, \bar/\tilde/\hat, Greek & logic symbols, sub/superscripts.
 */
function renderLatexNodes(src, parent) {
  let i = 0;
  const n = src.length;
  let textBuf = '';

  const flushText = () => {
    if (textBuf) {
      parent.appendChild(document.createTextNode(textBuf));
      textBuf = '';
    }
  };

  while (i < n) {
    const ch = src[i];

    // Whitespace normalization
    if (/\s/.test(ch)) {
      if (!textBuf.endsWith(' ')) textBuf += ' ';
      i++;
      continue;
    }

    // Group {...} — check for {\rm ...}
    if (ch === '{') {
      const grp = readBraceGroup(src, i);
      flushText();
      if (/^\\rm\b/.test(grp.content.trim())) {
        const inner = grp.content.trim().replace(/^\\rm\s*/, '');
        const sp = el('span', { class: 'math-op' });
        renderLatexNodes(inner, sp);
        parent.appendChild(sp);
      } else {
        renderLatexNodes(grp.content, parent);
      }
      i = grp.nextIdx;
      continue;
    }

    // Subscript / Superscript
    if (ch === '_' || ch === '^') {
      flushText();
      const tag = ch === '_' ? 'sub' : 'sup';
      const arg = readArg(src, i + 1);
      const scriptEl = el(tag);
      renderLatexNodes(arg.content, scriptEl);
      parent.appendChild(scriptEl);
      i = arg.nextIdx;
      continue;
    }

    // Backslash command
    if (ch === '\\') {
      const rest = src.slice(i);

      // Escaped single-char punctuation
      if (/^\\[,;! ]/.test(rest)) {
        if (rest[1] !== '!') textBuf += ' ';
        i += 2;
        continue;
      }
      if (/^\\([_{}|*])/.test(rest)) {
        const esc = rest[1];
        textBuf += esc === '|' ? '‖' : esc;
        i += 2;
        continue;
      }

      // \begin{cases}...\end{cases}
      if (rest.startsWith('\\begin{cases}')) {
        const endMarker = '\\end{cases}';
        const endPos = src.indexOf(endMarker, i + 13);
        const body = endPos >= 0 ? src.slice(i + 13, endPos) : src.slice(i + 13);
        flushText();
        const casesWrap = el('span', { class: 'math-cases' });
        casesWrap.appendChild(el('span', { class: 'math-cases-brace', 'aria-hidden': 'true' }, '{'));
        const rowsGrid = el('span', { class: 'math-cases-rows' });
        const rows = body.split('\\\\').map((r) => r.trim()).filter(Boolean);
        for (const r of rows) {
          const cols = r.split('&');
          const c1 = el('span');
          renderLatexNodes((cols[0] || '').trim(), c1);
          const c2 = el('span');
          renderLatexNodes((cols[1] || '').trim(), c2);
          rowsGrid.appendChild(c1);
          rowsGrid.appendChild(c2);
        }
        casesWrap.appendChild(rowsGrid);
        parent.appendChild(casesWrap);
        i = endPos >= 0 ? endPos + endMarker.length : n;
        continue;
      }

      const cmdMatch = rest.match(/^\\([A-Za-z]+)/);
      if (!cmdMatch) {
        i++;
        continue;
      }
      const cmd = cmdMatch[1];
      let nextIdx = i + cmdMatch[0].length;

      // Sizing delimiters to ignore or simplify
      if (cmd === 'left' || cmd === 'right' || cmd === 'Big' || cmd === 'big' || cmd === 'bigg' || cmd === 'Bigg') {
        i = nextIdx;
        continue;
      }

      // \frac{num}{den}
      if (cmd === 'frac') {
        flushText();
        const num = readArg(src, nextIdx);
        const den = readArg(src, num.nextIdx);
        const fracEl = el('span', { class: 'math-frac' });
        const numEl = el('span', { class: 'math-num' });
        const denEl = el('span', { class: 'math-den' });
        renderLatexNodes(num.content, numEl);
        renderLatexNodes(den.content, denEl);
        fracEl.appendChild(numEl);
        fracEl.appendChild(denEl);
        parent.appendChild(fracEl);
        i = den.nextIdx;
        continue;
      }

      // \underbrace{expr}_{label}
      if (cmd === 'underbrace') {
        flushText();
        const expr = readArg(src, nextIdx);
        let after = expr.nextIdx;
        let labelContent = '';
        while (after < n && /\s/.test(src[after])) after++;
        if (src[after] === '_') {
          const lbl = readArg(src, after + 1);
          labelContent = lbl.content;
          after = lbl.nextIdx;
        }
        const ub = el('span', { class: 'math-underbrace' });
        const ex = el('span', { class: 'math-ub-expr' });
        renderLatexNodes(expr.content, ex);
        ub.appendChild(ex);
        if (labelContent) {
          const lb = el('span', { class: 'math-ub-label' });
          renderLatexNodes(labelContent, lb);
          ub.appendChild(lb);
        }
        parent.appendChild(ub);
        i = after;
        continue;
      }

      // Font & alphabet commands
      if (cmd === 'mathcal') {
        const arg = readArg(src, nextIdx);
        textBuf += CAL_MAP[arg.content.trim()] || arg.content;
        i = arg.nextIdx;
        continue;
      }
      if (cmd === 'mathbb') {
        const arg = readArg(src, nextIdx);
        textBuf += BB_MAP[arg.content.trim()] || arg.content;
        i = arg.nextIdx;
        continue;
      }
      if (cmd === 'mathbf') {
        flushText();
        const arg = readArg(src, nextIdx);
        const sp = el('span', { class: 'math-bf' });
        renderLatexNodes(arg.content, sp);
        parent.appendChild(sp);
        i = arg.nextIdx;
        continue;
      }
      if (cmd === 'mathrm' || cmd === 'operatorname' || cmd === 'text') {
        flushText();
        const arg = readArg(src, nextIdx);
        const sp = el('span', { class: 'math-op' });
        if (cmd === 'text') sp.textContent = arg.content.replace(/\\_/g, '_');
        else renderLatexNodes(arg.content, sp);
        parent.appendChild(sp);
        i = arg.nextIdx;
        continue;
      }
      if (cmd === 'textsf') {
        flushText();
        const arg = readArg(src, nextIdx);
        const sp = el('span', { class: 'math-sf' });
        sp.textContent = arg.content.replace(/\\_/g, '_');
        parent.appendChild(sp);
        i = arg.nextIdx;
        continue;
      }
      if (cmd === 'mathit') {
        flushText();
        const arg = readArg(src, nextIdx);
        const sp = el('span', { class: 'math-it' });
        sp.textContent = arg.content.replace(/\\_/g, '_');
        parent.appendChild(sp);
        i = arg.nextIdx;
        continue;
      }
      if (cmd === 'bar' || cmd === 'tilde' || cmd === 'hat') {
        flushText();
        const arg = readArg(src, nextIdx);
        const comb = cmd === 'bar' ? '\u0304' : cmd === 'tilde' ? '\u0303' : '\u0302';
        const txt = arg.content.trim();
        if (txt.length === 1) {
          textBuf += txt + comb;
        } else {
          const sp = el('span', { class: 'math-bar' });
          renderLatexNodes(txt, sp);
          parent.appendChild(sp);
        }
        i = arg.nextIdx;
        continue;
      }

      if (SYMBOL_MAP[cmd] !== undefined) {
        textBuf += SYMBOL_MAP[cmd];
        i = nextIdx;
        continue;
      }

      // Fallback: show readable command name without backslash
      textBuf += cmd;
      i = nextIdx;
      continue;
    }

    textBuf += ch;
    i++;
  }
  flushText();
}

export function formatLatexFormula(latex, displayMode = false) {
  const wrap = el('span', { class: displayMode ? 'formula-math formula-math-display' : 'formula-math' });
  if (!latex) return wrap;
  if (renderKatexInto(latex, wrap, displayMode)) {
    return wrap;
  }
  renderLatexNodes(String(latex).trim(), wrap);
  return wrap;
}

function splitVariableDef(entry) {
  const s = String(entry || '').trim();
  const sep = s.match(/^([^:—–-]+?)\s*(?:—|–|:|\s-\s)\s*(.+)$/);
  if (sep) return [sep[1].trim(), sep[2].trim()];
  return [s, ''];
}

export class ArchitectureView {
  constructor(callbacks) {
    this.cb = callbacks || {};
    this.active = false;
    this.data = null;
    this.loading = false;
    this.loadError = null;
    this.hashValid = false;
    this.manifest = null;

    this.pinnedId = null;
    this.hoveredId = null;
    this.activeComponentId = null;
    this.reqSeq = 0;
    this.resolvedPositions = null;
    this.lastResolved = null;
    this.ontologyClasses = {};
    this.showCuratedLayer = true;
    this.showMappedLayer = true;
    this.showAllClasses = false;
    this.layoutPreset = 'split'; // 'split' | 'diagram' | 'globe'
    this.splitPct = 58;

    this.els = {
      viewport: document.getElementById('viewport'),
      pane: document.getElementById('arch-pane'),
      splitter: document.getElementById('arch-splitter'),
      img: document.getElementById('arch-figure-img'),
      svg: document.getElementById('arch-hotspot-svg'),
      banner: document.getElementById('arch-status-banner'),
      btnFocus: document.getElementById('btn-arch-focus'),
      btnClear: document.getElementById('btn-arch-clear'),
      btnEnlarge: document.getElementById('btn-arch-enlarge'),
      btnShowGraph: document.getElementById('btn-arch-show-graph'),
      presetBtns: Array.from(document.querySelectorAll('[data-arch-layout]')),
      inspector: document.getElementById('arch-inspector'),
      modal: document.getElementById('modal-arch-figure'),
      modalImg: document.getElementById('modal-arch-img'),
      modalSvg: document.getElementById('modal-arch-svg'),
      symbolDrawer: document.getElementById('symbol-drawer'),
      symbolBadge: document.getElementById('symbol-drawer-badge'),
      symbolTitle: document.getElementById('symbol-drawer-title'),
      symbolBody: document.getElementById('symbol-drawer-body'),
      btnCloseSymbol: document.getElementById('btn-close-symbol-drawer'),
    };
    this.activeSymbolFormulaId = null;

    this.bindEvents();
  }

  bindEvents() {
    if (this.els.btnFocus) {
      this.els.btnFocus.addEventListener('click', () => {
        if (this.resolvedPositions && this.cb.onFocusPositions) {
          this.cb.onFocusPositions(this.resolvedPositions);
        }
      });
    }
    if (this.els.btnClear) {
      this.els.btnClear.addEventListener('click', () => this.clearPinned());
    }
    if (this.els.btnEnlarge && this.els.modal) {
      this.els.btnEnlarge.addEventListener('click', () => {
        if (this.cb.onOpenModal) this.cb.onOpenModal('modal-arch-figure', this.els.btnEnlarge);
        else this.els.modal.classList.remove('hidden');
      });
    }
    if (this.els.btnShowGraph) {
      this.els.btnShowGraph.addEventListener('click', () => {
        if (this.cb.onShowInGraph) this.cb.onShowInGraph();
      });
    }
    if (this.els.btnCloseSymbol) {
      this.els.btnCloseSymbol.addEventListener('click', () => this.closeSymbolDrawer());
    }

    for (const btn of this.els.presetBtns) {
      btn.addEventListener('click', () => {
        this.setLayoutPreset(btn.dataset.archLayout || 'split');
      });
    }

    this.bindSplitter();

    document.addEventListener('keydown', (e) => {
      if (!this.active || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        const anyModalOpen = document.querySelector('.modal:not(.hidden)');
        if (anyModalOpen) return; // Modal Escape handler closes modal without clearing pin
        if (this.els.symbolDrawer && !this.els.symbolDrawer.classList.contains('hidden')) {
          this.closeSymbolDrawer();
          return;
        }
        if (this.pinnedId) {
          this.clearPinned();
        }
      }
    });
  }

  bindSplitter() {
    const sp = this.els.splitter;
    if (!sp) return;

    let dragging = false;
    const updateFromClientY = (clientY) => {
      if (!this.els.viewport) return;
      const rect = this.els.viewport.getBoundingClientRect();
      const tabsH = document.querySelector('.workspace-tabs')?.offsetHeight || 34;
      const avail = Math.max(200, rect.height - tabsH);
      const pct = Math.round(((clientY - rect.top - tabsH) / avail) * 100);
      this.setSplitPct(pct);
    };

    sp.addEventListener('pointerdown', (e) => {
      dragging = true;
      sp.classList.add('is-dragging');
      sp.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    sp.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      updateFromClientY(e.clientY);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      sp.classList.remove('is-dragging');
      if (this.cb.onLayoutResize) this.cb.onLayoutResize();
    };
    sp.addEventListener('pointerup', endDrag);
    sp.addEventListener('pointercancel', endDrag);

    sp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.setSplitPct(this.splitPct - 4);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.setSplitPct(this.splitPct + 4);
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.setSplitPct(32);
      } else if (e.key === 'End') {
        e.preventDefault();
        this.setSplitPct(80);
      } else if (e.key === '0') {
        e.preventDefault();
        this.setSplitPct(58);
      }
    });
  }

  setSplitPct(pct) {
    const clamped = Math.max(28, Math.min(82, Math.round(pct)));
    this.splitPct = clamped;
    if (this.els.pane) {
      this.els.pane.classList.remove('layout-diagram');
      this.els.pane.style.setProperty('--arch-split-pct', `${clamped}%`);
    }
    if (this.els.splitter) {
      this.els.splitter.setAttribute('aria-valuenow', String(clamped));
    }
    if (this.cb.onLayoutResize) this.cb.onLayoutResize();
  }

  setLayoutPreset(preset) {
    this.layoutPreset = preset;
    for (const b of this.els.presetBtns) {
      const act = b.dataset.archLayout === preset;
      b.classList.toggle('active', act);
      b.setAttribute('aria-pressed', String(act));
    }

    if (preset === 'globe') {
      if (this.cb.onRequestFullGlobe) this.cb.onRequestFullGlobe(true);
      return;
    }

    if (this.cb.onRequestFullGlobe) this.cb.onRequestFullGlobe(false);

    if (preset === 'diagram') {
      this.setSplitPct(82);
      if (this.els.pane) this.els.pane.classList.add('layout-diagram');
      if (this.cb.onAnnounce) this.cb.onAnnounce('Architecture layout: Focus Diagram.');
    } else {
      if (this.els.pane) this.els.pane.classList.remove('layout-diagram');
      this.setSplitPct(58);
      if (this.cb.onAnnounce) this.cb.onAnnounce('Architecture layout: Balanced Split.');
    }
    if (this.cb.onLayoutResize) this.cb.onLayoutResize();
  }

  resetLayout() {
    this.setLayoutPreset('split');
  }

  setManifest(manifest) {
    this.manifest = manifest;
    if (this.data) {
      this.evaluateHash();
      this.renderBanner();
    }
  }

  setOntologyClasses(classMap) {
    this.ontologyClasses = classMap || {};
  }

  async open() {
    this.active = true;
    if (this.els.pane) this.els.pane.classList.remove('hidden');
    if (this.els.splitter) this.els.splitter.classList.remove('hidden');
    if (this.els.inspector) this.els.inspector.classList.remove('hidden');
    this.setSplitPct(this.splitPct);

    if (!this.data && !this.loading) {
      await this.loadData();
    } else if (this.data) {
      this.evaluateHash();
      this.renderBanner();
      if (this.activeComponentId) {
        this.activateComponent(this.activeComponentId, this.pinnedId ? 'pin' : 'preview');
      }
    }
  }

  close() {
    this.active = false;
    this.reqSeq++;
    this.hoveredId = null;
    this.closeSymbolDrawer();
    if (this.els.pane) this.els.pane.classList.add('hidden');
    if (this.els.splitter) this.els.splitter.classList.add('hidden');
    if (this.els.inspector) this.els.inspector.classList.add('hidden');
    if (this.cb.onClearOverlay) this.cb.onClearOverlay();
  }

  openSymbolDrawer(formulaId, formulaObj) {
    const drawer = this.els.symbolDrawer;
    const body = this.els.symbolBody;
    if (!drawer || !body || !formulaObj) return;

    this.activeSymbolFormulaId = formulaId;
    const isInvariant = formulaObj.kind === 'invariant' || /^G\(/.test((formulaObj.latex || '').trim());
    if (this.els.symbolBadge) {
      this.els.symbolBadge.textContent = `${isInvariant ? 'Governance Invariant' : 'Mathematical Equation'}${formulaObj.section ? ` · §${formulaObj.section}` : ''}`;
    }
    if (this.els.symbolTitle) {
      this.els.symbolTitle.textContent = formulaObj.title || 'Equation Symbols & Interpretation';
    }

    body.replaceChildren();

    // 1. Rendered Equation Preview
    const eqCard = el('div', { class: 'symbol-eq-preview' });
    eqCard.appendChild(formatLatexFormula(formulaObj.latex, true));
    body.appendChild(eqCard);

    // 2. Plain-Language Interpretation
    const glossary = FORMULA_SYMBOL_GLOSSARY[formulaId] || null;
    const interpCard = el('div', { class: 'symbol-section' });
    interpCard.appendChild(el('h3', {}, 'Interpretation'));
    interpCard.appendChild(el('p', { class: 'symbol-interp-text' }, glossary?.interpretation || formulaObj.explanation || ''));
    if (glossary?.interpretation && formulaObj.explanation && glossary.interpretation !== formulaObj.explanation) {
      interpCard.appendChild(el('p', { class: 'hint-note' }, `Summary: ${formulaObj.explanation}`));
    }
    body.appendChild(interpCard);

    // 3. Complete Symbol-by-Symbol Breakdown
    const symSection = el('div', { class: 'symbol-section' });
    symSection.appendChild(el('h3', {}, 'Symbol-by-Symbol Guide'));
    const list = el('div', { class: 'symbol-list' });

    const entries = glossary?.symbols ? glossary.symbols.slice() : [];
    if (entries.length === 0 && Array.isArray(formulaObj.variables)) {
      for (const v of formulaObj.variables) {
        const [sym, def] = splitVariableDef(v);
        entries.push({ latex: sym, name: sym, meaning: def || sym });
      }
    }

    for (const item of entries) {
      const row = el('div', { class: 'symbol-item' });
      const symBox = el('div', { class: 'symbol-glyph' });
      symBox.appendChild(formatLatexFormula(item.latex, false));
      row.appendChild(symBox);

      const descBox = el('div', { class: 'symbol-desc' });
      descBox.appendChild(el('div', { class: 'symbol-name' }, item.name));
      descBox.appendChild(el('div', { class: 'symbol-meaning' }, item.meaning));
      row.appendChild(descBox);
      list.appendChild(row);
    }
    symSection.appendChild(list);
    body.appendChild(symSection);

    // 4. Assumptions & Scope
    if (formulaObj.assumptions) {
      const aBox = el('div', { class: 'arch-assumptions' }, `Scope & assumptions: ${formulaObj.assumptions}`);
      body.appendChild(aBox);
    }

    drawer.classList.remove('hidden');
    if (this.cb.onAnnounce) {
      this.cb.onAnnounce(`Opened symbol guide for ${formulaObj.title}.`);
    }
  }

  closeSymbolDrawer() {
    this.activeSymbolFormulaId = null;
    if (this.els.symbolDrawer) {
      this.els.symbolDrawer.classList.add('hidden');
    }
  }

  async loadData() {
    this.loading = true;
    this.loadError = null;
    this.renderBanner('Loading architecture evidence map…');
    try {
      const res = await fetch('./data/architecture-evidence.json');
      if (!res.ok) throw new Error(`HTTP ${res.status} loading architecture-evidence.json`);
      this.data = await res.json();
      this.evaluateHash();
      this.renderFigureAndHotspots();
      this.renderBanner();
      if (this._pendingPinId) {
        const targetId = this._pendingPinId;
        this._pendingPinId = null;
        this.pinComponent(targetId);
      } else {
        this.renderEmptyInspector();
      }
    } catch (err) {
      this.loadError = err?.message || String(err);
      this.renderBanner(this.loadError, true);
    } finally {
      this.loading = false;
    }
  }

  pinComponentWhenReady(compId) {
    if (this.data) {
      this.pinComponent(compId);
    } else {
      this._pendingPinId = compId;
    }
  }

  evaluateHash() {
    if (!this.data || !this.manifest) {
      this.hashValid = false;
      return;
    }
    this.hashValid = this.data.graph_snapshot_hash === this.manifest.snapshot_hash;
  }

  renderBanner(customText = null, isError = false) {
    const b = this.els.banner;
    if (!b) return;
    b.classList.remove('hidden', 'notice-warn', 'notice-error');
    if (customText) {
      b.textContent = customText;
      if (isError) b.classList.add('notice-error');
      return;
    }
    if (!this.data) {
      b.classList.add('hidden');
      return;
    }
    if (!this.hashValid) {
      b.classList.add('notice-warn');
      b.textContent = `Evidence map hash (${this.data.graph_snapshot_hash}) does not match active snapshot (${this.manifest?.snapshot_hash || 'unknown'}). Highlights are disabled until the evidence map is rebuilt; diagram and formulas remain readable.`;
      return;
    }
    b.textContent = this.data.coverage_note || '';
  }

  renderFigureAndHotspots() {
    if (!this.data) return;
    const figPath = `./${this.data.figure.asset}?v=light1`;
    const vb = (this.data.figure.view_box || [0, 0, 1177, 465]).join(' ');

    const populateSvg = (svgEl) => {
      if (!svgEl) return;
      svgEl.setAttribute('viewBox', vb);
      svgEl.replaceChildren();

      for (const comp of this.data.components || []) {
        const h = comp.hotspot;
        if (!h) continue;
        const stMeta = STAGE_META[comp.stage] || STAGE_META.A;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(h.x));
        rect.setAttribute('y', String(h.y));
        rect.setAttribute('width', String(h.width));
        rect.setAttribute('height', String(h.height));
        rect.setAttribute('rx', '6');
        rect.setAttribute('class', 'arch-hotspot');
        rect.setAttribute('data-comp-id', comp.id);
        rect.setAttribute('tabindex', '0');
        rect.setAttribute('role', 'button');
        rect.setAttribute('aria-pressed', String(comp.id === this.pinnedId));
        rect.setAttribute('aria-label', `${comp.label} (${(comp.module_ids || []).join(', ') || 'Boundary'})`);
        rect.style.setProperty('--stage-color', stMeta.color);

        const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        titleEl.textContent = `${comp.label} (${(comp.module_ids || []).join(', ') || 'Boundary'}) — Click or press Enter to pin`;
        rect.appendChild(titleEl);

        rect.addEventListener('mouseenter', () => this.previewComponent(comp.id));
        rect.addEventListener('focus', () => this.previewComponent(comp.id));
        rect.addEventListener('mouseleave', () => this.endPreview(comp.id));
        rect.addEventListener('blur', () => this.endPreview(comp.id));
        rect.addEventListener('click', (e) => {
          e.stopPropagation();
          this.pinComponent(comp.id);
        });
        rect.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.pinComponent(comp.id);
          }
        });

        svgEl.appendChild(rect);
      }
    };

    if (this.els.img) {
      this.els.img.src = figPath;
      this.els.img.alt = 'Healthcare World Model Architecture Diagram';
    }
    if (this.els.modalImg) {
      this.els.modalImg.src = figPath;
      this.els.modalImg.alt = 'Healthcare World Model Architecture Diagram (Large View)';
    }
    populateSvg(this.els.svg);
    populateSvg(this.els.modalSvg);
  }

  syncHotspotClasses() {
    const rects = document.querySelectorAll('.arch-hotspot');
    for (const r of rects) {
      const id = r.getAttribute('data-comp-id');
      const isPinned = id === this.pinnedId;
      r.classList.toggle('is-pinned', isPinned);
      r.classList.toggle('is-preview', id === this.hoveredId && !isPinned);
      r.setAttribute('aria-pressed', String(isPinned));
    }
    if (this.els.btnClear) {
      this.els.btnClear.disabled = !this.pinnedId;
    }
  }

  previewComponent(compId) {
    if (!this.active) return;
    this.hoveredId = compId;
    this.syncHotspotClasses();
    this.activateComponent(compId, 'preview');
  }

  endPreview(compId) {
    if (!this.active) return;
    if (this.hoveredId === compId) {
      this.hoveredId = null;
    }
    this.syncHotspotClasses();
    if (this.pinnedId) {
      this.activateComponent(this.pinnedId, 'pin');
    } else {
      this.activeComponentId = null;
      this.resolvedPositions = null;
      this.lastResolved = null;
      if (this.els.btnFocus) this.els.btnFocus.disabled = true;
      if (this.cb.onClearOverlay) this.cb.onClearOverlay();
      this.renderEmptyInspector();
    }
  }

  pinComponent(compId) {
    if (!this.active) return;
    this.pinnedId = compId;
    this.syncHotspotClasses();
    this.activateComponent(compId, 'pin');
    const comp = (this.data?.components || []).find((c) => c.id === compId);
    if (comp && this.cb.onAnnounce) {
      this.cb.onAnnounce(`Pinned architecture component: ${comp.label}.`);
    }
    if (this.cb.onComponentPinned) this.cb.onComponentPinned(comp || null);
  }

  clearPinned() {
    this.pinnedId = null;
    this.hoveredId = null;
    this.activeComponentId = null;
    this.resolvedPositions = null;
    this.lastResolved = null;
    this.reqSeq++;
    this.syncHotspotClasses();
    if (this.els.btnFocus) this.els.btnFocus.disabled = true;
    if (this.cb.onClearOverlay) this.cb.onClearOverlay();
    this.renderEmptyInspector();
    if (this.cb.onAnnounce) this.cb.onAnnounce('Cleared pinned architecture component.');
    if (this.cb.onComponentPinned) this.cb.onComponentPinned(null);
  }

  activateComponent(compId, mode) {
    if (!this.data) return;
    const comp = (this.data.components || []).find((c) => c.id === compId);
    if (!comp) return;
    if (this.activeComponentId !== compId) {
      this.showAllClasses = false;
    }
    this.activeComponentId = compId;
    this.lastResolved = null;
    this.renderComponentInspector(comp, null);

    if (!this.hashValid) {
      if (this.els.btnFocus) this.els.btnFocus.disabled = true;
      if (this.cb.onClearOverlay) this.cb.onClearOverlay();
      return;
    }

    const nodeSet = new Set();
    const edgeMap = new Map();
    for (const ep of comp.evidence_paths || []) {
      for (const nid of ep.node_ids || []) nodeSet.add(nid);
      for (const ed of ep.edges || []) {
        if (ed && ed.id && !edgeMap.has(ed.id)) {
          edgeMap.set(ed.id, ed);
        }
      }
    }

    const seq = ++this.reqSeq;
    if (this.cb.onResolveComponent) {
      this.cb.onResolveComponent({
        requestId: seq,
        componentId: comp.id,
        mode,
        moduleIds: comp.module_ids || [],
        featureIds: comp.feature_ids || [],
        nodeIds: Array.from(nodeSet),
        edgeRefs: Array.from(edgeMap.values()),
      });
    }
  }

  applyCurrentOverlay() {
    if (!this.lastResolved || !this.hashValid || !this.cb.onApplyOverlay) return;
    const msg = this.lastResolved;
    const primaryNodes = this.showCuratedLayer ? (msg.curatedNodePositions || msg.nodePositions || null) : null;
    const primaryEdges = this.showCuratedLayer ? (msg.curatedEdgePositions || msg.edgePositions || null) : null;
    const primaryLoops = this.showCuratedLayer ? (msg.curatedSelfLoopPositions || msg.selfLoopPositions || null) : null;
    const secondaryNodes = this.showMappedLayer ? (msg.allMappedNodePositions || null) : null;
    const secondaryEdges = this.showMappedLayer ? (msg.allMappedEdgePositions || null) : null;
    const secondaryLoops = this.showMappedLayer ? (msg.allMappedSelfLoopPositions || null) : null;

    this.cb.onApplyOverlay({
      nodePositions: primaryNodes,
      edgePositions: primaryEdges,
      selfLoopPositions: primaryLoops,
      secondaryNodePositions: secondaryNodes,
      secondaryEdgePositions: secondaryEdges,
      secondarySelfLoopPositions: secondaryLoops,
      theme: 'architecture',
      dimBackground: this.showCuratedLayer || this.showMappedLayer,
    });
  }

  handleResolvedComponent(msg) {
    if (!this.active || msg.requestId !== this.reqSeq) return;
    this.lastResolved = msg;
    const primaryNodes = msg.curatedNodePositions || msg.nodePositions;
    this.resolvedPositions = primaryNodes && primaryNodes.length > 0 ? primaryNodes : (msg.allMappedNodePositions || null);
    if (this.els.btnFocus) {
      this.els.btnFocus.disabled = !this.resolvedPositions;
    }
    this.applyCurrentOverlay();
    const comp = (this.data?.components || []).find((c) => c.id === msg.componentId);
    if (comp) {
      this.renderFootprintSection(comp, msg);
    }
  }

  renderFootprintSection(comp, resolved) {
    const slot = document.getElementById('arch-footprint-slot');
    if (!slot) return;
    slot.replaceChildren();

    const card = el('div', { class: 'insp-card' });
    const headRow = el('div', { class: 'section-header-row' });
    headRow.appendChild(el('h3', {}, 'Contributing KG Footprint & Ontology Classes'));
    if (resolved && this.cb.onDownloadJson) {
      const expBtn = el('button', { class: 'btn btn-xs btn-ghost', type: 'button', title: 'Export component provenance receipt as JSON' }, 'Export JSON');
      expBtn.addEventListener('click', () => {
        const payload = {
          exported_at_utc: new Date().toISOString(),
          snapshot_hash: this.manifest?.snapshot_hash || this.data?.graph_snapshot_hash || null,
          component: {
            id: comp.id,
            label: comp.label,
            stage: comp.stage,
            module_ids: comp.module_ids || [],
            derivation_step: comp.derivation_step || null,
            safety_point: comp.safety_point ?? null,
            requirements: comp.requirements || [],
          },
          footprint: {
            total_mapped_nodes: resolved.totalMappedNodes ?? 0,
            total_mapped_edges: resolved.totalMappedEdges ?? 0,
            curated_path_nodes: resolved.curatedNodeCount ?? 0,
            curated_path_edges: resolved.curatedEdgeCount ?? 0,
            mapping_basis: resolved.mappingBasis || null,
          },
          ontology_class_breakdown: (resolved.classBreakdown || []).map((c) => ({
            class_id: c.class_id,
            label: c.label,
            count: c.count,
            curated_count: c.curatedCount,
            description: c.description,
            contribution_role: c.contributionRole,
          })),
          curated_evidence_paths: comp.evidence_paths || [],
        };
        this.cb.onDownloadJson(payload, `hwm-kg-component-${comp.id}-${this.manifest?.snapshot_hash || 'receipt'}.json`);
      });
      headRow.appendChild(expBtn);
    }
    card.appendChild(headRow);

    if (!resolved) {
      card.appendChild(el('div', { class: 'hint-note' }, 'Resolving all contributing Knowledge Graph nodes, edges, and ontology classes…'));
      slot.appendChild(card);
      return;
    }

    const totalNodes = resolved.totalMappedNodes ?? resolved.curatedNodeCount ?? 0;
    const totalEdges = resolved.totalMappedEdges ?? resolved.curatedEdgeCount ?? 0;
    const curatedNodes = resolved.curatedNodeCount ?? 0;
    const curatedEdges = resolved.curatedEdgeCount ?? 0;
    const breakdown = resolved.classBreakdown || [];

    // Dual-layer metric summary
    const grid = el('div', { class: 'arch-footprint-grid' });

    const secBox = el('div', { class: 'arch-metric-box is-secondary' });
    const secLbl = el('div', { class: 'arch-metric-label' });
    secLbl.appendChild(el('span', { class: 'arch-layer-dot secondary', 'aria-hidden': 'true' }));
    secLbl.appendChild(document.createTextNode('All Contributing KG'));
    secBox.appendChild(secLbl);
    secBox.appendChild(el('div', { class: 'arch-metric-value' }, `${totalNodes.toLocaleString()} nodes`));
    secBox.appendChild(el('div', { class: 'arch-metric-sub' }, `${totalEdges.toLocaleString()} edges · ${breakdown.length} ontology classes`));
    grid.appendChild(secBox);

    const priBox = el('div', { class: 'arch-metric-box is-primary' });
    const priLbl = el('div', { class: 'arch-metric-label' });
    priLbl.appendChild(el('span', { class: 'arch-layer-dot primary', 'aria-hidden': 'true' }));
    priLbl.appendChild(document.createTextNode('Curated Paths'));
    priBox.appendChild(priLbl);
    priBox.appendChild(el('div', { class: 'arch-metric-value' }, `${curatedNodes.toLocaleString()} nodes`));
    priBox.appendChild(el('div', { class: 'arch-metric-sub' }, `${curatedEdges.toLocaleString()} edges · ${(comp.evidence_paths || []).length} evidence paths`));
    grid.appendChild(priBox);

    card.appendChild(grid);

    // Interactive 3D layer toggles
    const toggles = el('div', { class: 'arch-layer-toggles', role: 'group', 'aria-label': '3D highlight layers' });

    const lblPri = el('label', { class: 'arch-layer-toggle' });
    const chkPri = el('input', { type: 'checkbox', checked: this.showCuratedLayer });
    chkPri.addEventListener('change', () => {
      this.showCuratedLayer = chkPri.checked;
      this.applyCurrentOverlay();
    });
    lblPri.appendChild(chkPri);
    lblPri.appendChild(el('span', { class: 'arch-layer-dot primary', 'aria-hidden': 'true' }));
    lblPri.appendChild(document.createTextNode(`Curated exact evidence paths (${curatedNodes.toLocaleString()} nodes / ${curatedEdges.toLocaleString()} edges)`));
    toggles.appendChild(lblPri);

    const lblSec = el('label', { class: 'arch-layer-toggle' });
    const chkSec = el('input', { type: 'checkbox', checked: this.showMappedLayer });
    chkSec.addEventListener('change', () => {
      this.showMappedLayer = chkSec.checked;
      this.applyCurrentOverlay();
    });
    lblSec.appendChild(chkSec);
    lblSec.appendChild(el('span', { class: 'arch-layer-dot secondary', 'aria-hidden': 'true' }));
    lblSec.appendChild(document.createTextNode(`All component-mapped KG footprint (${totalNodes.toLocaleString()} nodes / ${totalEdges.toLocaleString()} edges)`));
    toggles.appendChild(lblSec);

    card.appendChild(toggles);

    // Explicit Ontology Class Breakdown
    if (breakdown.length > 0) {
      card.appendChild(
        el(
          'p',
          { class: 'hint-note', style: 'margin-top:0;' },
          'Explicit ontology categories contributing to this component, what each category represents, and how it brings evidence:'
        )
      );

      const listEl = el('div', { class: 'arch-class-list' });
      const visibleCount = this.showAllClasses ? breakdown.length : Math.min(breakdown.length, 8);

      for (const item of breakdown.slice(0, visibleCount)) {
        const clsCard = el('div', { class: 'arch-class-card' });
        const head = el('div', { class: 'arch-class-head' });

        const nameWrap = el('span', { class: 'arch-class-name' });
        nameWrap.appendChild(el('span', { class: 'color-dot', style: `background:${item.color || '#6C8EBF'}` }));
        nameWrap.appendChild(document.createTextNode(item.label || item.class_id));
        nameWrap.appendChild(el('code', {}, item.class_id));
        head.appendChild(nameWrap);

        const cntWrap = el('span', { class: 'arch-class-counts' });
        cntWrap.appendChild(el('span', { class: 'badge' }, `${(item.count || 0).toLocaleString()} mapped`));
        if (item.curatedCount > 0) {
          cntWrap.appendChild(el('span', { class: 'badge badge-present' }, `${item.curatedCount} curated`));
        }
        head.appendChild(cntWrap);
        clsCard.appendChild(head);

        const fallback = this.ontologyClasses[item.class_id] || {};
        const desc = item.description || fallback.definition || '';
        const role = item.contributionRole || fallback.contributionRole || '';
        const caution = item.cautionWhen || fallback.cautionWhen || '';

        if (desc) {
          clsCard.appendChild(el('p', { class: 'arch-class-desc' }, desc));
        }
        if (role) {
          const roleP = el('p', { class: 'arch-class-role' });
          roleP.appendChild(el('strong', {}, 'How it contributes: '));
          roleP.appendChild(document.createTextNode(role));
          clsCard.appendChild(roleP);
        }
        if (caution) {
          clsCard.appendChild(el('div', { class: 'arch-class-caution' }, `Interpretation note: ${caution}`));
        }

        if (item.sampleIds && item.sampleIds.length > 0) {
          const sampleRow = el('div', { class: 'arch-sample-row' });
          sampleRow.appendChild(el('span', { class: 'arch-sample-label' }, 'Inspect:'));
          for (const sample of item.sampleIds.slice(0, 3)) {
            const btn = el('button', {
              class: 'arch-node-pill',
              type: 'button',
              title: `${item.class_id}: ${sample.label || sample.id}`,
            }, sample.id);
            btn.addEventListener('click', () => {
              if (this.cb.onSelectNodeById) this.cb.onSelectNodeById(sample.id);
            });
            sampleRow.appendChild(btn);
          }
          clsCard.appendChild(sampleRow);
        }

        listEl.appendChild(clsCard);
      }

      card.appendChild(listEl);

      if (breakdown.length > 8) {
        const moreBtn = el('button', { class: 'btn btn-xs btn-ghost', type: 'button', style: 'margin-top:8px;' },
          this.showAllClasses ? 'Show fewer ontology classes' : `Show all ${breakdown.length} ontology classes (${breakdown.length - 8} more)`);
        moreBtn.addEventListener('click', () => {
          this.showAllClasses = !this.showAllClasses;
          this.renderFootprintSection(comp, resolved);
        });
        card.appendChild(moreBtn);
      }
    }

    slot.appendChild(card);
  }

  renderEmptyInspector() {
    const host = this.els.inspector;
    if (!host) return;
    host.replaceChildren();
    const box = el('div', { class: 'empty-inspector' });
    box.appendChild(el('h2', { class: 'arch-comp-title', style: 'margin-top:0' }, 'Architecture Evidence Explorer'));
    box.appendChild(el('p', {}, 'Hover or Tab-focus any of the 15 components on the diagram to preview its mapped Knowledge Graph nodes and edges on the 3D sphere.'));
    box.appendChild(el('p', {}, 'Click, tap, or press Enter on a component to pin its derivation equations, variable definitions, ontology class breakdown, and supporting/gap evidence paths.'));
    box.appendChild(el('p', { class: 'hint-note' }, 'Press Escape to clear a pinned component. Use Balanced Split, Focus Diagram, or Full Globe presets above to adjust workspace emphasis.'));
    host.appendChild(box);
  }

  renderComponentInspector(comp, resolved = null) {
    const host = this.els.inspector;
    if (!host) return;
    host.replaceChildren();

    const stMeta = STAGE_META[comp.stage] || STAGE_META.A;
    const header = el('div', { class: 'insp-card' });

    const badges = el('div', { class: 'badge-row' });
    badges.appendChild(el('span', { class: `badge ${stMeta.badgeCls}` }, stMeta.label));
    for (const m of comp.module_ids || []) {
      badges.appendChild(el('span', { class: 'badge badge-sci' }, m));
    }
    if (comp.derivation_step) {
      badges.appendChild(el('span', { class: 'badge' }, `Derivation ${comp.derivation_step}`));
    }
    if (comp.safety_point !== undefined && comp.safety_point !== null) {
      badges.appendChild(el('span', { class: 'badge badge-safety' }, `Safety #${comp.safety_point}`));
    }
    header.appendChild(badges);

    const headRow = el('div', { class: 'arch-comp-head-row' });
    headRow.appendChild(el('h2', { class: 'arch-comp-title' }, comp.label));
    if (this.cb.onCopyComponentLink) {
      const linkBtn = el('button', { class: 'btn btn-xs btn-ghost', type: 'button', title: 'Copy direct link to this component' }, 'Copy Link');
      linkBtn.addEventListener('click', () => this.cb.onCopyComponentLink(comp.id, linkBtn));
      headRow.appendChild(linkBtn);
    }
    header.appendChild(headRow);

    header.appendChild(el('h3', { style: 'margin-top:8px;' }, 'What It Does'));
    header.appendChild(el('p', { class: 'arch-desc' }, comp.description || ''));

    if (comp.requirements && comp.requirements.length) {
      const reqRow = el('div', { class: 'arch-req-row' });
      reqRow.appendChild(el('span', {}, 'Design requirements:'));
      for (const req of comp.requirements) {
        reqRow.appendChild(el('span', { class: 'arch-req-chip' }, req));
      }
      header.appendChild(reqRow);
    }
    host.appendChild(header);

    // Formulas / Invariants
    const formulas = this.data?.formulas || {};
    if (comp.formula_ids && comp.formula_ids.length) {
      const fCard = el('div', { class: 'insp-card' });
      const hasEq = comp.formula_ids.some((fid) => {
        const lx = formulas[fid]?.latex || '';
        return lx.includes('=') || lx.includes('\\le') || lx.includes('\\ge');
      });
      fCard.appendChild(el('h3', {}, hasEq ? 'Formula, Variables & Assumptions' : 'Interface Contract & Governance Invariant'));

      for (const fid of comp.formula_ids) {
        const f = formulas[fid];
        if (!f) continue;
        const fBox = el('div', { class: 'arch-formula-box' });
        const fHead = el('div', { class: 'arch-formula-head' });
        fHead.appendChild(el('div', { class: 'arch-formula-title' }, `${f.title}${f.section ? ` (§${f.section})` : ''}`));
        const isInvariant = f.kind === 'invariant' || /^G\(/.test((f.latex || '').trim());
        const rightGroup = el('div', { class: 'btn-row btn-row-inline' });
        rightGroup.appendChild(el('span', { class: 'arch-formula-kind' }, isInvariant ? 'Invariant' : 'Equation'));

        const symBtn = el('button', {
          class: 'btn btn-xs btn-accent',
          type: 'button',
          title: 'Open side box showing every symbol and its interpretation',
        }, 'Symbols & Meaning');
        symBtn.addEventListener('click', () => this.openSymbolDrawer(fid, f));
        rightGroup.appendChild(symBtn);

        if (f.latex && this.cb.onCopyText) {
          const copyBtn = el('button', { class: 'btn btn-xs btn-ghost', type: 'button', title: 'Copy raw LaTeX source' }, 'Copy LaTeX');
          copyBtn.addEventListener('click', () => this.cb.onCopyText(f.latex, copyBtn, 'Copied ✓', `Copied LaTeX for ${f.title}.`));
          rightGroup.appendChild(copyBtn);
        }
        fHead.appendChild(rightGroup);
        fBox.appendChild(fHead);

        const mathRow = el('div', {
          class: 'arch-formula-latex arch-formula-clickable',
          title: 'Click to open Symbols & Interpretation guide',
          role: 'button',
          tabindex: '0',
          'aria-label': `${f.title} equation — click to inspect symbol meanings`,
        });
        mathRow.appendChild(formatLatexFormula(f.latex, true));
        mathRow.addEventListener('click', () => this.openSymbolDrawer(fid, f));
        mathRow.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.openSymbolDrawer(fid, f);
          }
        });
        fBox.appendChild(mathRow);

        if (f.explanation) {
          fBox.appendChild(el('div', { class: 'arch-formula-exp' }, f.explanation));
        }
        if (f.variables && f.variables.length) {
          const dl = el('dl', { class: 'arch-var-dl' });
          for (const v of f.variables) {
            const [sym, def] = splitVariableDef(v);
            const dt = el('dt');
            dt.appendChild(formatLatexFormula(sym));
            const dd = el('dd');
            if (def && /\\[A-Za-z]+|[_^]\{?/.test(def)) {
              dd.appendChild(formatLatexFormula(def));
            } else {
              dd.textContent = def || sym;
            }
            dl.appendChild(dt);
            dl.appendChild(dd);
          }
          fBox.appendChild(dl);
        }
        if (f.assumptions) {
          fBox.appendChild(el('div', { class: 'arch-assumptions' }, `Key assumptions: ${f.assumptions}`));
        }
        fCard.appendChild(fBox);
      }
      host.appendChild(fCard);
    }

    // Contributing KG Footprint & Explicit Ontology Breakdown slot
    const footprintSlot = el('div', { id: 'arch-footprint-slot' });
    host.appendChild(footprintSlot);
    if (this.hashValid) {
      this.renderFootprintSection(comp, resolved);
    }

    // Evidence paths grouped by role
    const paths = comp.evidence_paths || [];
    const supports = paths.filter((p) => p.role === 'supports_design');
    const gaps = paths.filter((p) => p.role !== 'supports_design');

    const renderGroup = (title, list, badgeCls, roleIcon, cardCls) => {
      const sec = el('div', { class: 'insp-card' });
      sec.appendChild(el('h3', {}, `${roleIcon} ${title} (${list.length})`));
      if (list.length === 0) {
        sec.appendChild(el('div', { class: 'hint-note' }, '◈ Design requirement — no direct curated path in this category; see formulation requirements above.'));
        return sec;
      }
      const nodeIndex = this.data?.node_index || {};
      for (const ep of list) {
        const card = el('div', { class: `evidence-card ${cardCls}` });
        const top = el('div', { class: 'evidence-meta' });
        top.appendChild(el('span', { class: `badge ${badgeCls}` }, `${roleIcon} ${title === 'Supports the design' ? 'Supports Design' : 'Documents Gap'}`));
        if (ep.feature_id) top.appendChild(el('span', { class: 'badge mono-cell' }, ep.feature_id));
        if (ep.assessment_state) top.appendChild(el('span', { class: `badge badge-${ep.assessment_state}` }, ep.assessment_state));
        if (ep.evidence_stage) top.appendChild(el('span', { class: 'badge' }, ep.evidence_stage));
        card.appendChild(top);

        if (ep.contribution) {
          card.appendChild(el('div', { class: 'arch-ep-contrib' }, ep.contribution));
        }
        if (ep.rationale) {
          card.appendChild(el('div', { class: 'evidence-quote' }, ep.rationale));
        }

        // Node chain with ontology classes
        const chain = el('div', { class: 'arch-node-chain' });
        for (const nid of ep.node_ids || []) {
          const meta = nodeIndex[nid];
          const cls = meta?.class_id || 'Entity';
          const btn = el('button', { class: 'arch-node-pill', type: 'button', title: `${cls}: ${meta?.label || nid}` });
          btn.appendChild(el('span', { class: 'arch-node-cls' }, cls));
          btn.appendChild(document.createTextNode(nid));
          btn.addEventListener('click', () => {
            if (this.cb.onSelectNodeById) this.cb.onSelectNodeById(nid);
          });
          chain.appendChild(btn);
        }
        card.appendChild(chain);

        // Scope & source
        const bot = el('div', { class: 'evidence-meta' });
        if (ep.paper_id) {
          bot.appendChild(el('span', { class: 'tabular-num' }, `Paper ${ep.paper_id}${ep.page ? `, p. ${ep.page}` : ''}`));
        }
        if (ep.scope?.model_version_id) {
          bot.appendChild(el('span', { class: 'mono-cell' }, `· ${ep.scope.model_version_id}`));
        }
        if (ep.scope?.intended_use_context_id) {
          bot.appendChild(el('span', { class: 'mono-cell' }, `· ${ep.scope.intended_use_context_id}`));
        }
        if (ep.source_url) {
          bot.appendChild(el('a', { class: 'btn btn-xs btn-accent', href: ep.source_url, target: '_blank', rel: 'noopener noreferrer' }, 'Source'));
        }
        if (ep.paper_id && this.cb.onCopyCitation) {
          const citeInfo = {
            paperId: ep.paper_id,
            page: ep.page || null,
            doiOrUrl: ep.source_url || null,
          };
          const btnBib = el('button', { class: 'btn btn-xs btn-ghost', type: 'button', title: 'Copy BibTeX citation for this evidence source' }, 'BibTeX');
          btnBib.addEventListener('click', () => this.cb.onCopyCitation('bibtex', citeInfo, btnBib));
          bot.appendChild(btnBib);

          const btnApa = el('button', { class: 'btn btn-xs btn-ghost', type: 'button', title: 'Copy APA citation for this evidence source' }, 'APA');
          btnApa.addEventListener('click', () => this.cb.onCopyCitation('apa', citeInfo, btnApa));
          bot.appendChild(btnApa);
        }
        card.appendChild(bot);
        sec.appendChild(card);
      }
      return sec;
    };

    host.appendChild(renderGroup('Supports the design', supports, 'badge-present', '✓', 'evidence-support'));
    host.appendChild(renderGroup('Documents a gap', gaps, 'badge-warn', '⚠', 'evidence-gap'));
  }
}
