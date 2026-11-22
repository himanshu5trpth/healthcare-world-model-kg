# Healthcare World Model Architecture and Evidence Ontology

Version 1.0.1 · 17 November 2026 (changes listed at the end)

The ontology is in **Healthcare_World_Model_Ontology.json**. It organizes paper evidence into reusable architectural responsibilities, with explicit rules for deciding whether each feature is present, absent, partial, unresolved or inapplicable. It is a proposed research ontology, not a consensus standard or a clinically validated architecture.

## The organizing idea

**World and intended use → model version → implemented modules → interface contracts → evaluated capabilities → evidence gaps → context-specific blueprint.**

A paper is a source of evidence, not a single architecture node. One paper can describe several model versions, studies, modules and evaluation settings. A model can implement a simulator, recommend a planner and evaluate only representation quality. Those statements remain separate.

The blueprint uses a world-specific simulator and a shared decision and assurance framework. It supports event models, latent dynamics, generative observation models, mechanistic/hybrid systems and model-coupled controllers. No single backend, decoder, planner or causal method is mandatory for every contribution.

## What counts as a world model

The ontology stays a *world-model* ontology. A record is a healthcare world model only if a persistent state is advanced by a learned or hybrid transition over a declared health-world coordinate (clinical time, event index, procedure step or acquisition pose), at implementation stage or higher (`membership_and_capability.world_model_identity`). Capability levels then give four identity tiers:

| Tier | Capability | Meaning |
|---|---|---|
| WM-inspired representation | L0 | Transition implemented, only representation evaluated |
| Autonomous-dynamics WM | L1 | Future state under observed or marginalised care |
| Controllable WM | L2–L3 | Transition consumes settable actions; alternatives compared |
| Decision-coupled WM | L4 | An optimizer or policy uses the model |

Components, surveys, fixed mechanistic simulators, static predictors and excluded records stay in the registry but are never counted as world models. Every blueprint profile except `BP_COMPONENT` requires core world-model membership. Self-labels such as "world model" or "digital twin" never establish membership.

## Architectural responsibilities

| Module | Responsibility |
|---|---|
| M1 | Data adapters and provenance |
| M2 | Observation encoders and fusion |
| M3 | State and belief-state service |
| M4 | Typed actions, schedules and support |
| M5 | Pluggable state dynamics and emission models |
| M6 | Rollout and predictive-query service |
| M7 | Outcome readouts and conditional causal reasoning |
| M8 | Replaceable planner or learned policy |
| M9 | Safety, security, privacy and runtime assurance |
| M10 | User interaction, evidence lifecycle and release governance |

These are responsibilities, not a requirement for ten separate software services. M9 and M10 operate across the system. A component paper can contribute to one responsibility without implementing a complete world model. A forecasting system need not acquire a planner to qualify as a useful world model.

## How to decide whether something exists

Every feature contains `consider_present_when`, `consider_absent_when`, partial and applicability rules, minimum evidence and examples of insufficient evidence. Classes, relationships, capability levels, readiness facets, world types, vocabulary values, gates and failure modes also have classification criteria.

| Assessment | Meaning |
|---|---|
| `present` | Positive evidence meets the scoped definition at the recorded evidence stage. |
| `absent` | Explicit negative evidence or an inspected incompatible mechanism establishes scoped absence. |
| `partial` | Some named criteria are met and others are missing. Record both. |
| `not_reported` | Reporting/extraction does not establish the answer; preserve why. |
| `not_assessed` | The relevant assessment has not been performed. |
| `unknown` | Available information is unavailable, ambiguous or insufficient to resolve the answer. |
| `not_applicable` | A documented context or dependency makes the feature irrelevant. |
| `conflicting` | Incompatible evidence remains after checking version and scope. |

Record evidence stage separately: **claim, specification, implementation, evaluation, replication**. Record test outcome separately: **pass, fail, mixed, not tested, not reported, not applicable**. For example, a calibration evaluation can be present while its result fails. A proposed planner can be present at specification stage while its implementation remains unestablished.

