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
let edgeIdToIdx = new Map();
let sortedNodeIndices = null;
let sortedEdgeIndices = null;
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

let edgeParallelCount = null; // Uint16Array (E) — how many edges share (subject, object) pair
let selfLoopEdgeCount = 0;
let parallelEdgeGroupCount = 0;
let featureToModulesMap = new Map();
let moduleToFeaturesMap = new Map();
let componentMappingCache = null; // Map<compId, { nodeIndices, edgeIndices, assignedFeatures, moduleIds }>
let crossCuttingCache = null;     // { nodeIndices, edgeIndices, unionNodeCount, unionEdgeCount }

/**
 * Authoritative ontology class metadata derived from Healthcare_World_Model_Ontology.json (HWM-AEO v1.0.1).
 * Explains what each node category means and how it brings evidence or structure into an architecture component.
 */
const ONTOLOGY_RELATION_META = {
  hasVersion: { domain: 'PaperRecord', range: 'PaperVersion', assertWhen: 'Exact read version identified; not inferred from filename.', doNotAssertWhen: 'Only co-occurrence, a keyword, or an inferred filename version supports the edge.' },
  reportsStudy: { domain: 'PaperVersion', range: 'Study', assertWhen: 'The version reports the investigation; one paper can report several.', doNotAssertWhen: 'Only cited or mentioned without reporting the study.' },
  belongsToLineage: { domain: 'Study', range: 'StudyLineage', assertWhen: 'Typed overlap/extension evidence exists; uncertainty is retained.', doNotAssertWhen: 'Only shared topic or keyword overlap.' },
  extendsModel: { domain: 'ModelVersion', range: 'ModelVersion', assertWhen: 'Explicit extension/initialization lineage is documented.', doNotAssertWhen: 'Merely cites an earlier model family.' },
  sharesCohortWith: { domain: 'Study', range: 'Study', assertWhen: 'Participant overlap/data version is evidenced; not just a shared dataset brand.', doNotAssertWhen: 'Only similar clinical domain.' },
  reportsModel: { domain: 'PaperVersion', range: 'ModelVersion', assertWhen: 'The named/configured model is actually part of the paper’s method.', doNotAssertWhen: 'Only cited as related work or external baseline.' },
  composesModel: { domain: 'SystemComposition', range: 'ModelVersion', assertWhen: 'Component is operationally connected, not merely cited.', doNotAssertWhen: 'Co-mentioned without architectural composition.' },
  hasModule: { domain: 'SystemComposition', range: 'ModuleImplementation', assertWhen: 'Implemented responsibility is backed by scoped evidence.', doNotAssertWhen: 'Unimplemented future-work mention.' },
  realizesModule: { domain: 'ModuleImplementation', range: 'BlueprintModule', assertWhen: 'Maps implemented responsibility to M1–M10; a reviewer relevance tag alone is insufficient.', doNotAssertWhen: 'Only topical relevance without implementation.' },
  conformsToInterface: { domain: 'ModuleImplementation', range: 'InterfaceContract', assertWhen: 'Structural and semantic compatibility are specified/tested at the recorded stage.', doNotAssertWhen: 'Unverified interface assumption.' },
  feeds: { domain: 'ModuleImplementation', range: 'ModuleImplementation', assertWhen: 'Actual directed data dependency is documented, with channel/contract.', doNotAssertWhen: 'Only co-occurrence or inferred pipeline order.' },
  controls: { domain: 'ModuleImplementation', range: 'ModuleImplementation', assertWhen: 'Actual directed control/permission dependency is documented.', doNotAssertWhen: 'Co-occurrence without explicit control flow.' },
  modelsWorld: { domain: 'ModelVersion', range: 'WorldType', assertWhen: 'Evolving entity, interaction semantics and time coordinate match the definition.', doNotAssertWhen: 'Broad domain label without world-dynamics match.' },
  hasUseContext: { domain: 'SystemComposition', range: 'IntendedUseContext', assertWhen: 'Population/user/purpose/environment are explicitly scoped.', doNotAssertWhen: 'Generic clinical motivation in introduction.' },
  maintainsState: { domain: 'ModuleImplementation', range: 'StateSpec', assertWhen: 'The specified state is actually carried by this implementation.', doNotAssertWhen: 'Implicitly assumed without state representation.' },
  acceptsAction: { domain: 'ModuleImplementation', range: 'ActionSpec', assertWhen: 'The input can be set/query-conditioned, not only observed as an outcome.', doNotAssertWhen: 'Passive observation treated as controllable action.' },
  simulatesRegime: { domain: 'EvaluationRun', range: 'ActionRegime', assertWhen: 'Alternatives, history and timeline are pinned.', doNotAssertWhen: 'Unpinned open-ended rollout.' },
  usesDataset: { domain: 'EvaluationRun', range: 'DatasetVersion', assertWhen: 'Data release/role/split are known; training and testing roles are qualified.', doNotAssertWhen: 'Dataset brand mentioned without version/split.' },
  evaluatesOnCohort: { domain: 'EvaluationRun', range: 'Cohort', assertWhen: 'Eligibility/unit/count and relationship to development data are explicit.', doNotAssertWhen: 'Cohort details omitted or conflated across studies.' },
  followsProtocol: { domain: 'EvaluationRun', range: 'EvaluationProtocol', assertWhen: 'Evaluation protocol and deviations are recorded.', doNotAssertWhen: 'Protocol details unspecified.' },
  hasMetricResult: { domain: 'EvaluationRun', range: 'MetricResult', assertWhen: 'Numerical result has context, units, direction and uncertainty.', doNotAssertWhen: 'Unscoped headline metric without evaluation context.' },
  supportsAssertion: { domain: 'EvidenceFragment', range: 'Assertion', assertWhen: 'Entailment of the specific state/value and scope has been reviewed, not only substring matched.', doNotAssertWhen: 'Only quote occurrence without entailment.' },
  contradictsAssertion: { domain: 'EvidenceFragment', range: 'Assertion', assertWhen: 'Compatible-scope evidence genuinely contradicts it; version/context differences first resolved.', doNotAssertWhen: 'Different configurations treated as contradiction.' },
  assertedAbout: { domain: 'Assertion', range: 'ResearchEntity', assertWhen: 'Assertion subject/version/scope is identified.', doNotAssertWhen: 'Unscoped paper-level generalization.' },
  wasDerivedFrom: { domain: 'Assertion', range: 'EvidenceFragment', assertWhen: 'Provenance relation; derivation alone does not mean evidence supports the interpretation.', doNotAssertWhen: 'Fabricated or unlocated source passage.' },
  claimsCapability: { domain: 'PaperVersion', range: 'CapabilityLevel', assertWhen: 'Author claim only, tied to the model and source wording.', doNotAssertWhen: 'Equated with demonstrated empirical capability.' },
  demonstratesCapability: { domain: 'ModelVersion', range: 'CapabilityLevel', assertWhen: 'Capability-specific reported-result criteria are met in the stated evaluation scope.', doNotAssertWhen: 'Claimed in abstract without empirical criteria.' },
  hasReadinessEvidence: { domain: 'SystemComposition', range: 'ReadinessFacet', assertWhen: 'The scoped evidence facet is directly reported; no lower facets are automatically inherited.', doNotAssertWhen: 'Inferred from an adjacent facet or cited system.' },
  targetsEstimand: { domain: 'EvaluationProtocol', range: 'CausalEstimand', assertWhen: 'Intervention contrast/population/outcome/horizon are explicit.', doNotAssertWhen: 'Associational prediction labeled causal.' },
  dependsOnAssumption: { domain: 'CausalEstimand', range: 'CausalAssumption', assertWhen: 'Identification/mechanistic argument explicitly uses the assumption.', doNotAssertWhen: 'Unstated identification assumption.' },
  exhibitsFailure: { domain: 'EvaluationRun', range: 'FailureMode', assertWhen: 'Failure or limitation actually observed under the recorded protocol.', doNotAssertWhen: 'Hypothetical future risk only.' },
  mitigates: { domain: 'Mitigation', range: 'FailureMode', assertWhen: 'Design rationale links mechanism to hazard; effectiveness is a separate assertion.', doNotAssertWhen: 'Mitigation effectiveness assumed without test.' },
  informsBlueprintModule: { domain: 'PaperVersion', range: 'BlueprintModule', assertWhen: 'Reviewer design relevance is explicitly labeled; does not mean implements.', doNotAssertWhen: 'Conflated with realizing or implementing the module.' },
  recommendsModule: { domain: 'PaperVersion', range: 'BlueprintModule', assertWhen: 'Author recommendation is explicit and separate from implementation.', doNotAssertWhen: 'Implicit architectural preference.' },
  requiresFeature: { domain: 'Requirement', range: 'FeatureDefinition', assertWhen: 'Applicability and priority are explicit, not inferred from adoption counts.', doNotAssertWhen: 'Popularity treated as safety requirement.' },
  requiresEvidence: { domain: 'EvidenceGate', range: 'Requirement', assertWhen: 'All/any logical relationships and context are declared.', doNotAssertWhen: 'Unscoped checklist item.' },
  hasProfile: { domain: 'SystemComposition', range: 'BlueprintProfile', assertWhen: 'Profile selected for intended use, not assigned solely by specialty.', doNotAssertWhen: 'Specialty label substituted for intended-use profile.' },
  satisfiesGate: { domain: 'EvaluationRun', range: 'EvidenceGate', assertWhen: 'All applicable criteria are explicitly met; unresolved evidence cannot be called pass.', doNotAssertWhen: 'Partial or missing evidence marked as pass.' },
  hasApplicableFramework: { domain: 'Deployment', range: 'GovernanceApplicability', assertWhen: 'Jurisdiction/version/use applicability assessment is recorded.', doNotAssertWhen: 'Generic regulatory name-drop.' },
  publishesCard: { domain: 'Deployment', range: 'ModelCard', assertWhen: 'Card describes the deployed version and actual evidence boundary.', doNotAssertWhen: 'Marketing sheet without scope boundaries.' },
  summarizesExtraction: { domain: 'AnalysisFinding', range: 'DatasetVersion', assertWhen: 'Statistic is derived from a pinned extraction snapshot; not raw clinical evidence.', doNotAssertWhen: 'Treated as independent primary clinical evidence.' },
};

