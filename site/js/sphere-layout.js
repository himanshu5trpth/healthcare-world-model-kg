/**
 * Deterministic spherical layout engine & visual palette for the Healthcare World Model KG.
 * Position and distance support navigation only; they do not represent scientific similarity.
 */

export const CLASS_PALETTE = {
  // Paper anchors
  PaperVersion:         { color: '#38bdf8', size: 12.0, group: 'Papers',       label: 'Paper Version' },
  PaperRecord:          { color: '#0ea5e9', size: 8.5,  group: 'Papers',       label: 'Paper Record' },

  // Shared ontology / catalog core
  BlueprintModule:      { color: '#f59e0b', size: 14.0, group: 'Ontology',     label: 'Blueprint Module' },
  FeatureDefinition:    { color: '#fbbf24', size: 7.5,  group: 'Ontology',     label: 'Feature Definition' },
  CapabilityLevel:      { color: '#f97316', size: 11.0, group: 'Ontology',     label: 'Capability Level' },
  ReadinessFacet:       { color: '#fb923c', size: 10.0, group: 'Ontology',     label: 'Readiness Facet' },
  WorldType:            { color: '#eab308', size: 10.5, group: 'Ontology',     label: 'World Type' },
  EvidenceGate:         { color: '#facc15', size: 9.0,  group: 'Ontology',     label: 'Evidence Gate' },
  BlueprintProfile:     { color: '#fde047', size: 9.0,  group: 'Ontology',     label: 'Blueprint Profile' },
  ClassDefinition:      { color: '#94a3b8', size: 5.5,  group: 'Ontology',     label: 'Class Definition' },
  RelationDefinition:   { color: '#64748b', size: 5.5,  group: 'Ontology',     label: 'Relation Definition' },

  // Models & system architecture
  ModelVersion:         { color: '#2dd4bf', size: 8.0,  group: 'Models',       label: 'Model Version' },
  SystemComposition:    { color: '#14b8a6', size: 7.5,  group: 'Models',       label: 'System Composition' },
  ModuleImplementation: { color: '#0d9488', size: 7.0,  group: 'Models',       label: 'Module Implementation' },
  IntendedUseContext:   { color: '#5eead4', size: 6.5,  group: 'Models',       label: 'Intended Use Context' },

  // Studies, cohorts & datasets
  Study:                { color: '#34d399', size: 7.5,  group: 'Studies',      label: 'Study' },
  HumanStudy:           { color: '#10b981', size: 9.0,  group: 'Studies',      label: 'Human Study' },
  Cohort:               { color: '#6ee7b7', size: 6.5,  group: 'Studies',      label: 'Cohort' },
  DatasetVersion:       { color: '#4ade80', size: 7.0,  group: 'Studies',      label: 'Dataset Version' },
  EvaluationRun:        { color: '#86efac', size: 6.5,  group: 'Studies',      label: 'Evaluation Run' },
  EvaluationProtocol:   { color: '#a7f3d0', size: 6.5,  group: 'Studies',      label: 'Evaluation Protocol' },

  // Measurements & evidence
  MetricResult:         { color: '#fb7185', size: 5.8,  group: 'Metrics',      label: 'Metric Result' },
  EvidenceFragment:     { color: '#c084fc', size: 5.0,  group: 'Evidence',     label: 'Evidence Fragment' },

  // Assertions
  Assertion:            { color: '#60a5fa', size: 3.4,  group: 'Assertions',   label: 'Assertion' },
  Claim:                { color: '#f472b6', size: 7.0,  group: 'Assertions',   label: 'Claim' },
};

export const DEFAULT_CLASS_STYLE = { color: '#94a3b8', size: 5.5, group: 'Other', label: 'Other Entity' };

export const STATE_META = {
  present:        { icon: '✓', label: 'Present',        cls: 'badge-present' },
  partial:        { icon: '◐', label: 'Partial',        cls: 'badge-partial' },
  absent:         { icon: '✕', label: 'Absent',         cls: 'badge-absent' },
  unknown:        { icon: '?', label: 'Unknown',        cls: 'badge-unknown' },
  not_reported:   { icon: '—', label: 'Not Reported',   cls: 'badge-not_reported' },
  not_applicable: { icon: '⊘', label: 'Not Applicable', cls: 'badge-not_applicable' },
  not_assessed:   { icon: '◷', label: 'Not Assessed',   cls: 'badge-not_assessed' },
  conflicting:    { icon: '⚡', label: 'Conflicting',   cls: 'badge-conflicting' },
  unspecified:    { icon: '·', label: 'Unspecified',    cls: 'badge-not_reported' },
};

