/**
 * Main application coordinator for Healthcare World Model KG — Interactive 3D Sphere Explorer.
 */

import { SphereRenderer } from './renderer.js';
import { Inspector } from './inspector.js';
import { ControlsManager } from './controls.js';
import { ArchitectureView } from './architecture-view.js';
import { CoverageTour } from './coverage-tour.js';

const THEME_STORAGE_KEY = 'hwm_kg_theme_v1';

class KGExplorerApp {
  constructor() {
    this.worker = null;
    this.renderer = null;
    this.webglReady = false;
    this.manifest = null;

    this.selectedIdx = -1;
    this.selectedEdgeId = null;
    this.selectedNodeSummary = null;
    this.paperMetaById = new Map();
    this._pendingEdgeLookupId = null;
    this.hoveredLabelText = '';
    this.selectedLabelText = '';
    this.activePathNodes = [];
    this.reqCounter = 0;
    this.overlayReqCounter = 0;
    this.explainReqSeq = 0;
    this.workspaceTab = 'graph';
    this.theme = this.loadSavedTheme();
    this.zenMode = false;
    this._preZenPanels = null;

    this.els = {
      overlay: document.getElementById('state-overlay'),
      spinner: document.getElementById('state-spinner'),
      stateTitle: document.getElementById('state-title'),
      stateMsg: document.getElementById('state-message'),
      stateProgress: document.getElementById('state-progress'),
      stateActions: document.getElementById('state-actions'),
      loadingPill: document.getElementById('loading-pill'),
      snapshotMeta: document.getElementById('snapshot-meta'),
      headerCounts: document.getElementById('header-counts'),
      visibleCounts: document.getElementById('visible-counts'),
      hoverLabel: document.getElementById('hover-label'),
      selectedLabel: document.getElementById('selected-label'),
      a11yStatus: document.getElementById('a11y-status'),
      btnTheme: document.getElementById('btn-theme-toggle'),
      themeIcon: document.getElementById('theme-icon'),
      themeLabel: document.getElementById('theme-label'),
      btnZen: document.getElementById('btn-zen-globe'),
      btnResetLayout: document.getElementById('btn-reset-layout'),
      btnCopyPermalink: document.getElementById('btn-copy-permalink'),
      zenRestoreBar: document.getElementById('zen-restore-bar'),
      zenContextChip: document.getElementById('zen-context-chip'),
      btnZenExit: document.getElementById('btn-zen-exit'),
      btnZenReset: document.getElementById('btn-zen-reset'),
    };

    this.applyTheme(this.theme, false);

    this.inspector = new Inspector({
      onSelectNode: (idx) => this.selectNode(idx, true),
      onSelectNodeById: (id) => this.selectNodeById(id),
      onSelectEdge: (edgeIdx) => this.selectEdge(edgeIdx),
      onOpenPdf: (paperId, pageNum) => this.controls.openPdfModal(paperId, pageNum, this.manifest),
      onCopyCitation: (fmt, info, btn) => this.copyCitation(fmt, info, btn),
      onCopyPermalink: (btn) => {
        const url = this.buildPermalink();
        this.copyTextWithFeedback(url, btn, 'Copied ✓', 'Shareable link copied to clipboard.');
      },
      onFocusPositions: (positions) => {
        if (this.webglReady) this.renderer.focusOnPositions(positions);
      },
      onBackToComponent: () => this.showArchEvidenceInspector(),
      onJumpToComponent: (compId) => {
        if (this.workspaceTab !== 'architecture') this.setWorkspaceTab('architecture');
        this.showArchEvidenceInspector();
        this.archView.pinComponentWhenReady(compId);
      },
    });

    this.controls = new ControlsManager({
      onFilterChange: (state) => this.applyFilters(state),
      onSearch: (q) => this.worker && this.worker.postMessage({ type: 'search', query: q, limit: 40 }),
      onSelectSearchResult: (item) => {
        if (item.kind === 'edge') {
          this.selectEdge(item.edgeIdx, true);
        } else {
          this.selectNode(item.idx, true);
          if (!item.isVisible) {
            this.applyFilters(this.controls.getFilterState());
          }
        }
      },
      onSelectNode: (idx) => this.selectNode(idx, true),
      onSelectEdge: (edgeIdx) => this.selectEdge(edgeIdx),
      onEdgeOpacity: (v) => this.renderer && this.renderer.setEdgeOpacity(v),
      onNodeSize: (v) => this.renderer && this.renderer.setNodeSizeScale(v),
      onAutoRotate: (v) => this.renderer && this.renderer.setAutoRotate(v),
      onClearCache: () => this.worker && this.worker.postMessage({ type: 'clearCache' }),
      onResetCamera: () => this.renderer && this.renderer.resetCamera(),
      onFocusSelected: () => {
        if (this.renderer && this.selectedIdx >= 0) this.renderer.focusOnNode(this.selectedIdx);
      },
      onClearSelection: () => this.clearSelection(),
      onSetPathSlot: (slot) => {
        if (this.selectedNodeSummary) {
          this.controls.setPathSlot(slot, this.selectedNodeSummary);
        }
      },
      onFindPath: (a, b) => this.worker && this.worker.postMessage({ type: 'findPath', startIdx: a, endIdx: b }),
      onClearPath: () => {
        this.activePathNodes = [];
        if (this.renderer) this.renderer.setSelectionHighlight(this.selectedIdx, [], []);
      },
      onExportPng: () => this.exportPng(),
      onExportJson: () => this.worker && this.worker.postMessage({ type: 'exportSubgraph', selectedIdx: this.selectedIdx }),
      getCameraState: () => (this.renderer ? this.renderer.getCameraState() : null),
      setCameraState: (s) => this.renderer && this.renderer.setCameraState(s),
      onRequestTablePage: (tab, page, pageSize) => {
        if (this.worker) this.worker.postMessage({ type: 'getTablePage', tab, page, pageSize });
      },
      onPanelToggle: () => {
        if (this.zenMode) this.setZenMode(false);
        this.scheduleRendererResize();
      },
      onPanelResizeEnd: () => {
        if (this.renderer && this.webglReady) this.renderer.resize();
      },
      onToggleZen: () => this.setZenMode(!this.zenMode),
    });

    this.archView = new ArchitectureView({
      onResolveComponent: (payload) => {
        if (this.worker) this.worker.postMessage({ type: 'resolveArchitecture', ...payload });
      },
      onApplyOverlay: (overlay) => {
        if (!this.webglReady) return false;
        this.renderer.setOverlay(overlay);
        return true;
      },
      onClearOverlay: () => {
        if (this.webglReady) this.renderer.clearOverlay();
      },
      onFocusPositions: (positions) => {
        if (this.webglReady) this.renderer.focusOnPositions(positions);
      },
      onSelectNodeById: (id) => {
        this.showEntityInspectorInArch();
        this.selectNodeById(id);
      },
      onShowInGraph: () => {
        const canvas = document.getElementById('canvas-host');
        if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
      onLayoutResize: () => this.scheduleRendererResize(),
      onRequestFullGlobe: (enabled) => this.setZenMode(enabled),
      onAnnounce: (msg) => this.announce(msg),
      onCopyText: (text, btn, okLbl, msg) => this.copyTextWithFeedback(text, btn, okLbl, msg),
      onCopyCitation: (fmt, info, btn) => this.copyCitation(fmt, info, btn),
      onOpenModal: (id, trigger) => this.controls.openModal(id, trigger),
      onDownloadJson: (obj, filename) => this.downloadJson(obj, filename),
      onCopyComponentLink: (compId, btn) => {
        const params = new URLSearchParams({ tab: 'architecture', comp: compId });
        const url = `${window.location.origin}${window.location.pathname}#${params.toString()}`;
        this.copyTextWithFeedback(url, btn, 'Copied ✓', `Copied link to component ${compId}.`);
      },
      onComponentPinned: (comp) => {
        if (comp && this.workspaceTab === 'architecture') {
          this.showArchEvidenceInspector(false);
        }
        if (comp && window.matchMedia('(max-width: 1100px)').matches) {
          this.setPanelCollapsed('left', true);
          this.setPanelCollapsed('right', false);
        }
        if (this.zenMode && this.els.zenContextChip) {
          if (comp) {
            this.els.zenContextChip.textContent = `Pinned: ${comp.label}`;
            this.els.zenContextChip.classList.remove('hidden');
          } else {
            this.els.zenContextChip.classList.add('hidden');
          }
        }
      },
    });

    this.tour = new CoverageTour({
      onRequestBatch: (payload) => {
        if (this.worker) this.worker.postMessage({ type: 'getCoverageBatch', ...payload });
      },
      onRequestFullStats: () => {
        if (this.worker) this.worker.postMessage({ type: 'getFullCoverageStats' });
      },
      onRequestAllCoverage: (payload) => {
        if (this.worker) this.worker.postMessage({ type: 'getAllCoverageGeometry', ...payload });
      },
      onApplyOverlay: (overlay) => {
        if (!this.webglReady) return false;
        this.renderer.setOverlay(overlay);
        return true;
      },
      onClearOverlay: () => {
        if (this.webglReady) this.renderer.clearOverlay();
      },
      onFocusPositions: (positions) => {
        if (this.webglReady) this.renderer.focusOnPositions(positions);
      },
      onSelectNode: (idx) => this.selectNode(idx, true),
      onSelectEdge: (edgeIdx) => this.selectEdge(edgeIdx, true),
      onDownloadJson: (obj, filename) => this.downloadJson(obj, filename),
      onAnnounce: (msg) => this.announce(msg),
    });

    this.bindWorkspaceTabs();
    this.bindGlobalToolbar();
  }

  announce(message) {
    if (!this.els.a11yStatus || !message) return;
    this.els.a11yStatus.textContent = '';
    requestAnimationFrame(() => {
      if (this.els.a11yStatus) this.els.a11yStatus.textContent = message;
    });
  }

  loadSavedTheme() {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // Ignore storage errors
    }
    return 'light'; // Default Academic Light theme per publication spec
  }