const ONTOLOGY_CLASS_META = {
  BlueprintModule: {
    label: 'Blueprint Module',
    definition: 'A reusable responsibility definition M1–M10, distinct from its implementation.',
    considerWhen: 'An ontology definition/facet is explicitly identified.',
    cautionWhen: 'An actual implementation or study result is silently equated with its abstract class.',
    contributionRole: 'Anchors the architectural responsibility (M1–M10) in the blueprint topology and connects coded features, module implementations, and evidence paths.',
  },
  FeatureDefinition: {
    label: 'Feature Definition',
    definition: 'An operational coding criterion in the feature catalogue.',
    considerWhen: 'An ontology definition/facet is explicitly identified.',
    cautionWhen: 'An actual implementation or study result is silently equated with its abstract class.',
    contributionRole: 'Defines the specific technical, causal, safety, or governance capability criterion used to code reviewed papers for this component.',
  },
  Assertion: {
    label: 'Qualified Assertion',
    definition: 'A subject-property-value statement with stage, status and evidence.',
    considerWhen: 'Subject/version, scope, evidence basis and assessment state are explicit.',
    cautionWhen: 'An unqualified paper-to-category edge is called verified implementation.',
    contributionRole: 'Records scoped present, partial, absent, or gap-documenting judgments linking a paper’s model or study to a feature, gate, or capability criterion.',
  },
  EvidenceFragment: {
    label: 'Evidence Fragment',
    definition: 'Version-pinned source passage/table/code segment.',
    considerWhen: 'Source version plus locator, content and review status are available.',
    cautionWhen: 'Only a page number, generated summary or located substring without entailment review.',
    contributionRole: 'Supplies the exact version-pinned physical page quote, table citation, or figure paraphrase from a reviewed PDF backing an assertion.',
  },
  PaperVersion: {
    label: 'Paper Version',
    definition: 'Exact read document version with date/hash.',
    considerWhen: 'A PDF, accepted manuscript or dated preprint version is pinned.',
    cautionWhen: 'A filename year alone or an unspecified evolving URL.',
    contributionRole: 'Pins the exact reviewed manuscript or preprint PDF (via SHA-256 hash) from which evidence fragments for this component were extracted.',
  },
  PaperRecord: {
    label: 'Paper Record',
    definition: 'Bibliographic record, independent of number of models or experiments.',
    considerWhen: 'A distinct article/report/version is catalogued.',
    cautionWhen: 'Treating one paper as exactly one model, study, or independent validation.',
    contributionRole: 'Provides bibliographic provenance (title, year, DOI/source URL) for a contributing paper without conflating one paper with one study.',
  },
  ModelVersion: {
    label: 'Model Version',
    definition: 'Specified trained/parameterized predictive artifact and configuration.',
    considerWhen: 'Architecture, weights/parameters, configuration or training run identify a version.',
    cautionWhen: 'A family label such as diffusion is treated as one model instance.',
    contributionRole: 'Identifies the concrete trained model or architecture configuration in a reviewed paper whose behavior informs this component.',
  },
  SystemComposition: {
    label: 'System Composition',
    definition: 'Wiring of model and non-model components.',
    considerWhen: 'Data/control dependencies and compatible interfaces are specified.',
    cautionWhen: 'A set of papers merely co-mentions modules.',
    contributionRole: 'Documents how reviewed papers wire neural, symbolic, planning, or guard components across system boundaries.',
  },
  ModuleImplementation: {
    label: 'Module Implementation',
    definition: 'Concrete component realizing one or more blueprint responsibilities.',
    considerWhen: 'Operational inputs/outputs and executed responsibilities are evidenced.',
    cautionWhen: 'A module name, recommendation or reviewer FS tag only.',
    contributionRole: 'Represents an operational module implementation reported in a paper that directly realizes or informs this blueprint component.',
  },
  Study: {
    label: 'Study',
    definition: 'An investigation with a defined design, population and analyses.',
    considerWhen: 'Methods define an empirical or formal investigation.',
    cautionWhen: 'A citation, abstract claim or repeated version is counted as a new study.',
    contributionRole: 'Provides the empirical or formal study design context testing mechanisms relevant to this component.',
  },
  HumanStudy: {
    label: 'Human Evaluation Study',
    definition: 'Actual human participants reviewing or using model outputs.',
    considerWhen: 'Human roles, task, sample/ratings and outcomes are documented.',
    cautionWhen: 'An LLM, automated scorer, or simulated clinician feedback alone.',
    contributionRole: 'Supplies real human-in-the-loop, clinician approval, or reader-study evidence rather than automated proxies.',
  },
  EvaluationRun: {
    label: 'Evaluation Run',
    definition: 'A particular evaluated model/system under a protocol.',
    considerWhen: 'Model version, cohort, horizon/action context and measured results are connected.',
    cautionWhen: 'Results from one module/context are assigned to the complete system.',
    contributionRole: 'Connects a specific model version, cohort, and evaluation protocol to quantitative outcomes testing this component.',
  },
  EvaluationProtocol: {
    label: 'Evaluation Protocol',
    definition: 'Prespecified or explicitly described test procedure.',
    considerWhen: 'Task, splits, metrics, tolerances, analysis and comparator are identifiable.',
    cautionWhen: 'A metric name or plot alone is called a complete protocol.',
    contributionRole: 'Specifies the test splits, metrics, comparators, and tolerances used to evaluate models informing this component.',
  },
  MetricResult: {
    label: 'Metric Result',
    definition: 'Qualified quantitative result.',
    considerWhen: 'Value, units/scale, direction, task, split, horizon and baseline where comparative are supplied.',
    cautionWhen: 'Bare percent improvement or AUROC without outcome/context is pooled as performance.',
    contributionRole: 'Contributes measured quantitative performance, calibration, or rollout metrics from evaluations linked to this component.',
  },
  Cohort: {
    label: 'Cohort',
    definition: 'Defined sample and eligibility criteria within a data resource.',
    considerWhen: 'Population, sampling, count units and inclusion/exclusion are described.',
    cautionWhen: 'Scans, stays, events and patients are equated or counts added without overlap checks.',
    contributionRole: 'Defines the patient or study sample population on which component-relevant models were trained or evaluated.',
  },
  DatasetVersion: {
    label: 'Dataset Version',
    definition: 'Versioned clinical/synthetic data resource with access/provenance.',
    considerWhen: 'Data release or institution/time snapshot is identifiable.',
    cautionWhen: 'A dataset family string is counted as a unique cohort or independent test.',
    contributionRole: 'Identifies the versioned clinical, imaging, or synthetic data resource backing experiments for this component.',
  },
  IntendedUseContext: {
    label: 'Intended-Use Context',
    definition: 'Population, user, setting, purpose and decision boundary.',
    considerWhen: 'A scoped research/deployment use is documented.',
    cautionWhen: 'A generic healthcare label substitutes for intended use.',
    contributionRole: 'Scopes the clinical setting, user role, and decision boundary under which assertions and safety requirements apply.',
  },
  EvidenceGate: {
    label: 'Evidence Gate',
    definition: 'A decision on sufficiency of evidence for a declared purpose.',
    considerWhen: 'Required assertions and contextual validation criteria can be checked.',
    cautionWhen: 'Missing evidence is called an implemented-feature failure.',
    contributionRole: 'Defines the release and evidence-sufficiency gate (G01–G12) checking whether evidence supports this component’s guarantees.',
  },
  CapabilityLevel: {
    label: 'Capability Label',
    definition: 'A functional evidence summary L0–L4 or not-world-model; not clinical or causal assurance.',
    considerWhen: 'An ontology definition/facet is explicitly identified.',
    cautionWhen: 'An actual implementation or study result is silently equated with its abstract class.',
    contributionRole: 'Summarizes demonstrated functional world-model capability (L0–L4) separately from clinical readiness or causal proof.',
  },
  ReadinessFacet: {
    label: 'Readiness Evidence Facet',
    definition: 'An independently scoped clinical/technical validation form, not a cumulative quality score.',
    considerWhen: 'An ontology definition/facet is explicitly identified.',
    cautionWhen: 'An actual implementation or study result is silently equated with its abstract class.',
    contributionRole: 'Tracks scoped clinical and operational validation maturity (R0–R8) at the real-world boundary.',
  },
  WorldType: {
    label: 'World Type',
    definition: 'Nature of the evolving entity/problem, separate from specialty.',
    considerWhen: 'The entity whose state evolves and its interaction context are identified.',
    cautionWhen: 'Specialty or input modality alone determines a world type.',
    contributionRole: 'Categorizes the evolving healthcare system or clinical world (e.g., EHR trajectory, physiology, procedure) modeled across papers.',
  },
  BlueprintProfile: {
    label: 'Blueprint Profile',
    definition: 'Composable world/use-specific architecture recipe.',
    considerWhen: 'Modules, optional choices, contracts and evidence gates are explicitly connected.',
    cautionWhen: 'A discovered cluster or specialty dictates a universally optimal design.',
    contributionRole: 'Maps intended-use world-model profiles to required blueprint modules and release gates.',
  },
  StateSpec: {
    label: 'State Specification',
    definition: 'Variables or representation carried between prediction/update steps.',
    considerWhen: 'A persistent explicit/latent state with update/transition semantics is defined.',
    cautionWhen: 'A static label or one-off embedding automatically implies temporal dynamics.',
    contributionRole: 'Documents explicit or latent state representations and assimilation semantics informing state estimation.',
  },
  ActionSpec: {
    label: 'Action Specification',
    definition: 'A controllable input with role, target, timing and effect channels.',
    considerWhen: 'An intervention/command can be set or queried in the model.',
    cautionWhen: 'An outcome label, disease onset or post-treatment covariate is silently treated as an executable intervention.',
    contributionRole: 'Specifies controllable clinical or robotic action representations, roles, and support constraints.',
  },
  ActionRegime: {
    label: 'Action Regime',
    definition: 'Time-indexed action sequence or policy defining intervention alternatives.',
    considerWhen: 'Agent, dose/parameters, timing, route and co-interventions are specified where applicable.',
    cautionWhen: 'A drug name without enough context is called a complete regimen.',
    contributionRole: 'Captures structured multi-step treatment regimens or policy schedules evaluated during rollout and planning.',
  },
  TimeSpec: {
    label: 'Time Specification',
    definition: 'Clock, timestamp, step/event indexing and temporal support.',
    considerWhen: 'Step size or event-time semantics and units are declared.',
    cautionWhen: 'Diffusion denoising time is confused with physical/patient time.',
    contributionRole: 'Documents acquisition timestamps, availability clocks, and step/event indexing preventing temporal leakage.',
  },
  DynamicsSpec: {
    label: 'Dynamics Specification',
    definition: 'Transition operator over declared world states.',
    considerWhen: 'Next/future state depends on present/history and temporal or acquisition displacement.',
    cautionWhen: 'A static classifier or image reconstruction without evolving-state semantics.',
    contributionRole: 'Characterizes neural, mechanistic ODE/PK-PD, or hybrid state-transition operators.',
  },
  OutcomeSpec: {
    label: 'Outcome Specification',
    definition: 'Typed future-state readout or trajectory endpoint.',
    considerWhen: 'Target, horizon, units and measurement are defined.',
    cautionWhen: 'A decoder, utility or causal effect is conflated with every outcome.',
    contributionRole: 'Defines typed clinical outcome endpoints, horizons, and readout targets evaluated from simulated trajectories.',
  },
  FailureMode: {
    label: 'Failure Mode',
    definition: 'Defined mechanism of invalid/unsafe behavior.',
    considerWhen: 'An observed event/test matches the failure definition.',
    cautionWhen: 'Potential hazard or absence of a mitigation is counted as an observed failure.',
    contributionRole: 'Records observed model failure mechanisms that motivate hard safety guards, shift detectors, and abstention.',
  },
  CalibrationReport: {
    label: 'Calibration Report',
    definition: 'Uncertainty validation with target coverage/reliability context.',
    considerWhen: 'Calibration metric, nominal target, observed result, split and horizon are specified.',
    cautionWhen: 'Stochastic generation, accuracy, interval width or nominal confidence alone.',
    contributionRole: 'Supplies empirical uncertainty calibration and coverage evidence for safety gating and abstention.',
  },
  Claim: {
    label: 'Author Claim',
    definition: 'Statement the authors make, possibly exceeding evidence.',
    considerWhen: 'The source explicitly claims an architecture/capability/effect.',
    cautionWhen: 'Reviewer synthesis or a result extrapolation is attributed to authors.',
    contributionRole: 'Separates explicit author claims from verified implementation or empirical evaluation evidence.',
  },
  DesignDecision: {
    label: 'Design Decision',
    definition: 'Trade-off selection with alternatives and rationale.',
    considerWhen: 'Context, alternatives, justification and evidence are documented.',
    cautionWhen: 'Popularity or reviewer score alone proves the chosen design is superior.',
    contributionRole: 'Documents explicit architectural trade-offs and design rationales synthesized from corpus evidence.',
  },
  AnalysisFinding: {
    label: 'Exploratory Analysis Finding',
    definition: 'Notebook-derived statistic, pattern or hypothesis.',
    considerWhen: 'Data snapshot, code cell, assumptions and uncertainty/proxy limits are attached.',
    cautionWhen: 'A notebook correlation, graph hub or manually assigned array is promoted to primary clinical evidence.',
    contributionRole: 'Captures exploratory corpus-level synthesis findings clearly distinguished from primary study evidence.',
  },
  StudyLineage: {
    label: 'Study Lineage',
    definition: 'Explicit related-study group with typed dependence edges.',
    considerWhen: 'Extension, shared-model, shared-data or duplicate evidence is documented.',
    cautionWhen: 'Same author or graph neighborhood alone certifies dependency or independence.',
    contributionRole: 'Tracks shared-model, shared-data, or extension lineages so correlated papers are not double-counted.',
  },
  ResearchEntity: {
    label: 'Research Entity',
    definition: 'Versioned research/design/evidence object.',
    considerWhen: 'An identifiable source or specification is represented.',
    cautionWhen: 'An unqualified free-text keyword is mistaken for a verified implementation.',
    contributionRole: 'Provides top-level identifiable provenance for versioned research and design objects.',
  },
  ClassDefinition: {
    label: 'Class Definition (Schema)',
    definition: 'Ontology class definition in the HWM-AEO catalog specifying an entity category.',
    considerWhen: 'Inspecting the formal ontology vocabulary defining KG node types.',
    cautionWhen: 'A schema definition is mistaken for an empirical study or model instance.',
    contributionRole: 'Defines the formal ontology vocabulary governing how KG entities are typed across the entire graph.',
  },
  RelationDefinition: {
    label: 'Relation Definition (Schema)',
    definition: 'Ontology relation definition in the HWM-AEO catalog specifying a typed edge predicate.',
    considerWhen: 'Inspecting the formal ontology vocabulary defining KG edge semantics.',
    cautionWhen: 'A relation definition or provenance link is mistaken for causal entailment.',
    contributionRole: 'Defines the formal ontology predicates linking papers, models, assertions, and blueprint components.',
  },
};

