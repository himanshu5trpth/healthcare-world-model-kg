# Architecture evidence explorer

Implementation target: Gemini 4 Neon, medium effort. Build in the static GitHub Pages viewer. The data and figure are already under `site/data/architecture-evidence.json` and `site/assets/architecture/`.

## Layout and interaction

- Add an **Architecture** tab beside the existing graph view. On desktop, use the figure above two synchronized panes: the sphere and an evidence inspector. Use stage colors from the figure and a separate high contrast highlight for evidence. Give the figure a light background and preserve its aspect ratio. Offer a larger figure view for reading small labels.
- Overlay focusable SVG hotspots using the supplied view box and hotspot rectangles. Hover and keyboard focus preview a component. Click, Enter or tap pins it. Pointer exit restores the pinned selection. Escape clears it. Keep the camera steady during previews and provide a **Focus evidence** button.
- In the inspector, display the responsibility and derivation step, then equations with variable definitions and assumptions. Below those, group evidence under **Supports the design** and **Documents a gap**. Each path card shows the ontology class of each node, why the evidence is relevant, the assertion's rationale and scope, paper and physical page, and a source link. Show the coverage note once in this view. On narrow screens use vertically stacked panels and a **Show in graph** shortcut. Provide the evidence path list when WebGL is unavailable.

## Data binding

- Load JSON lazily. Compare `graph_snapshot_hash` to the active graph snapshot. On mismatch retain the diagram and formula descriptions, disable highlights and explain that the evidence map needs rebuilding. The JSON uses stable graph IDs. Resolve them in the worker, then draw a dedicated overlay from the supplied edge IDs. A reversed traversal still uses the original edge identity. Never substitute a shortest path.
- Reuse the existing node inspector and selection-by-ID interface. Keep graph filters intact and show mapped evidence in the overlay while a component is active. Clear only that overlay when leaving the tab. Serialize updates so delayed hover responses cannot replace a newer selection.
- The formula payload is LaTeX extracted from the formulation. Use a locally bundled math renderer and fall back to readable formula text. Render all source-provided strings as text. Load the figure as an image with a separate hotspot layer. Use relative URLs that work at the GitHub Pages repository subpath.
- Add a publication check that refuses to ship mismatched evidence IDs or graph hashes. Preserve these static assets when refreshing the viewer. A graph refresh requires rechecking or regenerating the evidence mapping before updating its snapshot hash. Document the separate roles of evidence, ontology and design requirements.

## Acceptance checks

- Inspect hotspot alignment for all 15 components. Verify keyboard traversal, touch, hover repair on pointer exit, pinning, clearing, and the mobile layout.
- Walk through M1, M6 and the clinician approval hotspot. Compare the highlighted nodes and edges to JSON and check their ontology types, source pages and labels. Test an empty mapping and a stale snapshot. Verify paths never imply causality from traversal or from `kg:` provenance.
- Check that search, regular graph selection, zoom, filters, source links and table fallback still work. Run a static preview at the Pages subpath before deploying.
