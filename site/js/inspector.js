/**
 * Safe, provenance-preserving Inspector & Paper Dossier renderer.
 * All source text is inserted strictly via textContent (never innerHTML).
 */

import { getClassStyle, STATE_META } from './sphere-layout.js';

const KG_PREDICATE_DOCS = {
  'kg:subject': 'Export metadata: links an Assertion to the entity it describes.',
  'kg:feature': 'Export metadata: links a Feature Assertion to its FeatureDefinition catalog node.',
  'kg:predicate': 'Export metadata: links a Relation Assertion to its RelationDefinition catalog node.',
  'kg:object': 'Export metadata: links a Relation Assertion to its target object node.',
  'kg:evidence': 'Export metadata: generic evidence reference (occurrence does not imply entailment).',
  'kg:sourceVersion': 'Export metadata: links an EvidenceFragment to the PaperVersion it came from.',
  'kg:level': 'Export metadata: links a Capability Assessment to a CapabilityLevel (L0–L4).',
  'kg:facet': 'Export metadata: links a Readiness Assessment to a ReadinessFacet (R0–R8).',
  'kg:gate': 'Export metadata: links a Gate Assessment to an EvidenceGate (G01–G12).',
  'kg:basedOnAssertion': 'Export metadata: links an assessment to the feature assertions cited as its basis.',
  'kg:ontologyModuleMembership': 'Ontology-derived feature-to-module membership (not paper evidence).',
};

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

function makeBadge(text, cls = '') {
  return el('span', { class: `badge ${cls}`.trim() }, text);
}

function makeStateBadge(state) {
  const key = state || 'unspecified';
  const meta = STATE_META[key] || { icon: '·', label: key, cls: 'badge-not_reported' };
  return makeBadge(`${meta.icon} ${meta.label}`, meta.cls);
}

function detectEvidenceMode(evProps, paperId) {
  const content = (evProps.content || '').toLowerCase();
  const locKind = (evProps.locator && evProps.locator.kind ? String(evProps.locator.kind) : '').toLowerCase();
  const verif = (evProps.verification_status || '').toLowerCase();
  if (
    locKind.includes('visual') ||
    locKind.includes('figure') ||
    locKind.includes('image') ||
    content.includes('visual paraphrase') ||
    content.includes('[visual') ||
    content.includes('paraphrase')
  ) {
    return { isVisual: true, label: 'Visual Paraphrase / Figure Inspection (not literal quote)' };
  }
  if (paperId === 'A20' || content.includes('ocr')) {
    return { isVisual: true, label: 'OCR / Image-Only Source Evidence (A20 — not native PDF text)' };
  }
  if (verif === 'occurrence_only') {
    return { isVisual: false, label: 'Quote Occurrence Only (entailment not established)' };
  }
  return { isVisual: false, label: 'Literal Quotation / Source Excerpt' };
}

export class Inspector {
  constructor(callbacks) {
    this.cb = callbacks || {};
    this.activeTab = 'details';
    this.currentSelection = null; // { kind: 'node'|'edge', data }
    this.manifest = null;
    this.paperCache = new Map();

    this.els = {
      badges: document.getElementById('inspector-badge-row'),
      title: document.getElementById('inspector-title'),
      subtitle: document.getElementById('inspector-subtitle'),
      quickActions: document.getElementById('inspector-quick-actions'),
      btnPaperView: document.getElementById('btn-insp-paper-view'),
      body: document.getElementById('inspector-body'),
      tabs: Array.from(document.querySelectorAll('[data-insp-tab]')),
    };

    for (const tabBtn of this.els.tabs) {
      tabBtn.addEventListener('click', () => {
        this.activeTab = tabBtn.dataset.inspTab;
        this.updateTabButtons();
        this.renderActiveTab();
      });
    }
  }

  setManifest(manifest) {
    this.manifest = manifest;
  }

  updateTabButtons() {
    for (const b of this.els.tabs) {
      const isAct = b.dataset.inspTab === this.activeTab;
      b.classList.toggle('active', isAct);
      b.setAttribute('aria-selected', String(isAct));
    }
  }