function getOntologyClassMeta(classId) {
  const style = getClassStyle(classId);
  const meta = ONTOLOGY_CLASS_META[classId];
  if (meta) {
    return {
      id: classId,
      label: meta.label,
      definition: meta.definition,
      considerWhen: meta.considerWhen,
      cautionWhen: meta.cautionWhen,
      contributionRole: meta.contributionRole,
      color: style.color,
      group: style.group,
    };
  }
  return {
    id: classId,
    label: style.label || classId,
    definition: `Ontology entity of category ${classId} in the Healthcare World Model Knowledge Graph.`,
    considerWhen: 'Entity is explicitly typed in the canonical KG snapshot.',
    cautionWhen: 'Presence in the KG does not by itself imply clinical validation.',
    contributionRole: 'Provides contextual research or provenance structure connected to this component.',
    color: style.color,
    group: style.group,
  };
}

/**
 * Authoritative mapping from the 15 interactive architecture diagram components
 * to their BlueprintModules (M1–M10), partitioned FeatureDefinitions, EvidenceGates (G01–G12),
 * and directly associated specification/validation classes.
 * Single-module components (M1–M8) own all features of their module; shared modules (M9, M10)
 * partition features by operational responsibility so each component highlights its true footprint.
 */
const COMPONENT_SPECS = [
  {
    id: 'intake',
    label: 'Data Adapters & Provenance',
    moduleIds: ['M1'],
    useAllModuleFeatures: true,
    featureIds: ['data.availability_time', 'data.native_time', 'data.leakage_control'],
    gateIds: ['G01'],
    extraClasses: ['TimeSpec'],
  },
  {
    id: 'encode',
    label: 'Encode & Fuse',
    moduleIds: ['M2'],
    useAllModuleFeatures: true,
    featureIds: ['perception.encoder', 'perception.fusion', 'perception.availability_aware_fusion'],
    gateIds: [],
    extraClasses: [],
  },
  {
    id: 'belief',
    label: 'Current State',
    moduleIds: ['M3'],
    useAllModuleFeatures: true,
    featureIds: ['state.online_assimilation', 'state.sufficiency_test'],
    gateIds: [],
    extraClasses: ['StateSpec'],
  },
  {
    id: 'actions',
    label: 'Candidate Actions',
    moduleIds: ['M4'],
    useAllModuleFeatures: true,
    featureIds: ['action.typed_roles', 'action.support', 'action.schedule'],
    gateIds: ['G05'],
    extraClasses: ['ActionSpec', 'ActionRegime'],
  },
  {
    id: 'transition',
    label: 'Next-State Model',
    moduleIds: ['M5'],
    useAllModuleFeatures: true,
    featureIds: ['dynamics.action_conditioned', 'dynamics.learned_hybrid', 'dynamics.hybrid'],
    gateIds: ['G02'],
    extraClasses: ['DynamicsSpec'],
  },
  {
    id: 'rollout',
    label: 'Roll Out Futures',
    moduleIds: ['M6'],
    useAllModuleFeatures: true,
    featureIds: ['rollout.multistep', 'rollout.drift_test', 'rollout.effective_horizon'],
    gateIds: ['G03'],
    extraClasses: [],
  },
  {
    id: 'outcomes',
    label: 'Score Outcomes',
    moduleIds: ['M7'],
    useAllModuleFeatures: true,
    featureIds: ['causal.estimand', 'causal.identification', 'causal.effect_claim_gate'],
    gateIds: ['G06'],
    extraClasses: ['OutcomeSpec'],
  },
  {
    id: 'planner',
    label: 'Planner / Policy',
    moduleIds: ['M8'],
    useAllModuleFeatures: true,
    featureIds: ['planning.model_use', 'planning.exploitation_test'],
    gateIds: ['G07'],
    extraClasses: [],
  },
  {
    id: 'guard',
    label: 'Safety Checks',
    moduleIds: ['M9'],
    useAllModuleFeatures: false,
    featureIds: [
      'safety.hard_guard', 'uq.shift_detector', 'safety.abstention',
      'uq.explicit', 'uq.decomposition', 'uq.calibration_evaluated',
      'uq.conformal', 'uq.tolerance_met', 'uq.trajectory_calibration',
      'safety.kill_switch', 'safety.privacy_controls', 'safety.memorization_audit',
      'safety.red_team', 'safety.threat_model', 'action.constraints',
      'action.irreversibility', 'rollout.horizon_enforcement', 'evaluation.E5', 'evaluation.E11',
    ],
    gateIds: ['G04', 'G08'],
    extraClasses: ['CalibrationReport', 'FailureMode'],
  },
  {
    id: 'presentation',
    label: 'Show & Approve',
    moduleIds: ['M10'],
    useAllModuleFeatures: false,
    featureIds: [
      'safety.human_escalation', 'lifecycle.intended_use', 'safety.automation_bias',
      'state.interpretability', 'agent.role', 'evaluation.E13', 'evaluation.E15',
    ],
    gateIds: [],
    extraClasses: [],
  },
  {
    id: 'approval',
    label: 'Clinician Approves Action?',
    moduleIds: ['M10'],
    useAllModuleFeatures: false,
    featureIds: [
      'safety.permissions', 'agent.autonomy', 'agent.external_calls', 'agent.multiple',
      'lifecycle.ethics', 'lifecycle.regulatory_evidence', 'lifecycle.regulatory_mention',
      'evaluation.E9', 'evaluation.E13',
    ],
    gateIds: ['G11'],
    extraClasses: [],
  },
  {
    id: 'trace',
    label: 'Trace Log',
    moduleIds: ['M10'],
    useAllModuleFeatures: false,
    featureIds: [
      'lifecycle.model_card', 'release.code', 'release.weights', 'release.license',
      'release.reproduced', 'evaluation.E1', 'evaluation.E3', 'evaluation.E4',
      'evaluation.E6', 'evaluation.E7', 'evaluation.E8', 'evaluation.E14',
    ],
    gateIds: [],
    extraClasses: [],
  },
  {
    id: 'drift',
    label: 'Drift Monitor',
    moduleIds: ['M9'],
    useAllModuleFeatures: false,
    featureIds: [
      'lifecycle.monitoring', 'safety.runtime_monitor', 'uq.shift_detector',
      'safety.kill_switch', 'rollout.drift_test', 'evaluation.E2',
      'evaluation.E10', 'evaluation.E11', 'evaluation.E12',
    ],
    gateIds: ['G09'],
    extraClasses: [],
  },
  {
    id: 'watch',
    label: 'Watch in Use',
    moduleIds: ['M10'],
    useAllModuleFeatures: false,
    featureIds: [
      'lifecycle.change_control', 'lifecycle.monitoring', 'lifecycle.regulatory_evidence',
      'safety.runtime_monitor', 'evaluation.E10', 'evaluation.E15',
    ],
    gateIds: ['G12'],
    extraClasses: [],
  },
  {
    id: 'boundary',
    label: 'Real Patient & Care Setting',
    moduleIds: [],
    useAllModuleFeatures: false,
    featureIds: ['agent.autonomy', 'lifecycle.intended_use', 'evaluation.E10', 'evaluation.E13', 'evaluation.E15'],
    gateIds: ['G10', 'G11'],
    readinessIds: ['R4', 'R5', 'R6', 'R7', 'R8'],
    extraClasses: ['HumanStudy'],
  },
];