Absence of a keyword, empty spreadsheet cells and `NR` are not evidence of absence. Finding a quotation establishes its occurrence, not necessarily that it supports the interpretation.

## Keep three judgments separate

1. **Architecture and functional capability:** What mechanism exists, and what has actually been demonstrated? L0–L4 distinguish representation, prediction, specified-action prediction, matched alternative comparison and model-coupled optimization/control.
2. **Causal validity:** What intervention effect is claimed, under which identification argument, assumptions and support? Functional L3 comparisons do not independently establish causal treatment effects.
3. **Readiness and clinical evidence:** What technical, retrospective, external, human, prospective or effectiveness evidence exists? Readiness facets are not cumulative. Phantom control is not patient feasibility; expert review is not a prospective patient benefit study.

Preserve model version, population, environment, action regime, horizon, dataset split and intended use for each conclusion. Do not transfer favorable evidence to a new composition automatically.

## Where to find things in the JSON

| Section | Use |
|---|---|
| `classes`, `relations` | Define research, architecture, evidence and design entities and their relationships. |
| `features` | 128 operational architecture/evaluation features with positive and negative rules. |
| `modules`, `interface_contracts`, `blueprint_topology` | Connect responsibilities through typed data, state, action, prediction and decision contracts. |
| `world_types`, `architecture_archetypes`, `specialty_profiles` | Select the modeled world and relevant design alternatives. |
| `membership_and_capability`, `readiness_model` | Classify contributions without conflating claims, function and clinical evidence. |
| `design_axes`, `principle_crosswalk` | Connect world-model design choices to all 91 existing principles. |
| `requirements`, `evidence_gates`, `failure_modes` | Identify applicable assurance questions, pass criteria and observed failures. |
| `controlled_vocabularies`, `extraction_crosswalk` | Preserve all 42 legacy vocabularies and map all 182 extraction fields. |
| `annotation_record_schema` | Embedded JSON Schema for annotation records, entities, feature assertions, relationship assertions and evidence fragments. |
| `worked_examples`, `classification_edge_cases` | Synthetic examples explaining difficult decisions; these are not paper evidence. |
| `competency_questions`, `blueprint_derivation` | Questions the completed mapping should answer and the workflow for deriving a blueprint. |
| `source_manifest`, `source_resolution_log` | Version-pinned local sources, primary methodological references and resolved contradictions. |
| `paper_registry` | 211 existing paper records, including 207 locally available PDFs. |

## Fitting a paper

1. Locate the paper and pin the version. Declare its model versions, studies, datasets and evaluations as separate entities where necessary.
2. Import existing extraction cells as provisional historical annotations. Preserve source cell and workbook provenance.
3. Read relevant methods and results. Annotate features using source locators and the rules above. Distinguish implementation from recommendation and evaluate from validate.
4. Add qualified relationships, world types, capability assessments and readiness facets. Check the same model and scope support each conclusion.
5. Select an intended-use profile and applicable gates. Define the actual metric, tolerance, population, action space and horizon before judging a result acceptable.
6. Build a module-by-evidence matrix. Report explicit absence, partial coverage, missing evidence and failed tests separately.

**Importing the workbook without losing world models.** Two import rules apply:

- **Membership.** Legacy `Include – core` (column L) creates a *provisional* core-WM membership assertion. Only a primary-source annotation replaces it (`membership_and_capability.legacy_import_policy`). Applying the core rule mechanically to the original legacy columns resolves only 81 of the 109 legacy core papers, because the dynamics backbone is often recorded as "Other" or "Not reported". For learned/hybrid transitions, also use the training objective (BV) and the paradigm (Y). Eight unresolved papers were checked in their PDFs, and all are learned or hybrid world models: B037, B045, B049, B051, B105, B086, B088 and 088. "Unresolved" never means "not a world model".
- **World type.** Map legacy Scale (Q) to `WorldType` with `world_type_import_rules`. Procedure/scene papers with acquisition or probe-motion actions become `WT_ACQUISITION`. Tissue/organ papers with acquisition actions take `WT_ORGAN` as primary and `WT_ACQUISITION` as secondary.

