# Healthcare World Model KG Explorer

An interactive 3D research graph covering **211 papers**, **40,055 research nodes**, **269 ontology nodes**, and **100,905 relationships**.

**[Open the explorer](https://himanshu5trpth.github.io/healthcare-world-model-kg/)**

Drag to rotate, scroll to zoom, and click a node to inspect it. Search by paper ID, title, model, feature, or evidence. Use the filters, architecture view, paper dossiers, and table view to explore further. On small screens, the top corner buttons open the filters and inspector.

Papers open through DOI or source links; 006 and 077 use clearly labeled title searches. PDFs are not redistributed. Annotations and evidence load on demand; the complete graph is searchable. The first visit downloads approximately 6 MB of compressed graph data plus the viewer; browser memory use is higher after indexing.

This is a research visualization, not clinical advice. Graph connections do not establish causality, proximity does not measure similarity, and capability is separate from clinical readiness. Unknowns and source limitations are retained. The snapshot reflects the reviewed project data from 22 November 2026; validation checks structure and consistency, not independent scientific verification.

## Run locally

With Python installed, run `python -m http.server 8765 --directory site`, then open `http://localhost:8765/`. No paid API, backend service, or database is required. Runtime libraries are included locally, with their license.

## Update and deploy

The public files live in `site/`. `tools/prepare_web.py` rebuilds them from the separate local research viewer when used inside the original workspace. It never edits research source files and excludes PDFs, page scans, credentials, and private project memory. Run its tests with `python -m unittest discover -s tools -p "test_*.py"`.

Push to `main` to publish through the included GitHub Pages workflow. Third-party papers remain subject to their respective rights and access conditions.
