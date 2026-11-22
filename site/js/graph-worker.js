/**
 * Web Worker for parsing, indexing, caching, filtering, searching, and laying out
 * the complete Healthcare World Model Knowledge Graph (40,000+ nodes, 100,000+ edges).
 */

import {
  getClassStyle,
  hexToRgbNorm,
  computeFullSphereLayout,
  computeArchitectureLayout,
  computePaperCenteredLayout,
  computeNeighborhoodLayout,
} from './sphere-layout.js';

const IDB_NAME = 'hwm_kg_3d_explorer_cache_v1';
const IDB_STORE = 'snapshots';

let manifest = null;
let registry = [];
let registryByPaper = new Map();
let nodes = [];          // Full node records (catalog + graph)
let edges = [];          // Full edge records
let idToIdx = new Map();
let outAdj = [];         // outAdj[nodeIdx] = [edgeIdx, ...]
let inAdj = [];          // inAdj[nodeIdx] = [edgeIdx, ...]
let nodePaperId = [];    // paper_record_id or null
let nodePrimaryModule = []; // 'M1'..'M10' or null
let nodeModules = [];    // Set or Array of module IDs linked to this node
let nodeFeatureId = [];  // feature_id or null
let nodeState = [];      // assessment_state or null
let nodeStage = [];      // evidence_stage or null
let nodeCapabilities = []; // e.g., ['L2']
let nodeReadiness = [];    // e.g., ['R3']
let nodeWorldTypes = [];   // e.g., ['WT_...']
let searchBlob = [];     // lowercased searchable string per node
let displayLabel = [];   // human-readable short title per node
let baseColors = null;   // Float32Array (N * 3)
let baseSizes = null;    // Float32Array (N)
let fullPositions = null; // Float32Array (N * 3)
let currentPositions = null; // Float32Array (N * 3)
let paperIdsSorted = [];
let paperVersionIdx = new Map();

let currentNodeVis = null; // Uint8Array (N)
let currentEdgeVis = null; // Uint8Array (E)
let currentViewMode = 'full';
let currentFilters = null;

function postProgress(pct, message) {
  self.postMessage({ type: 'progress', pct, message });
}

/* ---------- IndexedDB Cache Helpers ---------- */

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readCache(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeCache(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Cache is best-effort
  }
}

async function clearCache() {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return true;
  } catch {
    return false;
  }
}

/* ---------- JSONL Parsing ---------- */

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  return res.json();
}

async function fetchJsonl(url) {
  let text;
  if (typeof DecompressionStream !== 'undefined') {
    const compressed = await fetch(url + '.gz');
    if (compressed.ok) text = await new Response(compressed.body.pipeThrough(new DecompressionStream('gzip'))).text();
  }
  if (text === undefined) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    text = await res.text();
  }
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    out.push(JSON.parse(line));
  }
  return out;
}

function extractPaperIdFromAnnotation(srcAnn) {
  if (!srcAnn) return null;
  const m = srcAnn.match(/annotations\/([^/.]+)\.json$/i);
  return m ? m[1] : null;
}

function deriveLabel(n) {
  if (n.isCatalog) {
    return n.label ? `${n.id} — ${n.label}` : n.id;
  }
  const p = n.properties || {};
  const cls = n.class_id;
  if (cls === 'PaperVersion') {
    const pid = extractPaperIdFromAnnotation(n.source_annotation);
    const reg = pid ? registryByPaper.get(pid) : null;
    return reg ? `[${pid}] ${reg.title}` : (p.title || n.id);
  }
  if (cls === 'PaperRecord') {
    return p.title ? `[${p.local_id || ''}] ${p.title}` : n.id;
  }
  if (cls === 'Assertion') {
    const kind = p.kind || 'assertion';
    const target = p.feature_id || p.predicate_id || p.level_id || p.facet_id || p.gate_id || '';
    const st = p.assessment_state ? ` (${p.assessment_state})` : '';
    return target ? `${target}${st}` : `${kind}: ${n.id}${st}`;
  }
  if (cls === 'EvidenceFragment') {
    const page = p.locator && p.locator.page ? `p.${p.locator.page}` : '';
    const snippet = (p.content || '').replace(/\s+/g, ' ').slice(0, 72);
    return `${page ? page + ' · ' : ''}${snippet || n.id}`;
  }
  if (cls === 'ModelVersion' || cls === 'SystemComposition' || cls === 'ModuleImplementation') {
    return p.name || p.label || p.module_id || n.id;
  }
  if (cls === 'MetricResult') {
    const val = p.value !== undefined && p.value !== null ? `: ${p.value}` : '';
    return `${p.metric || 'Metric'}${val}`;
  }
  if (cls === 'HumanStudy' || cls === 'Study' || cls === 'Cohort' || cls === 'DatasetVersion') {
    return p.name || p.study_design || p.description || n.id;
  }
  return p.name || p.label || p.title || n.id;
}