The registry is prepared for this process; **this artifact does not claim that all 211 papers have been newly annotated against the ontology**. The source workbook also contains reviewer synthesis and legacy evidence limitations, which must remain visible during migration.

## Deriving the blueprint

Select a world and use context first. Compare compatible implementations for each applicable responsibility, then record the chosen implementation, alternatives and justification. Check units, time, state coordinates, action meaning, uncertainty, support and version compatibility across interfaces. Preserve dependencies between studies so reused datasets or model lineages do not masquerade as independent corroboration.

The output should include the composition, contracts, evidence matrix, relevant failure modes, applicable gate outcomes, unresolved gaps and a composition-level evaluation plan. Corpus frequency and graph centrality can describe research coverage; they cannot select a universally safe architecture.

There are no universal clinical thresholds in this ontology. Gates are proposed, use-specific research assurance requirements. A failed executed test and an unresolved evidence gap both prevent a supported pass, but they mean different things. Passing research gates does not itself authorize clinical use.

## What was studied and corrected

Both notebooks' cell sources and saved outputs were indexed. Their analytical narrative and central parsing, graph, requirement, gate and demonstration code were reviewed alongside the knowledge base, extraction schema, audited workbook and the design-principle material. The notebooks were not rerun wholesale, so saved analytical counts are treated as snapshot-dependent.

The ontology explicitly corrects several consequential interpretation risks: templated reviewer module mappings are not implementation evidence; hard-coded reliability curves are illustrations; the demonstration's fixed horizon and unconditional personalization flag are not validation; nonsignificant associations do not establish independence; stochastic outputs do not establish calibration; and action-conditioned comparisons do not establish identified causal effects. The detailed conflict log is in the JSON.

## Validation and limits

`Healthcare_World_Model_Ontology_Validation.json` records structural and reference checks, coverage checks, positive annotation fixtures and deliberately invalid fixtures. The embedded schema follows JSON Schema Draft 2020-12. Semantic rules still require a scope-aware reviewer or a future semantic validation engine; JSON parsing cannot prove that a paper supports an assertion.

The ontology preserves the existing workbook, knowledge base, notebooks and earlier graph artifact unchanged. It is plain JSON with an embedded annotation schema, not a claimed OWL, JSON-LD or executable SHACL ontology.

## Changes in 1.0.1

1. `modules[].feature_ids` is now derived from `features[].module_ids`. Twenty-six features were previously missing from their modules, including all uncertainty features (`uq.*`), evaluation layers E1–E15, the agent features, `action.comparison`, `perception.reconstruction` and `lifecycle.ethics`.
2. Added `membership_and_capability.legacy_import_policy` (provisional membership, a primary-source spot check of 8 papers, and the 5 legacy non-core papers that pass the core rule) and `membership_and_capability.world_model_identity` (necessary conditions, identity tiers and non-dilution invariants).
3. Added `world_type_import_rules`. Legacy Scale and Action type now map to `WorldType`, including the acquisition split. Distribution of the legacy core papers: organ 31, EHR 30, procedure 23, physiology 12, acquisition 9, population 2, multiscale 1, unresolved 1.
4. Extended the legacy columns of `dynamics.learned_hybrid` with Y (paradigm) and X (family; context only).
5. Removed the empty duplicate `vocabularies` object. `controlled_vocabularies` keeps all 42 vocabularies.
6. Added 5 entries to `source_resolution_log`. One records that `Papers/@Academic @EBSCOhost … @T.pdf` is a literature-search response rather than a paper, so it correctly stays out of the registry.

Nothing else changed: classes, relations, features, gates, failure modes, vocabularies, the crosswalk mappings and the paper registry are as in 1.0.0. The validation file keeps the 1,382 original checks and adds 13 for the changed sections (1,395 pass). The 1.0.0 files are backed up in `outputs/ontology_backup_v1.0.0/`.