  clear() {
    this.currentSelection = null;
    this.els.badges.replaceChildren();
    this.els.title.textContent = 'Select a node or edge';
    this.els.subtitle.textContent = 'Click any point or relationship on the sphere, or search above.';
    this.els.quickActions.classList.add('hidden');
    this.els.body.replaceChildren();
    const wrap = el('div', { class: 'empty-inspector' });
    wrap.appendChild(el('p', {}, 'Click any entity or relationship to inspect its full provenance, evidence, and raw properties.'));
    wrap.appendChild(el('p', { class: 'hint-note' }, 'Try searching for B016, A20, 091, or B066 to inspect ambiguity, image-only OCR receipts, unavailable supplements, and configuration-scoped assessments.'));
    this.els.body.appendChild(wrap);
  }

  showNode(details) {
    if (!details) return;
    this.currentSelection = { kind: 'node', data: details };
    const n = details.node;
    const style = getClassStyle(n.class_id);

    this.els.badges.replaceChildren();
    const clsBadge = el('span', { class: 'badge' });
    clsBadge.appendChild(el('span', { class: 'color-dot', style: `background:${style.color}` }));
    clsBadge.appendChild(document.createTextNode(n.class_id));
    this.els.badges.appendChild(clsBadge);

    if (n.isCatalog) {
      this.els.badges.appendChild(makeBadge('Ontology Catalog', 'badge-sci'));
    }
    if (details.paperId) {
      this.els.badges.appendChild(makeBadge(`Paper ${details.paperId}`, ''));
    }
    const p = n.properties || {};
    if (p.assessment_state) {
      this.els.badges.appendChild(makeStateBadge(p.assessment_state));
    }
    if (p.evidence_stage) {
      this.els.badges.appendChild(makeBadge(`Stage: ${p.evidence_stage}`, ''));
    }

    this.els.title.textContent = details.label || n.id;
    this.els.subtitle.textContent = n.id;
    this.els.quickActions.classList.remove('hidden');
    this.els.btnPaperView.classList.toggle('hidden', !details.paperId);

    this.renderActiveTab();
  }

  showEdge(details) {
    if (!details) return;
    this.currentSelection = { kind: 'edge', data: details };
    const ed = details.edge;

    this.els.badges.replaceChildren();
    this.els.badges.appendChild(
      details.isKg
        ? makeBadge('kg: Serialization / Provenance Link', 'badge-kg')
        : makeBadge('Scientific Ontology Relation', 'badge-sci')
    );
    if (details.paperId) {
      this.els.badges.appendChild(makeBadge(`Paper ${details.paperId}`, ''));
    }

    this.els.title.textContent = ed.predicate_id;
    this.els.subtitle.textContent = ed.id;
    this.els.quickActions.classList.add('hidden');
    if (this.activeTab === 'paper' && !details.paperId) {
      this.activeTab = 'details';
      this.updateTabButtons();
    }
    this.renderActiveTab();
  }

  renderActiveTab() {
    this.els.body.replaceChildren();
    if (!this.currentSelection) return;

    if (this.activeTab === 'raw') {
      const pre = el('pre', { class: 'raw-json' });
      const rawObj = this.currentSelection.kind === 'node'
        ? this.currentSelection.data.node
        : this.currentSelection.data.edge;
      pre.textContent = JSON.stringify(rawObj, null, 2);
      this.els.body.appendChild(pre);
      return;
    }

    if (this.activeTab === 'paper') {
      const pid = this.currentSelection.data.paperId;
      if (!pid) {
        this.els.body.appendChild(el('p', { class: 'hint-note' }, 'This entity is a shared ontology/catalog concept and does not belong to a single paper.'));
        return;
      }
      this.renderPaperDossier(pid);
      return;
    }

    if (this.currentSelection.kind === 'edge') {
      this.renderEdgeDetails(this.currentSelection.data);
      return;
    }

    if (this.activeTab === 'connections') {
      this.renderNodeConnections(this.currentSelection.data);
    } else {
      this.renderNodeDetails(this.currentSelection.data);
    }
  }

  makeNodeLink(idx, text, fallbackId) {
    const btn = el('button', { class: 'node-link-btn', type: 'button' }, text || fallbackId);
    btn.addEventListener('click', () => {
      if (this.cb.onSelectNode) {
        if (typeof idx === 'number' && idx >= 0) this.cb.onSelectNode(idx);
        else if (fallbackId && this.cb.onSelectNodeById) this.cb.onSelectNodeById(fallbackId);
      }
    });
    return btn;
  }