  applyTheme(theme, announceChange = true) {
    this.theme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, this.theme);
    } catch {
      // Ignore storage errors
    }
    const isDark = this.theme === 'dark';
    if (this.els.btnTheme) {
      this.els.btnTheme.setAttribute('aria-pressed', String(isDark));
    }
    if (this.els.themeIcon) {
      this.els.themeIcon.textContent = isDark ? '☀' : '☾';
    }
    if (this.els.themeLabel) {
      this.els.themeLabel.textContent = isDark ? 'Academic Light' : 'Dark Lab';
    }
    if (this.renderer && this.webglReady) {
      this.renderer.setTheme(this.theme);
    }
    if (announceChange) {
      this.announce(isDark ? 'Switched to Dark Lab theme.' : 'Switched to Academic Light theme.');
    }
  }

  scheduleRendererResize() {
    if (!this.renderer || !this.webglReady) return;
    this.renderer.resize();
    requestAnimationFrame(() => this.renderer && this.renderer.resize());
    setTimeout(() => this.renderer && this.renderer.resize(), 220);
  }

  setPanelCollapsed(side, collapsed) {
    const panel = document.getElementById(side === 'left' ? 'left-panel' : 'right-panel');
    const btn = document.getElementById(side === 'left' ? 'btn-toggle-left' : 'btn-toggle-right');
    if (panel) panel.classList.toggle('collapsed', collapsed);
    if (btn) btn.setAttribute('aria-expanded', String(!collapsed));
  }

  setZenMode(enabled) {
    const next = !!enabled;
    if (this.zenMode === next) return;
    this.zenMode = next;

    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const archPane = document.getElementById('arch-pane');
    const archSplitter = document.getElementById('arch-splitter');
    const tourPane = document.getElementById('tour-pane');

    if (next) {
      this._preZenPanels = {
        leftCollapsed: leftPanel ? leftPanel.classList.contains('collapsed') : false,
        rightCollapsed: rightPanel ? rightPanel.classList.contains('collapsed') : false,
      };
      this.setPanelCollapsed('left', true);
      this.setPanelCollapsed('right', true);
      if (archPane) archPane.classList.add('hidden');
      if (archSplitter) archSplitter.classList.add('hidden');
      if (tourPane) tourPane.classList.add('hidden');
      if (this.els.zenRestoreBar) this.els.zenRestoreBar.classList.remove('hidden');
      if (this.els.zenContextChip) {
        if (this.workspaceTab === 'architecture' && this.archView?.pinnedId) {
          const comp = this.archView.data?.components?.find((c) => c.id === this.archView.pinnedId);
          this.els.zenContextChip.textContent = `Pinned: ${comp?.label || this.archView.pinnedId}`;
          this.els.zenContextChip.classList.remove('hidden');
        } else {
          this.els.zenContextChip.classList.add('hidden');
        }
      }
      this.announce('Full Globe mode enabled. All panels collapsed.');
    } else {
      const prev = this._preZenPanels || { leftCollapsed: false, rightCollapsed: false };
      this.setPanelCollapsed('left', prev.leftCollapsed);
      this.setPanelCollapsed('right', prev.rightCollapsed);
      if (this.workspaceTab === 'architecture') {
        if (archPane) archPane.classList.remove('hidden');
        if (archSplitter) archSplitter.classList.remove('hidden');
        if (this.archView.layoutPreset === 'globe') {
          this.archView.layoutPreset = 'split';
          for (const b of this.archView.els.presetBtns) {
            const act = b.dataset.archLayout === 'split';
            b.classList.toggle('active', act);
            b.setAttribute('aria-pressed', String(act));
          }
        }
      }
      if (this.workspaceTab === 'tour' && tourPane) tourPane.classList.remove('hidden');
      if (this.els.zenRestoreBar) this.els.zenRestoreBar.classList.add('hidden');
      this.announce('Panels restored.');
    }

    if (this.els.btnZen) {
      this.els.btnZen.setAttribute('aria-pressed', String(next));
    }
    this.scheduleRendererResize();
  }

  resetLayout() {
    this.zenMode = false;
    if (this.els.btnZen) this.els.btnZen.setAttribute('aria-pressed', 'false');
    if (this.els.zenRestoreBar) this.els.zenRestoreBar.classList.add('hidden');

    const isMobile = window.matchMedia('(max-width: 1100px)').matches;
    if (isMobile) {
      this.setPanelCollapsed('left', true);
      this.setPanelCollapsed('right', true);
    } else if (this.workspaceTab === 'architecture') {
      this.setPanelCollapsed('left', true);
      this.setPanelCollapsed('right', false);
    } else {
      this.setPanelCollapsed('left', false);
      this.setPanelCollapsed('right', false);
    }

    const archPane = document.getElementById('arch-pane');
    const archSplitter = document.getElementById('arch-splitter');
    const tourPane = document.getElementById('tour-pane');
    if (archPane) archPane.classList.toggle('hidden', this.workspaceTab !== 'architecture');
    if (archSplitter) archSplitter.classList.toggle('hidden', this.workspaceTab !== 'architecture');
    if (tourPane) tourPane.classList.toggle('hidden', this.workspaceTab !== 'tour');
    if (this.workspaceTab === 'architecture') {
      this.archView.resetLayout();
    }

    if (this.controls.tableMode && this.webglReady) {
      this.controls.setTableMode(false);
    }
    if (this.renderer && this.webglReady) {
      this.renderer.resetCamera();
    }
    this.scheduleRendererResize();
    this.announce('Layout and camera reset to defaults.');
  }

  buildPermalink() {
    const params = new URLSearchParams();
    params.set('tab', this.workspaceTab);
    if (this.workspaceTab === 'architecture' && this.archView?.pinnedId) {
      params.set('comp', this.archView.pinnedId);
    } else if (this.workspaceTab === 'tour' && this.tour) {
      params.set('phase', this.tour.phase);
      params.set('batch', String(this.tour.batchIndex + 1));
    } else if (this.selectedNodeSummary?.id) {
      params.set('node', this.selectedNodeSummary.id);
    } else if (this.selectedEdgeId) {
      params.set('edge', this.selectedEdgeId);
    }
    return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
  }

  async copyTextWithFeedback(text, btnEl, successLabel = 'Copied ✓', announceMsg = 'Copied to clipboard.') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    this.announce(announceMsg);
    if (btnEl) {
      const orig = btnEl.textContent;
      btnEl.textContent = successLabel;
      setTimeout(() => {
        btnEl.textContent = orig;
      }, 1600);
    }
  }

  formatCitation(format, info = {}) {
    const pid = info.paperId || 'unknown';
    const meta = this.paperMetaById.get(pid) || {};
    const linkMeta = this.manifest?.paper_links?.[pid] || {};
    const title = info.title || meta.title || `Healthcare World Model Survey Paper ${pid}`;
    const year = info.year || meta.year || 'n.d.';
    const url = info.doiOrUrl || linkMeta.url || '';
    const pageStr = info.page ? `Reviewed PDF p. ${info.page}` : '';
    const snap = this.manifest?.snapshot_hash ? `KG Snapshot #${this.manifest.snapshot_hash}` : '';

    if (format === 'apa') {
      const parts = [`${title} (${year}).`];
      const tag = [`Healthcare World Model KG Paper ${pid}`, pageStr].filter(Boolean).join(', ');
      parts.push(`[${tag}].`);
      if (url) parts.push(url);
      return parts.join(' ');
    }

    const key = `hwm_${String(pid).replace(/[^A-Za-z0-9]/g, '')}_${String(year).replace(/[^0-9]/g, '') || 'nd'}`;
    const noteParts = [`Healthcare World Model KG Paper ${pid}`, pageStr, snap].filter(Boolean);
    const lines = [
      `@article{${key},`,
      `  title = {${title}},`,
      `  year = {${year}},`,
    ];
    if (url) lines.push(`  url = {${url}},`);
    lines.push(`  note = {${noteParts.join('; ')}}`);
    lines.push('}');
    return lines.join('\n');
  }

  copyCitation(format, info, btnEl) {
    const text = this.formatCitation(format, info);
    const label = format === 'apa' ? 'APA Copied ✓' : 'BibTeX Copied ✓';
    this.copyTextWithFeedback(text, btnEl, label, `Copied ${format.toUpperCase()} citation for paper ${info.paperId || ''}.`);
  }

  restoreStateFromHash() {
    const raw = (window.location.hash || '').replace(/^#/, '');
    if (!raw) return;
    const params = new URLSearchParams(raw);
    const tab = params.get('tab');
    const comp = params.get('comp');
    const nodeId = params.get('node');
    const edgeId = params.get('edge');
    const phase = params.get('phase');
    const batch = params.get('batch');

    if (tab === 'architecture' || comp) {
      this.setWorkspaceTab('architecture');
      if (comp) this.archView.pinComponentWhenReady(comp);
    } else if (tab === 'tour') {
      if (phase || batch) this.tour.jumpTo(phase || 'nodes', Number(batch) || 1);
      this.setWorkspaceTab('tour');
    } else if (tab === 'graph') {
      this.setWorkspaceTab('graph');
    }

    if (nodeId) {
      this.selectNodeById(nodeId);
    } else if (edgeId && this.worker) {
      this._pendingEdgeLookupId = edgeId;
      this.worker.postMessage({ type: 'search', query: edgeId, limit: 10 });
    }
  }

  bindGlobalToolbar() {
    if (this.els.btnTheme) {
      this.els.btnTheme.addEventListener('click', () => {
        this.applyTheme(this.theme === 'dark' ? 'light' : 'dark', true);
      });
    }
    if (this.els.btnZen) {
      this.els.btnZen.addEventListener('click', () => this.setZenMode(!this.zenMode));
    }
    if (this.els.btnZenExit) {
      this.els.btnZenExit.addEventListener('click', () => this.setZenMode(false));
    }
    if (this.els.btnResetLayout) {
      this.els.btnResetLayout.addEventListener('click', () => this.resetLayout());
    }
    if (this.els.btnZenReset) {
      this.els.btnZenReset.addEventListener('click', () => this.resetLayout());
    }
    if (this.els.btnCopyPermalink) {
      this.els.btnCopyPermalink.addEventListener('click', () => {
        const url = this.buildPermalink();
        this.copyTextWithFeedback(url, this.els.btnCopyPermalink, 'Link Copied ✓', 'Shareable link copied to clipboard.');
      });
    }
    const inspPermalink = document.getElementById('btn-insp-permalink');
    if (inspPermalink) {
      inspPermalink.addEventListener('click', () => {
        const url = this.buildPermalink();
        this.copyTextWithFeedback(url, inspPermalink, 'Copied ✓', 'Shareable entity link copied to clipboard.');
      });
    }
    window.addEventListener('hashchange', () => {
      if (this.manifest) this.restoreStateFromHash();
    });
  }

  bindWorkspaceTabs() {
    const tabs = Array.from(document.querySelectorAll('[data-workspace-tab]'));
    for (const btn of tabs) {
      btn.addEventListener('click', () => this.setWorkspaceTab(btn.dataset.workspaceTab));
    }
    const backBtn = document.getElementById('btn-arch-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showArchEvidenceInspector());
    }
  }

  showArchEvidenceInspector(restoreOverlay = true) {
    this.explainReqSeq++;
    this.inspector.setArchContext(null);
    document.getElementById('inspector-header')?.classList.add('hidden');
    document.getElementById('inspector-tabs')?.classList.add('hidden');
    document.getElementById('inspector-body')?.classList.add('hidden');
    document.getElementById('arch-inspector-bar')?.classList.add('hidden');
    document.getElementById('btn-arch-back')?.classList.add('hidden');
    document.getElementById('arch-inspector')?.classList.remove('hidden');
    if (restoreOverlay && this.archView?.active) {
      this.archView.applyCurrentOverlay();
    }
  }

  showEntityInspectorInArch() {
    if (this.workspaceTab !== 'architecture') return;
    document.getElementById('arch-inspector')?.classList.add('hidden');
    document.getElementById('arch-inspector-bar')?.classList.remove('hidden');
    document.getElementById('btn-arch-back')?.classList.remove('hidden');
    document.getElementById('inspector-header')?.classList.remove('hidden');
    document.getElementById('inspector-tabs')?.classList.remove('hidden');
    document.getElementById('inspector-body')?.classList.remove('hidden');
  }

  setWorkspaceTab(tab) {
    if (this.workspaceTab === tab) return;
    if (this.zenMode) this.setZenMode(false);
    if (this.workspaceTab === 'architecture') this.archView.close();
    if (this.workspaceTab === 'tour') this.tour.close();

    this.workspaceTab = tab;
    document.getElementById('app')?.classList.toggle('mode-architecture', tab === 'architecture');

    for (const b of document.querySelectorAll('[data-workspace-tab]')) {
      const act = b.dataset.workspaceTab === tab;
      b.classList.toggle('active', act);
      b.setAttribute('aria-selected', String(act));
    }

    const isMobile = window.matchMedia('(max-width: 1100px)').matches;
    if (tab === 'architecture') {
      if (isMobile) {
        this.setPanelCollapsed('left', true);
        this.setPanelCollapsed('right', true);
      } else {
        this.setPanelCollapsed('left', true);
        this.setPanelCollapsed('right', false);
      }
      this.showArchEvidenceInspector();
      this.archView.open();
    } else {
      if (isMobile) {
        this.setPanelCollapsed('left', true);
        this.setPanelCollapsed('right', true);
      } else {
        this.setPanelCollapsed('left', tab === 'tour' && window.innerWidth < 1280);
        this.setPanelCollapsed('right', false);
      }
      document.getElementById('arch-inspector-bar')?.classList.add('hidden');
      document.getElementById('arch-inspector')?.classList.add('hidden');
      document.getElementById('btn-arch-back')?.classList.add('hidden');
      document.getElementById('inspector-header')?.classList.remove('hidden');
      document.getElementById('inspector-tabs')?.classList.remove('hidden');
      document.getElementById('inspector-body')?.classList.remove('hidden');
      if (tab === 'tour') {
        this.tour.open();
      }
    }
    this.scheduleRendererResize();
  }

  start() {
    if (window.location.protocol === 'file:') {
      this.showError(
        'Local HTTP Server Required',
        'Please launch the viewer via Start_Viewer.bat (http://127.0.0.1:8765/) rather than opening index.html directly via file://.'
      );
      return;
    }

    const canvas = document.getElementById('sphere-canvas');
    this.renderer = new SphereRenderer(canvas, {
      onSelectNode: (idx) => this.selectNode(idx, false),
      onSelectEdge: (edgeIdx) => this.selectEdge(edgeIdx),
      onHoverNode: (idx) => {
        if (idx >= 0 && this.worker) {
          this.worker.postMessage({ type: 'getLabel', kind: 'hover', idx });
        } else {
          this.hoveredLabelText = '';
          this.els.hoverLabel.classList.add('hidden');
        }
      },
      onProjectLabels: (hIdx, hPos, sIdx, sPos) => this.positionLabels(hIdx, hPos, sIdx, sPos),
    });

    this.webglReady = this.renderer.init();
    if (this.webglReady) {
      this.renderer.setTheme(this.theme);
    } else {
      this.controls.setTableMode(true, 'WebGL unavailable — showing searchable table fallback.');
    }

    this.initWorker();
  }

  initWorker() {
    this.worker = new Worker('./js/graph-worker.js?v=academic3', { type: 'module' });
    this.worker.onmessage = (ev) => this.handleWorkerMessage(ev.data);
    this.worker.onerror = (err) => {
      this.showError('Graph Worker Error', err.message || 'Failed to start graph indexing worker.');
    };
    this.worker.postMessage({ type: 'init' });
  }

  handleWorkerMessage(msg) {
    if (msg.type === 'progress') {
      this.els.stateProgress.style.width = `${msg.pct}%`;
      this.els.stateMsg.textContent = msg.message;
      this.els.loadingPill.textContent = `${msg.pct}% · ${msg.message}`;
      return;
    }

    if (msg.type === 'error') {
      this.showError('Snapshot Load Error', msg.message);
      return;
    }

    if (msg.type === 'ready') {
      this.manifest = msg.manifest;
      this.paperMetaById = new Map();
      for (const p of msg.facets?.papers || []) {
        this.paperMetaById.set(p.id, p);
      }
      this.inspector.setManifest(this.manifest);
      this.controls.populateFacets(msg.facets, this.manifest);
      this.archView.setManifest(this.manifest);
      this.archView.setOntologyClasses(msg.ontologyClasses || {});
      this.tour.configure({
        snapshotHash: this.manifest.snapshot_hash,
        totalNodes: msg.totalNodes,
        totalEdges: msg.totalEdges,
        webglReady: this.webglReady,
      });

      const snapDate = (this.manifest.snapshot_time_utc || '').replace('T', ' ').replace('Z', ' UTC');
      this.els.snapshotMeta.textContent = `#${(this.manifest.snapshot_hash || '').slice(0, 12)}`;
      this.els.snapshotMeta.title = `Snapshot ${snapDate} · #${this.manifest.snapshot_hash}`;
      this.els.headerCounts.textContent =
        `${this.manifest.counts.paper_versions} papers · ${msg.totalNodes.toLocaleString()} nodes · ${msg.totalEdges.toLocaleString()} edges`;
      this.els.loadingPill.textContent = 'Ready';
      this.els.loadingPill.className = 'status-pill status-ready';

      if (this.webglReady) {
        this.renderer.setGraphData(msg.positions, msg.colors, msg.sizes);
      }

      this.els.overlay.classList.add('hidden');
      this.applyFilters(this.controls.getFilterState());
      this.restoreStateFromHash();
      return;
    }

    if (msg.type === 'filtered') {
      this.els.visibleCounts.textContent =
        `Visible: ${msg.visibleNodes.toLocaleString()} / ${msg.totalNodes.toLocaleString()} nodes · ${msg.visibleEdges.toLocaleString()} / ${msg.totalEdges.toLocaleString()} edges`;

      if (this.webglReady) {
        if (msg.positions) this.renderer.updatePositions(msg.positions);
        this.renderer.updateVisibilityAndEdges(msg.nodeVis, msg.edgePositions, msg.edgeColors, msg.edgeIndices);
      }

      // Show explicit empty state overlay if filters match 0 nodes
      if (msg.visibleNodes === 0) {
        this.showEmptyFilterState();
      } else if (!this.els.overlay.classList.contains('hidden')) {
        this.els.overlay.classList.add('hidden');
      }

      if (this.controls.tableMode) {
        this.controls.requestTablePage();
      }
      return;
    }

    if (msg.type === 'searchResults') {
      if (this._pendingEdgeLookupId && msg.query === this._pendingEdgeLookupId) {
        const targetId = this._pendingEdgeLookupId;
        this._pendingEdgeLookupId = null;
        const match = (msg.results || []).find((r) => r.kind === 'edge' && r.id === targetId);
        if (match) this.selectEdge(match.edgeIdx, true);
        return;
      }
      this.controls.renderSearchResults(msg.query, msg.totalMatches || 0, msg.results || []);
      return;
    }

    if (msg.type === 'nodeDetails') {
      if (!msg.details) return;
      this.selectedEdgeId = null;
      this.selectedIdx = msg.details.idx;
      this.selectedNodeSummary = { idx: msg.details.idx, id: msg.details.node.id, label: msg.details.label };
      this.selectedLabelText = `[${msg.details.node.class_id}] ${msg.details.label}`;
      this.inspector.showNode(msg.details);
      this.worker.postMessage({ type: 'getNeighbors', idx: msg.details.idx, depth: 1 });
      this.requestArchExplanationIfActive(msg.details.idx, -1);
      if (this._focusPending && this.webglReady) {
        this._focusPending = false;
        this.renderer.focusOnNode(msg.details.idx);
      }
      return;
    }

    if (msg.type === 'edgeDetails') {
      if (!msg.details) return;
      this.selectedEdgeId = msg.details.edge?.id || null;
      this.selectedIdx = -1;
      this.selectedNodeSummary = null;
      this.inspector.showEdge(msg.details);
      this.requestArchExplanationIfActive(-1, msg.details.edgeIdx);
      return;
    }

    if (msg.type === 'neighbors') {
      if (msg.idx === this.selectedIdx && this.webglReady) {
        this.renderer.setSelectionHighlight(this.selectedIdx, msg.hop1, this.activePathNodes);
      }
      return;
    }

    if (msg.type === 'nodeLabel') {
      if (msg.kind === 'hover') {
        this.hoveredLabelText = msg.label ? `[${msg.class_id}] ${msg.label}` : '';
        if (this.webglReady) this.renderer.updateFloatingLabels();
      }
      return;
    }

    if (msg.type === 'pathResult') {
      this.controls.renderPathResult(msg.result);
      if (msg.result.found) {
        this.activePathNodes = msg.result.nodeIndices || [];
        if (this.webglReady) {
          this.renderer.setSelectionHighlight(this.selectedIdx, [], this.activePathNodes);
        }
      }
      return;
    }

    if (msg.type === 'tablePage') {
      this.controls.renderTablePage(msg.result);
      return;
    }

    if (msg.type === 'subgraphExport') {
      this.downloadJson(msg.data, `hwm-kg-subgraph-${this.manifest?.snapshot_hash || 'export'}.json`);
      return;
    }

    if (msg.type === 'cacheCleared') {
      this.els.loadingPill.textContent = msg.ok ? 'Cache cleared (reload to rebuild)' : 'Cache clear failed';
      return;
    }

    if (msg.type === 'coverageBatch') {
      this.tour.handleBatchResponse(msg);
      return;
    }

    if (msg.type === 'fullCoverageStats') {
      this.tour.handleFullStats(msg);
      return;
    }

    if (msg.type === 'allCoverageGeometry') {
      this.tour.handleAllCoverageGeometry(msg);
      return;
    }

    if (msg.type === 'architectureResolved') {
      this.archView.handleResolvedComponent(msg);
      return;
    }

    if (msg.type === 'entityComponentExplanation') {
      if (msg.requestId !== this.explainReqSeq) return;
      const exp = msg.explanation;
      if (!exp) {
        this.inspector.setArchContext(null);
        return;
      }
      this.inspector.setArchContext({
        componentId: exp.componentId,
        componentLabel: exp.componentLabel,
        status: 'ready',
        explanation: exp,
        bridgeNodePositions: msg.bridgeNodePositions,
      });
      if (this.webglReady && this.workspaceTab === 'architecture' && msg.bridgeNodePositions?.length) {
        const mapped = this.archView?.lastResolved;
        this.renderer.setOverlay({
          nodePositions: msg.bridgeNodePositions,
          edgePositions: msg.bridgeEdgePositions,
          selfLoopPositions: msg.bridgeSelfLoopPositions,
          secondaryNodePositions: this.archView?.showMappedLayer ? (mapped?.allMappedNodePositions || null) : null,
          secondaryEdgePositions: this.archView?.showMappedLayer ? (mapped?.allMappedEdgePositions || null) : null,
          secondarySelfLoopPositions: this.archView?.showMappedLayer ? (mapped?.allMappedSelfLoopPositions || null) : null,
          theme: 'architecture',
          dimBackground: true,
        });
      }
      return;
    }

    if (msg.type === 'overlayGeometry') {
      if (msg.requestId === this.overlayReqCounter && this.webglReady) {
        this.renderer.setOverlay({
          nodePositions: msg.nodePositions,
          edgePositions: msg.edgePositions,
          selfLoopPositions: msg.selfLoopPositions,
          theme: 'selection',
        });
        if (msg.kind === 'focus' && msg.nodePositions?.length) {
          this.renderer.focusOnPositions(msg.nodePositions);
        }
      }
      return;
    }
  }

  applyFilters(state) {
    if (!this.worker) return;
    this.worker.postMessage({
      type: 'filter',
      viewMode: state.viewMode,
      hopDepth: state.hopDepth,
      selectedIdx: this.selectedIdx,
      filters: state.filters,
    });
  }

  requestArchExplanationIfActive(nodeIdx, edgeIdx) {
    if (this.workspaceTab !== 'architecture') {
      this.inspector.setArchContext(null);
      return;
    }
    const compId = this.archView?.pinnedId || this.archView?.activeComponentId;
    if (!compId || !this.archView?.data || !this.worker) {
      this.inspector.setArchContext(null);
      return;
    }
    const comp = (this.archView.data.components || []).find((c) => c.id === compId);
    if (!comp) {
      this.inspector.setArchContext(null);
      return;
    }
    const seq = ++this.explainReqSeq;
    this.inspector.setArchContext({
      componentId: comp.id,
      componentLabel: comp.label,
      status: 'loading',
      explanation: null,
    });
    this.worker.postMessage({
      type: 'explainEntityForComponent',
      requestId: seq,
      componentId: comp.id,
      componentLabel: comp.label,
      moduleIds: comp.module_ids || [],
      featureIds: comp.feature_ids || [],
      curatedPaths: comp.evidence_paths || [],
      nodeIdx,
      edgeIdx,
    });
  }

  selectNode(idx, focus = false) {
    if (this.workspaceTab === 'architecture') {
      this.showEntityInspectorInArch();
    }
    if (window.matchMedia('(max-width: 1100px)').matches) {
      document.getElementById('left-panel').classList.add('collapsed');
      document.getElementById('btn-toggle-left').setAttribute('aria-expanded', 'false');
      document.getElementById('right-panel').classList.remove('collapsed');
      document.getElementById('btn-toggle-right').setAttribute('aria-expanded', 'true');
    }

    this._focusPending = focus;
    this.selectedIdx = idx;
    this.worker.postMessage({ type: 'getNode', idx, requestId: ++this.reqCounter });
    if (this.controls.viewMode === 'neighborhood' || this.controls.viewMode === 'paper') {
      this.applyFilters(this.controls.getFilterState());
    }
  }

  selectNodeById(id) {
    if (this.workspaceTab === 'architecture') {
      this.showEntityInspectorInArch();
    }
    this._focusPending = true;
    this.worker.postMessage({ type: 'getNode', id, requestId: ++this.reqCounter });
  }

  selectEdge(edgeIdx, highlightOverlay = false) {
    if (this.workspaceTab === 'architecture') {
      this.showEntityInspectorInArch();
    }
    if (window.matchMedia('(max-width: 1100px)').matches) {
      document.getElementById('left-panel').classList.add('collapsed');
      document.getElementById('btn-toggle-left').setAttribute('aria-expanded', 'false');
      document.getElementById('right-panel').classList.remove('collapsed');
      document.getElementById('btn-toggle-right').setAttribute('aria-expanded', 'true');
    }

    this.worker.postMessage({ type: 'getEdge', edgeIdx, requestId: ++this.reqCounter });
    if (highlightOverlay && this.worker && this.workspaceTab === 'graph') {
      this.worker.postMessage({
        type: 'getOverlayGeometry',
        edgeIdx,
        kind: 'focus',
        requestId: ++this.overlayReqCounter,
      });
    }
  }

  clearSelection() {
    this.selectedIdx = -1;
    this.selectedEdgeId = null;
    this.selectedNodeSummary = null;
    this.selectedLabelText = '';
    this.activePathNodes = [];
    this.els.selectedLabel.classList.add('hidden');
    this.inspector.clear();
    if (this.webglReady) {
      this.renderer.setSelectionHighlight(-1, [], []);
      if (this.workspaceTab === 'graph') this.renderer.clearOverlay();
    }
    if (this.controls.viewMode === 'neighborhood') {
      this.controls.setViewMode('full');
    }
  }

  positionLabels(hIdx, hPos, sIdx, sPos) {
    if (hIdx >= 0 && hPos && this.hoveredLabelText && hIdx !== sIdx) {
      this.els.hoverLabel.textContent = this.hoveredLabelText;
      this.els.hoverLabel.style.left = `${hPos.x}px`;
      this.els.hoverLabel.style.top = `${hPos.y}px`;
      this.els.hoverLabel.classList.remove('hidden');
    } else {
      this.els.hoverLabel.classList.add('hidden');
    }

    if (sIdx >= 0 && sPos && this.selectedLabelText) {
      this.els.selectedLabel.textContent = this.selectedLabelText;
      this.els.selectedLabel.style.left = `${sPos.x}px`;
      this.els.selectedLabel.style.top = `${sPos.y}px`;
      this.els.selectedLabel.classList.remove('hidden');
    } else {
      this.els.selectedLabel.classList.add('hidden');
    }
  }

  showEmptyFilterState() {
    this.els.spinner.classList.add('hidden');
    this.els.stateTitle.textContent = 'No Entities Match Current Filters';
    this.els.stateMsg.textContent = 'Adjust or reset your active filters in the left panel to show nodes on the sphere.';
    this.els.stateProgress.parentElement.classList.add('hidden');
    this.els.stateActions.replaceChildren();
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-accent';
    resetBtn.textContent = 'Reset All Filters';
    resetBtn.addEventListener('click', () => {
      this.els.overlay.classList.add('hidden');
      this.controls.resetFilters();
    });
    this.els.stateActions.appendChild(resetBtn);
    this.els.stateActions.classList.remove('hidden');
    this.els.overlay.classList.remove('hidden');
  }

  showError(title, message) {
    this.els.spinner.classList.add('hidden');
    this.els.stateProgress.parentElement.classList.add('hidden');
    this.els.stateTitle.textContent = title;
    this.els.stateMsg.textContent = message;
    this.els.loadingPill.textContent = 'Error';
    this.els.loadingPill.className = 'status-pill status-error';
    this.els.overlay.classList.remove('hidden');
  }

  exportPng() {
    if (!this.renderer || !this.webglReady) return;
    const url = this.renderer.captureScreenshot();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `hwm-kg-sphere-${this.manifest?.snapshot_hash || 'view'}.png`;
    a.click();
  }

  downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

const app = new KGExplorerApp();
app.start();
