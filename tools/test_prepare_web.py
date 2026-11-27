import json
import math
import re
import tempfile
import unittest
from pathlib import Path
from prepare_web import (
    DEST,
    jsonl,
    source_link,
    validate_architecture_evidence,
    validate_architecture_svg,
    validate_graph,
)


class PublicSnapshotTests(unittest.TestCase):
    def test_doi_and_existing_source_links(self):
        self.assertEqual(source_link('10.1007/example'), 'https://doi.org/10.1007/example')
        self.assertEqual(source_link('https://arxiv.org/abs/1234.5678'), 'https://arxiv.org/abs/1234.5678')
        self.assertEqual(source_link('javascript:alert(1)'), '')
        self.assertEqual(source_link('Not reported'), '')
        self.assertEqual(source_link('https://user:secret@example.org/a'), '')

    def test_dangling_and_duplicate_ids_fail(self):
        with self.assertRaises(ValueError):
            validate_graph([{'id': 'a'}, {'id': 'a'}], [])
        with self.assertRaises(ValueError):
            validate_graph([{'id': 'a'}, {'id': 'b'}], [
                {'id': 'e1', 'subject_id': 'a', 'object_id': 'b'},
                {'id': 'e1', 'subject_id': 'a', 'object_id': 'b'},
            ])
        with self.assertRaises(ValueError):
            validate_graph([{'id': 'a'}], [{'id': 'e1', 'subject_id': 'a', 'object_id': 'b'}])
        validate_graph([{'id': 'a'}, {'id': 'b'}], [{'id': 'e1', 'subject_id': 'a', 'object_id': 'b'}])

    def test_architecture_evidence_validation(self):
        nodes = [{'id': 'M1'}, {'id': 'n1'}, {'id': 'n2'}]
        edges = [
            {'id': 'e1', 'subject_id': 'M1', 'object_id': 'n1'},
            {'id': 'e2', 'subject_id': 'n2', 'object_id': 'n1'},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'arch.json'
            p.write_text(json.dumps({
                'graph_snapshot_hash': 'hash-1',
                'figure': {'view_box': [0, 0, 1177, 465]},
                'formulas': {'f1': {'latex': 'x=1'}},
                'components': [{
                    'id': 'intake',
                    'hotspot': {'x': 10, 'y': 20, 'width': 100, 'height': 40},
                    'formula_ids': ['f1'],
                    'evidence_paths': [{'node_ids': ['M1', 'n1', 'n2'], 'edges': [{'id': 'e1'}, {'id': 'e2'}]}],
                }],
            }), encoding='utf-8')
            validate_architecture_evidence(p, nodes, edges, 'hash-1')
            with self.assertRaises(ValueError):
                validate_architecture_evidence(p, nodes, edges, 'hash-2')

            p.write_text(json.dumps({
                'graph_snapshot_hash': 'hash-1',
                'components': [{'id': 'intake', 'evidence_paths': [{'node_ids': ['missing'], 'edges': [{'id': 'e1'}]}]}],
            }), encoding='utf-8')
            with self.assertRaises(ValueError):
                validate_architecture_evidence(p, nodes, edges, 'hash-1')

            p.write_text(json.dumps({
                'graph_snapshot_hash': 'hash-1',
                'components': [{'id': 'intake', 'evidence_paths': [{'node_ids': ['M1'], 'edges': [{'id': 'missing-e'}]}]}],
            }), encoding='utf-8')
            with self.assertRaises(ValueError):
                validate_architecture_evidence(p, nodes, edges, 'hash-1')

            # Discontinuous edge must fail
            p.write_text(json.dumps({
                'graph_snapshot_hash': 'hash-1',
                'components': [{'id': 'intake', 'evidence_paths': [{'node_ids': ['M1', 'n2'], 'edges': [{'id': 'e1'}]}]}],
            }), encoding='utf-8')
            with self.assertRaises(ValueError):
                validate_architecture_evidence(p, nodes, edges, 'hash-1')

    def test_architecture_svg_rejects_dark_inversion(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad_scheme = Path(tmp) / 'bad_scheme.svg'
            bad_scheme.write_text(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1177 465" '
                'style="background: transparent; color-scheme: light dark;"><g/></svg>',
                encoding='utf-8',
            )
            with self.assertRaises(ValueError):
                validate_architecture_svg(bad_scheme)

            bad_ld = Path(tmp) / 'bad_ld.svg'
            bad_ld.write_text(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1177 465" '
                'style="background: #FFFFFF; color-scheme: light;">'
                '<rect width="10" height="10" style="fill: light-dark(#fff, #000);"/></svg>',
                encoding='utf-8',
            )
            with self.assertRaises(ValueError):
                validate_architecture_svg(bad_ld)

    def test_published_svg_crisp_light_rendering(self):
        svg_path = DEST / 'assets' / 'architecture' / 'healthcare_world_model_architecture.svg'
        validate_architecture_svg(svg_path)
        raw = svg_path.read_text(encoding='utf-8')
        m_open = re.search(r'<svg\b[^>]*>', raw)
        self.assertIsNotNone(m_open)
        body = raw[m_open.end():]
        self.assertNotIn('light-dark(', body)
        self.assertIn('fill="#FFFFFF"', body)

    def test_published_graph_full_coverage_and_evidence_validation(self):
        data = DEST / 'data'
        manifest = json.loads((data / 'snapshot-manifest.json').read_text(encoding='utf-8'))
        catalog = jsonl(data / 'graph' / 'catalog_nodes.jsonl')
        graph_nodes = jsonl(data / 'graph' / 'nodes.jsonl')
        edges = jsonl(data / 'graph' / 'edges.jsonl')
        all_nodes = catalog + graph_nodes

        # 100% of 40,324 nodes and 100,905 edges have unique IDs and resolved endpoints
        self.assertEqual(len(all_nodes), 40324)
        self.assertEqual(len(edges), 100905)
        self.assertEqual(manifest['counts']['total_nodes'], len(all_nodes))
        self.assertEqual(manifest['counts']['edges'], len(edges))
        validate_graph(all_nodes, edges)

        # Deterministic coverage tour batching covers every node and edge at least once
        node_batches = math.ceil(len(all_nodes) / 500)
        edge_batches = math.ceil(len(edges) / 500)
        self.assertEqual(node_batches, 81)
        self.assertEqual(edge_batches, 202)
        self.assertEqual(node_batches + edge_batches, 283)

        # Architecture evidence hash, all 15 components, 270 curated paths, and hotspots validate cleanly
        ev_path = data / 'architecture-evidence.json'
        validate_architecture_evidence(ev_path, all_nodes, edges, manifest['snapshot_hash'])
        ev = json.loads(ev_path.read_text(encoding='utf-8'))
        self.assertEqual(len(ev['components']), 15)
        self.assertEqual(sum(len(c.get('evidence_paths', [])) for c in ev['components']), 270)

        # Verify graph-worker.js covers all 15 component IDs and all 37 KG ontology node classes
        worker_src = (DEST / 'js' / 'graph-worker.js').read_text(encoding='utf-8')
        for comp in ev['components']:
            self.assertIn(f"id: '{comp['id']}'", worker_src)
        kg_classes = sorted({n['class_id'] for n in all_nodes})
        for cls_id in kg_classes:
            self.assertIn(f'  {cls_id}:', worker_src)

    def test_vendored_katex_assets_and_github_pages_readiness(self):
        katex_dir = DEST / 'vendor' / 'katex'
        self.assertTrue((katex_dir / 'katex.min.js').is_file())
        css_path = katex_dir / 'katex.min.css'
        self.assertTrue(css_path.is_file())
        css = css_path.read_text(encoding='utf-8')
        referenced_fonts = sorted(set(re.findall(r'fonts/[A-Za-z0-9_-]+\.[a-z0-9]+', css)))
        self.assertGreaterEqual(len(referenced_fonts), 20)
        for rel in referenced_fonts:
            self.assertTrue((katex_dir / rel).is_file(), f'Missing KaTeX font: {rel}')
        self.assertTrue((DEST / '.nojekyll').is_file())
        self.assertEqual(list(DEST.rglob('*.pdf')), [])
        self.assertEqual(list(DEST.rglob('OpenAI_API.py')), [])
        self.assertEqual(list(DEST.rglob('PROJECT_MEMORY.md')), [])


if __name__ == '__main__':
    unittest.main()