  makeKvCard(title, rows) {
    const card = el('div', { class: 'insp-card' });
    card.appendChild(el('h3', {}, title));
    const grid = el('div', { class: 'kv-grid' });
    for (const [k, v] of rows) {
      grid.appendChild(el('div', { class: 'kv-key' }, k));
      const valDiv = el('div', { class: 'kv-val' });
      if (v instanceof HTMLElement) {
        valDiv.appendChild(v);
      } else if (Array.isArray(v)) {
        valDiv.textContent = v.length ? v.join(', ') : '—';
      } else if (v && typeof v === 'object') {
        valDiv.textContent = JSON.stringify(v);
      } else {
        valDiv.textContent = v !== undefined && v !== null && v !== '' ? String(v) : '—';
      }
      grid.appendChild(valDiv);
    }
    card.appendChild(grid);
    return card;
  }

  makeEvidenceCard(evNode, paperId) {
    const p = evNode.properties || evNode;
    const mode = detectEvidenceMode(p, paperId);
    const card = el('div', { class: `evidence-card ${mode.isVisual ? 'visual-paraphrase' : ''}`.trim() });

    const topMeta = el('div', { class: 'evidence-meta' });
    topMeta.appendChild(makeBadge(mode.label, mode.isVisual ? 'badge-warn' : 'badge-sci'));
    if (p.verification_status) {
      topMeta.appendChild(makeBadge(`Verification: ${p.verification_status}`, ''));
    }
    card.appendChild(topMeta);

    card.appendChild(el('div', { class: 'evidence-quote' }, p.content || '(No fragment content recorded)'));

    const botMeta = el('div', { class: 'evidence-meta' });
    const loc = p.locator || {};
    const pageNum = loc.page || null;
    if (pageNum) botMeta.appendChild(el('span', {}, `Page ${pageNum}`));
    if (loc.section_or_table) botMeta.appendChild(el('span', {}, `· ${loc.section_or_table}`));
    if (p.source_version) botMeta.appendChild(el('span', {}, `· ${p.source_version}`));
    if (p.review_date) botMeta.appendChild(el('span', {}, `· Reviewed ${p.review_date}`));
    if (p.extractor_or_reviewer) botMeta.appendChild(el('span', {}, `(${p.extractor_or_reviewer})`));

    if (paperId) {
      const pdfBtn = el('button', { class: 'btn btn-xs btn-accent', type: 'button' }, pageNum ? `Open Source (p. ${pageNum})` : 'Open Source');
      pdfBtn.addEventListener('click', () => {
        if (this.cb.onOpenPdf) this.cb.onOpenPdf(paperId, pageNum);
      });
      botMeta.appendChild(pdfBtn);
    }
    card.appendChild(botMeta);
    return card;
  }

