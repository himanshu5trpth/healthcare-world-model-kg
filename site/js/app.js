/**
 * Main application coordinator for Healthcare World Model KG — Interactive 3D Sphere Explorer.
 */

import { SphereRenderer } from './renderer.js';
import { Inspector } from './inspector.js';
import { ControlsManager } from './controls.js';

class KGExplorerApp {
  constructor() {
    this.worker = null;
    this.renderer = null;
    this.webglReady = false;
    this.manifest = null;

    this.selectedIdx = -1;
    this.selectedNodeSummary = null;
    this.hoveredLabelText = '';
    this.selectedLabelText = '';
    this.activePathNodes = [];
    this.reqCounter = 0;

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
    };

    this.inspector = new Inspector({
      onSelectNode: (idx) => this.selectNode(idx, true),
      onSelectNodeById: (id) => this.selectNodeById(id),
      onSelectEdge: (edgeIdx) => this.selectEdge(edgeIdx),
      onOpenPdf: (paperId, pageNum) => this.controls.openPdfModal(paperId, pageNum, this.manifest),
    });

    this.controls = new ControlsManager({
      onFilterChange: (state) => this.applyFilters(state),
      onSearch: (q) => this.worker && this.worker.postMessage({ type: 'search', query: q, limit: 40 }),
      onSelectSearchResult: (item) => {
        this.selectNode(item.idx, true);
        if (!item.isVisible) {
          // Ensure the hidden node becomes visible by re-applying filters with selectedIdx set
          this.applyFilters(this.controls.getFilterState());
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
    });
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
    if (!this.webglReady) {
      this.controls.setTableMode(true, 'WebGL unavailable — showing searchable table fallback.');
    }

    this.initWorker();
  }

  initWorker() {
    this.worker = new Worker('./js/graph-worker.js', { type: 'module' });
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
      this.inspector.setManifest(this.manifest);
      this.controls.populateFacets(msg.facets, this.manifest);

      const snapDate = (this.manifest.snapshot_time_utc || '').replace('T', ' ').replace('Z', ' UTC');
      this.els.snapshotMeta.textContent = `Snapshot ${snapDate} · #${this.manifest.snapshot_hash}`;
      this.els.headerCounts.textContent =
        `${this.manifest.counts.paper_versions} papers · ${msg.totalNodes.toLocaleString()} nodes · ${msg.totalEdges.toLocaleString()} edges`;
      this.els.loadingPill.textContent = 'Ready';
      this.els.loadingPill.className = 'status-pill status-ready';

      if (this.webglReady) {
        this.renderer.setGraphData(msg.positions, msg.colors, msg.sizes);
      }

      this.els.overlay.classList.add('hidden');
      this.applyFilters(this.controls.getFilterState());
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
      this.controls.renderSearchResults(msg.query, msg.totalMatches || 0, msg.results || []);
      return;
    }

    if (msg.type === 'nodeDetails') {
      if (!msg.details) return;
      this.selectedIdx = msg.details.idx;
      this.selectedNodeSummary = { idx: msg.details.idx, id: msg.details.node.id, label: msg.details.label };
      this.selectedLabelText = `[${msg.details.node.class_id}] ${msg.details.label}`;
      this.inspector.showNode(msg.details);
      this.worker.postMessage({ type: 'getNeighbors', idx: msg.details.idx, depth: 1 });
      if (this._focusPending && this.webglReady) {
        this._focusPending = false;
        this.renderer.focusOnNode(msg.details.idx);
      }
      return;
    }

    if (msg.type === 'edgeDetails') {
      if (!msg.details) return;
      this.inspector.showEdge(msg.details);
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

  selectNode(idx, focus = false) {
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
    this._focusPending = true;
    this.worker.postMessage({ type: 'getNode', id, requestId: ++this.reqCounter });
  }

  selectEdge(edgeIdx) {
    if (window.matchMedia('(max-width: 1100px)').matches) {
      document.getElementById('left-panel').classList.add('collapsed');
      document.getElementById('btn-toggle-left').setAttribute('aria-expanded', 'false');
      document.getElementById('right-panel').classList.remove('collapsed');
      document.getElementById('btn-toggle-right').setAttribute('aria-expanded', 'true');
    }

    this.worker.postMessage({ type: 'getEdge', edgeIdx, requestId: ++this.reqCounter });
  }

  clearSelection() {
    this.selectedIdx = -1;
    this.selectedNodeSummary = null;
    this.selectedLabelText = '';
    this.activePathNodes = [];
    this.els.selectedLabel.classList.add('hidden');
    this.inspector.clear();
    if (this.webglReady) this.renderer.setSelectionHighlight(-1, [], []);
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