function buildSearchBlob(n, label, pid) {
  const parts = [n.id, n.class_id, label];
  if (pid) {
    parts.push(pid);
    const reg = registryByPaper.get(pid);
    if (reg && n.class_id === 'PaperVersion') {
      parts.push(reg.title || '', reg.doi_or_url || '', String(reg.year || ''));
    }
  }
  if (n.isCatalog) {
    parts.push(n.label || '', (n.module_ids || []).join(' '));
  } else {
    const p = n.properties || {};
    if (p.feature_id) parts.push(p.feature_id);
    if (p.assessment_state) parts.push(p.assessment_state);
    if (p.evidence_stage) parts.push(p.evidence_stage);
    if (p.name) parts.push(p.name);
    if (p.title) parts.push(p.title);
    if (p.metric) parts.push(p.metric);
    if (p.rationale) parts.push(p.rationale);
    if (p.content) parts.push(p.content);
    if (p.mechanism) parts.push(p.mechanism);
    if (p.task) parts.push(p.task);
  }
  return parts.join(' ').toLowerCase();
}

/* ---------- Indexing Pipeline ---------- */

async function initializeGraph() {
  postProgress(5, 'Loading snapshot manifest…');
  manifest = await fetchJson('../data/snapshot-manifest.json');
  const snapHash = manifest.snapshot_hash;

  postProgress(12, 'Loading paper registry…');
  registry = await fetchJsonl('../data/registry.jsonl');
  registryByPaper = new Map();
  for (const r of registry) {
    registryByPaper.set(r.paper_record_id, r);
  }
  paperIdsSorted = registry.map((r) => r.paper_record_id).sort();

  // Try IndexedDB cache for pre-parsed nodes/edges/layout
  postProgress(18, `Checking local cache (${snapHash})…`);
  const cached = await readCache(snapHash);

  let catalogRaw, nodesRaw, edgesRaw;
  if (cached && cached.nodes && cached.edges && cached.fullPositions) {
    postProgress(65, 'Restoring indexed graph from local cache…');
    nodes = cached.nodes;
    edges = cached.edges;
    fullPositions = cached.fullPositions;
  } else {
    postProgress(24, 'Loading ontology catalog nodes…');
    catalogRaw = await fetchJsonl('../data/graph/catalog_nodes.jsonl');
    for (const c of catalogRaw) c.isCatalog = true;

    postProgress(35, 'Loading graph nodes (40,000+ entities)…');
    nodesRaw = await fetchJsonl('../data/graph/nodes.jsonl');

    postProgress(55, 'Loading graph relationships (100,000+ edges)…');
    edgesRaw = await fetchJsonl('../data/graph/edges.jsonl');

    nodes = catalogRaw.concat(nodesRaw);
    edges = edgesRaw;
    fullPositions = null;
  }

  postProgress(72, 'Building ID, adjacency, and filter indexes…');
  const N = nodes.length;
  const E = edges.length;

  idToIdx = new Map();
  outAdj = Array.from({ length: N }, () => []);
  inAdj = Array.from({ length: N }, () => []);
  nodePaperId = new Array(N).fill(null);
  nodePrimaryModule = new Array(N).fill(null);
  nodeModules = Array.from({ length: N }, () => []);
  nodeFeatureId = new Array(N).fill(null);
  nodeState = new Array(N).fill(null);
  nodeStage = new Array(N).fill(null);
  nodeCapabilities = Array.from({ length: N }, () => []);
  nodeReadiness = Array.from({ length: N }, () => []);
  nodeWorldTypes = Array.from({ length: N }, () => []);
  displayLabel = new Array(N);
  searchBlob = new Array(N);
  baseColors = new Float32Array(N * 3);
  baseSizes = new Float32Array(N);
  paperVersionIdx = new Map();

  const featureToModules = new Map();
  for (let i = 0; i < N; i++) {
    const n = nodes[i];
    idToIdx.set(n.id, i);
    if (n.isCatalog && n.class_id === 'FeatureDefinition' && Array.isArray(n.module_ids)) {
      featureToModules.set(n.id, n.module_ids);
      nodeModules[i] = n.module_ids.slice();
      nodePrimaryModule[i] = n.module_ids[0] || null;
      nodeFeatureId[i] = n.id;
    } else if (n.isCatalog && n.class_id === 'BlueprintModule') {
      nodeModules[i] = [n.id];
      nodePrimaryModule[i] = n.id;
    }

    const pid = n.isCatalog ? null : extractPaperIdFromAnnotation(n.source_annotation);
    nodePaperId[i] = pid;
    if (n.class_id === 'PaperVersion' && pid) {
      paperVersionIdx.set(pid, i);
    }

    if (!n.isCatalog && n.properties) {
      const p = n.properties;
      if (p.feature_id) {
        nodeFeatureId[i] = p.feature_id;
        const mods = featureToModules.get(p.feature_id);
        if (mods && mods.length) {
          nodeModules[i] = mods.slice();
          nodePrimaryModule[i] = mods[0];
        }
      }
      if (n.class_id === 'Assertion') {
        nodeState[i] = p.assessment_state || 'unspecified';
        nodeStage[i] = p.evidence_stage || 'unspecified';
      }
    }

    const lbl = deriveLabel(n);
    displayLabel[i] = lbl;
    searchBlob[i] = buildSearchBlob(n, lbl, pid);

    const style = getClassStyle(n.class_id);
    const [r, g, b] = hexToRgbNorm(style.color);
    baseColors[i * 3] = r;
    baseColors[i * 3 + 1] = g;
    baseColors[i * 3 + 2] = b;
    baseSizes[i] = style.size;
  }

  // Index edges and propagate capability / readiness / world type / module links
  const predicateCounts = new Map();
  for (let e = 0; e < E; e++) {
    const edge = edges[e];
    const s = idToIdx.get(edge.subject_id);
    const o = idToIdx.get(edge.object_id);
    edge._s = s !== undefined ? s : -1;
    edge._o = o !== undefined ? o : -1;
    edge._isKg = typeof edge.predicate_id === 'string' && edge.predicate_id.startsWith('kg:');

    predicateCounts.set(edge.predicate_id, (predicateCounts.get(edge.predicate_id) || 0) + 1);

    if (s !== undefined && o !== undefined) {
      outAdj[s].push(e);
      inAdj[o].push(e);

      const pred = edge.predicate_id;
      const objNode = nodes[o];
      if (pred === 'kg:level' || pred === 'demonstratesCapability' || pred === 'claimsCapability') {
        if (objNode.class_id === 'CapabilityLevel') {
          if (!nodeCapabilities[s].includes(objNode.id)) nodeCapabilities[s].push(objNode.id);
        }
      } else if (pred === 'kg:facet' || pred === 'hasReadinessEvidence') {
        if (objNode.class_id === 'ReadinessFacet') {
          if (!nodeReadiness[s].includes(objNode.id)) nodeReadiness[s].push(objNode.id);
        }
      } else if (pred === 'modelsWorld') {
        if (objNode.class_id === 'WorldType') {
          if (!nodeWorldTypes[s].includes(objNode.id)) nodeWorldTypes[s].push(objNode.id);
        }
      } else if (pred === 'informsBlueprintModule' || pred === 'realizesModule' || pred === 'kg:ontologyModuleMembership') {
        if (objNode.class_id === 'BlueprintModule') {
          if (!nodeModules[s].includes(objNode.id)) nodeModules[s].push(objNode.id);
          if (!nodePrimaryModule[s]) nodePrimaryModule[s] = objNode.id;
        }
      }
    }
  }

  // Propagate capabilities/readiness/worldTypes to owning PaperVersion for paper-level filtering
  for (let i = 0; i < N; i++) {
    const pid = nodePaperId[i];
    if (!pid) continue;
    const pvIdx = paperVersionIdx.get(pid);
    if (pvIdx === undefined || pvIdx === i) continue;
    for (const c of nodeCapabilities[i]) {
      if (!nodeCapabilities[pvIdx].includes(c)) nodeCapabilities[pvIdx].push(c);
    }
    for (const r of nodeReadiness[i]) {
      if (!nodeReadiness[pvIdx].includes(r)) nodeReadiness[pvIdx].push(r);
    }
    for (const w of nodeWorldTypes[i]) {
      if (!nodeWorldTypes[pvIdx].includes(w)) nodeWorldTypes[pvIdx].push(w);
    }
  }

  if (!fullPositions) {
    postProgress(86, 'Computing deterministic spherical layout…');
    fullPositions = computeFullSphereLayout(nodes, paperIdsSorted, nodePaperId);
    postProgress(93, 'Saving derived index to local cache…');
    writeCache(snapHash, { nodes, edges, fullPositions });
  }

  currentPositions = fullPositions;
  currentNodeVis = new Uint8Array(N).fill(1);
  currentEdgeVis = new Uint8Array(E);

  // Build facet metadata for UI dropdowns
  const classCounts = new Map();
  const stateCounts = new Map();
  const stageCounts = new Map();
  const modulesList = [];
  const featuresList = [];
  const capList = [];
  const readList = [];
  const worldList = [];

  for (let i = 0; i < N; i++) {
    const n = nodes[i];
    classCounts.set(n.class_id, (classCounts.get(n.class_id) || 0) + 1);
    if (nodeState[i]) stateCounts.set(nodeState[i], (stateCounts.get(nodeState[i]) || 0) + 1);
    if (nodeStage[i]) stageCounts.set(nodeStage[i], (stageCounts.get(nodeStage[i]) || 0) + 1);
    if (n.isCatalog) {
      if (n.class_id === 'BlueprintModule') modulesList.push({ id: n.id, label: n.label });
      else if (n.class_id === 'FeatureDefinition') featuresList.push({ id: n.id, label: n.label, module_ids: n.module_ids || [] });
      else if (n.class_id === 'CapabilityLevel') capList.push({ id: n.id, label: n.label });
      else if (n.class_id === 'ReadinessFacet') readList.push({ id: n.id, label: n.label });
      else if (n.class_id === 'WorldType') worldList.push({ id: n.id, label: n.label });
    }
  }

  modulesList.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  featuresList.sort((a, b) => a.id.localeCompare(b.id));
  capList.sort((a, b) => a.id.localeCompare(b.id));
  readList.sort((a, b) => a.id.localeCompare(b.id));
  worldList.sort((a, b) => a.id.localeCompare(b.id));

  const facets = {
    classes: Array.from(classCounts.entries())
      .map(([id, count]) => ({ id, count, ...getClassStyle(id) }))
      .sort((a, b) => b.count - a.count),
    papers: registry.map((r) => ({
      id: r.paper_record_id,
      title: r.title,
      year: r.year,
      paper_version_id: r.paper_version_id,
      completion_state: r.completion_state,
      pdf_available: r.pdf_available,
      pdf_pages: r.pdf_pages,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    modules: modulesList,
    features: featuresList,
    states: Array.from(stateCounts.entries()).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
    stages: Array.from(stageCounts.entries()).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
    capabilities: capList,
    readiness: readList,
    worldTypes: worldList,
    predicates: Array.from(predicateCounts.entries())
      .map(([id, count]) => ({ id, count, isKg: id.startsWith('kg:') }))
      .sort((a, b) => Number(a.isKg) - Number(b.isKg) || b.count - a.count),
  };

  postProgress(100, 'Ready');

  // Transfer copies of buffers to renderer
  const posCopy = new Float32Array(currentPositions);
  const colCopy = new Float32Array(baseColors);
  const sizeCopy = new Float32Array(baseSizes);

  self.postMessage(
    {
      type: 'ready',
      manifest,
      totalNodes: N,
      totalEdges: E,
      facets,
      positions: posCopy,
      colors: colCopy,
      sizes: sizeCopy,
    },
    [posCopy.buffer, colCopy.buffer, sizeCopy.buffer]
  );
}

/* ---------- Filtering & Edge Buffer Generation ---------- */

function computeNeighborhoodSets(centerIdx, maxDepth) {
  const hop1 = new Set();
  const hop2 = new Set();
  if (centerIdx < 0 || centerIdx >= nodes.length) return { hop1, hop2 };

  const addNeighbors = (u, targetSet) => {
    for (const e of outAdj[u]) {
      const v = edges[e]._o;
      if (v >= 0 && v !== centerIdx) targetSet.add(v);
    }
    for (const e of inAdj[u]) {
      const v = edges[e]._s;
      if (v >= 0 && v !== centerIdx) targetSet.add(v);
    }
  };

  addNeighbors(centerIdx, hop1);
  if (maxDepth >= 2) {
    // Cap 2-hop expansion on ultra-high-degree catalog hubs to keep UI responsive
    let count = 0;
    for (const u of hop1) {
      addNeighbors(u, hop2);
      count++;
      if (hop2.size > 4000 || count > 500) break;
    }
    for (const u of hop1) hop2.delete(u);
    hop2.delete(centerIdx);
  }
  return { hop1, hop2 };
}

function applyFiltersAndLayout(req) {
  currentFilters = req.filters;
  const f = req.filters;
  const viewMode = req.viewMode || 'full';
  const selectedIdx = typeof req.selectedIdx === 'number' ? req.selectedIdx : -1;
  const hopDepth = req.hopDepth || 1;
  const N = nodes.length;
  const E = edges.length;

  const allowedClasses = f.classes && f.classes.length ? new Set(f.classes) : null;
  const paperFilter = f.paper || '';
  const moduleFilter = f.module || '';
  const featureFilter = f.feature || '';
  const stateFilter = f.state || '';
  const stageFilter = f.stage || '';
  const capFilter = f.capability || '';
  const readFilter = f.readiness || '';
  const worldFilter = f.worldType || '';
  const predFilter = f.predicate || '';
  const showAllEdges = !!f.showAllEdges;
  const includeKgEdges = !!f.includeKgEdges || (predFilter && predFilter.startsWith('kg:'));
  const edgeDensity = typeof f.edgeDensity === 'number' ? f.edgeDensity : 0.35;
  const reducedDetail = !!f.reducedDetail;

  // Neighborhood restriction if viewMode === 'neighborhood'
  let neighborhoodAllowed = null;
  let hop1List = [];
  let hop2List = [];
  if (viewMode === 'neighborhood' && selectedIdx >= 0) {
    const { hop1, hop2 } = computeNeighborhoodSets(selectedIdx, hopDepth);
    hop1List = Array.from(hop1);
    hop2List = Array.from(hop2);
    neighborhoodAllowed = new Set([selectedIdx, ...hop1List, ...hop2List]);
  }

  // Recompute positions if layout mode changed or centered target changed
  let positionsChanged = false;
  if (viewMode === 'full') {
    if (currentViewMode !== 'full') {
      currentPositions = fullPositions;
      positionsChanged = true;
    }
  } else if (viewMode === 'architecture') {
    currentPositions = computeArchitectureLayout(nodes, nodePrimaryModule, fullPositions);
    positionsChanged = true;
  } else if (viewMode === 'paper') {
    const targetPaper = paperFilter || (selectedIdx >= 0 ? nodePaperId[selectedIdx] : null) || paperIdsSorted[0];
    currentPositions = computePaperCenteredLayout(nodes, targetPaper, nodePaperId, fullPositions);
    positionsChanged = true;
  } else if (viewMode === 'neighborhood' && selectedIdx >= 0) {
    currentPositions = computeNeighborhoodLayout(nodes, selectedIdx, hop1List, hop2List, fullPositions);
    positionsChanged = true;
  }
  currentViewMode = viewMode;

  // Compute node visibility
  const vis = new Uint8Array(N);
  let visNodeCount = 0;

  for (let i = 0; i < N; i++) {
    const n = nodes[i];
    if (neighborhoodAllowed && !neighborhoodAllowed.has(i)) continue;
    if (allowedClasses && !allowedClasses.has(n.class_id)) continue;
    if (paperFilter && !n.isCatalog && nodePaperId[i] !== paperFilter) continue;
    if (moduleFilter) {
      const mods = nodeModules[i];
      if (!(n.id === moduleFilter || (mods && mods.includes(moduleFilter)))) continue;
    }
    if (featureFilter && nodeFeatureId[i] !== featureFilter) continue;
    if (stateFilter && nodeState[i] !== stateFilter) continue;
    if (stageFilter && nodeStage[i] !== stageFilter) continue;
    if (capFilter && !(n.id === capFilter || nodeCapabilities[i].includes(capFilter))) continue;
    if (readFilter && !(n.id === readFilter || nodeReadiness[i].includes(readFilter))) continue;
    if (worldFilter && !(n.id === worldFilter || nodeWorldTypes[i].includes(worldFilter))) continue;

    vis[i] = 1;
    visNodeCount++;
  }

  // Always keep selected node visible if one is chosen
  if (selectedIdx >= 0 && selectedIdx < N && !vis[selectedIdx]) {
    vis[selectedIdx] = 1;
    visNodeCount++;
  }

  currentNodeVis = vis;

  // Compute edge visibility & build compact GPU line buffer
  const edgeVis = new Uint8Array(E);
  const drawnEdgeIndices = [];
  const maxDefaultEdges = reducedDetail ? 3500 : 14000;
  const strideDenom = Math.max(1, Math.round(1 / Math.max(0.05, edgeDensity)));

  for (let e = 0; e < E; e++) {
    const edge = edges[e];
    const s = edge._s;
    const o = edge._o;
    if (s < 0 || o < 0) continue;
    if (!vis[s] || !vis[o]) continue;
    if (predFilter && edge.predicate_id !== predFilter) continue;

    const isSelectedIncident = selectedIdx >= 0 && (s === selectedIdx || o === selectedIdx);

    if (!showAllEdges && !isSelectedIncident) {
      if (edge._isKg && !includeKgEdges) {
        // Still allow high-signal structural kg links when unfiltered
        if (
          edge.predicate_id !== 'kg:level' &&
          edge.predicate_id !== 'kg:facet' &&
          edge.predicate_id !== 'kg:ontologyModuleMembership'
        ) {
          continue;
        }
      }
      if (!predFilter && strideDenom > 1 && (e % strideDenom) !== 0) {
        continue;
      }
      if (drawnEdgeIndices.length >= maxDefaultEdges) {
        continue;
      }
    }

    edgeVis[e] = 1;
    drawnEdgeIndices.push(e);
  }

  currentEdgeVis = edgeVis;

  // Build line segment position buffer (2 vertices * 3 floats per drawn edge)
  const drawnCount = drawnEdgeIndices.length;
  const edgePos = new Float32Array(drawnCount * 6);
  const edgeCol = new Float32Array(drawnCount * 6);
  const edgeIdxBuf = new Int32Array(drawnCount);

  for (let k = 0; k < drawnCount; k++) {
    const e = drawnEdgeIndices[k];
    const edge = edges[e];
    const s = edge._s;
    const o = edge._o;
    edgeIdxBuf[k] = e;

    edgePos[k * 6]     = currentPositions[s * 3];
    edgePos[k * 6 + 1] = currentPositions[s * 3 + 1];
    edgePos[k * 6 + 2] = currentPositions[s * 3 + 2];
    edgePos[k * 6 + 3] = currentPositions[o * 3];
    edgePos[k * 6 + 4] = currentPositions[o * 3 + 1];
    edgePos[k * 6 + 5] = currentPositions[o * 3 + 2];

    // Scientific predicates in crisp teal-cyan; kg: metadata in muted slate-blue
    const r = edge._isKg ? 0.38 : 0.22;
    const g = edge._isKg ? 0.50 : 0.78;
    const b = edge._isKg ? 0.68 : 0.85;
    edgeCol[k * 6] = r; edgeCol[k * 6 + 1] = g; edgeCol[k * 6 + 2] = b;
    edgeCol[k * 6 + 3] = r; edgeCol[k * 6 + 4] = g; edgeCol[k * 6 + 5] = b;
  }

  const visCopy = new Uint8Array(vis);
  const transfer = [visCopy.buffer, edgePos.buffer, edgeCol.buffer, edgeIdxBuf.buffer];
  const payload = {
    type: 'filtered',
    visibleNodes: visNodeCount,
    totalNodes: N,
    visibleEdges: drawnCount,
    totalEdges: E,
    nodeVis: visCopy,
    edgePositions: edgePos,
    edgeColors: edgeCol,
    edgeIndices: edgeIdxBuf,
  };

  if (positionsChanged) {
    const posCopy = new Float32Array(currentPositions);
    payload.positions = posCopy;
    transfer.push(posCopy.buffer);
  }

  self.postMessage(payload, transfer);
}

/* ---------- Search (Across ALL Nodes, Including Hidden) ---------- */

function handleSearch(query, limit = 40) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    self.postMessage({ type: 'searchResults', query, results: [] });
    return;
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = [];

  for (let i = 0; i < nodes.length; i++) {
    const blob = searchBlob[i];
    let ok = true;
    for (let t = 0; t < tokens.length; t++) {
      if (!blob.includes(tokens[t])) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    // Prioritize exact ID / paper ID / PaperVersion / Catalog matches
    let score = 0;
    const n = nodes[i];
    if (n.id.toLowerCase() === q) score += 100;
    else if (nodePaperId[i] && nodePaperId[i].toLowerCase() === q) score += (n.class_id === 'PaperVersion' ? 95 : 40);
    if (n.class_id === 'PaperVersion') score += 30;
    else if (n.isCatalog) score += 25;
    else if (n.class_id === 'ModelVersion' || n.class_id === 'HumanStudy') score += 15;
    if (displayLabel[i].toLowerCase().includes(q)) score += 20;

    scored.push({ idx: i, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit).map(({ idx }) => {
    const n = nodes[idx];
    return {
      idx,
      id: n.id,
      class_id: n.class_id,
      label: displayLabel[idx],
      paperId: nodePaperId[idx],
      isVisible: currentNodeVis ? currentNodeVis[idx] === 1 : true,
      state: nodeState[idx],
    };
  });

  self.postMessage({ type: 'searchResults', query, totalMatches: scored.length, results: top });
}

/* ---------- Details, Neighbors, Path Finding, Table & Export ---------- */

function getNodeDetails(idx) {
  if (idx < 0 || idx >= nodes.length) return null;
  const n = nodes[idx];
  const pid = nodePaperId[idx];
  const reg = pid ? registryByPaper.get(pid) : null;

  const outgoing = outAdj[idx].slice(0, 250).map((e) => {
    const ed = edges[e];
    return {
      edgeIdx: e,
      id: ed.id,
      predicate_id: ed.predicate_id,
      isKg: ed._isKg,
      targetIdx: ed._o,
      targetId: ed.object_id,
      targetClass: nodes[ed._o]?.class_id || 'Unknown',
      targetLabel: displayLabel[ed._o] || ed.object_id,
    };
  });

  const incoming = inAdj[idx].slice(0, 250).map((e) => {
    const ed = edges[e];
    return {
      edgeIdx: e,
      id: ed.id,
      predicate_id: ed.predicate_id,
      isKg: ed._isKg,
      sourceIdx: ed._s,
      sourceId: ed.subject_id,
      sourceClass: nodes[ed._s]?.class_id || 'Unknown',
      sourceLabel: displayLabel[ed._s] || ed.subject_id,
    };
  });

  // Resolve linked evidence fragments directly for quick inspection
  const linkedEvidence = [];
  const evIds = new Set();
  const props = n.properties || {};
  for (const id of (props.evidence_ids || [])) evIds.add(id);
  for (const id of (props.source_evidence_ids || [])) evIds.add(id);
  for (const id of (n.provenance_evidence_ids || [])) evIds.add(id);
  for (const e of outAdj[idx]) {
    if (edges[e].predicate_id === 'kg:evidence') evIds.add(edges[e].object_id);
  }
  for (const eid of evIds) {
    const eIdx = idToIdx.get(eid);
    if (eIdx !== undefined) {
      linkedEvidence.push({ idx: eIdx, node: nodes[eIdx], paperId: nodePaperId[eIdx] });
    }
  }

  return {
    idx,
    node: n,
    label: displayLabel[idx],
    paperId: pid,
    registry: reg || null,
    outgoing,
    incoming,
    totalOut: outAdj[idx].length,
    totalIn: inAdj[idx].length,
    linkedEvidence,
    position: [currentPositions[idx * 3], currentPositions[idx * 3 + 1], currentPositions[idx * 3 + 2]],
  };
}

function getEdgeDetails(edgeIdx) {
  if (edgeIdx < 0 || edgeIdx >= edges.length) return null;
  const ed = edges[edgeIdx];
  const s = ed._s;
  const o = ed._o;
  return {
    edgeIdx,
    edge: {
      id: ed.id,
      subject_id: ed.subject_id,
      predicate_id: ed.predicate_id,
      object_id: ed.object_id,
      source_annotation: ed.source_annotation,
      properties: ed.properties,
    },
    isKg: ed._isKg,
    subject: s >= 0 ? { idx: s, id: nodes[s].id, class_id: nodes[s].class_id, label: displayLabel[s] } : null,
    object: o >= 0 ? { idx: o, id: nodes[o].id, class_id: nodes[o].class_id, label: displayLabel[o] } : null,
    paperId: extractPaperIdFromAnnotation(ed.source_annotation),
  };
}

function findShortestPath(startIdx, endIdx) {
  if (startIdx < 0 || endIdx < 0 || startIdx >= nodes.length || endIdx >= nodes.length) {
    return { found: false, reason: 'Select both Node A and Node B first.' };
  }
  if (startIdx === endIdx) {
    return {
      found: true,
      nodeIndices: [startIdx],
      steps: [{ idx: startIdx, id: nodes[startIdx].id, label: displayLabel[startIdx], class_id: nodes[startIdx].class_id }],
      edges: [],
    };
  }

  const N = nodes.length;
  const prevNode = new Int32Array(N).fill(-1);
  const prevEdge = new Int32Array(N).fill(-1);
  const visited = new Uint8Array(N);

  const queue = [startIdx];
  visited[startIdx] = 1;
  let head = 0;
  let found = false;

  while (head < queue.length) {
    const u = queue[head++];
    // Prefer scientific edges before kg: edges
    const adj = outAdj[u].concat(inAdj[u]);
    for (let k = 0; k < adj.length; k++) {
      const e = adj[k];
      const ed = edges[e];
      const v = ed._s === u ? ed._o : ed._s;
      if (v < 0 || visited[v]) continue;
      visited[v] = 1;
      prevNode[v] = u;
      prevEdge[v] = e;
      if (v === endIdx) {
        found = true;
        break;
      }
      queue.push(v);
    }
    if (found) break;
  }

  if (!found) {
    return { found: false, reason: 'No undirected path exists between these two nodes (disconnected components).' };
  }

  const nodeIndices = [];
  const edgeIndices = [];
  let cur = endIdx;
  while (cur !== -1) {
    nodeIndices.push(cur);
    if (prevEdge[cur] !== -1) edgeIndices.push(prevEdge[cur]);
    cur = prevNode[cur];
  }
  nodeIndices.reverse();
  edgeIndices.reverse();

  return {
    found: true,
    nodeIndices,
    steps: nodeIndices.map((idx) => ({
      idx,
      id: nodes[idx].id,
      class_id: nodes[idx].class_id,
      label: displayLabel[idx],
    })),
    edges: edgeIndices.map((e) => ({
      edgeIdx: e,
      id: edges[e].id,
      predicate_id: edges[e].predicate_id,
      isKg: edges[e]._isKg,
      subject_id: edges[e].subject_id,
      object_id: edges[e].object_id,
    })),
  };
}

function getTablePage(tab, page, pageSize) {
  const start = page * pageSize;
  const end = start + pageSize;
  if (tab === 'papers') {
    const sorted = registry.slice().sort((a, b) => a.paper_record_id.localeCompare(b.paper_record_id));
    const slice = sorted.slice(start, end).map((r) => ({
      idx: paperVersionIdx.get(r.paper_record_id) ?? -1,
      paper_record_id: r.paper_record_id,
      year: r.year,
      title: r.title,
      completion_state: r.completion_state,
      pdf_pages: r.pdf_pages,
    }));
    return { tab, page, pageSize, total: sorted.length, rows: slice };
  }
  if (tab === 'edges') {
    const visibleList = [];
    for (let e = 0; e < edges.length; e++) {
      if (currentEdgeVis && currentEdgeVis[e]) visibleList.push(e);
    }
    const slice = visibleList.slice(start, end).map((e) => {
      const ed = edges[e];
      return {
        edgeIdx: e,
        id: ed.id,
        subject_id: ed.subject_id,
        predicate_id: ed.predicate_id,
        object_id: ed.object_id,
        isKg: ed._isKg,
        source_annotation: ed.source_annotation || '',
      };
    });
    return { tab, page, pageSize, total: visibleList.length, rows: slice };
  }
  // Default: visible nodes
  const visibleList = [];
  for (let i = 0; i < nodes.length; i++) {
    if (!currentNodeVis || currentNodeVis[i]) visibleList.push(i);
  }
  const slice = visibleList.slice(start, end).map((idx) => ({
    idx,
    id: nodes[idx].id,
    class_id: nodes[idx].class_id,
    label: displayLabel[idx],
    paperId: nodePaperId[idx] || (nodes[idx].isCatalog ? 'Ontology' : '—'),
    state: nodeState[idx] || '—',
    stage: nodeStage[idx] || '—',
  }));
  return { tab: 'nodes', page, pageSize, total: visibleList.length, rows: slice };
}

function buildSubgraphExport(selectedIdx) {
  const exportedNodes = [];
  const exportedEdges = [];
  if (selectedIdx >= 0 && selectedIdx < nodes.length) {
    const { hop1 } = computeNeighborhoodSets(selectedIdx, 1);
    const keep = new Set([selectedIdx, ...hop1]);
    for (const i of keep) exportedNodes.push(nodes[i]);
    for (let e = 0; e < edges.length; e++) {
      if (keep.has(edges[e]._s) && keep.has(edges[e]._o)) {
        const { _s, _o, _isKg, ...clean } = edges[e];
        exportedEdges.push(clean);
      }
    }
  } else {
    for (let i = 0; i < nodes.length; i++) {
      if (currentNodeVis && currentNodeVis[i]) exportedNodes.push(nodes[i]);
    }
    for (let e = 0; e < edges.length; e++) {
      if (currentEdgeVis && currentEdgeVis[e]) {
        const { _s, _o, _isKg, ...clean } = edges[e];
        exportedEdges.push(clean);
      }
    }
  }
  return {
    exported_at_utc: new Date().toISOString(),
    snapshot_hash: manifest?.snapshot_hash || null,
    scope: selectedIdx >= 0 ? `1-hop neighborhood of ${nodes[selectedIdx].id}` : 'current filtered view',
    node_count: exportedNodes.length,
    edge_count: exportedEdges.length,
    nodes: exportedNodes,
    edges: exportedEdges,
  };
}

/* ---------- Message Dispatcher ---------- */

self.onmessage = async (ev) => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      await initializeGraph();
    } else if (msg.type === 'filter') {
      applyFiltersAndLayout(msg);
    } else if (msg.type === 'search') {
      handleSearch(msg.query, msg.limit || 40);
    } else if (msg.type === 'getNode') {
      const idx = typeof msg.idx === 'number' ? msg.idx : idToIdx.get(msg.id);
      const details = idx !== undefined ? getNodeDetails(idx) : null;
      self.postMessage({ type: 'nodeDetails', requestId: msg.requestId, details });
    } else if (msg.type === 'getEdge') {
      const details = getEdgeDetails(msg.edgeIdx);
      self.postMessage({ type: 'edgeDetails', requestId: msg.requestId, details });
    } else if (msg.type === 'getLabel') {
      const idx = msg.idx;
      self.postMessage({
        type: 'nodeLabel',
        kind: msg.kind,
        idx,
        label: idx >= 0 && idx < nodes.length ? displayLabel[idx] : '',
        class_id: idx >= 0 && idx < nodes.length ? nodes[idx].class_id : '',
        id: idx >= 0 && idx < nodes.length ? nodes[idx].id : '',
      });
    } else if (msg.type === 'getNeighbors') {
      const { hop1, hop2 } = computeNeighborhoodSets(msg.idx, msg.depth || 1);
      self.postMessage({
        type: 'neighbors',
        idx: msg.idx,
        hop1: Array.from(hop1),
        hop2: Array.from(hop2),
      });
    } else if (msg.type === 'findPath') {
      const result = findShortestPath(msg.startIdx, msg.endIdx);
      self.postMessage({ type: 'pathResult', result });
    } else if (msg.type === 'getTablePage') {
      const result = getTablePage(msg.tab, msg.page, msg.pageSize || 50);
      self.postMessage({ type: 'tablePage', result });
    } else if (msg.type === 'exportSubgraph') {
      const data = buildSubgraphExport(msg.selectedIdx);
      self.postMessage({ type: 'subgraphExport', data });
    } else if (msg.type === 'clearCache') {
      const ok = await clearCache();
      self.postMessage({ type: 'cacheCleared', ok });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