  renderNodeDetails(details) {
    const n = details.node;
    const p = n.properties || {};

    // Special A20 notice
    if (details.paperId === 'A20') {
      this.els.body.appendChild(
        el(
          'div',
          { class: 'notice-banner' },
          'Image-only source PDF (A20 — Archimedes): OCR text and visual-review receipts are available in the Paper Dossier tab. OCR is not native selectable source text, and visual paraphrases are not direct quotations.'
        )
      );
    }

    // Paper quick bar if applicable
    if (details.paperId && details.registry) {
      const r = details.registry;
      const bar = el('div', { class: 'insp-card' });
      bar.appendChild(el('h3', {}, `Owning Paper: ${details.paperId}`));
      bar.appendChild(el('div', { style: 'font-weight:600;margin-bottom:6px;' }, `${r.title} (${r.year || 'n.d.'})`));
      const row = el('div', { class: 'btn-row' });
      const btnPdf = el('button', { class: 'btn btn-xs btn-accent', type: 'button' }, `Open Source (${r.pdf_pages || '?'} pp.)`);
      btnPdf.addEventListener('click', () => this.cb.onOpenPdf && this.cb.onOpenPdf(details.paperId, null));
      row.appendChild(btnPdf);

      const btnDossier = el('button', { class: 'btn btn-xs btn-ghost', type: 'button' }, 'Open Paper Dossier');
      btnDossier.addEventListener('click', () => {
        this.activeTab = 'paper';
        this.updateTabButtons();
        this.renderActiveTab();
      });
      row.appendChild(btnDossier);

      const annLink = el('a', { class: 'btn btn-xs btn-ghost', href: `./data/annotations/${details.paperId}.json`, target: '_blank', rel: 'noopener' }, 'Annotation JSON');
      row.appendChild(annLink);
      bar.appendChild(row);
      this.els.body.appendChild(bar);
    }

    // Specialized Assertion card
    if (n.class_id === 'Assertion') {
      const subjectEdge = details.outgoing.find((e) => e.predicate_id === 'kg:subject');
      const subjectEl = subjectEdge
        ? this.makeNodeLink(subjectEdge.targetIdx, `${subjectEdge.targetLabel} (${subjectEdge.targetClass})`, subjectEdge.targetId)
        : (p.subject_id || '—');

      const rows = [
        ['Assertion Kind', p.kind || '—'],
        ['Subject / Scope', subjectEl],
        ['Feature / Target', p.feature_id || p.predicate_id || p.level_id || p.facet_id || p.gate_id || '—'],
        ['Assessment State', makeStateBadge(p.assessment_state)],
        ['Evidence Stage', p.evidence_stage || '—'],
        ['Assertion Basis', p.assertion_basis || '—'],
        ['Verification', p.verification_status || '—'],
        ['Confidence', p.confidence ?? '—'],
        ['Missingness Reason', p.missingness_reason || '—'],
        ['Rationale', p.rationale || p.notes || '—'],
      ];
      if (p.criteria_met) rows.push(['Criteria Met', p.criteria_met]);
      if (p.criteria_missing) rows.push(['Criteria Missing', p.criteria_missing]);
      if (p.test_outcome) rows.push(['Test Outcome', p.test_outcome]);
      this.els.body.appendChild(this.makeKvCard('Qualified Assertion', rows));
    } else if (n.class_id === 'EvidenceFragment') {
      this.els.body.appendChild(this.makeEvidenceCard(n, details.paperId));
    } else if (n.isCatalog) {
      const rows = [
        ['Catalog ID', n.id],
        ['Class', n.class_id],
        ['Label', n.label || '—'],
        ['Origin', n.origin || 'ontology'],
      ];
      if (n.module_ids) rows.push(['Blueprint Modules', n.module_ids]);
      rows.push(['Incoming Links', String(details.totalIn)]);
      rows.push(['Outgoing Links', String(details.totalOut)]);
      this.els.body.appendChild(this.makeKvCard('Ontology Catalog Concept', rows));
    } else {
      // Structured properties for PaperVersion, ModelVersion, MetricResult, HumanStudy, Cohort, etc.
      const rows = Object.entries(p).map(([k, v]) => [k, v]);
      if (rows.length > 0) {
        this.els.body.appendChild(this.makeKvCard(`${n.class_id} Properties`, rows));
      }
    }

    // Linked Evidence Cards
    if (details.linkedEvidence && details.linkedEvidence.length > 0) {
      const evSection = el('div', { class: 'insp-card' });
      evSection.appendChild(el('h3', {}, `Linked Evidence Fragments (${details.linkedEvidence.length})`));
      for (const item of details.linkedEvidence.slice(0, 15)) {
        evSection.appendChild(this.makeEvidenceCard(item.node, item.paperId || details.paperId));
      }
      this.els.body.appendChild(evSection);
    }
  }

  renderEdgeDetails(details) {
    const ed = details.edge;
    const explain = KG_PREDICATE_DOCS[ed.predicate_id]
      || (details.isKg
        ? 'Property-graph serialization/provenance link (kg: namespace), not a scientific ontology predicate.'
        : 'Direct scientific ontology relationship backed by a present-state relation assertion.');

    this.els.body.appendChild(el('div', { class: 'notice-banner' }, explain));

    const subjEl = details.subject
      ? this.makeNodeLink(details.subject.idx, `${details.subject.label} [${details.subject.class_id}]`, details.subject.id)
      : ed.subject_id;
    const objEl = details.object
      ? this.makeNodeLink(details.object.idx, `${details.object.label} [${details.object.class_id}]`, details.object.id)
      : ed.object_id;

    const rows = [
      ['Edge ID', ed.id],
      ['Predicate', ed.predicate_id],
      ['Category', details.isKg ? 'kg: Serialization / Provenance' : 'Scientific Relation'],
      ['Subject (From)', subjEl],
      ['Object (To)', objEl],
      ['Source Annotation', ed.source_annotation || 'Ontology'],
    ];
    if (ed.properties) {
      for (const [k, v] of Object.entries(ed.properties)) {
        rows.push([k, v]);
      }
    }
    this.els.body.appendChild(this.makeKvCard('Relationship Details', rows));
  }

