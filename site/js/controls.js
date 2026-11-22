/**
 * UI Controls, Filters, Search, Legend, Saved Presets, Modals, and Table Fallback.
 * Uses strictly textContent / createElement (no unsafe HTML injection).
 */

import { getClassStyle, STATE_META } from './sphere-layout.js';

const PRESETS_KEY = 'hwm_kg_3d_explorer_presets_v1';

const CORE_CLASSES = new Set([
  'PaperVersion', 'PaperRecord', 'BlueprintModule', 'FeatureDefinition',
  'CapabilityLevel', 'ReadinessFacet', 'WorldType', 'EvidenceGate',
  'ModelVersion', 'SystemComposition', 'Study', 'HumanStudy', 'MetricResult',
]);

function el(tag, attrs = {}, text = null) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('data-')) node.setAttribute(k, v);
    else node[k] = v;
  }
  if (text !== null && text !== undefined) node.textContent = String(text);
  return node;
}

export class ControlsManager {
  constructor(callbacks) {
    this.cb = callbacks || {};
    this.facets = null;
    this.checkedClasses = new Set();
    this.viewMode = 'full';
    this.hopDepth = 1;
    this.tableMode = false;
    this.tableTab = 'nodes';
    this.tablePage = 0;
    this.tableTotal = 0;
    this.tablePageSize = 50;

    this.pathA = null; // { idx, id, label }
    this.pathB = null;
    this.searchResults = [];
    this.searchActiveIdx = -1;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bindStaticElements();
    this.renderPresets();
  }

