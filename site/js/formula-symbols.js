/**
 * Locally bundled KaTeX math renderer helper + complete symbol-by-symbol glossary
 * and clinical/mathematical interpretation for all 19 formulation equations/invariants.
 */

export function normalizeLatexForKatex(latex) {
  if (!latex) return '';
  return String(latex)
    .trim()
    // Fix markdown-escaped asterisk inside superscript (e.g. h^\* -> h^*)
    .replace(/\^\s*\\\*/g, '^*')
    .replace(/\\\*/g, '*')
    // Normalize single-line breaks inside display equations cleanly
    .replace(/\r\n/g, '\n');
}

/**
 * Render LaTeX using locally bundled KaTeX (window.katex) into a DOM container.
 * Returns true if KaTeX rendered without error, false if caller should fall back.
 */
export function renderKatexInto(latex, container, displayMode = true) {
  const norm = normalizeLatexForKatex(latex);
  if (!norm) return true;
  if (typeof window !== 'undefined' && window.katex && typeof window.katex.render === 'function') {
    try {
      window.katex.render(norm, container, {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: false,
        output: 'htmlAndMathml',
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Complete symbol-by-symbol glossary & plain-language interpretation for all 19 formulas
 * in architecture-evidence.json (derived from Formulation-2-GPT.md).
 */
export const FORMULA_SYMBOL_GLOSSARY = {
  availability: {
    interpretation:
      'Defines the exact information set legally and temporally available at decision time t, preventing future-result leakage by gating every observation and executed action on its release timestamp.',
    symbols: [
      { latex: '\\mathcal{F}_t^{av}', name: 'Availability filtration at time t', meaning: 'The sigma-algebra (information set) of all patient observations and executed actions available to the model at decision cutoff t.' },
      { latex: '\\sigma(\\cdot)', name: 'Generated sigma-algebra', meaning: 'All measurable events/facts reconstructible from the enclosed records without peeking past cutoff t.' },
      { latex: 'o_j', name: 'Observation value', meaning: 'The j-th clinical measurement, note, waveform, or imaging record.' },
      { latex: 't_j^{acq}', name: 'Acquisition time', meaning: 'When the physiological measurement or specimen was actually collected from the patient.' },
      { latex: 'm_j', name: 'Metadata / modality / mask', meaning: 'Units, assay modality, missingness mask, and provenance tag accompanying observation o_j.' },
      { latex: 't_j^{av} \\le t', name: 'Information-availability cutoff', meaning: 'Release/reporting timestamp when observation o_j actually became visible in the EHR (must be at or before decision time t).' },
      { latex: 'a_k', name: 'Executed action', meaning: 'The k-th clinical intervention or device command actually administered.' },
      { latex: '\\tau_k^{start}', name: 'Action start time', meaning: 'Timestamp when action a_k began taking effect on the patient.' },
      { latex: 't_k^{av,exec}', name: 'Execution-record availability time', meaning: 'Timestamp when the execution of action a_k was recorded and became observable.' },
    ],
  },
  learning: {
    interpretation:
      'Joint multi-term training objective combining multi-step latent prediction, representation anti-collapse regularization, irregular-time observation-process likelihood, hybrid physical-residual regularization, and an optional observation decoder.',
    symbols: [
      { latex: '\\mathcal{L}(\\phi,\\theta,\\omega,\\psi)', name: 'Total training objective', meaning: 'Composite loss minimized over encoder (φ), dynamics (θ), observation intensity (ω), and optional decoder (ψ) parameters.' },
      { latex: '\\phi,\\theta,\\omega,\\psi', name: 'Learnable parameter groups', meaning: 'φ: encoder; θ: latent transition/predictor; ω: observation-process intensity model; ψ: optional decoder.' },
      { latex: 'w_k', name: 'Horizon offset weights', meaning: 'Non-negative weights balancing prediction accuracy across rollout steps k = 1…K.' },
      { latex: 'D(\\cdot,\\cdot)', name: 'Latent representation distance', meaning: 'Divergence or metric comparing encoded future observation against predicted latent state.' },
      { latex: '\\mathrm{Enc}_\\phi(o_{t_k})', name: 'Observation encoder', meaning: 'Maps multimodal clinical observation at future time t_k into latent representation space.' },
      { latex: '\\mathrm{Pred}_\\theta^{(k)}(z_t,\\bar{a}_{t:t_k},\\Delta_k)', name: 'k-step latent predictor', meaning: 'Rolls latent state z_t forward over elapsed interval Δ_k conditioned on action history ā_{t:t_k}.' },
      { latex: '\\beta_{reg},\\ \\mathrm{SIGReg}(\\{z\\})', name: 'Anti-collapse regularizer', meaning: 'Weighted covariance/isotropic regularization preventing trivial constant latent representations.' },
      { latex: '\\beta_{obs},\\ \\lambda_\\omega(t)', name: 'Observation-process intensity', meaning: 'Point-process intensity modeling informative clinical sampling times (e.g., sicker patients get more frequent labs).' },
      { latex: '\\beta_{mech},\\ \\|r_\\theta\\|^2', name: 'Hybrid residual penalty', meaning: 'Penalizes learned residual r_θ so dynamics stay anchored near mechanistic/physiological equations.' },
      { latex: '\\beta_{dec},\\ \\mathcal{L}_{dec}(E_\\psi)', name: 'Optional decoder loss', meaning: 'Auxiliary reconstruction loss when an explicit observation decoder E_ψ is attached.' },
    ],
  },
  belief: {
    interpretation:
      'Recursive Bayesian/neural filtering step updating the patient belief state from t to t′ using only records newly released in (t, t′], handling asynchronous and late-arriving hospital data.',
    symbols: [
      { latex: 'b_{t\'}', name: 'Updated belief state', meaning: 'Posterior distribution (or sufficient latent representation) over the patient’s current physiological state at time t′.' },
      { latex: 'b_t', name: 'Prior belief state', meaning: 'Belief state summarized up to the previous decision/update cutoff t.' },
      { latex: '\\mathrm{Filt}_{t\\to t\'}', name: 'State filtering operator', meaning: 'Assimilates new clinical evidence and propagates uncertainty forward across interval t → t′.' },
      { latex: '\\mathcal{R}_{(t,t\']}', name: 'Newly released record set', meaning: 'All observations and execution records whose availability timestamps fall in (t, t′], including delayed lab results.' },
      { latex: '\\theta', name: 'Filter/world-model parameters', meaning: 'Parameterized dynamics and observation-likelihood weights governing state assimilation.' },
    ],
  },
  support: {
    interpretation:
      'Temporal safety invariant: the system may roll out a candidate intervention only when that action has verified data/operational support in the patient’s population, clinical scope, and history.',
    symbols: [
      { latex: 'G(\\cdot)', name: 'Linear Temporal Logic “Always”', meaning: 'Invariant operator requiring the enclosed implication to hold at every execution step.' },
      { latex: '\\mathit{eligible\\_action\\_rollout}', name: 'Eligible action rollout event', meaning: 'Flag indicating the world model is permitted to simulate a proposed candidate action.' },
      { latex: '\\Rightarrow', name: 'Logical implication', meaning: 'Whenever the left-hand event occurs, the right-hand condition must simultaneously hold.' },
      { latex: '\\mathit{scope\\_matched\\_support}', name: 'Scope-matched support check', meaning: 'Operational verification that the candidate action lies within supported dosage/command bounds for this population and history (distinct from causal identification).' },
    ],
  },
  transition: {
    interpretation:
      'Hybrid next-state update combining a mechanistic physiological model, a learned neural residual, and calibrated stochastic noise, then projecting the complete draw onto physically valid clinical bounds.',
    symbols: [
      { latex: 'z_{k+1}', name: 'Next state', meaning: 'Patient state at rollout step k+1 after applying action a_k over interval Δ.' },
      { latex: '\\Pi_{\\mathcal{C}_{\\mathrm{phys}}}(\\cdot)', name: 'Physical-constraint projection', meaning: 'Projects the combined stochastic draw onto the physiologically admissible constraint set C_phys (e.g., non-negative concentrations).' },
      { latex: 'f_{\\mathrm{mech}}(z_k,a_k,\\Delta;\\varphi)', name: 'Mechanistic dynamics', meaning: 'Physics, ODE, or PK/PD transition component governed by physiological parameters φ.' },
      { latex: 'r_\\theta(z_k,a_k,\\Delta)', name: 'Learned neural residual', meaning: 'Data-driven correction capturing unmodeled dynamics beyond f_mech.' },
      { latex: '\\sigma_\\theta(z_k,a_k,\\Delta)', name: 'State-dependent noise scale', meaning: 'Learned aleatoric uncertainty scale modulating transition variability.' },
      { latex: '\\xi_k \\sim \\mathcal{N}(0,I)', name: 'Standard Gaussian innovation', meaning: 'Independent standard-normal stochastic draw enabling sampled future trajectories.' },
      { latex: '\\Delta', name: 'Elapsed time step', meaning: 'Continuous time interval between state k and state k+1.' },
    ],
  },
  bound: {
    interpretation:
      'Upper bound on multi-step rollout compounding error: initial state estimation error e₀ and per-step transition errors ε_j can grow multiplicatively with the model’s Lipschitz constants L_k over horizon h.',
    symbols: [
      { latex: 'e_k,\\ e_{k+1}', name: 'State discrepancy at step k', meaning: 'Distance between simulated rollout state and true physiological state at step k.' },
      { latex: 'e_0', name: 'Initial state estimation error', meaning: 'Error in reconstructing the starting patient state before rollout begins.' },
      { latex: 'e_h', name: 'Cumulative error at horizon h', meaning: 'Total trajectory discrepancy after h free-running rollout steps.' },
      { latex: 'L_k', name: 'Local Lipschitz constant', meaning: 'Sensitivity factor bounding how much step-k dynamics can amplify an existing state error (>1 causes exponential growth).' },
      { latex: '\\epsilon_k,\\ \\epsilon_j', name: 'One-step model discrepancy', meaning: 'Uniform per-step approximation error of the transition model at step k or j.' },
      { latex: '\\prod_{k=0}^{h-1} L_k', name: 'Cumulative amplification product', meaning: 'Product of Lipschitz sensitivities across all h steps.' },
      { latex: '\\sum_{j=0}^{h-1}', name: 'Accumulated step-error sum', meaning: 'Sums every step’s local discrepancy ε_j amplified by all remaining steps j+1…h−1.' },
    ],
  },
  horizon: {
    interpretation:
      'Governance invariant preventing extrapolation beyond tested horizons: substantive forecasts may be published only for horizons h empirically evaluated for the same query, release, endpoint, and population.',
    symbols: [
      { latex: 'G(\\cdot)', name: 'Always invariant', meaning: 'Must hold across all forecast publications.' },
      { latex: '\\mathit{publish\\_forecast}', name: 'Forecast publication event', meaning: 'Emitting a substantive predictive forecast to the clinician or downstream planner.' },
      { latex: 'h', name: 'Requested forecast horizon', meaning: 'How far into the future the query asks the model to predict.' },
      { latex: '\\mathcal{H}_{\\mathrm{eval}}(q)', name: 'Evaluated horizon set', meaning: 'Set of forecast horizons empirically validated for query class q (matching release, endpoint, mode, and cohort).' },
      { latex: '\\in', name: 'Set membership', meaning: 'Requires requested horizon h to lie strictly inside the validated set.' },
    ],
  },
  effect: {
    interpretation:
      'Sequential g-computation formula expressing the expected clinical outcome under a dynamic treatment regime g by integrating conditional outcome means over sequential covariate transition kernels.',
    symbols: [
      { latex: '\\psi_{h_0}(g)', name: 'Target causal/regime functional', meaning: 'Expected potential outcome under treatment strategy g given baseline patient history h₀.' },
      { latex: '\\mathbb{E}[Y^g \\mid H_0 = h_0]', name: 'Conditional counterfactual expectation', meaning: 'Expected clinical endpoint Y if the patient followed treatment regime g from baseline history h₀.' },
      { latex: 'g = (g_0,\\dots,g_{K-1})', name: 'Dynamic treatment regime', meaning: 'Decision rule assigning action a_k = g_k(h_k) based on evolving clinical history h_k.' },
      { latex: 'm_K(h_K)', name: 'Terminal conditional outcome mean', meaning: 'Expected outcome given complete history h_K at the end of horizon K.' },
      { latex: 'p(dl_{k+1} \\mid h_k, a_k)', name: 'Covariate transition kernel', meaning: 'Conditional distribution of next clinical covariates l_{k+1} given history h_k and action a_k.' },
      { latex: '\\int \\cdots \\prod_{k=0}^{K-1}', name: 'Sequential path integral', meaning: 'Integrates over all intermediate clinical covariate trajectories from k=0 to K−1 under regime g.' },
    ],
  },
  'effect-gate': {
    interpretation:
      'Epistemic gate forbidding causal-effect language unless a scope-matched causal identification certificate exists for that exact estimand, intervention, and patient population.',
    symbols: [
      { latex: 'G(\\cdot)', name: 'Always invariant', meaning: 'Holds globally whenever causal-effect claims are presented.' },
      { latex: '\\mathit{publish\\_effect}', name: 'Causal effect publication', meaning: 'Presenting an output labeled as an interventional or counterfactual causal treatment effect.' },
      { latex: '\\mathit{scope\\_matched\\_id\\_certificate}', name: 'Identification certificate', meaning: 'Auditable documentation that consistency, exchangeability, positivity, and time-varying confounding assumptions are justified for this exact estimand and population.' },
    ],
  },
  objective: {
    interpretation:
      'Risk- and uncertainty-aware planning objective: selects candidate treatment regimes minimizing expected clinical cost plus an epistemic uncertainty penalty to deter overconfident out-of-support plans.',
    symbols: [
      { latex: 'J(g; b_t)', name: 'Planning objective score', meaning: 'Total penalized expected cost of candidate treatment regime g under current belief b_t (lower is preferred).' },
      { latex: '\\mathbb{E}_{P_\\theta, b_t, g}[C(\\tau, g)]', name: 'Expected trajectory cost', meaning: 'Expected clinical/operational cost C over simulated trajectories τ generated by model P_θ from belief b_t under regime g.' },
      { latex: 'C(\\tau, g)', name: 'Trajectory cost function', meaning: 'Clinical harm, adverse-event risk, resource burden, or negative utility of trajectory τ and regime g.' },
      { latex: '\\beta_{ep}', name: 'Epistemic uncertainty weight', meaning: 'Penalty coefficient controlling how conservatively the planner avoids high-uncertainty regions.' },
      { latex: 'U^{ep}(b_t, g)', name: 'Epistemic uncertainty score', meaning: 'Model uncertainty (disagreement/lack of knowledge) for regime g starting from belief b_t.' },
    ],
  },
  guard: {
    interpretation:
      'Three-way clinical safety gate evaluating every proposed regime: allows presentation only when all hard constraints, uncertainty bounds, OOD checks, and horizon limits pass; otherwise requests planner revision or abstains/escalates.',
    symbols: [
      { latex: '\\mathrm{Guard}(\\tilde{g}, \\mathcal{H}_t)', name: 'Safety guard decision function', meaning: 'Maps proposed regime g̃ and patient history H_t to allow-to-present, revise, or abstain/escalate.' },
      { latex: '\\tilde{g}', name: 'Proposed candidate regime', meaning: 'Treatment/control plan submitted by the Planner / Policy for safety verification.' },
      { latex: '\\forall j: G_j \\le 0', name: 'Hard safety constraints satisfied', meaning: 'Every clinical guard rule and contraindication G_j must remain non-positive (unviolated).' },
      { latex: 'U^{ep} \\le u_{max}', name: 'Epistemic uncertainty bound', meaning: 'Model epistemic uncertainty must stay below the maximum permitted threshold u_max.' },
      { latex: '\\mathrm{OOD} = 0', name: 'In-distribution check', meaning: 'Out-of-distribution detector must confirm the patient/action lies inside the validated distribution.' },
      { latex: 'h \\le h^*', name: 'Validated horizon ceiling', meaning: 'Requested planning horizon h must not exceed the verified safe horizon limit h*.' },
      { latex: '\\textsf{revise} / \\textsf{abstain}', name: 'Safe fallback outcomes', meaning: 'Routes back to planner along the Alternatives edge if another feasible option exists, or abstains/escalates to clinician.' },
    ],
  },
  risk: {
    interpretation:
      'Distributionally robust safety constraint: even under the worst-case plausible trajectory law P in ambiguity set P(q, g), the probability of violating any safety constraint G_j at any step k must stay within risk budget δ_risk.',
    symbols: [
      { latex: '\\sup_{P \\in \\mathcal{P}(q,g)}', name: 'Worst-case supremum', meaning: 'Takes the highest (most conservative) violation probability across all plausible trajectory laws P.' },
      { latex: '\\mathcal{P}(q,g)', name: 'Plausible trajectory law set', meaning: 'Ambiguity/uncertainty set of dynamics distributions consistent with query q and regime g.' },
      { latex: '\\exists\\,j,k:\\ G_j(Z_k,A_k) > 0', name: 'Any constraint violation event', meaning: 'Event that at least one safety constraint j is breached (> 0) at any rollout step k.' },
      { latex: '\\delta_{\\mathrm{risk}}', name: 'Allowed risk budget', meaning: 'Maximum acceptable upper bound on safety-constraint violation probability.' },
    ],
  },
  fresh: {
    interpretation:
      'Ensures no stale clinical recommendation is displayed: every substantive published answer must match the currently bound patient snapshot and evidence revision.',
    symbols: [
      { latex: 'G(\\cdot)', name: 'Always invariant', meaning: 'Enforced on every substantive publication to the UI.' },
      { latex: '\\mathit{substantive\\_publish}', name: 'Substantive output publication', meaning: 'Displaying an actionable answer or recommendation to the clinician.' },
      { latex: '\\mathit{current\\_bound\\_snapshot}', name: 'Current bound snapshot', meaning: 'Verification that no newer patient data or release invalidation occurred since inference started.' },
    ],
  },
  approval: {
    interpretation:
      'Human-in-the-loop authorization invariant: no action may ever be committed/dispatched to the patient care setting without consuming a valid, matching, single-use clinician approval.',
    symbols: [
      { latex: 'G(\\cdot)', name: 'Always invariant', meaning: 'Hard architectural boundary between simulation/recommendation and real-world patient care.' },
      { latex: '\\mathit{dispatch\\_commit}', name: 'Committed action dispatch', meaning: 'Passing an authorized order or control command out to the patient/care team.' },
      { latex: '\\mathit{consume\\_valid\\_approval}', name: 'Single-use approval consumption', meaning: 'Atomically verifies and consumes an unexpired clinician approval bound to that exact order and patient state.' },
    ],
  },
  audit: {
    interpretation:
      'Auditability invariant: every governed component hand-off that commits must persist a matching, durable trace record so clinical decisions can be reconstructed post-hoc.',
    symbols: [
      { latex: 'G(\\cdot)', name: 'Always invariant', meaning: 'Applies to every governed inter-component boundary.' },
      { latex: '\\mathit{handoff\\_committed}', name: 'Committed hand-off', meaning: 'Completion of a governed state transition, approval, or recommendation hand-off.' },
      { latex: '\\mathit{trace\\_durable}', name: 'Durable trace persisted', meaning: 'Tamper-evident audit record written to persistent storage (e.g., Part 11-style trail).' },
    ],
  },
  provenance: {
    interpretation:
      'Anti-contamination invariant: simulated/imagined rollout trajectories may never be relabeled or committed into the real EHR as observed patient measurements.',
    symbols: [
      { latex: 'G(\\cdot)', name: 'Always invariant', meaning: 'Enforces strict separation between observed EHR records and simulated zone.' },
      { latex: '\\mathit{observed\\_record\\_commit}', name: 'Observed-record write', meaning: 'Writing a measurement into the canonical observed-patient record.' },
      { latex: '\\mathit{observed\\_provenance}', name: 'Verified observed provenance', meaning: 'Cryptographic/metadata proof that the record came from real clinical measurement, never model rollout.' },
    ],
  },
  drift: {
    interpretation:
      'Post-deployment calibration monitor: measures excess empirical miscoverage by comparing actual later-measured patient outcomes Y_i^{obs} against predicted intervals Γ_i(q_i) across a matched monitoring window W_t.',
    symbols: [
      { latex: 'D_t', name: 'Miscoverage drift statistic', meaning: 'Excess error rate above nominal miscoverage (1 − c_nom) at monitoring time t; positive spikes signal calibration drift.' },
      { latex: '|W_t|', name: 'Monitoring window size', meaning: 'Number of eligible matched forecast-outcome pairs in rolling window W_t.' },
      { latex: '\\mathbf{1}\\{\\cdot\\}', name: 'Indicator function', meaning: 'Equals 1 if the realized outcome falls outside the predicted interval, and 0 otherwise.' },
      { latex: 'Y_i^{\\mathrm{obs}}', name: 'Later-measured real outcome', meaning: 'Actual clinical outcome later recorded for executed case i (unexecuted counterfactuals have no factual outcome).' },
      { latex: '\\Gamma_i(q_i)', name: 'Predicted interval / set', meaning: 'Model’s calibrated prediction set issued for query q_i.' },
      { latex: 'c_{\\mathrm{nom}}', name: 'Nominal coverage level', meaning: 'Target coverage probability (e.g., 0.90 or 0.95), making (1 − c_nom) the nominal miscoverage rate.' },
    ],
  },
  fallback: {
    interpretation:
      'Bounded-time safety response invariant: whenever a drift or safety alarm triggers for release r, affected dispatch is inhibited immediately and fallback mode completes within deadline d_r.',
    symbols: [
      { latex: 'G(\\cdot)', name: 'Always invariant', meaning: 'Governs runtime monitoring and incident response continuously.' },
      { latex: '\\mathit{alarm}(r)', name: 'Drift/safety alarm for release r', meaning: 'Triggered when calibration drift, OOD rate, or incident thresholds exceed safety limits for release r.' },
      { latex: '\\mathit{dispatch\\_inhibited}(r)', name: 'Immediate dispatch inhibition', meaning: 'Blocks release r from issuing new clinical action recommendations immediately upon alarm.' },
      { latex: '\\land', name: 'Logical conjunction (“and”)', meaning: 'Both immediate inhibition and bounded-time fallback must hold.' },
      { latex: 'F_{\\le d_r}\\mathit{fallback}(r)', name: 'Bounded eventuality fallback', meaning: 'System transitions release r into a safe fallback/abstain state within deadline d_r.' },
    ],
  },
  release: {
    interpretation:
      'Release-governance invariant: substantive model outputs may only be emitted by a pinned, currently valid, non-revoked release version (while still allowing restriction notices when blocked).',
    symbols: [
      { latex: 'G(\\cdot)', name: 'Always invariant', meaning: 'Enforced across all clinical output publications.' },
      { latex: '\\mathit{substantive\\_publish}', name: 'Substantive output publication', meaning: 'Publishing a clinical forecast or recommendation to the clinician UI.' },
      { latex: '\\mathit{version\\_pinned}', name: 'Version pinned', meaning: 'Exact immutable model release identifier and configuration hash are recorded.' },
      { latex: '\\mathit{version\\_valid}', name: 'Version currently valid', meaning: 'Release is active, revalidated, and neither expired nor revoked by post-market monitoring.' },
    ],
  },
};