export function getClassStyle(classId) {
  return CLASS_PALETTE[classId] || DEFAULT_CLASS_STYLE;
}

export function hexToRgbNorm(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Deterministic 32-bit FNV-1a hash returning [0, 1) */
export function hash01(str, salt = 0) {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0) / 4294967296;
}

/** Point on unit Fibonacci sphere for index i of n */
export function fibonacciPoint(i, n) {
  if (n <= 1) return [0, 1, 0];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i;
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

/** Build an orthonormal tangent basis (u, v) perpendicular to unit vector n */
function tangentBasis(nx, ny, nz) {
  const ax = Math.abs(ny) < 0.9 ? 0 : 1;
  const ay = Math.abs(ny) < 0.9 ? 1 : 0;
  const az = 0;
  // u = normalize(cross(a, n))
  let ux = ay * nz - az * ny;
  let uy = az * nx - ax * nz;
  let uz = ax * ny - ay * nx;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul; uy /= ul; uz /= ul;
  // v = cross(n, u)
  const vx = ny * uz - nz * uy;
  const vy = nz * ux - nx * uz;
  const vz = nx * uy - ny * ux;
  return [ux, uy, uz, vx, vy, vz];
}

/** Place a point around unit anchor direction (ax,ay,az) at radius R with angular spread */
function placeAroundAnchor(ax, ay, az, radius, maxAngle, id) {
  const [ux, uy, uz, vx, vy, vz] = tangentBasis(ax, ay, az);
  const angle = Math.sqrt(hash01(id, 11)) * maxAngle;
  const phi = hash01(id, 29) * Math.PI * 2;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const dx = ax * cosA + (ux * Math.cos(phi) + vx * Math.sin(phi)) * sinA;
  const dy = ay * cosA + (uy * Math.cos(phi) + vy * Math.sin(phi)) * sinA;
  const dz = az * cosA + (uz * Math.cos(phi) + vz * Math.sin(phi)) * sinA;
  return [dx * radius, dy * radius, dz * radius];
}

/**
 * Compute Full Sphere layout coordinates for all nodes.
 * Returns Float32Array of length nodes.length * 3.
 */
export function computeFullSphereLayout(nodes, paperIdsSorted, nodePaperId) {
  const count = nodes.length;
  const pos = new Float32Array(count * 3);

  // 1. Anchor all 211 paper versions evenly on the primary Fibonacci sphere
  const paperDir = new Map();
  const numPapers = paperIdsSorted.length;
  for (let i = 0; i < numPapers; i++) {
    paperDir.set(paperIdsSorted[i], fibonacciPoint(i, numPapers));
  }

  // 2. Partition catalog nodes for structured inner ontology core
  const blueprintModules = [];
  const features = [];
  const otherCatalog = [];
  for (let i = 0; i < count; i++) {
    const n = nodes[i];
    if (!n.isCatalog) continue;
    if (n.class_id === 'BlueprintModule') blueprintModules.push(i);
    else if (n.class_id === 'FeatureDefinition') features.push(i);
    else otherCatalog.push(i);
  }
  blueprintModules.sort((a, b) => nodes[a].id.localeCompare(nodes[b].id));
  features.sort((a, b) => nodes[a].id.localeCompare(nodes[b].id));
  otherCatalog.sort((a, b) => nodes[a].id.localeCompare(nodes[b].id));

  const moduleDir = new Map();
  for (let k = 0; k < blueprintModules.length; k++) {
    const idx = blueprintModules[k];
    const angle = (k / Math.max(1, blueprintModules.length)) * Math.PI * 2;
    const dir = [Math.cos(angle), 0, Math.sin(angle)];
    moduleDir.set(nodes[idx].id, dir);
    pos[idx * 3]     = dir[0] * 48;
    pos[idx * 3 + 1] = dir[1] * 48;
    pos[idx * 3 + 2] = dir[2] * 48;
  }

  for (let k = 0; k < features.length; k++) {
    const idx = features[k];
    const n = nodes[idx];
    const mods = n.module_ids || [];
    const mDir = mods.length && moduleDir.has(mods[0])
      ? moduleDir.get(mods[0])
      : fibonacciPoint(k, features.length);
    const [x, y, z] = placeAroundAnchor(mDir[0], mDir[1], mDir[2], 62 + hash01(n.id, 3) * 8, 0.34, n.id);
    pos[idx * 3] = x;
    pos[idx * 3 + 1] = y;
    pos[idx * 3 + 2] = z;
  }

  for (let k = 0; k < otherCatalog.length; k++) {
    const idx = otherCatalog[k];
    const n = nodes[idx];
    const [dx, dy, dz] = fibonacciPoint(k, otherCatalog.length);
    let r = 34;
    if (n.class_id === 'CapabilityLevel' || n.class_id === 'ReadinessFacet') r = 38;
    else if (n.class_id === 'WorldType' || n.class_id === 'EvidenceGate' || n.class_id === 'BlueprintProfile') r = 44;
    else r = 26;
    pos[idx * 3] = dx * r;
    pos[idx * 3 + 1] = dy * r;
    pos[idx * 3 + 2] = dz * r;
  }

  // 3. Place graph nodes around their owning PaperVersion anchor on layered spherical shells
  for (let i = 0; i < count; i++) {
    const n = nodes[i];
    if (n.isCatalog) continue;
    const pid = nodePaperId[i];
    const dir = (pid && paperDir.has(pid))
      ? paperDir.get(pid)
      : fibonacciPoint(Math.floor(hash01(n.id, 7) * 512), 512);

    const cls = n.class_id;
    let x, y, z;
    if (cls === 'PaperVersion') {
      const r = 120;
      x = dir[0] * r; y = dir[1] * r; z = dir[2] * r;
    } else if (cls === 'PaperRecord') {
      [x, y, z] = placeAroundAnchor(dir[0], dir[1], dir[2], 116, 0.03, n.id);
    } else if (cls === 'ModelVersion' || cls === 'SystemComposition' || cls === 'ModuleImplementation' || cls === 'IntendedUseContext') {
      const r = 94 + hash01(n.id, 41) * 14;
      [x, y, z] = placeAroundAnchor(dir[0], dir[1], dir[2], r, 0.11, n.id);
    } else if (cls === 'Study' || cls === 'HumanStudy' || cls === 'Cohort' || cls === 'DatasetVersion' || cls === 'EvaluationRun' || cls === 'EvaluationProtocol') {
      const r = 104 + hash01(n.id, 43) * 11;
      [x, y, z] = placeAroundAnchor(dir[0], dir[1], dir[2], r, 0.12, n.id);
    } else if (cls === 'MetricResult') {
      const r = 132 + hash01(n.id, 47) * 10;
      [x, y, z] = placeAroundAnchor(dir[0], dir[1], dir[2], r, 0.13, n.id);
    } else if (cls === 'EvidenceFragment') {
      const r = 140 + hash01(n.id, 53) * 12;
      [x, y, z] = placeAroundAnchor(dir[0], dir[1], dir[2], r, 0.14, n.id);
    } else if (cls === 'Assertion') {
      const r = 154 + hash01(n.id, 59) * 30;
      [x, y, z] = placeAroundAnchor(dir[0], dir[1], dir[2], r, 0.155, n.id);
    } else {
      const r = 126 + hash01(n.id, 61) * 10;
      [x, y, z] = placeAroundAnchor(dir[0], dir[1], dir[2], r, 0.12, n.id);
    }

    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
  }

  return pos;
}

/**
 * Compute Architecture / Component View layout:
 * BlueprintModules M1-M10 form the central equatorial ring; features orbit their modules;
 * papers and assertions cluster around their primary module.
 */
export function computeArchitectureLayout(nodes, nodePrimaryModule, basePositions) {
  const count = nodes.length;
  const pos = new Float32Array(count * 3);

  const moduleList = [];
  for (let i = 0; i < count; i++) {
    if (nodes[i].class_id === 'BlueprintModule') moduleList.push(nodes[i].id);
  }
  moduleList.sort();
  const modDir = new Map();
  for (let k = 0; k < moduleList.length; k++) {
    const a = (k / Math.max(1, moduleList.length)) * Math.PI * 2;
    modDir.set(moduleList[k], [Math.cos(a), 0, Math.sin(a)]);
  }

  for (let i = 0; i < count; i++) {
    const n = nodes[i];
    if (n.class_id === 'BlueprintModule' && modDir.has(n.id)) {
      const d = modDir.get(n.id);
      pos[i * 3] = d[0] * 78;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = d[2] * 78;
      continue;
    }
    if (n.class_id === 'CapabilityLevel' || n.class_id === 'ReadinessFacet') {
      const sign = n.class_id === 'CapabilityLevel' ? 1 : -1;
      const a = hash01(n.id, 13) * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * 32;
      pos[i * 3 + 1] = sign * 110;
      pos[i * 3 + 2] = Math.sin(a) * 32;
      continue;
    }
    const mid = nodePrimaryModule[i];
    if (mid && modDir.has(mid)) {
      const d = modDir.get(mid);
      const r = n.class_id === 'FeatureDefinition'
        ? 98 + hash01(n.id, 17) * 12
        : n.class_id === 'PaperVersion'
          ? 128 + hash01(n.id, 19) * 14
          : 145 + hash01(n.id, 23) * 34;
      const [x, y, z] = placeAroundAnchor(d[0], d[1], d[2], r, 0.30, n.id);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    } else {
      // Fallback: place on outer halo preserving relative direction
      pos[i * 3] = basePositions[i * 3] * 1.05;
      pos[i * 3 + 1] = basePositions[i * 3 + 1] * 1.05;
      pos[i * 3 + 2] = basePositions[i * 3 + 2] * 1.05;
    }
  }
  return pos;
}

/**
 * Compute Paper-Centered layout for a specific paperId.
 */
export function computePaperCenteredLayout(nodes, paperId, nodePaperId, basePositions) {
  const count = nodes.length;
  const pos = new Float32Array(count * 3);
  const owned = [];
  for (let i = 0; i < count; i++) {
    if (nodePaperId[i] === paperId) owned.push(i);
  }
  const ringModels = [];
  const ringEv = [];
  const ringAssert = [];

  for (const idx of owned) {
    const cls = nodes[idx].class_id;
    if (cls === 'PaperVersion') {
      pos[idx * 3] = 0; pos[idx * 3 + 1] = 0; pos[idx * 3 + 2] = 0;
    } else if (cls === 'PaperRecord') {
      pos[idx * 3] = 0; pos[idx * 3 + 1] = 14; pos[idx * 3 + 2] = 0;
    } else if (cls === 'Assertion') {
      ringAssert.push(idx);
    } else if (cls === 'EvidenceFragment' || cls === 'MetricResult') {
      ringEv.push(idx);
    } else {
      ringModels.push(idx);
    }
  }

  for (let k = 0; k < ringModels.length; k++) {
    const [dx, dy, dz] = fibonacciPoint(k, ringModels.length);
    const idx = ringModels[k];
    pos[idx * 3] = dx * 42; pos[idx * 3 + 1] = dy * 42; pos[idx * 3 + 2] = dz * 42;
  }
  for (let k = 0; k < ringEv.length; k++) {
    const [dx, dy, dz] = fibonacciPoint(k, ringEv.length);
    const idx = ringEv[k];
    pos[idx * 3] = dx * 72; pos[idx * 3 + 1] = dy * 72; pos[idx * 3 + 2] = dz * 72;
  }
  for (let k = 0; k < ringAssert.length; k++) {
    const [dx, dy, dz] = fibonacciPoint(k, ringAssert.length);
    const idx = ringAssert[k];
    pos[idx * 3] = dx * 102; pos[idx * 3 + 1] = dy * 102; pos[idx * 3 + 2] = dz * 102;
  }

  const ownedSet = new Set(owned);
  for (let i = 0; i < count; i++) {
    if (ownedSet.has(i)) continue;
    pos[i * 3] = basePositions[i * 3] * 1.25;
    pos[i * 3 + 1] = basePositions[i * 3 + 1] * 1.25;
    pos[i * 3 + 2] = basePositions[i * 3 + 2] * 1.25;
  }
  return pos;
}

/**
 * Compute Neighborhood-Centered layout for a selected node and its 1-hop / 2-hop sets.
 */
export function computeNeighborhoodLayout(nodes, centerIdx, hop1List, hop2List, basePositions) {
  const count = nodes.length;
  const pos = new Float32Array(count * 3);
  const placed = new Set();

  if (centerIdx >= 0 && centerIdx < count) {
    pos[centerIdx * 3] = 0; pos[centerIdx * 3 + 1] = 0; pos[centerIdx * 3 + 2] = 0;
    placed.add(centerIdx);
  }
  for (let k = 0; k < hop1List.length; k++) {
    const idx = hop1List[k];
    if (placed.has(idx)) continue;
    const [dx, dy, dz] = fibonacciPoint(k, hop1List.length);
    pos[idx * 3] = dx * 52; pos[idx * 3 + 1] = dy * 52; pos[idx * 3 + 2] = dz * 52;
    placed.add(idx);
  }
  for (let k = 0; k < hop2List.length; k++) {
    const idx = hop2List[k];
    if (placed.has(idx)) continue;
    const [dx, dy, dz] = fibonacciPoint(k, hop2List.length);
    pos[idx * 3] = dx * 106; pos[idx * 3 + 1] = dy * 106; pos[idx * 3 + 2] = dz * 106;
    placed.add(idx);
  }
  for (let i = 0; i < count; i++) {
    if (placed.has(i)) continue;
    pos[i * 3] = basePositions[i * 3] * 1.3;
    pos[i * 3 + 1] = basePositions[i * 3 + 1] * 1.3;
    pos[i * 3 + 2] = basePositions[i * 3 + 2] * 1.3;
  }
  return pos;
}