  bindStaticElements() {
    // Panel toggles
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const btnLeft = document.getElementById('btn-toggle-left');
    const btnRight = document.getElementById('btn-toggle-right');

    if (window.matchMedia('(max-width: 1100px)').matches) {
      leftPanel.classList.add('collapsed');
      rightPanel.classList.add('collapsed');
      btnLeft.setAttribute('aria-expanded', 'false');
      btnRight.setAttribute('aria-expanded', 'false');
    }
    btnLeft.addEventListener('click', () => {
      const collapsed = leftPanel.classList.toggle('collapsed');
      btnLeft.setAttribute('aria-expanded', String(!collapsed));
    });
    btnRight.addEventListener('click', () => {
      const collapsed = rightPanel.classList.toggle('collapsed');
      btnRight.setAttribute('aria-expanded', String(!collapsed));
    });

    // View mode buttons
    const modeBtns = Array.from(document.querySelectorAll('[data-view-mode]'));
    const depthRow = document.getElementById('neighborhood-depth-row');
    const hopSelect = document.getElementById('hop-depth');

    for (const btn of modeBtns) {
      btn.addEventListener('click', () => {
        this.setViewMode(btn.dataset.viewMode);
      });
    }
    hopSelect.addEventListener('change', () => {
      this.hopDepth = Number(hopSelect.value) || 1;
      this.emitFilterChange();
    });
    this._modeBtns = modeBtns;
    this._depthRow = depthRow;

    // Filter selects
    const filterIds = [
      'filter-paper', 'filter-module', 'filter-feature', 'filter-state',
      'filter-stage', 'filter-capability', 'filter-readiness', 'filter-worldtype', 'filter-predicate',
    ];
    for (const id of filterIds) {
      document.getElementById(id).addEventListener('change', () => this.emitFilterChange());
    }

    document.getElementById('btn-reset-filters').addEventListener('click', () => this.resetFilters());
    document.getElementById('btn-classes-all').addEventListener('click', () => {
      if (!this.facets) return;
      this.checkedClasses = new Set(this.facets.classes.map((c) => c.id));
      this.syncClassCheckboxes();
      this.emitFilterChange();
    });
    document.getElementById('btn-classes-core').addEventListener('click', () => {
      if (!this.facets) return;
      this.checkedClasses = new Set(this.facets.classes.map((c) => c.id).filter((id) => CORE_CLASSES.has(id)));
      this.syncClassCheckboxes();
      this.emitFilterChange();
    });

    // Display & performance controls
    document.getElementById('chk-all-edges').addEventListener('change', () => this.emitFilterChange());
    document.getElementById('chk-include-kg-edges').addEventListener('change', () => this.emitFilterChange());
    document.getElementById('chk-reduced-detail').addEventListener('change', () => this.emitFilterChange());

    const rngDensity = document.getElementById('rng-edge-density');
    const valDensity = document.getElementById('val-edge-density');
    rngDensity.addEventListener('input', () => {
      valDensity.textContent = `${rngDensity.value}%`;
    });
    rngDensity.addEventListener('change', () => this.emitFilterChange());

    const rngOpacity = document.getElementById('rng-edge-opacity');
    const valOpacity = document.getElementById('val-edge-opacity');
    rngOpacity.addEventListener('input', () => {
      valOpacity.textContent = Number(rngOpacity.value).toFixed(2);
      if (this.cb.onEdgeOpacity) this.cb.onEdgeOpacity(Number(rngOpacity.value));
    });

    const rngSize = document.getElementById('rng-node-size');
    const valSize = document.getElementById('val-node-size');
    rngSize.addEventListener('input', () => {
      valSize.textContent = `${Number(rngSize.value).toFixed(1)}×`;
      if (this.cb.onNodeSize) this.cb.onNodeSize(Number(rngSize.value));
    });

    const chkAuto = document.getElementById('chk-autorotate');
    if (this.reducedMotion) {
      chkAuto.checked = false;
      chkAuto.disabled = true;
      chkAuto.parentElement.title = 'Disabled because reduced motion is requested by your system.';
    }
    chkAuto.addEventListener('change', () => {
      if (this.cb.onAutoRotate) this.cb.onAutoRotate(chkAuto.checked);
    });

    document.getElementById('btn-clear-cache').addEventListener('click', () => {
      if (this.cb.onClearCache) this.cb.onClearCache();
    });

    // Global Search
    const searchInput = document.getElementById('global-search');
    const searchDropdown = document.getElementById('search-results');
    let searchTimer = null;

    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      if (!q) {
        searchDropdown.classList.add('hidden');
        return;
      }
      searchTimer = setTimeout(() => {
        if (this.cb.onSearch) this.cb.onSearch(q);
      }, 140);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (searchDropdown.classList.contains('hidden')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.searchActiveIdx = Math.min(this.searchResults.length - 1, this.searchActiveIdx + 1);
        this.highlightSearchItem();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.searchActiveIdx = Math.max(0, this.searchActiveIdx - 1);
        this.highlightSearchItem();
      } else if (e.key === 'Enter' && this.searchActiveIdx >= 0) {
        e.preventDefault();
        const item = this.searchResults[this.searchActiveIdx];
        if (item) this.pickSearchResult(item);
      } else if (e.key === 'Escape') {
        searchDropdown.classList.add('hidden');
      }
    });

    document.addEventListener('click', (e) => {
      if (!searchDropdown.contains(e.target) && e.target !== searchInput) {
        searchDropdown.classList.add('hidden');
      }
    });

    // Connection Path
    document.getElementById('btn-set-path-a').addEventListener('click', () => {
      if (this.cb.onSetPathSlot) this.cb.onSetPathSlot('A');
    });
    document.getElementById('btn-set-path-b').addEventListener('click', () => {
      if (this.cb.onSetPathSlot) this.cb.onSetPathSlot('B');
    });
    document.getElementById('btn-find-path').addEventListener('click', () => {
      if (this.cb.onFindPath && this.pathA && this.pathB) {
        this.cb.onFindPath(this.pathA.idx, this.pathB.idx);
      }
    });
    document.getElementById('btn-clear-path').addEventListener('click', () => {
      this.pathA = null;
      this.pathB = null;
      document.getElementById('path-node-a').textContent = 'None';
      document.getElementById('path-node-b').textContent = 'None';
      document.getElementById('path-result').classList.add('hidden');
      if (this.cb.onClearPath) this.cb.onClearPath();
    });

    // Saved Presets & Exports
    document.getElementById('btn-save-preset').addEventListener('click', () => this.saveCurrentPreset());
    document.getElementById('btn-export-png').addEventListener('click', () => this.cb.onExportPng && this.cb.onExportPng());
    document.getElementById('btn-export-json').addEventListener('click', () => this.cb.onExportJson && this.cb.onExportJson());

    // Bottom bar actions
    document.getElementById('btn-reset-camera').addEventListener('click', () => this.cb.onResetCamera && this.cb.onResetCamera());
    document.getElementById('btn-focus-selected').addEventListener('click', () => this.cb.onFocusSelected && this.cb.onFocusSelected());
    document.getElementById('btn-clear-selection').addEventListener('click', () => this.cb.onClearSelection && this.cb.onClearSelection());

    // Inspector quick actions
    document.getElementById('btn-insp-focus').addEventListener('click', () => this.cb.onFocusSelected && this.cb.onFocusSelected());
    document.getElementById('btn-insp-1hop').addEventListener('click', () => {
      this.hopDepth = 1;
      document.getElementById('hop-depth').value = '1';
      this.setViewMode('neighborhood');
    });
    document.getElementById('btn-insp-2hop').addEventListener('click', () => {
      this.hopDepth = 2;
      document.getElementById('hop-depth').value = '2';
      this.setViewMode('neighborhood');
    });
    document.getElementById('btn-insp-paper-view').addEventListener('click', () => this.setViewMode('paper'));

    // Table Mode toggle & tabs
    const btnTable = document.getElementById('btn-table-mode');
    btnTable.addEventListener('click', () => this.setTableMode(!this.tableMode));

    for (const tb of document.querySelectorAll('[data-table-tab]')) {
      tb.addEventListener('click', () => {
        this.tableTab = tb.dataset.tableTab;
        this.tablePage = 0;
        for (const x of document.querySelectorAll('[data-table-tab]')) {
          const act = x.dataset.tableTab === this.tableTab;
          x.classList.toggle('active', act);
          x.setAttribute('aria-selected', String(act));
        }
        this.requestTablePage();
      });
    }
    document.getElementById('btn-table-prev').addEventListener('click', () => {
      if (this.tablePage > 0) {
        this.tablePage--;
        this.requestTablePage();
      }
    });
    document.getElementById('btn-table-next').addEventListener('click', () => {
      if ((this.tablePage + 1) * this.tablePageSize < this.tableTotal) {
        this.tablePage++;
        this.requestTablePage();
      }
    });

    // Modals
    document.getElementById('btn-interpret').addEventListener('click', () => {
      document.getElementById('modal-interpret').classList.remove('hidden');
    });
    for (const closeEl of document.querySelectorAll('[data-close-modal]')) {
      closeEl.addEventListener('click', () => {
        const id = closeEl.dataset.closeModal;
        document.getElementById(id).classList.add('hidden');
        if (id === 'modal-pdf') {
          document.getElementById('modal-pdf-frame').src = 'about:blank';
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === '/' && !inInput) {
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === 'Escape') {
        document.getElementById('modal-interpret').classList.add('hidden');
        document.getElementById('modal-pdf').classList.add('hidden');
        searchDropdown.classList.add('hidden');
      } else if (!inInput && (e.key === 'r' || e.key === 'R')) {
        this.cb.onResetCamera && this.cb.onResetCamera();
      } else if (!inInput && (e.key === 'f' || e.key === 'F')) {
        this.cb.onFocusSelected && this.cb.onFocusSelected();
      }
    });
  }

  populateFacets(facets, manifest) {
    this.facets = facets;
    this.checkedClasses = new Set(facets.classes.map((c) => c.id));

    const fillSelect = (id, items, fmt) => {
      const sel = document.getElementById(id);
      while (sel.options.length > 1) sel.remove(1);
      for (const item of items) {
        sel.appendChild(el('option', { value: item.id }, fmt(item)));
      }
    };

    fillSelect('filter-paper', facets.papers, (p) => `${p.id} (${p.year || 'n.d.'}) — ${p.title.slice(0, 48)}`);
    fillSelect('filter-module', facets.modules, (m) => `${m.id} — ${m.label}`);
    fillSelect('filter-feature', facets.features, (f) => `${f.id} (${(f.module_ids || []).join(',')})`);
    fillSelect('filter-state', facets.states, (s) => {
      const meta = STATE_META[s.id] || { icon: '·', label: s.id };
      return `${meta.icon} ${meta.label} (${s.count.toLocaleString()})`;
    });
    fillSelect('filter-stage', facets.stages, (s) => `${s.id} (${s.count.toLocaleString()})`);
    fillSelect('filter-capability', facets.capabilities, (c) => `${c.id} — ${c.label}`);
    fillSelect('filter-readiness', facets.readiness, (r) => `${r.id} — ${r.label}`);
    fillSelect('filter-worldtype', facets.worldTypes, (w) => `${w.id} — ${w.label}`);
    fillSelect('filter-predicate', facets.predicates, (p) => `${p.isKg ? '[kg:] ' : ''}${p.id} (${p.count.toLocaleString()})`);

    // Entity class checkboxes
    const listHost = document.getElementById('class-filter-list');
    listHost.replaceChildren();
    for (const c of facets.classes) {
      const lbl = el('label', { class: 'class-check-item' });
      const chk = el('input', { type: 'checkbox', checked: true, 'data-class-id': c.id });
      chk.addEventListener('change', () => {
        if (chk.checked) this.checkedClasses.add(c.id);
        else this.checkedClasses.delete(c.id);
        this.syncLegendState();
        this.emitFilterChange();
      });
      lbl.appendChild(chk);
      lbl.appendChild(el('span', { class: 'color-dot', style: `background:${c.color}` }));
      lbl.appendChild(el('span', {}, c.id));
      lbl.appendChild(el('span', { class: 'class-count' }, c.count.toLocaleString()));
      listHost.appendChild(lbl);
    }

    // Bottom legend strip (top classes)
    const legend = document.getElementById('legend-strip');
    legend.replaceChildren();
    const legendClasses = [
      'PaperVersion', 'BlueprintModule', 'FeatureDefinition', 'ModelVersion',
      'Study', 'HumanStudy', 'MetricResult', 'EvidenceFragment', 'Assertion',
    ];
    for (const cid of legendClasses) {
      const st = getClassStyle(cid);
      const chip = el('button', { class: 'legend-chip', type: 'button', 'data-legend-class': cid, title: `Toggle ${cid}` });
      chip.appendChild(el('span', { class: 'color-dot', style: `background:${st.color}` }));
      chip.appendChild(el('span', {}, st.label));
      chip.addEventListener('click', () => {
        if (this.checkedClasses.has(cid)) this.checkedClasses.delete(cid);
        else this.checkedClasses.add(cid);
        this.syncClassCheckboxes();
        this.emitFilterChange();
      });
      legend.appendChild(chip);
    }

    // Populate reference document links inside "How to Interpret" modal
    const docList = document.getElementById('doc-links-list');
    docList.replaceChildren();
    if (manifest && manifest.files) {
      for (const relPath of Object.keys(manifest.files).sort()) {
        if (relPath.startsWith('data/documents/') || relPath.startsWith('data/audit/')) {
          const name = relPath.split('/').pop();
          docList.appendChild(el('a', { class: 'doc-chip', href: `./${relPath}`, target: '_blank', rel: 'noopener' }, name));
        }
      }
    }
  }

  syncClassCheckboxes() {
    for (const chk of document.querySelectorAll('#class-filter-list input[type="checkbox"]')) {
      chk.checked = this.checkedClasses.has(chk.dataset.classId);
    }
    this.syncLegendState();
  }

  syncLegendState() {
    for (const chip of document.querySelectorAll('[data-legend-class]')) {
      chip.classList.toggle('dimmed', !this.checkedClasses.has(chip.dataset.legendClass));
    }
  }

  setViewMode(mode) {
    this.viewMode = mode;
    for (const b of this._modeBtns) {
      b.classList.toggle('active', b.dataset.viewMode === mode);
    }
    this._depthRow.classList.toggle('hidden', mode !== 'neighborhood');
    this.emitFilterChange();
  }

  getFilterState() {
    return {
      viewMode: this.viewMode,
      hopDepth: this.hopDepth,
      filters: {
        classes: Array.from(this.checkedClasses),
        paper: document.getElementById('filter-paper').value,
        module: document.getElementById('filter-module').value,
        feature: document.getElementById('filter-feature').value,
        state: document.getElementById('filter-state').value,
        stage: document.getElementById('filter-stage').value,
        capability: document.getElementById('filter-capability').value,
        readiness: document.getElementById('filter-readiness').value,
        worldType: document.getElementById('filter-worldtype').value,
        predicate: document.getElementById('filter-predicate').value,
        showAllEdges: document.getElementById('chk-all-edges').checked,
        includeKgEdges: document.getElementById('chk-include-kg-edges').checked,
        edgeDensity: Number(document.getElementById('rng-edge-density').value) / 100,
        reducedDetail: document.getElementById('chk-reduced-detail').checked,
      },
    };
  }

  applyFilterState(saved) {
    if (!saved) return;
    if (saved.filters) {
      const f = saved.filters;
      if (Array.isArray(f.classes)) {
        this.checkedClasses = new Set(f.classes);
        this.syncClassCheckboxes();
      }
      document.getElementById('filter-paper').value = f.paper || '';
      document.getElementById('filter-module').value = f.module || '';
      document.getElementById('filter-feature').value = f.feature || '';
      document.getElementById('filter-state').value = f.state || '';
      document.getElementById('filter-stage').value = f.stage || '';
      document.getElementById('filter-capability').value = f.capability || '';
      document.getElementById('filter-readiness').value = f.readiness || '';
      document.getElementById('filter-worldtype').value = f.worldType || '';
      document.getElementById('filter-predicate').value = f.predicate || '';
      document.getElementById('chk-all-edges').checked = !!f.showAllEdges;
      document.getElementById('chk-include-kg-edges').checked = !!f.includeKgEdges;
      document.getElementById('chk-reduced-detail').checked = !!f.reducedDetail;
      if (typeof f.edgeDensity === 'number') {
        const pct = Math.round(f.edgeDensity * 100);
        document.getElementById('rng-edge-density').value = String(pct);
        document.getElementById('val-edge-density').textContent = `${pct}%`;
      }
    }
    this.hopDepth = saved.hopDepth || 1;
    document.getElementById('hop-depth').value = String(this.hopDepth);
    this.setViewMode(saved.viewMode || 'full');
  }

  resetFilters() {
    if (this.facets) {
      this.checkedClasses = new Set(this.facets.classes.map((c) => c.id));
      this.syncClassCheckboxes();
    }
    for (const id of [
      'filter-paper', 'filter-module', 'filter-feature', 'filter-state',
      'filter-stage', 'filter-capability', 'filter-readiness', 'filter-worldtype', 'filter-predicate',
    ]) {
      document.getElementById(id).value = '';
    }
    document.getElementById('chk-all-edges').checked = false;
    document.getElementById('chk-include-kg-edges').checked = false;
    document.getElementById('chk-reduced-detail').checked = false;
    document.getElementById('rng-edge-density').value = '35';
    document.getElementById('val-edge-density').textContent = '35%';
    this.setViewMode('full');
  }

  emitFilterChange() {
    if (this.cb.onFilterChange) this.cb.onFilterChange(this.getFilterState());
    if (this.tableMode) {
      this.tablePage = 0;
      this.requestTablePage();
    }
  }

  /* ---------- Search Dropdown ---------- */

  renderSearchResults(query, totalMatches, results) {
    this.searchResults = results;
    this.searchActiveIdx = results.length ? 0 : -1;
    const host = document.getElementById('search-results');
    host.replaceChildren();

    if (!query) {
      host.classList.add('hidden');
      return;
    }

    if (results.length === 0) {
      host.appendChild(el('div', { class: 'search-item' }, `No matches for "${query}" across all loaded nodes.`));
      host.classList.remove('hidden');
      return;
    }

    host.appendChild(
      el('div', { class: 'search-item', style: 'cursor:default;color:#93abc9;font-size:11px;' },
        `Showing ${results.length} of ${totalMatches.toLocaleString()} matches (including hidden nodes)`)
    );

    results.forEach((item, i) => {
      const style = getClassStyle(item.class_id);
      const row = el('div', { class: `search-item ${i === 0 ? 'active' : ''}`, role: 'option', 'data-search-idx': String(i) });
      const top = el('div', { class: 'search-item-top' });
      top.appendChild(el('span', { class: 'color-dot', style: `background:${style.color}` }));
      top.appendChild(el('span', {}, item.label));
      if (!item.isVisible) {
        top.appendChild(el('span', { class: 'hidden-tag' }, 'Hidden by filter'));
      }
      row.appendChild(top);
      row.appendChild(el('div', { class: 'search-item-sub' }, `${item.class_id} · ${item.id}${item.paperId ? ' · Paper ' + item.paperId : ''}`));
      row.addEventListener('click', () => this.pickSearchResult(item));
      host.appendChild(row);
    });

    host.classList.remove('hidden');
  }

  highlightSearchItem() {
    const rows = document.querySelectorAll('#search-results [data-search-idx]');
    rows.forEach((r) => {
      r.classList.toggle('active', Number(r.dataset.searchIdx) === this.searchActiveIdx);
    });
  }

  pickSearchResult(item) {
    document.getElementById('search-results').classList.add('hidden');
    if (this.cb.onSelectSearchResult) this.cb.onSelectSearchResult(item);
  }

  /* ---------- Path UI ---------- */

  setPathSlot(slot, nodeInfo) {
    if (slot === 'A') {
      this.pathA = nodeInfo;
      document.getElementById('path-node-a').textContent = nodeInfo ? `${nodeInfo.id}` : 'None';
    } else {
      this.pathB = nodeInfo;
      document.getElementById('path-node-b').textContent = nodeInfo ? `${nodeInfo.id}` : 'None';
    }
  }

  renderPathResult(result) {
    const box = document.getElementById('path-result');
    box.replaceChildren();
    box.classList.remove('hidden');

    if (!result.found) {
      box.appendChild(el('div', {}, result.reason || 'No path found.'));
      return;
    }

    box.appendChild(
      el('div', { style: 'font-weight:600;color:#fde68a;margin-bottom:6px;' },
        `Graph connectivity path (${result.edges.length} hop${result.edges.length === 1 ? '' : 's'}) — connectivity only, NOT causality.`)
    );

    result.steps.forEach((step, i) => {
      const row = el('div', { class: 'path-step' });
      const btn = el('button', { class: 'node-link-btn', type: 'button' }, `${i + 1}. [${step.class_id}] ${step.label}`);
      btn.addEventListener('click', () => this.cb.onSelectNode && this.cb.onSelectNode(step.idx));
      row.appendChild(btn);
      box.appendChild(row);
      if (i < result.edges.length) {
        const ed = result.edges[i];
        box.appendChild(el('div', { class: 'path-edge-label' }, `↕ ${ed.predicate_id}${ed.isKg ? ' (kg: meta)' : ''}`));
      }
    });
  }

  /* ---------- Saved Presets (localStorage) ---------- */

  loadPresets() {
    try {
      return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  saveCurrentPreset() {
    const input = document.getElementById('preset-name');
    const name = input.value.trim() || `View ${new Date().toLocaleTimeString()}`;
    const presets = this.loadPresets();
    presets.unshift({
      id: String(Date.now()),
      name,
      state: this.getFilterState(),
      camera: this.cb.getCameraState ? this.cb.getCameraState() : null,
    });
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, 15)));
    } catch {
      // Ignore storage quota errors
    }
    input.value = '';
    this.renderPresets();
  }

  renderPresets() {
    const host = document.getElementById('preset-list');
    host.replaceChildren();
    const presets = this.loadPresets();
    for (const p of presets) {
      const row = el('div', { class: 'preset-item' });
      const loadBtn = el('button', { class: 'node-link-btn', type: 'button' }, p.name);
      loadBtn.addEventListener('click', () => {
        this.applyFilterState(p.state);
        if (p.camera && this.cb.setCameraState) this.cb.setCameraState(p.camera);
      });
      const delBtn = el('button', { class: 'btn btn-xs btn-ghost', type: 'button', title: 'Delete preset' }, '✕');
      delBtn.addEventListener('click', () => {
        const next = this.loadPresets().filter((x) => x.id !== p.id);
        localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
        this.renderPresets();
      });
      row.appendChild(loadBtn);
      row.appendChild(delBtn);
      host.appendChild(row);
    }
  }

  /* ---------- Embedded PDF Modal ---------- */

  openPdfModal(paperId, pageNum, manifest) {
    const pdfInfo = manifest?.pdfs?.[paperId];
    const modal = document.getElementById('modal-pdf');
    const title = document.getElementById('modal-pdf-title');
    const sub = document.getElementById('modal-pdf-subtitle');
    const notice = document.getElementById('modal-pdf-notice');
    const frame = document.getElementById('modal-pdf-frame');
    const newTab = document.getElementById('modal-pdf-newtab');

    const source = manifest?.paper_links?.[paperId];
    title.textContent = `Paper ${paperId} — ${source?.kind === 'title_search' ? 'Find Paper' : 'Original Source'}`;
    sub.textContent = `Evidence refers to the reviewed PDF${pageNum ? `, physical page ${pageNum}` : ''}.`;
    newTab.href = source?.url || '#';
    newTab.textContent = source?.kind === 'title_search' ? 'Search Paper Title' : 'Open DOI / Source';
    newTab.rel = 'noopener noreferrer';
    newTab.classList.toggle('hidden', !source?.url);
    notice.textContent = (source?.kind === 'title_search'
      ? 'No direct source link was recorded. This searches the exact paper title; confirm the version before using it.'
      : 'Full papers are linked externally and are not redistributed here. Publisher access and page numbering may differ from the reviewed PDF.')
      + (paperId === 'A20' ? ' Archimedes was reviewed as an image-only scan; recorded visual paraphrases are not literal quotations.' : '');
    notice.classList.remove('hidden');
    frame.src = 'about:blank';
    frame.hidden = true;
    modal.classList.remove('hidden');
  }

  /* ---------- Table Fallback View ---------- */

  setTableMode(enabled, reason = null) {
    this.tableMode = enabled;
    document.getElementById('table-view').classList.toggle('hidden', !enabled);
    document.getElementById('canvas-host').classList.toggle('hidden', enabled);
    document.getElementById('btn-table-mode').textContent = enabled ? '3D Sphere View' : 'Table View';
    if (reason) {
      document.getElementById('table-status').textContent = reason;
    }
    if (enabled) {
      this.tablePage = 0;
      this.requestTablePage();
    }
  }

  requestTablePage() {
    if (this.cb.onRequestTablePage) {
      this.cb.onRequestTablePage(this.tableTab, this.tablePage, this.tablePageSize);
    }
  }

  renderTablePage(data) {
    this.tableTotal = data.total;
    const head = document.getElementById('table-head');
    const body = document.getElementById('table-body');
    head.replaceChildren();
    body.replaceChildren();

    const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
    document.getElementById('table-page-info').textContent = `Page ${data.page + 1} / ${totalPages} (${data.total.toLocaleString()} rows)`;

    const trH = el('tr');
    if (data.tab === 'papers') {
      for (const h of ['Paper ID', 'Year', 'Title', 'Status', 'Pages']) trH.appendChild(el('th', {}, h));
      head.appendChild(trH);
      for (const r of data.rows) {
        const tr = el('tr');
        tr.appendChild(el('td', {}, r.paper_record_id));
        tr.appendChild(el('td', {}, r.year || '—'));
        tr.appendChild(el('td', {}, r.title || '—'));
        tr.appendChild(el('td', {}, r.completion_state || '—'));
        tr.appendChild(el('td', {}, r.pdf_pages ?? '—'));
        tr.addEventListener('click', () => {
          if (r.idx >= 0 && this.cb.onSelectNode) this.cb.onSelectNode(r.idx);
        });
        body.appendChild(tr);
      }
    } else if (data.tab === 'edges') {
      for (const h of ['Predicate', 'Type', 'Subject', 'Object', 'Source']) trH.appendChild(el('th', {}, h));
      head.appendChild(trH);
      for (const r of data.rows) {
        const tr = el('tr');
        tr.appendChild(el('td', {}, r.predicate_id));
        tr.appendChild(el('td', {}, r.isKg ? 'kg: meta' : 'Scientific'));
        tr.appendChild(el('td', {}, r.subject_id));
        tr.appendChild(el('td', {}, r.object_id));
        tr.appendChild(el('td', {}, r.source_annotation || 'Ontology'));
        tr.addEventListener('click', () => {
          if (this.cb.onSelectEdge) this.cb.onSelectEdge(r.edgeIdx);
        });
        body.appendChild(tr);
      }
    } else {
      for (const h of ['Class', 'Label', 'ID', 'Paper', 'State', 'Stage']) trH.appendChild(el('th', {}, h));
      head.appendChild(trH);
      for (const r of data.rows) {
        const tr = el('tr');
        tr.appendChild(el('td', {}, r.class_id));
        tr.appendChild(el('td', {}, r.label));
        tr.appendChild(el('td', {}, r.id));
        tr.appendChild(el('td', {}, r.paperId));
        tr.appendChild(el('td', {}, r.state));
        tr.appendChild(el('td', {}, r.stage));
        tr.addEventListener('click', () => {
          if (this.cb.onSelectNode) this.cb.onSelectNode(r.idx);
        });
        body.appendChild(tr);
      }
    }
  }
}
