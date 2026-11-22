/**
 * Three.js WebGL Sphere Renderer for the Healthcare World Model KG.
 * Uses GPU point sprites and shared line buffers with render-on-demand,
 * capped pixel ratio, node + edge ray picking, and graceful WebGL fallback.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

const VERTEX_SHADER = `
  attribute float aSize;
  attribute float aState;
  uniform float uSizeScale;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vState;

  void main() {
    vColor = color;
    vState = aState;
    if (aState < 0.5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    float dist = max(20.0, -mvPos.z);
    float boost = (aState > 3.5) ? 1.85 : ((aState > 2.5) ? 1.35 : 1.0);
    float sz = aSize * uSizeScale * boost * (260.0 / dist) * uPixelRatio;
    gl_PointSize = clamp(sz, 2.0 * uPixelRatio, 42.0 * uPixelRatio);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vState;

  void main() {
    if (vState < 0.5) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    // Bright selection ring for selected / path nodes
    if (vState > 3.5) {
      float ring = smoothstep(0.32, 0.37, d) * (1.0 - smoothstep(0.45, 0.50, d));
      float core = 1.0 - smoothstep(0.26, 0.34, d);
      vec3 col = mix(vColor * 1.25, vec3(1.0, 0.98, 0.85), ring);
      float alpha = clamp(core + ring, 0.0, 1.0);
      gl_FragColor = vec4(col, alpha);
      return;
    }

    // Secondary highlight for neighbors
    if (vState > 2.5) {
      float edge = smoothstep(0.35, 0.42, d) * (1.0 - smoothstep(0.46, 0.50, d));
      float core = 1.0 - smoothstep(0.34, 0.48, d);
      vec3 col = mix(vColor * 1.15, vec3(0.75, 0.94, 1.0), edge * 0.8);
      gl_FragColor = vec4(col, clamp(core + edge * 0.85, 0.0, 0.98));
      return;
    }

    // Dimmed background nodes when a selection is active
    float alpha = 1.0 - smoothstep(0.32, 0.50, d);
    if (vState > 1.5 && vState < 2.5) {
      gl_FragColor = vec4(vColor * 0.55, alpha * 0.16);
      return;
    }

    // Normal visible node
    gl_FragColor = vec4(vColor, alpha * 0.92);
  }
`;

export class SphereRenderer {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.cb = callbacks || {};
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.points = null;
    this.edgesMesh = null;
    this.highlightLines = null;
    this.guideGroup = null;

    this.nodeCount = 0;
    this.positions = null;
    this.colors = null;
    this.sizes = null;
    this.nodeVis = null;
    this.nodeStates = null;

    this.edgePositions = null;
    this.edgeIndices = null;

    this.selectedIdx = -1;
    this.hoveredIdx = -1;
    this.neighborSet = new Set();
    this.pathNodeSet = new Set();

    this.needsRender = true;
    this.autoRotate = false;
    this.animatingCamera = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.rafId = null;

    this.pointerDownPos = null;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.tmpVec = new THREE.Vector3();
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();
    this.tmpClosestRay = new THREE.Vector3();
    this.tmpClosestSeg = new THREE.Vector3();
  }

  init() {
    // Check WebGL availability
    try {
      const testCtx = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
      if (!testCtx) return false;
    } catch {
      return false;
    }

    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 600;
    const pr = Math.min(window.devicePixelRatio || 1, 2);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // Enables clean PNG screenshot export
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(48, width / height, 1, 2400);
    this.camera.position.set(0, 65, 340);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 24;
    this.controls.maxDistance = 950;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.45;
    this.controls.addEventListener('change', () => {
      this.requestRender();
      this.updateFloatingLabels();
    });

    this.buildSphereGuides();
    this.bindEvents();
    this.startLoop();
    return true;
  }

  buildSphereGuides() {
    this.guideGroup = new THREE.Group();
    const outerGeo = new THREE.SphereGeometry(120, 36, 20);
    const outerWire = new THREE.WireframeGeometry(outerGeo);
    const outerMat = new THREE.LineBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.14 });
    this.guideGroup.add(new THREE.LineSegments(outerWire, outerMat));

    const coreGeo = new THREE.SphereGeometry(48, 24, 14);
    const coreWire = new THREE.WireframeGeometry(coreGeo);
    const coreMat = new THREE.LineBasicMaterial({ color: 0x92400e, transparent: true, opacity: 0.16 });
    this.guideGroup.add(new THREE.LineSegments(coreWire, coreMat));

    this.scene.add(this.guideGroup);
  }

  setGraphData(positions, colors, sizes) {
    this.nodeCount = sizes.length;
    this.positions = positions;
    this.colors = colors;
    this.sizes = sizes;
    this.nodeVis = new Uint8Array(this.nodeCount).fill(1);
    this.nodeStates = new Float32Array(this.nodeCount).fill(1);

    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
      this.points.material.dispose();
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geom.setAttribute('aState', new THREE.BufferAttribute(this.nodeStates, 1));
    geom.computeBoundingSphere();

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSizeScale: { value: 1.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
    });

    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.requestRender();
  }

  updatePositions(positions) {
    this.positions = positions;
    if (this.points) {
      const attr = this.points.geometry.getAttribute('position');
      attr.array.set(positions);
      attr.needsUpdate = true;
      this.points.geometry.computeBoundingSphere();
    }
    this.requestRender();
    this.updateFloatingLabels();
  }

  updateVisibilityAndEdges(nodeVis, edgePositions, edgeColors, edgeIndices) {
    this.nodeVis = nodeVis;
    this.edgePositions = edgePositions;
    this.edgeIndices = edgeIndices;

    this.recomputeNodeStates();

    if (this.edgesMesh) {
      this.scene.remove(this.edgesMesh);
      this.edgesMesh.geometry.dispose();
      this.edgesMesh.material.dispose();
      this.edgesMesh = null;
    }

    if (edgePositions && edgePositions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: this._edgeOpacity ?? 0.28,
        depthWrite: false,
      });
      this.edgesMesh = new THREE.LineSegments(geom, mat);
      this.edgesMesh.frustumCulled = false;
      this.scene.add(this.edgesMesh);
    }

    this.requestRender();
    this.updateFloatingLabels();
  }

  setSelectionHighlight(selectedIdx, neighborIndices = [], pathNodeIndices = []) {
    this.selectedIdx = selectedIdx;
    this.neighborSet = new Set(neighborIndices);
    this.pathNodeSet = new Set(pathNodeIndices);
    this.recomputeNodeStates();

    // Draw bright highlight edges for path or selected node
    if (this.highlightLines) {
      this.scene.remove(this.highlightLines);
      this.highlightLines.geometry.dispose();
      this.highlightLines.material.dispose();
      this.highlightLines = null;
    }

    if (pathNodeIndices && pathNodeIndices.length > 1 && this.positions) {
      const segs = new Float32Array((pathNodeIndices.length - 1) * 6);
      for (let i = 0; i < pathNodeIndices.length - 1; i++) {
        const a = pathNodeIndices[i];
        const b = pathNodeIndices[i + 1];
        segs[i * 6]     = this.positions[a * 3];
        segs[i * 6 + 1] = this.positions[a * 3 + 1];
        segs[i * 6 + 2] = this.positions[a * 3 + 2];
        segs[i * 6 + 3] = this.positions[b * 3];
        segs[i * 6 + 4] = this.positions[b * 3 + 1];
        segs[i * 6 + 5] = this.positions[b * 3 + 2];
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(segs, 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.95 });
      this.highlightLines = new THREE.LineSegments(geom, mat);
      this.scene.add(this.highlightLines);
    } else if (selectedIdx >= 0 && neighborIndices.length > 0 && this.positions) {
      const cap = Math.min(neighborIndices.length, 400);
      const segs = new Float32Array(cap * 6);
      const sx = this.positions[selectedIdx * 3];
      const sy = this.positions[selectedIdx * 3 + 1];
      const sz = this.positions[selectedIdx * 3 + 2];
      for (let i = 0; i < cap; i++) {
        const b = neighborIndices[i];
        segs[i * 6] = sx; segs[i * 6 + 1] = sy; segs[i * 6 + 2] = sz;
        segs[i * 6 + 3] = this.positions[b * 3];
        segs[i * 6 + 4] = this.positions[b * 3 + 1];
        segs[i * 6 + 5] = this.positions[b * 3 + 2];
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(segs, 3));
      const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 });
      this.highlightLines = new THREE.LineSegments(geom, mat);
      this.scene.add(this.highlightLines);
    }

    this.requestRender();
    this.updateFloatingLabels();
  }

  recomputeNodeStates() {
    if (!this.nodeStates || !this.nodeVis) return;
    const hasFocus = this.selectedIdx >= 0 || this.pathNodeSet.size > 0;
    for (let i = 0; i < this.nodeCount; i++) {
      if (!this.nodeVis[i]) {
        this.nodeStates[i] = 0;
      } else if (i === this.selectedIdx || this.pathNodeSet.has(i)) {
        this.nodeStates[i] = 4;
      } else if (this.neighborSet.has(i)) {
        this.nodeStates[i] = 3;
      } else if (hasFocus) {
        this.nodeStates[i] = 2;
      } else {
        this.nodeStates[i] = 1;
      }
    }
    if (this.points) {
      this.points.geometry.getAttribute('aState').needsUpdate = true;
    }
  }

  setEdgeOpacity(val) {
    this._edgeOpacity = val;
    if (this.edgesMesh) {
      this.edgesMesh.material.opacity = val;
      this.requestRender();
    }
  }

  setNodeSizeScale(val) {
    if (this.points) {
      this.points.material.uniforms.uSizeScale.value = val;
      this.requestRender();
    }
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled && !this.reducedMotion;
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
    }
    this.requestRender();
  }

  resetCamera() {
    this.animateCameraTo(new THREE.Vector3(0, 65, 340), new THREE.Vector3(0, 0, 0));
  }

  focusOnNode(idx) {
    if (!this.positions || idx < 0 || idx >= this.nodeCount) return;
    const tx = this.positions[idx * 3];
    const ty = this.positions[idx * 3 + 1];
    const tz = this.positions[idx * 3 + 2];
    const target = new THREE.Vector3(tx, ty, tz);
    const dir = target.lengthSq() > 0.01 ? target.clone().normalize() : new THREE.Vector3(0, 0.2, 1).normalize();
    const camPos = target.clone().addScaledVector(dir, 92);
    this.animateCameraTo(camPos, target);
  }

  animateCameraTo(targetPos, targetLookAt) {
    if (!this.camera || !this.controls) return;
    if (this.reducedMotion) {
      this.camera.position.copy(targetPos);
      this.controls.target.copy(targetLookAt);
      this.controls.update();
      this.requestRender();
      return;
    }
    this.animatingCamera = {
      startTime: performance.now(),
      duration: 520,
      fromPos: this.camera.position.clone(),
      toPos: targetPos.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: targetLookAt.clone(),
    };
    this.requestRender();
  }

  getCameraState() {
    if (!this.camera || !this.controls) return null;
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
    };
  }

  setCameraState(state) {
    if (!state || !this.camera || !this.controls) return;
    this.camera.position.fromArray(state.position);
    this.controls.target.fromArray(state.target);
    this.controls.update();
    this.requestRender();
  }

  captureScreenshot() {
    if (!this.renderer) return null;
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL('image/png');
  }

  projectNodeToScreen(idx) {
    if (!this.positions || !this.camera || idx < 0 || idx >= this.nodeCount) return null;
    if (this.nodeVis && !this.nodeVis[idx]) return null;
    this.tmpVec.set(this.positions[idx * 3], this.positions[idx * 3 + 1], this.positions[idx * 3 + 2]);
    this.tmpVec.project(this.camera);
    if (this.tmpVec.z > 1) return null;
    const x = (this.tmpVec.x * 0.5 + 0.5) * this.canvas.clientWidth;
    const y = (-this.tmpVec.y * 0.5 + 0.5) * this.canvas.clientHeight;
    return { x, y };
  }

  updateFloatingLabels() {
    if (this.cb.onProjectLabels) {
      const hoveredPos = this.hoveredIdx >= 0 ? this.projectNodeToScreen(this.hoveredIdx) : null;
      const selectedPos = this.selectedIdx >= 0 ? this.projectNodeToScreen(this.selectedIdx) : null;
      this.cb.onProjectLabels(this.hoveredIdx, hoveredPos, this.selectedIdx, selectedPos);
    }
  }

  /* ---------- Picking (Nodes & Edges) ---------- */

  pickAtPointer(clientX, clientY) {
    if (!this.camera || !this.positions) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const ray = this.raycaster.ray;

    // 1. Pick closest visible node within screen-space tolerance
    let bestNode = -1;
    let bestScore = Infinity;
    const camDist = this.camera.position.length();
    const baseThresh = Math.max(1.2, camDist * 0.015);

    for (let i = 0; i < this.nodeCount; i++) {
      if (!this.nodeVis[i]) continue;
      this.tmpVec.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
      const distToRay = ray.distanceToPoint(this.tmpVec);
      const nodeThresh = baseThresh * (0.65 + (this.sizes[i] || 5) * 0.08);
      if (distToRay < nodeThresh) {
        const depth = ray.origin.distanceTo(this.tmpVec);
        const score = distToRay * 4.0 + depth * 0.008;
        if (score < bestScore) {
          bestScore = score;
          bestNode = i;
        }
      }
    }
    if (bestNode >= 0) return { kind: 'node', idx: bestNode };

    // 2. If no node hit, pick closest visible relationship edge
    if (this.edgePositions && this.edgeIndices && this.edgeIndices.length > 0) {
      let bestEdge = -1;
      let bestEdgeDistSq = (baseThresh * 0.85) ** 2;
      const maxCheck = Math.min(this.edgeIndices.length, 20000);
      for (let k = 0; k < maxCheck; k++) {
        this.tmpA.set(this.edgePositions[k * 6], this.edgePositions[k * 6 + 1], this.edgePositions[k * 6 + 2]);
        this.tmpB.set(this.edgePositions[k * 6 + 3], this.edgePositions[k * 6 + 4], this.edgePositions[k * 6 + 5]);
        const dSq = ray.distanceSqToSegment(this.tmpA, this.tmpB, this.tmpClosestRay, this.tmpClosestSeg);
        if (dSq < bestEdgeDistSq) {
          bestEdgeDistSq = dSq;
          bestEdge = this.edgeIndices[k];
        }
      }
      if (bestEdge >= 0) return { kind: 'edge', edgeIdx: bestEdge };
    }

    return null;
  }

  bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.animatingCamera = null;
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (!this.pointerDownPos) return;
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      this.pointerDownPos = null;
      if (Math.hypot(dx, dy) > 5) return; // Dragged, not clicked

      const hit = this.pickAtPointer(e.clientX, e.clientY);
      if (hit && hit.kind === 'node' && this.cb.onSelectNode) {
        this.cb.onSelectNode(hit.idx);
      } else if (hit && hit.kind === 'edge' && this.cb.onSelectEdge) {
        this.cb.onSelectEdge(hit.edgeIdx);
      }
    });

    this.canvas.addEventListener('dblclick', (e) => {
      const hit = this.pickAtPointer(e.clientX, e.clientY);
      if (hit && hit.kind === 'node') {
        if (this.cb.onSelectNode) this.cb.onSelectNode(hit.idx);
        this.focusOnNode(hit.idx);
      }
    });

    let hoverTimer = null;
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.buttons !== 0) return;
      if (hoverTimer) return;
      hoverTimer = setTimeout(() => {
        hoverTimer = null;
        const hit = this.pickAtPointer(e.clientX, e.clientY);
        const newHover = hit && hit.kind === 'node' ? hit.idx : -1;
        this.canvas.style.cursor = hit ? 'pointer' : 'grab';
        if (newHover !== this.hoveredIdx) {
          this.hoveredIdx = newHover;
          if (this.cb.onHoverNode) this.cb.onHoverNode(newHover);
          this.updateFloatingLabels();
        }
      }, 36);
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const host = this.canvas.parentElement;
    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.requestRender();
    this.updateFloatingLabels();
  }

  requestRender() {
    this.needsRender = true;
  }

  startLoop() {
    const tick = (now) => {
      this.rafId = requestAnimationFrame(tick);
      if (!this.renderer) return;

      let active = this.needsRender || this.autoRotate;

      if (this.animatingCamera) {
        const a = this.animatingCamera;
        const t = Math.min(1, (now - a.startTime) / a.duration);
        const ease = 1 - Math.pow(1 - t, 3);
        this.camera.position.lerpVectors(a.fromPos, a.toPos, ease);
        this.controls.target.lerpVectors(a.fromTarget, a.toTarget, ease);
        if (t >= 1) this.animatingCamera = null;
        active = true;
      }

      if (this.controls && this.controls.update()) {
        active = true;
      }

      if (active) {
        this.renderer.render(this.scene, this.camera);
        this.needsRender = false;
        this.updateFloatingLabels();
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
