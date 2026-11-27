"""Build an isolated GitHub Pages site from the existing local viewer. No API calls."""
import gzip
import hashlib
import json
import re
import shutil
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / 'KG_3D_Explorer'
DEST = Path(__file__).resolve().parents[1] / 'site'


def source_link(value):
    value = str(value or '').strip()
    if re.fullmatch(r'10\.\d{4,9}/\S+', value, re.I):
        return 'https://doi.org/' + value
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme in ('https', 'http') and parsed.hostname and not parsed.username and not parsed.password:
        return value if not re.search(r'\s', value) else ''
    return ''


def validate_graph(nodes, edges):
    ids = [n['id'] for n in nodes]
    known = set(ids)
    if len(ids) != len(known):
        raise ValueError('Duplicate graph node IDs')
    edge_ids = [e['id'] for e in edges if 'id' in e]
    if len(edge_ids) != len(set(edge_ids)):
        raise ValueError('Duplicate graph edge IDs')
    for edge in edges:
        if edge['subject_id'] not in known or edge['object_id'] not in known:
            raise ValueError('Unresolved graph endpoint: ' + edge.get('id', '?'))


def validate_architecture_svg(svg_path):
    if not svg_path.exists():
        raise ValueError(f'Missing architecture SVG: {svg_path}')
    raw = svg_path.read_text(encoding='utf-8')
    m_open = re.search(r'<svg\b[^>]*>', raw)
    if not m_open:
        raise ValueError('Architecture SVG missing <svg> root element')
    open_tag = raw[m_open.start():m_open.end()]
    body = raw[m_open.end():]
    if 'color-scheme: light dark' in open_tag or 'color-scheme:light dark' in open_tag:
        raise ValueError('Architecture SVG contains color-scheme: light dark inversion bug')
    if 'color-scheme: light' not in open_tag:
        raise ValueError('Architecture SVG must explicitly lock color-scheme: light')
    if 'light-dark(' in body:
        raise ValueError('Architecture SVG rendered body contains unresolved light-dark() CSS functions')
    root = ET.fromstring(raw)
    if root.attrib.get('viewBox') != '0 0 1177 465':
        raise ValueError(f"Unexpected architecture SVG viewBox: {root.attrib.get('viewBox')!r}")
    if '#FFFFFF' not in open_tag.upper() and 'FILL="#FFFFFF"' not in body.upper():
        raise ValueError('Architecture SVG must define a crisp #FFFFFF light canvas background')


def validate_architecture_evidence(evidence_path, nodes, edges, snapshot_hash):
    if not evidence_path.exists():
        return
    evidence = json.loads(evidence_path.read_text(encoding='utf-8'))
    if evidence.get('graph_snapshot_hash') != snapshot_hash:
        raise ValueError(
            f"Architecture evidence hash {evidence.get('graph_snapshot_hash')!r} "
            f"does not match snapshot {snapshot_hash!r}"
        )
    known_nodes = {n['id'] for n in nodes}
    edges_by_id = {e['id']: e for e in edges if 'id' in e}
    formulas = evidence.get('formulas') or {}
    view_box = (evidence.get('figure') or {}).get('view_box')
    for comp in evidence.get('components', []):
        if view_box and comp.get('hotspot'):
            vb_x, vb_y, vb_w, vb_h = view_box
            h = comp['hotspot']
            if h['x'] < vb_x or h['y'] < vb_y or (h['x'] + h['width']) > (vb_x + vb_w) or (h['y'] + h['height']) > (vb_y + vb_h):
                raise ValueError(f"Hotspot out of viewBox bounds for component {comp.get('id')!r}")
        if formulas:
            for fid in comp.get('formula_ids', []):
                if fid not in formulas:
                    raise ValueError(f"Unresolved architecture formula ID: {fid}")
        for ep in comp.get('evidence_paths', []):
            node_ids = ep.get('node_ids', [])
            for nid in node_ids:
                if nid not in known_nodes:
                    raise ValueError(f"Unresolved architecture evidence node ID: {nid}")
            ep_edges = ep.get('edges', [])
            for idx_e, ed in enumerate(ep_edges):
                eid = ed.get('id') if isinstance(ed, dict) else ed
                if eid not in edges_by_id:
                    raise ValueError(f"Unresolved architecture evidence edge ID: {eid}")
                if len(node_ids) == len(ep_edges) + 1:
                    edge_rec = edges_by_id[eid]
                    u, v = node_ids[idx_e], node_ids[idx_e + 1]
                    if not (
                        (edge_rec['subject_id'] == u and edge_rec['object_id'] == v)
                        or (edge_rec['subject_id'] == v and edge_rec['object_id'] == u)
                    ):
                        raise ValueError(
                            f"Discontinuous architecture evidence edge {eid} between {u} and {v}"
                        )


def jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def build():
    DEST.mkdir(parents=True, exist_ok=True)
    for name in ('js', 'css', 'vendor'):
        shutil.copytree(LOCAL / name, DEST / name, dirs_exist_ok=True)
    shutil.copy2(LOCAL / 'index.html', DEST / 'index.html')
    # Preserve static architecture assets if already present in DEST; copy from LOCAL only if missing.
    dest_arch_assets = DEST / 'assets' / 'architecture'
    local_arch_assets = LOCAL / 'assets' / 'architecture'
    if not dest_arch_assets.exists() and local_arch_assets.exists():
        shutil.copytree(local_arch_assets, dest_arch_assets, dirs_exist_ok=True)
    # Copy only research data, never PDFs, page scans, private project memory, or run credentials.
    # Existing site/data/architecture-evidence.json is preserved and validated below.
    data = DEST / 'data'
    for name in ('graph', 'annotations', 'coverage', 'reviews', 'audit'):
        shutil.copytree(LOCAL / 'data' / name, data / name, dirs_exist_ok=True)
    for name in ('registry.jsonl', 'review_queue.jsonl'):
        shutil.copy2(LOCAL / 'data' / name, data / name)
    documents = data / 'documents'
    documents.mkdir(exist_ok=True)
    for path in (LOCAL / 'data/documents').iterdir():
        if path.name.startswith('Healthcare_World_Model_') and path.suffix in ('.md', '.json'):
            shutil.copy2(path, documents / path.name)

    registry = jsonl(data / 'registry.jsonl')
    links = {}
    for record in registry:
        pid = record['paper_record_id']
        annotation = json.loads((data / 'annotations' / (pid + '.json')).read_text(encoding='utf-8'))
        candidates = [record.get('doi_or_url'), annotation.get('legacy_cells', {}).get('G')]
        for entity in annotation.get('entities', []):
            if entity.get('class_id') == 'PaperRecord':
                props = entity.get('properties', {})
                candidates.extend([props.get('doi'), props.get('url')])
        url = next((source_link(c) for c in candidates if source_link(c)), '')
        direct = bool(url)
        if not url:
            url = 'https://scholar.google.com/scholar?q=' + urllib.parse.quote(record['title'])
        links[pid] = {'url': url, 'kind': 'source' if direct else 'title_search',
                      'pdf_pages': record.get('pdf_pages'), 'sha256': record.get('pdf_sha256'),
                      'available': False}
        record['doi_or_url'] = url if direct else ''
        record['source_url'] = url
        record['source_link_kind'] = links[pid]['kind']
        # Registry limitations are historical; canonical dossiers expose the current limits.
        record.pop('review_limitations', None)
    (data / 'registry.jsonl').write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in registry), encoding='utf-8')

    nodes = jsonl(data / 'graph/nodes.jsonl')
    catalog = jsonl(data / 'graph/catalog_nodes.jsonl')
    edges = jsonl(data / 'graph/edges.jsonl')
    validate_graph(nodes + catalog, edges)
    for path in [*sorted((data / 'graph').glob('*.jsonl')), data / 'registry.jsonl']:
        with gzip.GzipFile(filename=str(path) + '.gz', mode='wb', mtime=0) as out:
            out.write(path.read_bytes())

    for path in [DEST / 'index.html', *sorted((DEST / 'js').glob('*.js'))]:
        text = path.read_text(encoding='utf-8').replace('L0–L5', 'L0–L4')
        text = text.replace('Open Copied PDF', 'Open Paper Source').replace('Open PDF', 'Open Source')
        text = text.replace('./css/styles.css"', './css/styles.css?v=public1"')
        path.write_text(text, encoding='utf-8')
    controls = DEST / 'js/controls.js'
    text = controls.read_text(encoding='utf-8')
    start = text.index('    const baseUrl = `./assets/papers/')
    end = text.index("    modal.classList.remove('hidden');", start)
    text = text[:start] + '''    const source = manifest?.paper_links?.[paperId];
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
''' + text[end:]
    controls.write_text(text, encoding='utf-8')

    worker = DEST / 'js/graph-worker.js'
    text = worker.read_text(encoding='utf-8')
    old = "  const res = await fetch(url);\n  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);\n  const text = await res.text();"
    new = '''  let text;
  if (typeof DecompressionStream !== 'undefined') {
    const compressed = await fetch(url + '.gz');
    if (compressed.ok) text = await new Response(compressed.body.pipeThrough(new DecompressionStream('gzip'))).text();
  }
  if (text === undefined) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    text = await res.text();
  }'''
    if 'DecompressionStream' not in text:
        if old not in text:
            raise ValueError('Viewer parser changed; inspect before patching')
        worker.write_text(text.replace(old, new), encoding='utf-8')

    # Small screens use drawers so panels cannot squeeze the graph to a narrow strip.
    css = DEST / 'css/styles.css'
    with css.open('a', encoding='utf-8') as out:
        out.write('''
@media (max-width: 1100px) {
  .top-bar { height: auto; flex: 0 0 auto; flex-wrap: wrap; padding: 8px; gap: 6px; }
  .top-brand { flex: 1 1 auto; }
  .brand-text h1 { font-size: 13px; }
  .top-search { order: 3; flex: 1 0 100%; max-width: none; }
  .counts-pill, .status-pill { display: none; }
  .top-actions { gap: 4px; }
  .side-panel { position: absolute; top: 0; bottom: 0; max-width: 88vw; box-shadow: 0 10px 40px #0009; }
  .left-panel { left: 0; }
  .right-panel { right: 0; }
  .side-panel.collapsed { visibility: hidden; }
  .legend-strip { display: none; }
  .visible-counts { font-size: 10px; white-space: normal; }
}
@media (max-width: 520px) {
  #btn-interpret { font-size: 0; }
  #btn-interpret::after { content: '?'; font-size: 14px; }
  .bottom-bar { gap: 4px; padding: 4px; height: auto; flex-wrap: wrap; }
  .safeguard-grid { grid-template-columns: 1fr; }
}
.pdf-iframe[hidden] { display: none; }
''')
    controls_text = controls.read_text(encoding='utf-8')
    needle = "    btnLeft.addEventListener('click', () => {"
    controls_text = controls_text.replace(needle, '''    if (window.matchMedia('(max-width: 1100px)').matches) {
      leftPanel.classList.add('collapsed');
      rightPanel.classList.add('collapsed');
      btnLeft.setAttribute('aria-expanded', 'false');
      btnRight.setAttribute('aria-expanded', 'false');
    }
''' + needle)
    controls.write_text(controls_text, encoding='utf-8')
    app = DEST / 'js/app.js'
    app_text = app.read_text(encoding='utf-8')
    for signature in ('  selectNode(idx, focus = false) {', '  selectEdge(edgeIdx) {'):
        app_text = app_text.replace(signature, signature + '''
    if (window.matchMedia('(max-width: 1100px)').matches) {
      document.getElementById('left-panel').classList.add('collapsed');
      document.getElementById('btn-toggle-left').setAttribute('aria-expanded', 'false');
      document.getElementById('right-panel').classList.remove('collapsed');
      document.getElementById('btn-toggle-right').setAttribute('aria-expanded', 'true');
    }
''')
    app.write_text(app_text, encoding='utf-8')

    manifest = json.loads((LOCAL / 'data/snapshot-manifest.json').read_text(encoding='utf-8'))
    manifest.pop('source_root', None)
    manifest['publication_mode'] = 'linked_papers_no_pdfs'
    manifest['paper_links'] = links
    manifest['pdfs'] = links
    manifest['archimedes_receipts'] = []
    manifest['counts']['pdfs_available'] = 0
    manifest['counts']['graph_nodes'] = len(nodes)
    manifest['counts']['catalog_nodes'] = len(catalog)
    manifest['counts']['total_nodes'] = len(nodes) + len(catalog)
    manifest['counts']['edges'] = len(edges)
    manifest['files'] = {}
    for path in sorted(data.rglob('*')):
        if path.is_file() and path.name not in ('snapshot-manifest.json', 'architecture-evidence.json'):
            manifest['files'][path.relative_to(DEST).as_posix()] = {
                'size': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    manifest['snapshot_hash'] = hashlib.sha256(json.dumps(manifest['files'], sort_keys=True).encode()).hexdigest()[:16] + '-web1'
    arch_svg = DEST / 'assets' / 'architecture' / 'healthcare_world_model_architecture.svg'
    if arch_svg.exists():
        validate_architecture_svg(arch_svg)
    validate_architecture_evidence(data / 'architecture-evidence.json', nodes + catalog, edges, manifest['snapshot_hash'])
    (data / 'snapshot-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    (DEST / '.nojekyll').write_text('', encoding='utf-8')
    assert not list(DEST.rglob('*.pdf'))
    assert not list(DEST.rglob('OpenAI_API.py'))
    assert not list(DEST.rglob('PROJECT_MEMORY.md'))
    result = {'papers': len(registry), 'nodes': len(nodes), 'catalog_nodes': len(catalog), 'edges': len(edges),
              'direct_links': sum(x['kind'] == 'source' for x in links.values()),
              'title_search_links': sum(x['kind'] == 'title_search' for x in links.values()),
              'site_bytes': sum(p.stat().st_size for p in DEST.rglob('*') if p.is_file())}
    print(json.dumps(result))
    return result


if __name__ == '__main__':
    build()