  renderNodeConnections(details) {
    const makeGroup = (title, list, total, isOut) => {
      const card = el('div', { class: 'insp-card' });
      card.appendChild(el('h3', {}, `${title} (${total}${total > list.length ? `, showing ${list.length}` : ''})`));
      if (list.length === 0) {
        card.appendChild(el('div', { class: 'hint-note' }, 'None'));
        return card;
      }
      for (const item of list) {
        const row = el('div', { class: 'conn-item' });
        const top = el('div', { class: 'evidence-meta' });
        top.appendChild(makeBadge(item.predicate_id, item.isKg ? 'badge-kg' : 'badge-sci'));
        top.appendChild(el('span', {}, isOut ? `→ ${item.targetClass}` : `← ${item.sourceClass}`));
        row.appendChild(top);
        row.appendChild(el('div', { style: 'font-size:12px;' }, isOut ? item.targetLabel : item.sourceLabel));

        const actRow = el('div', { class: 'btn-row' });
        const btnNode = el('button', { class: 'btn btn-xs btn-ghost', type: 'button' }, 'Inspect Node');
        btnNode.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetIdx = isOut ? item.targetIdx : item.sourceIdx;
          if (this.cb.onSelectNode) this.cb.onSelectNode(targetIdx);
        });
        const btnEdge = el('button', { class: 'btn btn-xs btn-ghost', type: 'button' }, 'Inspect Edge');
        btnEdge.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.cb.onSelectEdge) this.cb.onSelectEdge(item.edgeIdx);
        });
        actRow.appendChild(btnNode);
        actRow.appendChild(btnEdge);
        row.appendChild(actRow);
        card.appendChild(row);
      }
      return card;
    };

    this.els.body.appendChild(makeGroup('Outgoing Relationships', details.outgoing, details.totalOut, true));
    this.els.body.appendChild(makeGroup('Incoming Relationships', details.incoming, details.totalIn, false));
  }

  async loadPaperBundle(paperId) {
    if (this.paperCache.has(paperId)) return this.paperCache.get(paperId);
    const fetchSafeJson = async (url) => {
      try {
        const r = await fetch(url);
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    };
    const fetchSafeText = async (url) => {
      try {
        const r = await fetch(url);
        return r.ok ? await r.text() : null;
      } catch {
        return null;
      }
    };

    const [annotation, coverage, reviewMd] = await Promise.all([
      fetchSafeJson(`./data/annotations/${paperId}.json`),
      fetchSafeJson(`./data/coverage/${paperId}.json`),
      fetchSafeText(`./data/reviews/${paperId}.md`),
    ]);
    const bundle = { annotation, coverage, reviewMd };
    this.paperCache.set(paperId, bundle);
    return bundle;
  }

  async renderPaperDossier(paperId) {
    this.els.body.replaceChildren(el('p', { class: 'hint-note' }, `Loading canonical annotation, coverage, and review notes for ${paperId}…`));
    const { annotation, coverage, reviewMd } = await this.loadPaperBundle(paperId);
    this.els.body.replaceChildren();

    if (!annotation) {
      this.els.body.appendChild(el('div', { class: 'notice-banner' }, `Could not load data/annotations/${paperId}.json.`));
      return;
    }

    const reg = this.currentSelection?.data?.registry || null;
    const pdfMeta = this.manifest?.pdfs?.[paperId] || null;

    // 1. Identity & Source Links
    const idRows = [
      ['Paper ID', paperId],
      ['Version ID', annotation.paper_version_id || '—'],
      ['Status', annotation.annotation_status || '—'],
      ['Title', reg?.title || '—'],
      ['Year', reg?.year || '—'],
      ['DOI / URL', reg?.doi_or_url || '—'],
      ['PDF SHA-256', pdfMeta?.sha256 || reg?.pdf_sha256 || '—'],
      ['PDF Pages', pdfMeta?.pdf_pages || reg?.pdf_pages || '—'],
      ['World Types', annotation.world_type_ids || []],
      ['Profiles', annotation.profile_ids || []],
    ];
    const idCard = this.makeKvCard('Bibliographic Identity & Provenance', idRows);
    const linkRow = el('div', { class: 'btn-row' });
    const btnPdf = el('button', { class: 'btn btn-xs btn-accent', type: 'button' }, 'Open Paper Source');
    btnPdf.addEventListener('click', () => this.cb.onOpenPdf && this.cb.onOpenPdf(paperId, null));
    linkRow.appendChild(btnPdf);
    linkRow.appendChild(el('a', { class: 'btn btn-xs btn-ghost', href: `./data/annotations/${paperId}.json`, target: '_blank', rel: 'noopener' }, 'Open Annotation JSON'));
    linkRow.appendChild(el('a', { class: 'btn btn-xs btn-ghost', href: `./data/coverage/${paperId}.json`, target: '_blank', rel: 'noopener' }, 'Coverage JSON'));
    idCard.appendChild(linkRow);
    this.els.body.appendChild(idCard);

    // 2. Special A20 Archimedes OCR & Visual-Review Receipts
    if (paperId === 'A20' && this.manifest?.archimedes_receipts?.length) {
      const a20Card = el('div', { class: 'insp-card' });
      a20Card.appendChild(el('h3', {}, 'A20 Image-Only Source & OCR / Visual-Review Receipts'));
      a20Card.appendChild(
        el(
          'div',
          { class: 'notice-banner' },
          'A20 (Archimedes) is an image-only scanned PDF. Local OCR drafts and page-image inspections are provided below as provenance receipts; OCR is NOT native selectable source text, and visual paraphrases are NOT direct quotations.'
        )
      );
      const chips = el('div', { class: 'doc-chips' });
      for (const f of this.manifest.archimedes_receipts) {
        chips.appendChild(el('a', { class: 'doc-chip', href: `./${f.asset_path}`, target: '_blank', rel: 'noopener' }, f.name));
      }
      a20Card.appendChild(chips);
      this.els.body.appendChild(a20Card);
    }

    // 3. Canonical Limitations & Coverage (takes precedence over stale registry strings)
    const lims = Array.isArray(annotation.limitations) ? annotation.limitations : [];
    const limCard = el('div', { class: 'insp-card' });
    limCard.appendChild(el('h3', {}, `Canonical Limitations & Coverage (${lims.length})`));
    limCard.appendChild(el('p', { class: 'hint-note' }, 'Sourced from canonical annotation and coverage sidecar (supersedes older registry strings or prior audits).'));
    if (lims.length === 0) {
      limCard.appendChild(el('div', { style: 'margin-top:6px;' }, 'No limitations recorded in canonical annotation.'));
    } else {
      const ul = el('ul', { style: 'padding-left:18px;margin:6px 0 0 0;' });
      for (const l of lims) ul.appendChild(el('li', { style: 'margin-bottom:4px;' }, typeof l === 'string' ? l : JSON.stringify(l)));
      limCard.appendChild(ul);
    }
    if (coverage) {
      const covSummary = [];
      if (coverage.feature_count !== undefined) covSummary.push(`Features: ${coverage.feature_count}`);
      if (coverage.unassessed_count !== undefined) covSummary.push(`Unassessed: ${coverage.unassessed_count}`);
      if (coverage.pages_inspected) covSummary.push(`Pages inspected: ${JSON.stringify(coverage.pages_inspected)}`);
      if (covSummary.length) {
        limCard.appendChild(el('div', { class: 'hint-note', style: 'margin-top:6px;color:#cbd5e1;' }, covSummary.join(' · ')));
      }
    }
    this.els.body.appendChild(limCard);

    // 4. Scoped Capability & Readiness Assessments (never collapsed to a single max!)
    const caps = annotation.capability_assessments || [];
    const reads = annotation.readiness_assessments || [];
    if (caps.length || reads.length) {
      const crCard = el('div', { class: 'insp-card' });
      crCard.appendChild(el('h3', {}, `Scoped Capability (${caps.length}) & Readiness (${reads.length})`));
      crCard.appendChild(el('p', { class: 'hint-note' }, 'Each assessment is scoped to its specific model, configuration, or study. Differing configurations are not collapsed.'));
      for (const c of caps) {
        const box = el('div', { class: 'evidence-card', style: 'margin-top:6px;' });
        const meta = el('div', { class: 'evidence-meta' });
        meta.appendChild(makeBadge(`Capability ${c.level_id || c.capability_level_id || '?'}`, 'badge-sci'));
        if (c.assessment_state) meta.appendChild(makeStateBadge(c.assessment_state));
        if (c.evidence_stage) meta.appendChild(makeBadge(c.evidence_stage, ''));
        box.appendChild(meta);
        box.appendChild(el('div', { style: 'font-size:11.5px;margin-top:4px;' }, `Scope: ${c.subject_id || '—'}`));
        if (c.rationale) box.appendChild(el('div', { class: 'hint-note', style: 'color:#cbd5e1;' }, c.rationale));
        crCard.appendChild(box);
      }
      for (const r of reads) {
        const box = el('div', { class: 'evidence-card', style: 'margin-top:6px;border-left-color:#f59e0b;' });
        const meta = el('div', { class: 'evidence-meta' });
        meta.appendChild(makeBadge(`Readiness ${r.facet_id || r.readiness_facet_id || '?'}`, 'badge-warn'));
        if (r.assessment_state) meta.appendChild(makeStateBadge(r.assessment_state));
        if (r.evidence_stage) meta.appendChild(makeBadge(r.evidence_stage, ''));
        box.appendChild(meta);
        box.appendChild(el('div', { style: 'font-size:11.5px;margin-top:4px;' }, `Scope: ${r.subject_id || '—'}`));
        if (r.rationale) box.appendChild(el('div', { class: 'hint-note', style: 'color:#cbd5e1;' }, r.rationale));
        crCard.appendChild(box);
      }
      this.els.body.appendChild(crCard);
    }

    // 5. Models, Studies, Cohorts & Metric Results
    const entities = annotation.entities || [];
    const metrics = annotation.metric_results || [];
    if (entities.length || metrics.length) {
      const entCard = el('div', { class: 'insp-card' });
      entCard.appendChild(el('h3', {}, `Entities (${entities.length}) & Metric Results (${metrics.length})`));
      for (const ent of entities.slice(0, 40)) {
        const row = el('div', { class: 'conn-item' });
        const top = el('div', { class: 'evidence-meta' });
        top.appendChild(makeBadge(ent.class_id || 'Entity', ''));
        top.appendChild(el('span', {}, ent.id));
        row.appendChild(top);
        const nm = ent.properties?.name || ent.properties?.study_design || ent.properties?.title || '';
        if (nm) row.appendChild(el('div', { style: 'font-size:11.5px;color:#cbd5e1;' }, nm));
        row.addEventListener('click', () => this.cb.onSelectNodeById && this.cb.onSelectNodeById(ent.id));
        entCard.appendChild(row);
      }
      if (metrics.length) {
        entCard.appendChild(el('h3', { style: 'margin-top:10px;' }, `Metric Results (showing ${Math.min(metrics.length, 25)} of ${metrics.length})`));
        for (const m of metrics.slice(0, 25)) {
          const row = el('div', { class: 'conn-item' });
          row.appendChild(el('div', { style: 'font-weight:600;font-size:11.5px;' }, `${m.metric || m.id}: ${m.value ?? '—'} ${m.unit_or_scale || ''}`));
          row.appendChild(el('div', { class: 'hint-note' }, `Model: ${m.model_version_id || '—'} · Task: ${m.task || '—'} · Split: ${m.split_role || '—'}`));
          row.addEventListener('click', () => this.cb.onSelectNodeById && this.cb.onSelectNodeById(m.id));
          entCard.appendChild(row);
        }
      }
      this.els.body.appendChild(entCard);
    }

    // 6. All 128 Feature Assessments (searchable & filterable by state)
    const assertions = annotation.assertions || [];
    const featCard = el('div', { class: 'insp-card' });
    featCard.appendChild(el('h3', {}, `Feature Assessments (${assertions.length})`));
    const filterBar = el('div', { class: 'dossier-filter-bar' });
    const searchIn = el('input', { type: 'search', placeholder: 'Filter features / rationale…' });
    const stateSel = el('select');
    stateSel.appendChild(el('option', { value: '' }, 'All states'));
    for (const st of ['present', 'partial', 'absent', 'unknown', 'not_reported', 'not_applicable', 'not_assessed', 'conflicting']) {
      stateSel.appendChild(el('option', { value: st }, st));
    }
    filterBar.appendChild(searchIn);
    filterBar.appendChild(stateSel);
    featCard.appendChild(filterBar);

    const listHost = el('div');
    const renderFeatureList = () => {
      listHost.replaceChildren();
      const q = searchIn.value.trim().toLowerCase();
      const st = stateSel.value;
      const filtered = assertions.filter((a) => {
        if (st && a.assessment_state !== st) return false;
        if (q) {
          const txt = `${a.feature_id || ''} ${a.subject_id || ''} ${a.rationale || ''} ${a.assessment_state || ''}`.toLowerCase();
          if (!txt.includes(q)) return false;
        }
        return true;
      });
      listHost.appendChild(el('div', { class: 'hint-note', style: 'margin-bottom:6px;' }, `Showing ${Math.min(filtered.length, 150)} of ${filtered.length} assertions`));
      for (const a of filtered.slice(0, 150)) {
        const item = el('div', { class: 'conn-item' });
        const top = el('div', { class: 'evidence-meta' });
        top.appendChild(el('strong', {}, a.feature_id || a.id));
        top.appendChild(makeStateBadge(a.assessment_state));
        if (a.evidence_stage) top.appendChild(makeBadge(a.evidence_stage, ''));
        item.appendChild(top);
        if (a.subject_id) item.appendChild(el('div', { class: 'hint-note' }, `Scope: ${a.subject_id}`));
        if (a.rationale) item.appendChild(el('div', { style: 'font-size:11.5px;color:#cbd5e1;margin-top:2px;' }, a.rationale));
        item.addEventListener('click', () => this.cb.onSelectNodeById && this.cb.onSelectNodeById(a.id));
        listHost.appendChild(item);
      }
    };
    searchIn.addEventListener('input', renderFeatureList);
    stateSel.addEventListener('change', renderFeatureList);
    renderFeatureList();
    featCard.appendChild(listHost);
    this.els.body.appendChild(featCard);

    // 7. Legacy-Cell Values & Correction History
    const legacy = annotation.legacy_cells || {};
    const legacyEntries = Array.isArray(legacy) ? legacy : Object.entries(legacy);
    if (legacyEntries.length > 0) {
      const legCard = el('div', { class: 'insp-card' });
      legCard.appendChild(el('h3', {}, `Legacy Workbook Cells (${legacyEntries.length})`));
      const detailsEl = el('details');
      detailsEl.appendChild(el('summary', { style: 'cursor:pointer;color:#38bdf8;font-size:12px;' }, 'Expand legacy-cell values & review status'));
      const pre = el('pre', { class: 'raw-json', style: 'margin-top:6px;max-height:260px;overflow:auto;' });
      pre.textContent = JSON.stringify(legacy, null, 2);
      detailsEl.appendChild(pre);
      legCard.appendChild(detailsEl);
      this.els.body.appendChild(legCard);
    }

    // 8. Review Notes (Markdown rendered safely as plain text)
    if (reviewMd) {
      const revCard = el('div', { class: 'insp-card' });
      revCard.appendChild(el('h3', {}, 'Review Notes'));
      const detailsEl = el('details');
      detailsEl.appendChild(el('summary', { style: 'cursor:pointer;color:#38bdf8;font-size:12px;' }, `Expand reviews/${paperId}.md`));
      const pre = el('pre', { class: 'raw-json', style: 'margin-top:6px;max-height:320px;overflow:auto;' });
      pre.textContent = reviewMd;
      detailsEl.appendChild(pre);
      revCard.appendChild(detailsEl);
      this.els.body.appendChild(revCard);
    }
  }
}