const COMPONENT_SPEC_BY_ID = new Map(COMPONENT_SPECS.map((c) => [c.id, c]));

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
  featureToModulesMap = featureToModules;
  moduleToFeaturesMap = new Map();
  componentMappingCache = null;
  crossCuttingCache = null;
  for (let i = 0; i < N; i++) {
    const n = nodes[i];
    idToIdx.set(n.id, i);
    if (n.isCatalog && n.class_id === 'FeatureDefinition' && Array.isArray(n.module_ids)) {
      featureToModules.set(n.id, n.module_ids);
      for (const mId of n.module_ids) {
        if (!moduleToFeaturesMap.has(mId)) moduleToFeaturesMap.set(mId, []);
        moduleToFeaturesMap.get(mId).push(n.id);
      }
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

  // Index edges, self-loops, parallel edge groups, and propagate capability / readiness / world type / module links
  edgeIdToIdx = new Map();
  edgeParallelCount = new Uint16Array(E);
  selfLoopEdgeCount = 0;
  const pairCounts = new Map();
  const predicateCounts = new Map();
  for (let e = 0; e < E; e++) {
    const edge = edges[e];
    edgeIdToIdx.set(edge.id, e);
    const s = idToIdx.get(edge.subject_id);
    const o = idToIdx.get(edge.object_id);
    edge._s = s !== undefined ? s : -1;
    edge._o = o !== undefined ? o : -1;
    edge._isKg = typeof edge.predicate_id === 'string' && edge.predicate_id.startsWith('kg:');

    predicateCounts.set(edge.predicate_id, (predicateCounts.get(edge.predicate_id) || 0) + 1);

    if (s !== undefined && o !== undefined) {
      outAdj[s].push(e);
      inAdj[o].push(e);
      if (s === o) selfLoopEdgeCount++;
      const pairKey = `${s}|${o}`;
      pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);

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
  parallelEdgeGroupCount = 0;
  for (const cnt of pairCounts.values()) {
    if (cnt > 1) parallelEdgeGroupCount++;
  }
  for (let e = 0; e < E; e++) {
    const ed = edges[e];
    if (ed._s >= 0 && ed._o >= 0) {
      edgeParallelCount[e] = Math.min(65535, pairCounts.get(`${ed._s}|${ed._o}`) || 1);
    } else {
      edgeParallelCount[e] = 1;
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

  sortedNodeIndices = Int32Array.from({ length: N }, (_, i) => i);
  sortedNodeIndices.sort((a, b) => (nodes[a].id < nodes[b].id ? -1 : nodes[a].id > nodes[b].id ? 1 : 0));
  sortedEdgeIndices = Int32Array.from({ length: E }, (_, e) => e);
  sortedEdgeIndices.sort((a, b) => (edges[a].id < edges[b].id ? -1 : edges[a].id > edges[b].id ? 1 : 0));

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

  const ontologyClasses = {};
  for (const clsId of classCounts.keys()) {
    ontologyClasses[clsId] = getOntologyClassMeta(clsId);
  }

  const facets = {
    classes: Array.from(classCounts.entries())
      .map(([id, count]) => {
        const meta = ontologyClasses[id];
        return {
          id,
          count,
          ...getClassStyle(id),
          label: meta.label,
          definition: meta.definition,
          considerWhen: meta.considerWhen,
          cautionWhen: meta.cautionWhen,
          contributionRole: meta.contributionRole,
        };
      })
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
      ontologyClasses,
      ontologyRelations: ONTOLOGY_RELATION_META,
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
  const rawQ = (query || '').trim();
  const q = rawQ.toLowerCase();
  if (!q) {
    self.postMessage({ type: 'searchResults', query, results: [] });
    return;
  }

  const exactResults = [];
  const exactNodeIdx = idToIdx.get(rawQ);
  if (exactNodeIdx !== undefined) {
    const n = nodes[exactNodeIdx];
    exactResults.push({
      kind: 'node',
      exactIdMatch: true,
      idx: exactNodeIdx,
      id: n.id,
      class_id: n.class_id,
      label: displayLabel[exactNodeIdx],
      paperId: nodePaperId[exactNodeIdx],
      source: n.source_annotation || (n.isCatalog ? 'Ontology' : '—'),
      isVisible: currentNodeVis ? currentNodeVis[exactNodeIdx] === 1 : true,
      state: nodeState[exactNodeIdx],
    });
  }
  const exactEdgeIdx = edgeIdToIdx.get(rawQ);
  if (exactEdgeIdx !== undefined) {
    const ed = edges[exactEdgeIdx];
    exactResults.push({
      kind: 'edge',
      exactIdMatch: true,
      edgeIdx: exactEdgeIdx,
      id: ed.id,
      predicate_id: ed.predicate_id,
      subject_id: ed.subject_id,
      object_id: ed.object_id,
      isKg: ed._isKg,
      source: ed.source_annotation || 'Ontology',
      isVisible: currentEdgeVis ? currentEdgeVis[exactEdgeIdx] === 1 : false,
    });
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = [];

  for (let i = 0; i < nodes.length; i++) {
    if (i === exactNodeIdx) continue;
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
  const remaining = Math.max(0, limit - exactResults.length);
  const top = exactResults.concat(scored.slice(0, remaining).map(({ idx }) => {
    const n = nodes[idx];
    return {
      kind: 'node',
      idx,
      id: n.id,
      class_id: n.class_id,
      label: displayLabel[idx],
      paperId: nodePaperId[idx],
      source: n.source_annotation || (n.isCatalog ? 'Ontology' : '—'),
      isVisible: currentNodeVis ? currentNodeVis[idx] === 1 : true,
      state: nodeState[idx],
    };
  }));

  self.postMessage({ type: 'searchResults', query, totalMatches: scored.length + exactResults.length, results: top });
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

  const classDefIdx = idToIdx.get(n.class_id) ?? idToIdx.get(`class:${n.class_id}`) ?? -1;

  return {
    idx,
    node: n,
    label: displayLabel[idx],
    paperId: pid,
    registry: reg || null,
    ontologyMeta: getOntologyClassMeta(n.class_id),
    classDefIdx: classDefIdx !== idx ? classDefIdx : -1,
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
  const relDefIdx = idToIdx.get(ed.predicate_id) ?? idToIdx.get(`relation:${ed.predicate_id}`) ?? -1;
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
    ontologyRelation: ONTOLOGY_RELATION_META[ed.predicate_id] || null,
    relDefIdx,
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
    } else if (msg.type === 'getCoverageBatch') {
      postCoverageBatch(msg);
    } else if (msg.type === 'resolveArchitecture' || msg.type === 'resolveArchitectureFull') {
      postResolvedArchitecture(msg);
    } else if (msg.type === 'getOverlayGeometry') {
      postOverlayGeometry(msg);
    } else if (msg.type === 'getFullCoverageStats') {
      postFullCoverageStats(msg);
    } else if (msg.type === 'getComponentCoverageSummary') {
      postComponentCoverageSummary(msg);
    } else if (msg.type === 'getAllCoverageGeometry') {
      postAllCoverageGeometry(msg);
    } else if (msg.type === 'getOntologyClasses') {
      postOntologyClasses(msg);
    } else if (msg.type === 'explainEntityForComponent') {
      postEntityComponentExplanation(msg);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};

function postCoverageBatch(req) {
  const phase = req.phase === 'edges' ? 'edges' : 'nodes';
  const batchSize = Math.max(1, Math.min(2000, Number(req.batchSize) || 500));
  const totalItems = phase === 'edges' ? edges.length : nodes.length;
  const totalBatches = Math.max(1, Math.ceil(totalItems / batchSize));
  const batchIndex = Math.max(0, Math.min(totalBatches - 1, Number(req.batchIndex) || 0));
  const start = batchIndex * batchSize;
  const end = Math.min(totalItems, start + batchSize);
  const count = end - start;

  if (phase === 'nodes') {
    const nodeIndices = new Int32Array(count);
    const nodePositions = new Float32Array(count * 3);
    const items = new Array(count);
    for (let k = 0; k < count; k++) {
      const idx = sortedNodeIndices[start + k];
      const n = nodes[idx];
      nodeIndices[k] = idx;
      nodePositions[k * 3] = currentPositions[idx * 3];
      nodePositions[k * 3 + 1] = currentPositions[idx * 3 + 1];
      nodePositions[k * 3 + 2] = currentPositions[idx * 3 + 2];
      items[k] = {
        kind: 'node',
        idx,
        id: n.id,
        class_id: n.class_id,
        label: displayLabel[idx],
        paperId: nodePaperId[idx] || (n.isCatalog ? 'Ontology' : '—'),
      };
    }
    self.postMessage(
      {
        type: 'coverageBatch',
        requestId: req.requestId,
        phase,
        batchIndex,
        batchSize,
        startIndex: start,
        endIndex: end,
        batchItemCount: count,
        totalItems,
        totalBatches,
        nodeIndices,
        nodePositions,
        items,
      },
      [nodeIndices.buffer, nodePositions.buffer]
    );
    return;
  }

  const edgeIndices = new Int32Array(count);
  const edgePositions = new Float32Array(count * 6);
  const endpointSet = new Set();
  const selfLoopArr = [];
  const items = new Array(count);

  for (let k = 0; k < count; k++) {
    const e = sortedEdgeIndices[start + k];
    const ed = edges[e];
    const s = ed._s;
    const o = ed._o;
    edgeIndices[k] = e;
    const isSelfLoop = s >= 0 && s === o;
    if (s >= 0 && o >= 0) {
      endpointSet.add(s);
      endpointSet.add(o);
      edgePositions[k * 6] = currentPositions[s * 3];
      edgePositions[k * 6 + 1] = currentPositions[s * 3 + 1];
      edgePositions[k * 6 + 2] = currentPositions[s * 3 + 2];
      edgePositions[k * 6 + 3] = currentPositions[o * 3];
      edgePositions[k * 6 + 4] = currentPositions[o * 3 + 1];
      edgePositions[k * 6 + 5] = currentPositions[o * 3 + 2];
      if (isSelfLoop) {
        selfLoopArr.push(currentPositions[s * 3], currentPositions[s * 3 + 1], currentPositions[s * 3 + 2]);
      }
    }
    items[k] = {
      kind: 'edge',
      edgeIdx: e,
      id: ed.id,
      predicate_id: ed.predicate_id,
      subject_id: ed.subject_id,
      object_id: ed.object_id,
      isSelfLoop,
      parallelGroupSize: edgeParallelCount ? edgeParallelCount[e] : 1,
      isKg: ed._isKg,
      source: ed.source_annotation || 'Ontology',
    };
  }

  const nodeIndices = Int32Array.from(endpointSet);
  const nodePositions = new Float32Array(nodeIndices.length * 3);
  for (let k = 0; k < nodeIndices.length; k++) {
    const idx = nodeIndices[k];
    nodePositions[k * 3] = currentPositions[idx * 3];
    nodePositions[k * 3 + 1] = currentPositions[idx * 3 + 1];
    nodePositions[k * 3 + 2] = currentPositions[idx * 3 + 2];
  }
  const selfLoopPositions = new Float32Array(selfLoopArr);

  self.postMessage(
    {
      type: 'coverageBatch',
      requestId: req.requestId,
      phase,
      batchIndex,
      batchSize,
      startIndex: start,
      endIndex: end,
      batchItemCount: count,
      totalItems,
      totalBatches,
      edgeIndices,
      edgePositions,
      nodeIndices,
      nodePositions,
      selfLoopPositions,
      items,
    },
    [edgeIndices.buffer, edgePositions.buffer, nodeIndices.buffer, nodePositions.buffer, selfLoopPositions.buffer]
  );
}

function buildOverlayBuffers(nodeIdxList, edgeIdxList) {
  const nodeIndices = nodeIdxList instanceof Int32Array ? new Int32Array(nodeIdxList) : Int32Array.from(nodeIdxList);
  const nodePositions = new Float32Array(nodeIndices.length * 3);
  for (let k = 0; k < nodeIndices.length; k++) {
    const idx = nodeIndices[k];
    nodePositions[k * 3] = currentPositions[idx * 3];
    nodePositions[k * 3 + 1] = currentPositions[idx * 3 + 1];
    nodePositions[k * 3 + 2] = currentPositions[idx * 3 + 2];
  }

  const edgeIndices = edgeIdxList instanceof Int32Array ? new Int32Array(edgeIdxList) : Int32Array.from(edgeIdxList);
  const edgePositions = new Float32Array(edgeIndices.length * 6);
  const selfLoopArr = [];
  for (let k = 0; k < edgeIndices.length; k++) {
    const ed = edges[edgeIndices[k]];
    const s = ed._s;
    const o = ed._o;
    if (s >= 0 && o >= 0) {
      edgePositions[k * 6] = currentPositions[s * 3];
      edgePositions[k * 6 + 1] = currentPositions[s * 3 + 1];
      edgePositions[k * 6 + 2] = currentPositions[s * 3 + 2];
      edgePositions[k * 6 + 3] = currentPositions[o * 3];
      edgePositions[k * 6 + 4] = currentPositions[o * 3 + 1];
      edgePositions[k * 6 + 5] = currentPositions[o * 3 + 2];
      if (s === o) {
        selfLoopArr.push(currentPositions[s * 3], currentPositions[s * 3 + 1], currentPositions[s * 3 + 2]);
      }
    }
  }
  const selfLoopPositions = new Float32Array(selfLoopArr);
  return { nodeIndices, nodePositions, edgeIndices, edgePositions, selfLoopPositions };
}

/* ---------- Full Component-to-KG Mapping & 100% Coverage Partition ---------- */

const SUBJECT_CONTEXT_PREDS = new Set([
  'hasMetricResult',
  'evaluatesOnCohort',
  'usesDataset',
  'hasUseContext',
  'hasModule',
  'composesModel',
  'realizesModule',
  'informsBlueprintModule',
  'recommendsModule',
  'hasVersion',
  'reportsModel',
  'reportsStudy',
  'acceptsAction',
  'followsProtocol',
  'maintainsState',
  'exhibitsFailure',
  'modelsWorld',
  'hasReadinessEvidence',
  'demonstratesCapability',
  'claimsCapability',
  'hasProfile',
  'belongsToLineage',
  'kg:sourceVersion',
]);

function computeSingleComponentMapping(spec, extraModuleIds = [], extraFeatureIds = []) {
  const N = nodes.length;
  const E = edges.length;
  const nodeMark = new Uint8Array(N);
  const assignedModules = new Set([...(spec?.moduleIds || []), ...(extraModuleIds || [])]);
  const assignedFeatures = new Set([...(spec?.featureIds || []), ...(extraFeatureIds || [])]);

  if (!spec || spec.useAllModuleFeatures) {
    for (const mId of assignedModules) {
      const mFeats = moduleToFeaturesMap.get(mId);
      if (mFeats) {
        for (const fid of mFeats) assignedFeatures.add(fid);
      }
    }
  }

  const seedAssertions = [];
  const assertionMark = new Uint8Array(N);
  const addAssertion = (idx) => {
    if (idx >= 0 && !assertionMark[idx]) {
      assertionMark[idx] = 1;
      nodeMark[idx] = 1;
      seedAssertions.push(idx);
    }
  };

  // 1. Seed BlueprintModule nodes & direct module implementations/assertions
  for (const mId of assignedModules) {
    const mIdx = idToIdx.get(mId);
    if (mIdx === undefined) continue;
    nodeMark[mIdx] = 1;
    for (const e of inAdj[mIdx]) {
      const ed = edges[e];
      const s = ed._s;
      if (s < 0) continue;
      // For shared modules (M9, M10), skip non-assigned FeatureDefinitions so sibling components stay distinct
      if (ed.predicate_id === 'kg:ontologyModuleMembership' && !assignedFeatures.has(nodes[s].id)) {
        continue;
      }
      nodeMark[s] = 1;
      if (nodes[s].class_id === 'Assertion') addAssertion(s);
    }
    for (const e of outAdj[mIdx]) {
      const o = edges[e]._o;
      if (o >= 0) nodeMark[o] = 1;
    }
  }

  // 2. Seed FeatureDefinition nodes & all feature Assertions pointing to them
  for (const fid of assignedFeatures) {
    const fIdx = idToIdx.get(fid);
    if (fIdx === undefined) continue;
    nodeMark[fIdx] = 1;
    for (const e of inAdj[fIdx]) {
      const s = edges[e]._s;
      if (s >= 0) {
        nodeMark[s] = 1;
        if (nodes[s].class_id === 'Assertion') addAssertion(s);
      }
    }
  }

  // 3. Seed component EvidenceGates (G01..G12) and ReadinessFacets (for boundary)
  for (const gId of (spec?.gateIds || [])) {
    const gIdx = idToIdx.get(gId);
    if (gIdx === undefined) continue;
    nodeMark[gIdx] = 1;
    for (const e of inAdj[gIdx]) {
      const s = edges[e]._s;
      if (s >= 0) {
        nodeMark[s] = 1;
        if (nodes[s].class_id === 'Assertion') addAssertion(s);
      }
    }
  }
  for (const rId of (spec?.readinessIds || [])) {
    const rIdx = idToIdx.get(rId);
    if (rIdx === undefined) continue;
    nodeMark[rIdx] = 1;
    for (const e of inAdj[rIdx]) {
      const s = edges[e]._s;
      if (s >= 0) {
        nodeMark[s] = 1;
        if (nodes[s].class_id === 'Assertion') addAssertion(s);
      }
    }
  }

  // 4. Seed component-specific specification / validation entity classes
  const extraClassSet = new Set(spec?.extraClasses || []);
  const seedEntities = [];
  if (extraClassSet.size > 0) {
    for (let i = 0; i < N; i++) {
      if (extraClassSet.has(nodes[i].class_id)) {
        nodeMark[i] = 1;
        seedEntities.push(i);
      }
    }
  }

  // 5. Pull in assessments built on top of our feature assertions (via incoming kg:basedOnAssertion)
  const baseCount = seedAssertions.length;
  for (let k = 0; k < baseCount; k++) {
    const aIdx = seedAssertions[k];
    for (const e of inAdj[aIdx]) {
      const ed = edges[e];
      if (ed.predicate_id === 'kg:basedOnAssertion' && ed._s >= 0) {
        addAssertion(ed._s);
      }
    }
  }

  // 6. From all component Assertions -> EvidenceFragments, PaperVersions, Subjects, Objects
  const evFrags = [];
  const evMark = new Uint8Array(N);
  const subjects = [];
  const subMark = new Uint8Array(N);

  for (let k = 0; k < seedAssertions.length; k++) {
    const aIdx = seedAssertions[k];
    for (const e of outAdj[aIdx]) {
      const o = edges[e]._o;
      if (o < 0) continue;
      nodeMark[o] = 1;
      const cls = nodes[o].class_id;
      if (cls === 'EvidenceFragment') {
        if (!evMark[o]) {
          evMark[o] = 1;
          evFrags.push(o);
        }
      } else if (!nodes[o].isCatalog) {
        if (!subMark[o]) {
          subMark[o] = 1;
          subjects.push(o);
        }
      }
    }
  }

  for (let k = 0; k < seedEntities.length; k++) {
    const idx = seedEntities[k];
    if (!subMark[idx]) {
      subMark[idx] = 1;
      subjects.push(idx);
    }
  }

  // 7. EvidenceFragment -> PaperVersion -> PaperRecord
  const paperVersions = [];
  const pvMark = new Uint8Array(N);
  for (let k = 0; k < evFrags.length; k++) {
    const ef = evFrags[k];
    for (const e of outAdj[ef]) {
      const o = edges[e]._o;
      if (o >= 0) {
        nodeMark[o] = 1;
        if (nodes[o].class_id === 'PaperVersion' && !pvMark[o]) {
          pvMark[o] = 1;
          paperVersions.push(o);
        }
      }
    }
  }

  // 8. Subject entities -> direct quantitative / evaluation / model / study context (1-hop scientific edges)
  for (let k = 0; k < subjects.length; k++) {
    const u = subjects[k];
    if (nodes[u].class_id === 'PaperVersion' && !pvMark[u]) {
      pvMark[u] = 1;
      paperVersions.push(u);
    }
    for (const e of outAdj[u]) {
      const ed = edges[e];
      if (ed._o >= 0 && SUBJECT_CONTEXT_PREDS.has(ed.predicate_id)) {
        nodeMark[ed._o] = 1;
      }
    }
    for (const e of inAdj[u]) {
      const ed = edges[e];
      if (ed._s >= 0 && SUBJECT_CONTEXT_PREDS.has(ed.predicate_id)) {
        nodeMark[ed._s] = 1;
      }
    }
  }

  // Link PaperVersion <-> PaperRecord (hasVersion)
  for (let k = 0; k < paperVersions.length; k++) {
    const pv = paperVersions[k];
    for (const e of inAdj[pv]) {
      if (edges[e].predicate_id === 'hasVersion' && edges[e]._s >= 0) {
        nodeMark[edges[e]._s] = 1;
      }
    }
    for (const e of outAdj[pv]) {
      if (edges[e].predicate_id === 'hasVersion' && edges[e]._o >= 0) {
        nodeMark[edges[e]._o] = 1;
      }
    }
  }

  // 9. Collect dense sorted nodeIndices and all induced edgeIndices within this component subgraph
  const nodeIndicesArr = [];
  for (let i = 0; i < N; i++) {
    if (nodeMark[i]) nodeIndicesArr.push(i);
  }
  const edgeIndicesArr = [];
  for (let e = 0; e < E; e++) {
    const ed = edges[e];
    if (ed._s >= 0 && ed._o >= 0 && nodeMark[ed._s] && nodeMark[ed._o]) {
      edgeIndicesArr.push(e);
    }
  }

  return {
    id: spec ? spec.id : 'custom',
    label: spec ? spec.label : 'Component',
    moduleIds: Array.from(assignedModules),
    assignedFeatures: Array.from(assignedFeatures),
    nodeIndices: Int32Array.from(nodeIndicesArr),
    edgeIndices: Int32Array.from(edgeIndicesArr),
  };
}

function ensureComponentCoverageCache() {
  if (componentMappingCache && crossCuttingCache) return;
  const N = nodes.length;
  const E = edges.length;
  componentMappingCache = new Map();
  const coveredNodes = new Uint8Array(N);
  const coveredEdges = new Uint8Array(E);

  for (const spec of COMPONENT_SPECS) {
    const mapped = computeSingleComponentMapping(spec);
    componentMappingCache.set(spec.id, mapped);
    for (let k = 0; k < mapped.nodeIndices.length; k++) coveredNodes[mapped.nodeIndices[k]] = 1;
    for (let k = 0; k < mapped.edgeIndices.length; k++) coveredEdges[mapped.edgeIndices[k]] = 1;
  }

  const crossNodes = [];
  let unionNodeCount = 0;
  for (let i = 0; i < N; i++) {
    if (coveredNodes[i]) unionNodeCount++;
    else crossNodes.push(i);
  }
  const crossEdges = [];
  let unionEdgeCount = 0;
  for (let e = 0; e < E; e++) {
    if (coveredEdges[e]) unionEdgeCount++;
    else crossEdges.push(e);
  }

  crossCuttingCache = {
    nodeIndices: Int32Array.from(crossNodes),
    edgeIndices: Int32Array.from(crossEdges),
    unionNodeCount,
    unionEdgeCount,
  };
}

function buildClassBreakdown(allNodeIndices, curatedNodeSet) {
  const byClass = new Map();
  for (let k = 0; k < allNodeIndices.length; k++) {
    const idx = allNodeIndices[k];
    const cls = nodes[idx].class_id;
    let bucket = byClass.get(cls);
    if (!bucket) {
      bucket = { count: 0, curatedCount: 0, samples: [] };
      byClass.set(cls, bucket);
    }
    bucket.count++;
    const isCurated = curatedNodeSet ? curatedNodeSet.has(idx) : false;
    if (isCurated) bucket.curatedCount++;
    if (bucket.samples.length < 4) {
      bucket.samples.push({ idx, id: nodes[idx].id, label: displayLabel[idx] });
    } else if (isCurated) {
      // Prefer curated examples at front of samples if not already present
      const nonCuratedPos = bucket.samples.findIndex((s) => !curatedNodeSet.has(s.idx));
      if (nonCuratedPos >= 0) {
        bucket.samples[nonCuratedPos] = { idx, id: nodes[idx].id, label: displayLabel[idx] };
      }
    }
  }

  // Order with curated/architectural categories clearly surfaced, then by count descending
  const priorityOrder = [
    'BlueprintModule',
    'FeatureDefinition',
    'Assertion',
    'EvidenceFragment',
    'PaperVersion',
    'ModelVersion',
    'ModuleImplementation',
    'SystemComposition',
    'HumanStudy',
    'Study',
    'EvaluationRun',
    'MetricResult',
    'Cohort',
    'DatasetVersion',
    'IntendedUseContext',
    'EvidenceGate',
    'PaperRecord',
  ];
  const prio = new Map(priorityOrder.map((c, i) => [c, i]));

  return Array.from(byClass.entries())
    .map(([cls, info]) => {
      const meta = getOntologyClassMeta(cls);
      return {
        class_id: cls,
        label: meta.label,
        color: meta.color,
        group: meta.group,
        description: meta.definition,
        considerWhen: meta.considerWhen,
        cautionWhen: meta.cautionWhen,
        contributionRole: meta.contributionRole,
        count: info.count,
        curatedCount: info.curatedCount,
        sampleIds: info.samples,
      };
    })
    .sort((a, b) => {
      const pa = prio.has(a.class_id) ? prio.get(a.class_id) : 99;
      const pb = prio.has(b.class_id) ? prio.get(b.class_id) : 99;
      if (pa !== pb) return pa - pb;
      return b.count - a.count;
    });
}

function postResolvedArchitecture(req) {
  ensureComponentCoverageCache();

  // 1. Resolve exact curated representative evidence paths (Layer 1 — primary accent)
  const curatedNodeSet = new Set();
  const missingNodeIds = [];
  for (const nid of (req.nodeIds || [])) {
    const idx = idToIdx.get(nid);
    if (idx !== undefined) curatedNodeSet.add(idx);
    else missingNodeIds.push(nid);
  }

  const curatedEdgeSet = new Set();
  const missingEdgeIds = [];
  for (const ref of (req.edgeRefs || [])) {
    const eid = typeof ref === 'string' ? ref : ref.id;
    const eIdx = edgeIdToIdx.get(eid);
    if (eIdx !== undefined) {
      curatedEdgeSet.add(eIdx);
      const ed = edges[eIdx];
      if (ed._s >= 0) curatedNodeSet.add(ed._s);
      if (ed._o >= 0) curatedNodeSet.add(ed._o);
    } else {
      missingEdgeIds.push(eid);
    }
  }

  // 2. Resolve ALL contributing KG nodes & edges for this component (Layer 2 — full footprint)
  let baseMapping = componentMappingCache.get(req.componentId);
  if (!baseMapping) {
    const spec = COMPONENT_SPEC_BY_ID.get(req.componentId) || null;
    baseMapping = computeSingleComponentMapping(spec, req.moduleIds || [], req.featureIds || []);
  }

  // Merge base component mapping with any curated nodes/edges so curated is strictly a subset of allMapped
  const allNodeSet = new Set(baseMapping.nodeIndices);
  for (const idx of curatedNodeSet) allNodeSet.add(idx);
  const allEdgeSet = new Set(baseMapping.edgeIndices);
  for (const eIdx of curatedEdgeSet) allEdgeSet.add(eIdx);

  const curatedBufs = buildOverlayBuffers(curatedNodeSet, curatedEdgeSet);
  const allMappedBufs = buildOverlayBuffers(allNodeSet, allEdgeSet);
  const classBreakdown = buildClassBreakdown(allMappedBufs.nodeIndices, curatedNodeSet);

  self.postMessage(
    {
      type: 'architectureResolved',
      requestId: req.requestId,
      componentId: req.componentId,
      mode: req.mode || 'preview',
      missingNodeIds,
      missingEdgeIds,

      // Backward-compatible primary aliases (shared buffer references with curated*)
      nodeIndices: curatedBufs.nodeIndices,
      nodePositions: curatedBufs.nodePositions,
      edgeIndices: curatedBufs.edgeIndices,
      edgePositions: curatedBufs.edgePositions,
      selfLoopPositions: curatedBufs.selfLoopPositions,

      // Layer 1: Curated Representative Evidence Paths
      curatedNodeIndices: curatedBufs.nodeIndices,
      curatedNodePositions: curatedBufs.nodePositions,
      curatedEdgeIndices: curatedBufs.edgeIndices,
      curatedEdgePositions: curatedBufs.edgePositions,
      curatedSelfLoopPositions: curatedBufs.selfLoopPositions,
      curatedNodeCount: curatedBufs.nodeIndices.length,
      curatedEdgeCount: curatedBufs.edgeIndices.length,

      // Layer 2: Complete Component-Contributing KG Footprint
      allMappedNodeIndices: allMappedBufs.nodeIndices,
      allMappedNodePositions: allMappedBufs.nodePositions,
      allMappedEdgeIndices: allMappedBufs.edgeIndices,
      allMappedEdgePositions: allMappedBufs.edgePositions,
      allMappedSelfLoopPositions: allMappedBufs.selfLoopPositions,
      totalMappedNodes: allMappedBufs.nodeIndices.length,
      totalMappedEdges: allMappedBufs.edgeIndices.length,

      // Explicit Ontology Class Breakdown
      classBreakdown,
      mappingBasis: {
        moduleIds: baseMapping.moduleIds,
        assignedFeatureIds: baseMapping.assignedFeatures,
        curatedPathNodeCount: curatedBufs.nodeIndices.length,
        curatedPathEdgeCount: curatedBufs.edgeIndices.length,
      },
    },
    [
      curatedBufs.nodeIndices.buffer,
      curatedBufs.nodePositions.buffer,
      curatedBufs.edgeIndices.buffer,
      curatedBufs.edgePositions.buffer,
      curatedBufs.selfLoopPositions.buffer,
      allMappedBufs.nodeIndices.buffer,
      allMappedBufs.nodePositions.buffer,
      allMappedBufs.edgeIndices.buffer,
      allMappedBufs.edgePositions.buffer,
      allMappedBufs.selfLoopPositions.buffer,
    ]
  );
}

function postFullCoverageStats(req) {
  ensureComponentCoverageCache();
  const N = nodes.length;
  const E = edges.length;
  let catalogNodeCount = 0;
  const clsCounts = new Map();
  for (let i = 0; i < N; i++) {
    if (nodes[i].isCatalog) catalogNodeCount++;
    const c = nodes[i].class_id;
    clsCounts.set(c, (clsCounts.get(c) || 0) + 1);
  }
  let resolvedEdges = 0;
  for (let e = 0; e < E; e++) {
    if (edges[e]._s >= 0 && edges[e]._o >= 0) resolvedEdges++;
  }

  const classDistribution = Array.from(clsCounts.entries())
    .map(([cls, count]) => {
      const meta = getOntologyClassMeta(cls);
      return {
        class_id: cls,
        label: meta.label,
        description: meta.definition,
        contributionRole: meta.contributionRole,
        color: meta.color,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const defaultBatchSize = 500;
  const nodeBatchesAt500 = Math.ceil(N / defaultBatchSize);
  const edgeBatchesAt500 = Math.ceil(E / defaultBatchSize);

  self.postMessage({
    type: 'fullCoverageStats',
    requestId: req.requestId,
    snapshotHash: manifest?.snapshot_hash || null,
    totalNodes: N,
    totalEdges: E,
    catalogNodeCount,
    graphNodeCount: N - catalogNodeCount,
    selfLoopEdgeCount,
    parallelEdgeGroupCount,
    allNodesIndexedAndReachable: idToIdx.size === N,
    allEdgesResolved: resolvedEdges === E && edgeIdToIdx.size === E,
    unionMappedNodeCount: crossCuttingCache.unionNodeCount,
    unionMappedEdgeCount: crossCuttingCache.unionEdgeCount,
    crossCuttingNodeCount: crossCuttingCache.nodeIndices.length,
    crossCuttingEdgeCount: crossCuttingCache.edgeIndices.length,
    totalAccountedNodes: crossCuttingCache.unionNodeCount + crossCuttingCache.nodeIndices.length,
    totalAccountedEdges: crossCuttingCache.unionEdgeCount + crossCuttingCache.edgeIndices.length,
    classDistribution,
    defaultBatchSize,
    nodeBatchesAt500,
    edgeBatchesAt500,
    totalBatchesAt500: nodeBatchesAt500 + edgeBatchesAt500,
  });
}

function postComponentCoverageSummary(req) {
  ensureComponentCoverageCache();
  const N = nodes.length;
  const E = edges.length;

  // Optional curated counts provided by UI from architecture-evidence.json
  const curatedById = new Map();
  for (const c of (req.components || [])) {
    curatedById.set(c.id, c);
  }

  const components = COMPONENT_SPECS.map((spec) => {
    const mapped = componentMappingCache.get(spec.id);
    const cur = curatedById.get(spec.id);
    return {
      id: spec.id,
      label: spec.label,
      moduleIds: mapped.moduleIds,
      featureCount: mapped.assignedFeatures.length,
      mappedNodeCount: mapped.nodeIndices.length,
      mappedEdgeCount: mapped.edgeIndices.length,
      curatedNodeCount: cur && Array.isArray(cur.node_ids) ? cur.node_ids.length : null,
      curatedEdgeCount: cur && Array.isArray(cur.edge_ids) ? cur.edge_ids.length : null,
    };
  });

  const crossBreakdown = buildClassBreakdown(crossCuttingCache.nodeIndices, null).map((b) => ({
    class_id: b.class_id,
    label: b.label,
    description: b.description,
    color: b.color,
    count: b.count,
  }));

  self.postMessage({
    type: 'componentCoverageSummary',
    requestId: req.requestId,
    totalNodes: N,
    totalEdges: E,
    components,
    crossCuttingPartition: {
      id: 'cross_cutting',
      label: 'Cross-Cutting Ontology, Lineage & Relation Context',
      description: 'Schema definitions (ClassDefinition, RelationDefinition), global world/profile/capability vocabularies, study lineages, and relation-only assertions spanning the entire KG outside individual component feature mappings.',
      nodeCount: crossCuttingCache.nodeIndices.length,
      edgeCount: crossCuttingCache.edgeIndices.length,
      classBreakdown: crossBreakdown,
    },
    unionCoveredNodes: crossCuttingCache.unionNodeCount + crossCuttingCache.nodeIndices.length,
    unionCoveredEdges: crossCuttingCache.unionEdgeCount + crossCuttingCache.edgeIndices.length,
  });
}

function postAllCoverageGeometry(req) {
  ensureComponentCoverageCache();
  const scope = req.scope || 'all';
  const includeEdges = req.includeEdges !== false;
  const N = nodes.length;
  const E = edges.length;

  let nodeList;
  let edgeList;

  if (scope === 'cross_cutting') {
    nodeList = crossCuttingCache.nodeIndices;
    edgeList = includeEdges ? crossCuttingCache.edgeIndices : new Int32Array(0);
  } else if (scope === 'unvisited') {
    const batchSize = Math.max(1, Math.min(2000, Number(req.batchSize) || 500));
    const visNodeBatches = new Set(req.visitedNodeBatches || []);
    const visEdgeBatches = new Set(req.visitedEdgeBatches || []);

    const unvisNodes = [];
    for (let pos = 0; pos < N; pos++) {
      const bIdx = Math.floor(pos / batchSize);
      if (!visNodeBatches.has(bIdx)) unvisNodes.push(sortedNodeIndices[pos]);
    }
    const unvisEdges = [];
    if (includeEdges) {
      for (let pos = 0; pos < E; pos++) {
        const bIdx = Math.floor(pos / batchSize);
        if (!visEdgeBatches.has(bIdx)) unvisEdges.push(sortedEdgeIndices[pos]);
      }
    }
    nodeList = Int32Array.from(unvisNodes);
    edgeList = Int32Array.from(unvisEdges);
  } else {
    // scope === 'all': EVERY single node 0..N-1 and edge 0..E-1
    nodeList = sortedNodeIndices;
    edgeList = includeEdges ? sortedEdgeIndices : new Int32Array(0);
  }

  const bufs = buildOverlayBuffers(nodeList, edgeList);
  self.postMessage(
    {
      type: 'allCoverageGeometry',
      requestId: req.requestId,
      scope,
      nodeCount: bufs.nodeIndices.length,
      edgeCount: bufs.edgeIndices.length,
      selfLoopCount: Math.floor(bufs.selfLoopPositions.length / 3),
      ...bufs,
    },
    [
      bufs.nodeIndices.buffer,
      bufs.nodePositions.buffer,
      bufs.edgeIndices.buffer,
      bufs.edgePositions.buffer,
      bufs.selfLoopPositions.buffer,
    ]
  );
}

function postOntologyClasses(req) {
  const out = {};
  for (const key of Object.keys(ONTOLOGY_CLASS_META)) {
    out[key] = getOntologyClassMeta(key);
  }
  self.postMessage({
    type: 'ontologyClasses',
    requestId: req.requestId,
    classes: out,
  });
}

function postOverlayGeometry(req) {
  const nodeList = [];
  const edgeList = [];
  if (typeof req.nodeIdx === 'number' && req.nodeIdx >= 0 && req.nodeIdx < nodes.length) {
    nodeList.push(req.nodeIdx);
  }
  if (typeof req.edgeIdx === 'number' && req.edgeIdx >= 0 && req.edgeIdx < edges.length) {
    edgeList.push(req.edgeIdx);
    const ed = edges[req.edgeIdx];
    if (ed._s >= 0) nodeList.push(ed._s);
    if (ed._o >= 0) nodeList.push(ed._o);
  }
  const bufs = buildOverlayBuffers(Array.from(new Set(nodeList)), edgeList);
  self.postMessage(
    {
      type: 'overlayGeometry',
      requestId: req.requestId,
      kind: req.kind || 'selection',
      ...bufs,
    },
    [
      bufs.nodeIndices.buffer,
      bufs.nodePositions.buffer,
      bufs.edgeIndices.buffer,
      bufs.edgePositions.buffer,
      bufs.selfLoopPositions.buffer,
    ]
  );
}

function findBridgePathToComponent(startIdx, mappedNodeSet, primaryAnchors, moduleAnchors) {
  if (startIdx < 0 || startIdx >= nodes.length || !mappedNodeSet.has(startIdx)) {
    return null;
  }

  // If the clicked node is already a module anchor, return single-node path
  if (moduleAnchors.has(startIdx)) {
    return { nodeIndices: [startIdx], edgeSteps: [] };
  }

  // BFS inside the component's mapped subgraph to the nearest anchor (Feature/Gate/Readiness/Module)
  const targetSet = primaryAnchors.size > 0 ? primaryAnchors : moduleAnchors;
  const visited = new Set([startIdx]);
  const prevNode = new Map();
  const prevEdge = new Map();
  const queue = [startIdx];
  let hit = -1;

  if (targetSet.has(startIdx)) {
    hit = startIdx;
  } else {
    let head = 0;
    while (head < queue.length && hit === -1) {
      const u = queue[head++];
      // Prefer outgoing provenance/feature edges first, then incoming edges
      for (const e of outAdj[u]) {
        const v = edges[e]._o;
        if (v < 0 || !mappedNodeSet.has(v) || visited.has(v)) continue;
        visited.add(v);
        prevNode.set(v, u);
        prevEdge.set(v, { edgeIdx: e, direction: 'forward' });
        if (targetSet.has(v) || moduleAnchors.has(v)) {
          hit = v;
          break;
        }
        queue.push(v);
      }
      if (hit !== -1) break;
      for (const e of inAdj[u]) {
        const v = edges[e]._s;
        if (v < 0 || !mappedNodeSet.has(v) || visited.has(v)) continue;
        visited.add(v);
        prevNode.set(v, u);
        prevEdge.set(v, { edgeIdx: e, direction: 'reverse' });
        if (targetSet.has(v) || moduleAnchors.has(v)) {
          hit = v;
          break;
        }
        queue.push(v);
      }
    }
  }

  if (hit === -1) return null;

  const nodeIndices = [];
  const edgeSteps = [];
  let cur = hit;
  while (cur !== undefined) {
    nodeIndices.push(cur);
    const pe = prevEdge.get(cur);
    if (pe) edgeSteps.push(pe);
    cur = prevNode.get(cur);
  }
  nodeIndices.reverse();
  edgeSteps.reverse();

  // If we stopped at a FeatureDefinition/Gate and a BlueprintModule anchor is 1 hop away, extend to the module!
  const lastNode = nodeIndices[nodeIndices.length - 1];
  if (!moduleAnchors.has(lastNode) && moduleAnchors.size > 0) {
    for (const e of outAdj[lastNode]) {
      const v = edges[e]._o;
      if (moduleAnchors.has(v)) {
        nodeIndices.push(v);
        edgeSteps.push({ edgeIdx: e, direction: 'forward' });
        break;
      }
    }
  }

  return { nodeIndices, edgeSteps };
}

function findBridgePathAcrossGraph(startIdx, primaryAnchors, moduleAnchors, maxVisit = 4500) {
  if (startIdx < 0 || startIdx >= nodes.length) return null;
  if (moduleAnchors.has(startIdx)) {
    return { nodeIndices: [startIdx], edgeSteps: [] };
  }
  const targetSet = primaryAnchors.size > 0 ? primaryAnchors : moduleAnchors;
  if (targetSet.has(startIdx)) {
    return { nodeIndices: [startIdx], edgeSteps: [] };
  }

  const visited = new Set([startIdx]);
  const prevNode = new Map();
  const prevEdge = new Map();
  const queue = [startIdx];
  let hit = -1;
  let head = 0;

  while (head < queue.length && visited.size < maxVisit && hit === -1) {
    const u = queue[head++];
    for (const e of outAdj[u]) {
      const v = edges[e]._o;
      if (v < 0 || visited.has(v)) continue;
      visited.add(v);
      prevNode.set(v, u);
      prevEdge.set(v, { edgeIdx: e, direction: 'forward' });
      if (targetSet.has(v) || moduleAnchors.has(v)) {
        hit = v;
        break;
      }
      queue.push(v);
    }
    if (hit !== -1) break;
    for (const e of inAdj[u]) {
      const v = edges[e]._s;
      if (v < 0 || visited.has(v)) continue;
      visited.add(v);
      prevNode.set(v, u);
      prevEdge.set(v, { edgeIdx: e, direction: 'reverse' });
      if (targetSet.has(v) || moduleAnchors.has(v)) {
        hit = v;
        break;
      }
      queue.push(v);
    }
  }

  if (hit === -1) return null;

  const nodeIndices = [];
  const edgeSteps = [];
  let cur = hit;
  while (cur !== undefined) {
    nodeIndices.push(cur);
    const pe = prevEdge.get(cur);
    if (pe) edgeSteps.push(pe);
    cur = prevNode.get(cur);
  }
  nodeIndices.reverse();
  edgeSteps.reverse();
  return { nodeIndices, edgeSteps };
}

function buildContributionNarrative(entityKind, nodeIdx, edgeIdx, componentLabel, steps, links, curatedMatches, inComponent, extra = {}) {
  if (!inComponent) {
    if (entityKind === 'edge' && edgeIdx >= 0) {
      const ed = edges[edgeIdx];
      const rel = ONTOLOGY_RELATION_META[ed.predicate_id];
      const relDesc = rel
        ? `${ed.predicate_id} (${rel.domain} → ${rel.range}): ${rel.assertWhen}`
        : (ed._isKg ? `kg: provenance/ontology link (${ed.predicate_id}) connecting ${ed.subject_id} → ${ed.object_id}.` : `Scientific relation ${ed.predicate_id} connecting ${ed.subject_id} → ${ed.object_id}.`);
      if (extra.bridgeToOtherComponent) {
        return `${relDesc} This connection informs ${extra.bridgeToOtherComponent.label} rather than ${componentLabel} directly.`;
      }
      return `${relDesc} Cross-cutting ontology connection outside ${componentLabel}'s direct feature set.`;
    }

    const n = nodes[nodeIdx];
    const cls = n.class_id;
    const meta = getOntologyClassMeta(cls);
    if (extra.connectedToActive && links.length > 0) {
      const via = steps.length > 2 ? ` via ${steps[1].class_id} (${steps[1].label || steps[1].id})` : '';
      return `Not directly assigned to ${componentLabel}'s feature set, but connects to ${componentLabel} in ${links.length} step${links.length === 1 ? '' : 's'}${via}. ${meta.definition} ${meta.contributionRole}`;
    }
    if (extra.bridgeToOtherComponent) {
      return `This ${cls} (${meta.label}) informs ${extra.bridgeToOtherComponent.label} rather than ${componentLabel} directly. ${meta.definition} ${meta.contributionRole}`;
    }
    return `Cross-cutting ${cls} (${meta.label}): ${meta.definition} ${meta.contributionRole}`;
  }

  if (curatedMatches.length > 0) {
    const first = curatedMatches[0];
    const roleText = first.role === 'supports_design' ? 'supports the design of' : 'documents an empirical gap for';
    return `Directly part of ${curatedMatches.length} curated derivation path${curatedMatches.length === 1 ? '' : 's'} that ${roleText} ${componentLabel}: ${first.contribution || first.rationale || ''}`;
  }

  if (entityKind === 'edge' && edgeIdx >= 0) {
    const ed = edges[edgeIdx];
    const subjCls = ed._s >= 0 ? nodes[ed._s].class_id : 'Entity';
    const objCls = ed._o >= 0 ? nodes[ed._o].class_id : 'Entity';
    const kindDesc = ed._isKg ? 'provenance/ontology link' : 'scientific ontology relation';
    const hopText = links.length > 1 ? ` and reaches ${componentLabel} in ${links.length} steps` : ` directly anchoring ${componentLabel}`;
    return `This ${kindDesc} (${ed.predicate_id}) connects ${subjCls} → ${objCls}${hopText}.`;
  }

  const n = nodes[nodeIdx];
  const cls = n.class_id;
  const meta = getOntologyClassMeta(cls);
  const featStep = steps.find((s) => s.class_id === 'FeatureDefinition');
  const assertStep = steps.find((s) => s.class_id === 'Assertion');
  const modStep = steps.find((s) => s.class_id === 'BlueprintModule');

  if (cls === 'BlueprintModule') {
    return `${n.id} is the ontology BlueprintModule anchor for ${componentLabel}. All assigned features, assertions, evidence fragments, and paper evaluations for this module converge here.`;
  }
  if (cls === 'FeatureDefinition') {
    return `FeatureDefinition "${n.label || n.id}" is a core ontology feature assigned to ${componentLabel}${modStep ? ` (${modStep.id})` : ''}, aggregating paper-level assertions and evidence fragments for this requirement.`;
  }
  if (cls === 'Assertion') {
    const st = n.properties?.assessment_state || 'recorded';
    const stage = n.properties?.evidence_stage ? `, ${n.properties.evidence_stage}` : '';
    const target = featStep ? `feature "${featStep.label}"` : (n.properties?.feature_id || componentLabel);
    return `This Assertion records a ${st}${stage} assessment for ${target}, bringing structured evidence from Paper ${nodePaperId[nodeIdx] || 'record'} into ${componentLabel}.`;
  }
  if (cls === 'EvidenceFragment') {
    const page = n.properties?.locator?.page ? `, p. ${n.properties.locator.page}` : '';
    const via = assertStep ? ` grounds assertion ${assertStep.id}` : '';
    const feat = featStep ? ` on feature "${featStep.label}"` : '';
    return `This EvidenceFragment (Paper ${nodePaperId[nodeIdx] || '?'}${page})${via}${feat}, supplying verbatim/visual source grounding for ${componentLabel}.`;
  }
  if (featStep) {
    return `This ${cls} (${meta.label}) connects in ${links.length} step${links.length === 1 ? '' : 's'} through feature "${featStep.label}" to inform ${componentLabel}. ${meta.contributionRole}`;
  }
  return `This ${cls} (${meta.label}) connects in ${links.length} step${links.length === 1 ? '' : 's'} to ${componentLabel}. ${meta.contributionRole}`;
}

function postEntityComponentExplanation(req) {
  ensureComponentCoverageCache();
  const compId = req.componentId;
  const compLabel = req.componentLabel || compId;
  const spec = COMPONENT_SPEC_BY_ID.get(compId) || null;
  let mapped = componentMappingCache.get(compId);
  if (!mapped) {
    mapped = computeSingleComponentMapping(spec, req.moduleIds || [], req.featureIds || []);
  }

  const mappedNodeSet = new Set(mapped.nodeIndices);
  const mappedEdgeSet = new Set(mapped.edgeIndices);

  // Also include curated path nodes/edges in the component membership set
  const curatedPaths = Array.isArray(req.curatedPaths) ? req.curatedPaths : [];
  for (const cp of curatedPaths) {
    for (const nid of (cp.node_ids || [])) {
      const idx = idToIdx.get(nid);
      if (idx !== undefined) mappedNodeSet.add(idx);
    }
    for (const ed of (cp.edges || [])) {
      const eid = typeof ed === 'string' ? ed : ed.id;
      const eIdx = edgeIdToIdx.get(eid);
      if (eIdx !== undefined) mappedEdgeSet.add(eIdx);
    }
  }

  const moduleAnchors = new Set();
  for (const mId of (mapped.moduleIds || req.moduleIds || [])) {
    const idx = idToIdx.get(mId);
    if (idx !== undefined) moduleAnchors.add(idx);
  }
  const primaryAnchors = new Set(moduleAnchors);
  for (const fid of (mapped.assignedFeatures || req.featureIds || [])) {
    const idx = idToIdx.get(fid);
    if (idx !== undefined) primaryAnchors.add(idx);
  }
  for (const gid of (spec?.gateIds || [])) {
    const idx = idToIdx.get(gid);
    if (idx !== undefined) primaryAnchors.add(idx);
  }
  for (const rid of (spec?.readinessIds || [])) {
    const idx = idToIdx.get(rid);
    if (idx !== undefined) primaryAnchors.add(idx);
  }

  const isEdge = typeof req.edgeIdx === 'number' && req.edgeIdx >= 0 && req.edgeIdx < edges.length;
  const nodeIdx = !isEdge && typeof req.nodeIdx === 'number' && req.nodeIdx >= 0 && req.nodeIdx < nodes.length ? req.nodeIdx : -1;
  const edgeIdx = isEdge ? req.edgeIdx : -1;

  if (!isEdge && nodeIdx < 0) {
    self.postMessage({ type: 'entityComponentExplanation', requestId: req.requestId, explanation: null });
    return;
  }

  const entityId = isEdge ? edges[edgeIdx].id : nodes[nodeIdx].id;
  const inComponent = isEdge ? mappedEdgeSet.has(edgeIdx) : mappedNodeSet.has(nodeIdx);

  // Find curated evidence paths containing this node or edge
  const curatedMatches = [];
  for (const cp of curatedPaths) {
    const matched = isEdge
      ? (cp.edges || []).some((e) => (typeof e === 'string' ? e : e.id) === entityId)
      : (cp.node_ids || []).includes(entityId);
    if (matched) {
      curatedMatches.push({
        id: cp.id,
        role: cp.role,
        feature_id: cp.feature_id,
        contribution: cp.contribution,
        rationale: cp.rationale,
        paper_id: cp.paper_id,
        page: cp.page,
        assessment_state: cp.assessment_state,
        evidence_stage: cp.evidence_stage,
      });
    }
  }

  // Find all other architecture components that this entity also contributes to
  const otherComponents = [];
  for (const s of COMPONENT_SPECS) {
    if (s.id === compId) continue;
    const cm = componentMappingCache.get(s.id);
    if (!cm) continue;
    const arr = isEdge ? cm.edgeIndices : cm.nodeIndices;
    const target = isEdge ? edgeIdx : nodeIdx;
    // Binary search on sorted Int32Array
    let lo = 0;
    let hi = arr.length - 1;
    let found = false;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] === target) { found = true; break; }
      if (arr[mid] < target) lo = mid + 1;
      else hi = mid - 1;
    }
    if (found) {
      otherComponents.push({ id: s.id, label: s.label, moduleIds: s.moduleIds });
    }
  }

  let bridge = null;
  let connectedToActive = false;
  let bridgeToOtherComponent = null;

  if (inComponent) {
    if (isEdge) {
      const ed = edges[edgeIdx];
      const pS = findBridgePathToComponent(ed._s, mappedNodeSet, primaryAnchors, moduleAnchors);
      const pO = findBridgePathToComponent(ed._o, mappedNodeSet, primaryAnchors, moduleAnchors);
      if (pS && (!pO || pS.nodeIndices.length <= pO.nodeIndices.length)) {
        if (pS.nodeIndices[0] === ed._s && pS.nodeIndices[1] !== ed._o) {
          bridge = {
            nodeIndices: [ed._o, ...pS.nodeIndices],
            edgeSteps: [{ edgeIdx, direction: 'reverse' }, ...pS.edgeSteps],
          };
        } else {
          bridge = pS;
        }
      } else if (pO) {
        if (pO.nodeIndices[0] === ed._o && pO.nodeIndices[1] !== ed._s) {
          bridge = {
            nodeIndices: [ed._s, ...pO.nodeIndices],
            edgeSteps: [{ edgeIdx, direction: 'forward' }, ...pO.edgeSteps],
          };
        } else {
          bridge = pO;
        }
      } else {
        bridge = { nodeIndices: [ed._s, ed._o].filter((x) => x >= 0), edgeSteps: [{ edgeIdx, direction: 'forward' }] };
      }
    } else {
      bridge = findBridgePathToComponent(nodeIdx, mappedNodeSet, primaryAnchors, moduleAnchors);
    }
  } else {
    // Fallback 1: If this entity informs another architecture component, trace its provenance chain there
    if (otherComponents.length > 0) {
      const otherSpec = COMPONENT_SPEC_BY_ID.get(otherComponents[0].id);
      const otherMapped = componentMappingCache.get(otherComponents[0].id);
      if (otherSpec && otherMapped) {
        const oModAnchors = new Set((otherSpec.moduleIds || []).map((m) => idToIdx.get(m)).filter((x) => x !== undefined));
        const oPriAnchors = new Set(oModAnchors);
        for (const f of (otherMapped.assignedFeatures || [])) {
          const fIdx = idToIdx.get(f);
          if (fIdx !== undefined) oPriAnchors.add(fIdx);
        }
        const oNodeSet = new Set(otherMapped.nodeIndices);
        if (!isEdge) {
          bridge = findBridgePathToComponent(nodeIdx, oNodeSet, oPriAnchors, oModAnchors);
        } else {
          const ed = edges[edgeIdx];
          bridge = findBridgePathToComponent(ed._s, oNodeSet, oPriAnchors, oModAnchors)
            || findBridgePathToComponent(ed._o, oNodeSet, oPriAnchors, oModAnchors);
        }
        if (bridge) bridgeToOtherComponent = otherComponents[0];
      }
    }
    // Fallback 2: Try a bounded full-KG bridge to the active component
    if (!bridge && !isEdge) {
      bridge = findBridgePathAcrossGraph(nodeIdx, primaryAnchors, moduleAnchors, 3500);
      if (bridge) connectedToActive = true;
    }
    // Fallback 3: Show immediate ontology connections for cross-cutting schema/vocabulary nodes
    if (!bridge) {
      if (isEdge) {
        const ed = edges[edgeIdx];
        bridge = { nodeIndices: [ed._s, ed._o].filter((x) => x >= 0), edgeSteps: [{ edgeIdx, direction: 'forward' }] };
      } else {
        const firstOut = outAdj[nodeIdx][0];
        const firstIn = inAdj[nodeIdx][0];
        if (firstOut !== undefined && edges[firstOut]._o >= 0) {
          bridge = { nodeIndices: [nodeIdx, edges[firstOut]._o], edgeSteps: [{ edgeIdx: firstOut, direction: 'forward' }] };
        } else if (firstIn !== undefined && edges[firstIn]._s >= 0) {
          bridge = { nodeIndices: [nodeIdx, edges[firstIn]._s], edgeSteps: [{ edgeIdx: firstIn, direction: 'reverse' }] };
        }
      }
    }
  }

  const steps = (bridge?.nodeIndices || []).map((idx) => {
    const n = nodes[idx];
    const meta = getOntologyClassMeta(n.class_id);
    return {
      idx,
      id: n.id,
      class_id: n.class_id,
      classLabel: meta.label,
      label: displayLabel[idx],
      isAnchor: moduleAnchors.has(idx) || primaryAnchors.has(idx),
    };
  });

  const links = (bridge?.edgeSteps || []).map((st) => {
    const ed = edges[st.edgeIdx];
    return {
      edgeIdx: st.edgeIdx,
      id: ed.id,
      predicate_id: ed.predicate_id,
      direction: st.direction,
      isKg: ed._isKg,
    };
  });

  const summary = buildContributionNarrative(
    isEdge ? 'edge' : 'node',
    nodeIdx,
    edgeIdx,
    compLabel,
    steps,
    links,
    curatedMatches,
    inComponent,
    { connectedToActive, bridgeToOtherComponent }
  );

  const entityClass = isEdge ? null : nodes[nodeIdx].class_id;
  const ontologyMeta = entityClass ? getOntologyClassMeta(entityClass) : null;

  const bridgeNodeList = bridge ? Array.from(new Set(bridge.nodeIndices)) : (isEdge ? [edges[edgeIdx]._s, edges[edgeIdx]._o].filter((x) => x >= 0) : [nodeIdx]);
  const bridgeEdgeList = bridge ? bridge.edgeSteps.map((s) => s.edgeIdx) : (isEdge ? [edgeIdx] : []);
  const bufs = buildOverlayBuffers(bridgeNodeList, bridgeEdgeList);

  self.postMessage(
    {
      type: 'entityComponentExplanation',
      requestId: req.requestId,
      explanation: {
        componentId: compId,
        componentLabel: compLabel,
        entityKind: isEdge ? 'edge' : 'node',
        entityId,
        inComponent,
        connectedToActive,
        bridgeToOtherComponent,
        isCurated: curatedMatches.length > 0,
        summary,
        ontologyRole: ontologyMeta ? ontologyMeta.contributionRole : null,
        curatedMatches,
        steps,
        links,
        otherComponents,
      },
      bridgeNodePositions: bufs.nodePositions,
      bridgeEdgePositions: bufs.edgePositions,
      bridgeSelfLoopPositions: bufs.selfLoopPositions,
    },
    [bufs.nodePositions.buffer, bufs.edgePositions.buffer, bufs.selfLoopPositions.buffer]
  );
}
