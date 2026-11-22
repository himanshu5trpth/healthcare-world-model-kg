# World Models for Healthcare — Consolidated Knowledge Base and Architecture Blueprint

*Compiled 17 November 2026 from: `World Model Principle/Leapspace.pdf` (26-page synthesis of world-model architecture and design), the relevant entries of `World Model Principle/response.csv`, all 207 papers under `Papers/` (86 numbered originals, 104 `Expanded_Collection` B-papers, 17 `Recommended_Additions` A-papers, plus 4 linked-only records), the existing screening notes in `Papers/`, and a targeted web search for 2025–2026 world-model surveys. Every paper used is listed in [Section 22](#22-bibliography-of-all-sources-used).*

> **How to use this document.** Sections 1–13 explain what a world model (WM) is, which components and properties it needs, and which design choices are best supported by evidence. Sections 14–17 specialise this to healthcare and summarise the local literature side by side. Section 18 is the recommended blueprint. Section 19 lists open problems. Section 20 maps every principle to the extraction-sheet columns in `Healthcare_World_Model_Extraction_Sheet.xlsx`. Citation keys: `[001]`–`[099]` = numbered papers; `[B001]`–`[B106]` = Expanded Collection; `[A01]`–`[A20]` = Recommended Additions; `[LS]` = Leapspace synthesis; `[LS-n]` = reference *n* inside Leapspace; `[R-n]` = reference *n* in `response.csv`; `[W-n]` = web source (Section 22.5).

> **Evidence caution.** Many 2026 sources are arXiv preprints. Unless stated otherwise, statements about individual papers come from their abstracts, opening pages or targeted full-text passages, not from a page-by-page critical appraisal. "Best" recommendations are syntheses of the evidence, not results of a controlled head-to-head benchmark.

---

## Contents

1. [Definitions: what a world model is (and is not)](#1-definitions-what-a-world-model-is-and-is-not)
2. [Intellectual lineage](#2-intellectual-lineage)
3. [Canonical architecture: the six components](#3-canonical-architecture-the-six-components)
4. [Formal statement](#4-formal-statement)
5. [Properties a good world model must have](#5-properties-a-good-world-model-must-have)
6. [The five coupled design axes](#6-the-five-coupled-design-axes)
7. [General world-model families side by side](#7-general-world-model-families-side-by-side)
8. [Training objectives and the reconstruction–control tension](#8-training-objectives-and-the-reconstructioncontrol-tension)
9. [Planning with a world model](#9-planning-with-a-world-model)
10. [Memory, long horizons and temporal abstraction](#10-memory-long-horizons-and-temporal-abstraction)
11. [Uncertainty](#11-uncertainty)
12. [Causality, interventions and counterfactuals](#12-causality-interventions-and-counterfactuals)
13. [Evaluation science, failure modes and mitigations](#13-evaluation-science-failure-modes-and-mitigations)
14. [Why healthcare is a distinct world](#14-why-healthcare-is-a-distinct-world)
15. [Medical world models: capability ladder and evidence ladder](#15-medical-world-models-capability-ladder-and-evidence-ladder)
16. [Healthcare world-model families: the local literature side by side](#16-healthcare-world-model-families-the-local-literature-side-by-side)
17. [Supporting components from the original numbered collection](#17-supporting-components-from-the-original-numbered-collection)
18. [Safety, security, governance and regulation](#18-safety-security-governance-and-regulation)
19. [Recommended healthcare world-model blueprint](#19-recommended-healthcare-world-model-blueprint)
20. [Open problems and research gaps](#20-open-problems-and-research-gaps)
21. [How this document maps to the extraction sheet](#21-how-this-document-maps-to-the-extraction-sheet)
22. [Bibliography of all sources used](#22-bibliography-of-all-sources-used)

---

## 1. Definitions: what a world model is (and is not)

### 1.1 Core definition

A **world model** is a *learned internal predictive representation of how an environment evolves*. It is used to predict future states, reason about the consequences of actions, plan, and make decisions from experience and perception [LS; LS-1–LS-4]. Its defining move is that an agent **maintains an internal state of the world and simulates what may happen under different actions** before acting [LS].

A world model is best treated as a **learned predictive control system**, not merely a generator or simulator [LS]. Fidelity of generated observations is a means, not an end. The end is *better decisions*.

### 1.2 Competing definitions you will encounter

| Community | What "world model" emphasises | Typical example | Source |
|---|---|---|---|
| Model-based RL / deep RL | Action-conditioned latent dynamics sufficient for control; reward/value prediction; imagined rollouts | PlaNet, Dreamer V1–V3, MuZero | [LS; LS-9, LS-27, LS-58, LS-65, LS-77] |
| Robotics / autonomous systems | Engineering component storing and updating the robot's view of the environment and its own self-state; sensor fusion; semantic map; notifies decision layer of events | Object-oriented WM for autonomous vehicles; robotic WM best practice | [R-4; LS-12; LS-13] |
| Cognitive architectures | Persistent, past-oriented state about the outside world, kept separate from goals/plans (future-oriented commitments) | Double Pass Architecture | [R-2] |
| Self-supervised representation learning (LeCun/JEPA) | Predict *representations* of masked or future content in latent space, not pixels; energy-based; hierarchical (H-JEPA) | I-JEPA, V-JEPA, V-JEPA 2-AC | [R-3; R-5; W-6] |
| Generative video / "world simulators" | Render the world realistically and interactively; prompt- or action-controllable | Genie 1–3, Cosmos, Sora-style models | [R-11; R-49; W-4; W-5] |
| Predictive processing / neuroscience | Brain as a generative model minimising prediction error (predictive coding, free-energy principle) | Rao & Ballard; Friston | [LS-60; LS-61; R-3; R-19] |
| Physical AI | Physics-grounded perception + symbolic reasoning + generative simulation to bridge sim-to-real | Survey on Physical AI | [R-35] |
| Code / language agents | Simulate execution states or environment responses for reasoning ("next-world" rather than next-token prediction) | Code World Models | [R-24] |
| Medicine | Learned simulator of **patient-state dynamics** under **clinical interventions**, used to forecast, compare and plan care | MeWM, EHRWorld, PatientWM, PulmoWorld | [A17; A18; B056; W-1–W-3] |

**Consensus kernel.** Across communities a system qualifies as a world model when it (i) maintains a state, (ii) predicts how that state evolves, ideally conditioned on actions, and (iii) uses that predictive structure to simulate, score or execute behaviour, regardless of implementation (RSSM, diffusion, 3-D reconstruction or Transformer sequence model) [R-49].

**There is no universally accepted formal definition and no canonical component taxonomy** [LS]. Your extraction sheet therefore records *which capabilities* a paper demonstrates instead of accepting the label "world model" at face value.

### 1.3 Medical world model definition used in this document

> A **medical world model** is a learned (or hybrid learned–mechanistic) system that **(1)** builds a patient, organ, procedure or health-system **state** from multimodal observations, **(2)** models how that state **evolves over time**, **(3)** accepts **interventions** (drugs, doses, procedures, probe motions, operational decisions) as inputs, **(4)** **rolls trajectories forward** under those interventions with uncertainty, and **(5)** optionally uses the rollouts for **comparison, planning or control** under clinician oversight.

This synthesis follows the converging 2026 surveys. A17 organises the field around patient-state construction, clinical dynamics modelling and intervention decision support [A17; W-1]. A18 uses patient-state representation, temporal dynamics, intervention-conditioned simulation and clinician-supervised planning [A18; W-2]. Su et al. use state representation, dynamics modelling, intervention conditioning, future rollout and decision support [W-3].

### 1.4 What a world model is NOT (boundary cases)

| Adjacent paradigm | Why it is not automatically a world model | When it becomes one |
|---|---|---|
| Static classifier / risk score / segmentation | No state transition; no rollout | Never on its own; may serve as a readout head |
| Single-endpoint prognostic model | Predicts one future label, not state evolution | When it models intermediate states and can be rolled forward |
| Generic synthetic-data generator (tabular GAN/VAE) | No temporal or action semantics [016; 030; 050; 063] | When it generates longitudinal trajectories conditioned on history and actions [B071; B085] |
| Model-free RL policy | Learns *what to do* but not *what will happen* [067] | When paired with a learned dynamics model (model-based RL) [A04; B092] |
| Medical chatbot / LLM | Static reasoning; drifts under sequential interventions; poor state consistency [A03; A06] | When trained or used as a stateful simulator, or coupled to one [A07; B055] |
| Counterfactual outcome estimator | Estimates effects but may not simulate full state trajectories | When used to generate full covariate trajectories (g-computation rollouts) [A12; B080] |
| "Digital twin" label | Often used for static, twin-*inspired* prediction [079] | When it has a patient-specific state, update (assimilation) and forward simulation [B063; B091; A14] |
| Self-supervised representation model ("image world model") | Learns state geometry but may not model time or action [B001–B005] | When a temporal or action-conditioned predictor is retained and evaluated [B010; B100] |

---

## 2. Intellectual lineage

| Era | Milestone | Contribution to modern WMs | Source |
|---|---|---|---|
| 1980s–2000s | World models in intelligent control; mobile-robot world representations | WM as engineered component for perception–model–decision | [LS-13; LS-14; R-2] |
| 1999 | Rao & Ballard predictive coding; prediction-driven auditory scene analysis | Perception as hypothesis confirmation via prediction error | [LS-61; R-19] |
| 2010 | Friston free-energy principle | Unifies perception and action around minimising prediction error | [LS-60] |
| 2010 | Object-oriented WM for autonomous vehicles | Modular API, sync/async access, event notification to decision layer | [R-4] |
| 2011 | PILCO | Probabilistic (GP) dynamics for data-efficient control; uncertainty propagation | [LS-20] |
| 2015 | Embed to Control (E2C) | Locally-linear latent dynamics for control from pixels | [LS-62] |
| 2017–2019 | Structured inference networks / deep Kalman; Neural ODE, Latent ODE, GRU-ODE-Bayes, latent SDE, ODE2VAE | Probabilistic and continuous-time latent dynamics for irregular data | [LS-95–LS-100] |
| 2018 | Ha & Schmidhuber "World Models" (VAE + MDN-RNN + controller) | Train policy inside learned "dream" | [LS-59; R-50] |
| 2018 | PETS | Probabilistic ensembles + trajectory sampling (CEM) | [LS-57] |
| 2019 | PlaNet / RSSM | Deterministic + stochastic latent recurrence; latent overshooting; online latent planning | [LS-9] |
| 2019–2020 | MBPO; MOPO | Short model rollouts; uncertainty-penalised offline model-based RL | [LS-126; LS-127] |
| 2020 | Dreamer; MuZero | Actor–critic learned in imagination; value-equivalent model + tree search | [LS-65; LS-77] |
| 2021 | DreamerV2 | Discrete latents beat continuous on Atari | [LS-27] |
| 2022 | LeCun "path towards autonomous machine intelligence" | JEPA, H-JEPA, energy-based WMs; configurator–perception–WM–cost–memory–actor | [R-3; R-5; W-9] |
| 2023 | IRIS / Transformer WMs; S4 WM backbones | Transformers sample-efficient; SSMs improve long memory | [LS-39; LS-50; LS-130] |
| 2023 | DayDreamer | Dreamer learning directly on physical robots | [LS-85] |
| 2024–2025 | Genie, Genie 2/3; NVIDIA Cosmos WFM; V-JEPA 2 / V-JEPA 2-AC | Foundation world models: interactive generation; action-conditioned latent planning at scale | [W-4–W-7] |
| 2025 | DreamerV3 in *Nature* | One configuration masters diverse control domains | [LS-58] |
| 2025–2026 | Medical WMs: MeWM, CLARITY, EHRWorld, PatientWM, PulmoWorld, Cosmos-H-Surgical, SonoWorld ... | Transfer of WM principles to patients, procedures and health systems | [A01–A11; B001–B106] |

---

## 3. Canonical architecture: the six components

The architecture that recurs across RL, robotics and medicine is [LS]:

```
observations o_t ──► (1) ENCODER / PERCEPTION ──► (2) LATENT / BELIEF STATE s_t ◄── memory of history
                                                    │
                       action a_t (+Δt) ───────────►│
                                                    ▼
                                  (3) ACTION-CONDITIONED TRANSITION  p(s_{t+1} | s_t, a_t, Δt)
                                                    │
                     ┌──────────────────────────────┼──────────────────────────────┐
                     ▼                              ▼                              ▼
       (4) OBSERVATION DECODER          (5) REWARD / VALUE / TASK HEADS     (6) PLANNER / POLICY
       p(o_{t+1} | s_{t+1})             r(s,a), V(s), clinical readouts     uses imagined rollouts
       (optional)                       (optional)                          to choose a_t
```

| # | Component | Function | Why it exists | Medical analogue |
|---|---|---|---|---|
| 1 | Encoder / perception | Map raw observations (pixels, signals, codes, text) to compact features | Reduce complexity; denoise; fuse modalities | Image/EHR/signal encoders; availability-aware encoders [B030] |
| 2 | Latent or belief state | Summarise history under partial observability | Memory; sufficient statistic for prediction | Patient state; disease state; ocular state [B038]; belief over registration [B044] |
| 3 | Action-conditioned transition | Predict next state given action and elapsed time | Enables counterfactual simulation and planning | Treatment-conditioned dynamics [A02; B026; B039] |
| 4 | Observation/emission model (decoder) | Generate observations from state | Training signal; human inspection; image-level forecasting | Future MRI/CT/X-ray, video, ECG, labs [A01; A05; B027] |
| 5 | Reward/value/task heads | Score states for objectives | Converts prediction into decision-relevant quantities | Survival, mortality, pCR, organ-support readouts [A01; B015] |
| 6 | Planner or policy interface | Search or learn actions using imagined trajectories | Turns prediction into action | MPC [B092], imagined RL [A04], agent propose–simulate–refine [A07], retrieval planning [B041] |

**Why this pattern recurs** [LS]: the encoder reduces complexity; the latent state supplies memory; the transition supports counterfactual simulation; the planner converts prediction into action. Model-based learning from imagined interaction is the main source of **sample efficiency**.

**Robotics adds** [LS; R-4; R-14; LS-12]: robot self-state, multimodal sensor fusion, semantic world state, active perception, uncertainty-aware state estimation, sim-to-real, explicit event notification and **modular software engineering** (design patterns, synchronous/asynchronous APIs, behaviour trees for action selection).

**LeCun's cognitive architecture** adds explicit modules for a *configurator* (task set-up), a *cost* module (intrinsic cost + trainable critic), *short-term memory* and an *actor*. It also uses hierarchical JEPA for multi-level abstraction [R-3; R-5; W-9].

**Layered integration principle.** For safety-critical, long-horizon decisions, a latent world-model layer should feed **structured interfaces** to classical planners, a "planner-of-record", runtime assurance envelopes and human gates. Making it the sole decision maker is not advised [R-5].

---

## 4. Formal statement

A world model for decision making can be written as a partially observed controlled stochastic process:

- **Belief update (filtering / data assimilation):** `b_t = f_θ(b_{t-1}, a_{t-1}, o_t, Δt_t)` — correct the predicted state when, and only when, an observation arrives [B066].
- **Transition (prior):** `p_θ(s_{t+1} | s_t, a_t, Δt)` — deterministic + stochastic parts, as in RSSM [LS-9]; continuous-time variants integrate `ds/dt = g_θ(s, a, t)` (neural ODE/SDE) [LS-96–LS-99].
- **Observation model:** `p_θ(o_t | s_t)` and, in healthcare, an **observation-process model** `p(observed_t, timing | s_t, acquisition context)` [B007; B071].
- **Readouts:** `y_t = h_k(s_t)` for task *k* (typed decoders) [B030].
- **Reward/cost:** `r(s_t, a_t)` or a clinical utility `U(trajectory)`.
- **Planning:** `a*_{t:t+H} = argmax E_{p_θ}[ Σ γ^k r(s_{t+k}, a_{t+k}) − λ·Uncertainty ]`, subject to constraints C. Execute `a*_t`, observe, re-plan (receding horizon) [LS; W-6].
- **Healthcare transition record:** the minimal unit of training evidence is `(s_t, a_t, Δt) → s_{t+1}` with downstream outcomes and measurement context [A17].

**Capability levels** (Section 15) map onto these equations. L1 uses the transition with actions marginalised or fixed to observed care. L2 conditions on specified actions. L3 compares rollouts under alternative action sequences, which requires causal identification. L4 optimises action sequences [A18].

---

## 5. Properties a good world model must have

The checklist below merges the principles in Leapspace with medical-survey requirements. Column codes in brackets refer to the extraction sheet (Section 21).

| # | Property | What it means | Why it matters | Best-supported practice |
|---|---|---|---|---|
| P1 | **Predictive** | Forecasts future states, not only labels | Core definition | Multi-step forecasting losses (latent overshooting) [LS-9] |
| P2 | **Action-conditioned** | Transition depends on actions | Enables "what-if" | Explicit action encoder; typed actions [A06; B029] |
| P3 | **Compact latent state** | Predict in a learned latent rather than raw observation space | Control efficiency; ignores nuisance (e.g., ultrasound speckle) | Latent rollouts > pixel rollouts for control [LS; B008] |
| P4 | **Decision-sufficient state** | State keeps the variables that determine future transitions | Missing determinants lead to confounded, implausible rollouts | State-sufficiency ablations [A17] |
| P5 | **Partial-observability aware** | Belief state integrates history | Patients and scenes are never fully observed | RSSM/filtering; propagate–correct separation [B066; B044] |
| P6 | **Explicit uncertainty** | Distribution over futures, aleatoric vs epistemic | Planning under uncertainty; safe abstention | Ensembles, stochastic latents, posterior sampling [LS; 082; B067] |
| P7 | **Calibrated** | Predicted probabilities and spreads match frequencies across the horizon | Trustworthy decisions | Trajectory-level calibration [B056; A18] |
| P8 | **Useful long-horizon memory** | Retains relevant history over long sequences | Delayed effects; chronic disease | SSM/S4, explicit memory, history-conditioning [LS; B030; B074] |
| P9 | **Temporal fidelity** | Handles irregular, asynchronous, continuous time | Clinical data are irregular; timing carries information | Continuous-time models; native timestamps [B013; B074; B007] |
| P10 | **Structure (objects, discrete, causal, symbolic, physics)** | Inductive bias matched to the domain | Robustness, interpretability, transfer, OOD | Object-centric, scene-graph, neuro-symbolic, hybrid mechanistic [LS; B042; B058; B067] |
| P11 | **Causal validity** | Intervention-conditioned predictions reflect effects, not care patterns | Treatment comparison | Sign constraints, g-computation, target-trial emulation [B026; A12; B039] |
| P12 | **Closed-loop compatible** | Supports receding-horizon re-planning with new observations | Rollout error compounds | MPC, short rollouts + value bootstrapping [LS; B092] |
| P13 | **Exploitation-resistant** | Planner cannot "win" by exploiting model errors | Over-optimistic plans | Uncertainty penalties; support constraints [LS-127; A17] |
| P14 | **Consistent state** | Entities, anatomy and identity persist across rollouts | Avoids object disappearance and drift | State-consistency training [A03]; geometry-grounded memory [LS-138] |
| P15 | **Personalised** | Patient history materially changes the forecast | Separates individual simulation from population average | P³ audit; history-swap tests [B016; B063] |
| P16 | **Updatable (assimilation, continual)** | New data update the state without retraining | Digital-twin behaviour | Hourly latent updating [B063]; adaptive twin updating [B091] |
| P17 | **Composable / modular** | Clear interfaces between encoder, dynamics, planner, readouts | Reuse across tasks and settings | Serial / shared-state / closed-loop compositions [A17]; unified state + typed decoders [B030] |
| P18 | **Efficient** | Fast enough to plan in the loop | Real-time surgery and ultrasound | Latent planning (V-JEPA 2-AC ~16 s/action vs ~4 min for pixel generation) [W-6]; distillation to causal students [B033; B057] |
| P19 | **Interpretable / inspectable** | Users can inspect assumptions, states and alternative futures | Clinician oversight | Explicit physiological variables, scene graphs, mechanistic modules [B086; B042] |
| P20 | **Verifiable** | Fidelity, rollout stability, plausibility and usable horizon are measurable | Evidence for deployment | Trajectory-level verification + effective horizon [A19]; audits [B007; B016; B046; B059] |
| P21 | **Safe and governed** | Constraints, abstention, human escalation, monitoring | Clinical harm prevention | Rule-based contraindication blocks + disagreement-triggered review [B096]; failure detectors [B050] |
| P22 | **Secure and privacy-preserving** | Resists poisoning and trajectory manipulation; protects identifying trajectories | Threat surface grows with predictive power | Lifecycle defences [R-11; R-49]; federated training; memorisation audits [A18; 038] |

**Five expert principles distilled by Leapspace** [LS]:

1. Model in **latent space** for control.
2. Represent **uncertainty explicitly**.
3. Keep planning **closed-loop and horizon-limited**.
4. Add **structure** (objects, discrete states, causality, symbols).
5. **Evaluate by control usefulness, robustness and transfer**, not visual realism.

---

## 6. The five coupled design axes

Leapspace identifies five coupled axes along which every world model can be placed [LS]. They become extraction columns `DA1–DA5`.

| Axis | Options (from least to most structured) | Trade-offs | Healthcare evidence |
|---|---|---|---|
| **DA1 State abstraction** | Pixels/voxels → compact continuous latent → discrete codes → object slots / scene graphs → symbolic/explicit physiological variables | Pixels: inspectable but costly and nuisance-heavy. Latents: efficient but opaque. Discrete codebooks can beat continuous latents for control [LS-38]. Symbols: interpretable but need engineering | Voxel diffusion [B018]; continuous latents [B030]; scene graphs [B042]; Gaussian motion states [B077]; explicit physiology [B086] |
| **DA2 Uncertainty representation** | Deterministic → stochastic latent → ensembles → Bayesian posterior → calibrated confidence / conformal | More expressive costs more compute; calibration must be checked | Tempered posterior [B067]; uncertainty-guided twin [B073]; conformal [032] |
| **DA3 Memory horizon** | Markov → RNN/GRU → Transformer context → S4/S5/Mamba → graph memory → explicit memory injection → retrieval | Long memory needed for delayed effects; no single backbone dominates [LS] | Ordered state–action history [B030]; recurrence-aware next-visit [B103]; retrieval-induced transitions [B041] |
| **DA4 Structural bias** | Unstructured → object-centric → causal → physics-informed → symbolic/neuro-symbolic → mechanistic | Structure improves OOD robustness and interpretability; risk of mis-specification | Sign constraints [B026]; ODE priors [B027]; transport PDEs [B067]; neuro-symbolic surgery [B058]; agentic ODE discovery [B072; B095] |
| **DA5 Planner interface** | None → candidate comparison → sampling MPC (CEM/MPPI) → tree search → differentiable planning → imagined policy learning → LLM agent loop | Short-horizon MPC is robust; imagined RL is efficient but vulnerable to model exploitation | MPC [B092]; TD-MPC2 [B049; B051; B105]; Dreamer-style [A04; B048; B052]; LLM agent [A07] |

**Likely future architecture** (medium confidence [LS]): a hybrid with an **RSSM-like latent dynamics core**, **stronger memory**, and **structured overlays** (objects, semantics, causality). The medical surveys reach a parallel conclusion: the most consequential advances are expected from **hybrid models that respect clinical mechanisms and causal structure** and from **action representations that mirror how clinicians act** [A18].

---

## 7. General world-model families side by side

| Family | Representative | State | Dynamics | Objective | Planner | Strengths | Weaknesses |
|---|---|---|---|---|---|---|---|
| Probabilistic dynamics for control | PILCO, PETS [LS-20; LS-57] | Low-dim state | GP / probabilistic ensembles | Likelihood | Analytic policy search / CEM-MPC | Data efficiency; explicit uncertainty | Scales poorly to high-dim observations |
| Latent recurrent SSM | PlaNet, Dreamer V1–V3 (RSSM) [LS-9; LS-27; LS-58; LS-65] | Deterministic + stochastic latent (discrete in V2/V3) | Recurrent | Reconstruction + KL + reward; overshooting | Online latent planning (PlaNet) / actor–critic in imagination (Dreamer) | Robust general recipe; sample efficient; one config across domains (V3) | Reconstruction keeps nuisance detail; limited long memory |
| Value-equivalent | MuZero [LS-77] | Abstract latent | Learned | Predict reward, value, policy only | MCTS | No need to reconstruct observations | Less interpretable; hard to reuse for other tasks |
| Transformer WMs | IRIS, TWM [LS-50; LS-130] | Discrete tokens | Autoregressive Transformer | Next-token | Imagined policy | Strong sample efficiency; long context | Compounding error; compute |
| Joint-embedding predictive (JEPA) | I-JEPA, V-JEPA 2, V-JEPA 2-AC [R-3; R-5; W-6] | Embeddings | Predictor in embedding space (action-conditioned in AC) | Latent prediction (no pixels) | MPC minimising a goal-conditioned energy | Ignores unpredictable detail; very efficient planning (~300M-parameter AC predictor; <62 h robot video; zero-shot pick-and-place) | No pixel output for inspection; collapse must be prevented |
| Generative video / world foundation models | Genie 1–3, Cosmos, Sora-style [W-4; W-5; R-49] | Video tokens / latents | Diffusion and/or autoregressive | Denoising / next-token | Policy evaluation; synthetic data; (slow) planning | Visual fidelity; interactivity; broad priors | Sampling cost, drift, object disappearance, long-horizon physical inconsistency [LS]; costly to plan with |
| Object-centric / causal | Dyn-O, FIOC-WM, SlotDiffusion, VCD, SCM-VAE [LS-34–LS-37; LS-111–LS-114] | Slots / causal variables | Factored | Reconstruction + structure | Various | Robust to structured shift; interventional reuse | Identifiability and engineering burden |
| Memory-extended | S4/S5 WMs, FACTS graph memory, EDELINE, MemoryMaze mLSTM [LS-39; LS-40; LS-41; LS-137] | Latent + memory | SSM / graph routing | Prediction | Imagined policy | Long-horizon recall | Memory scaling still unsolved |
| Hierarchical / temporally abstract | H-JEPA; option-level WMs [R-5; LS-91; LS-146–LS-148] | Multi-level | Multi-timescale | Multi-level prediction | Hierarchical planning | Shortens effective horizon; delayed-effect recovery | Learning stable abstractions is hard |
| LLM / language WMs | PLM text-game WMs; Code WMs [LS-82; R-24] | Text / program state | LLM | Next-token / execution-trace prediction | Agent reasoning | World knowledge; flexible interface | State inconsistency, hallucination, drift under long interaction [A03; A06] |
| Mechanistic / hybrid simulators | PK/PD, tumour growth, cardiac EP, UVA/Padova [B082; A16; A20] | Explicit physiological variables | ODE/PDE + learned closures | Fit to data | Optimisation / control | Valid under intervention; interpretable; regulatory precedent | Mis-specification; parameter identifiability; expert effort |

**The central paradigm split** [W-4; W-8]:

- *Pixel-generative* models (Sora/Veo/Cosmos/Genie) are visually strong and interactive, but they are physically brittle and expensive to plan with.
- *Predictive-latent* models (the JEPA line) do not render pixels, need little labelling, and are cheap to use for control.
- Evidence through 2025–2026 indicates **each has its uses, but latent prediction is cheaper and often better for control**. One study reports that action-relevant latents come from *prediction rather than reconstruction* [W-8].

---

## 8. Training objectives and the reconstruction–control tension

| Objective | Description | Used by | Note |
|---|---|---|---|
| Observation reconstruction (ELBO) | Decode o_t from s_t | VAE-RNN, RSSM, Dreamer | Retains control-irrelevant detail [LS] |
| Latent dynamics consistency / prediction | Predict future latent from past latent (+action) | JEPA, Clin-JEPA, EchoJEPA, Brain-JEPA, Sonata | Avoids modelling unpredictable noise; needs anti-collapse design [B006; B008; B010; B101] |
| Reward / value prediction | Predict task signals | MuZero, Dreamer | Decision sufficiency |
| Multi-step / overshooting loss | Train for k-step predictions | PlaNet; physiology-aware rollout losses [A06] | Reduces compounding error |
| Imagined-rollout policy objective | Actor–critic on imagined trajectories | Dreamer, medDreamer [A04] | Sample efficiency; exploitation risk |
| Next-token (events) | Autoregressive event/time generation | Foresight, Curiosity, Delphi-2M, FlatASCEND, RAVEN [B081; B032; A15; B083; B103] | Scales with data; next-token ≠ state simulation [B055] |
| Diffusion denoising / flow matching | Generate images or trajectories | TaDiff, BrLP, TFM, ImageFlowNet, PhaseFlow3D [B023; B022; B014; B025; B070] | Continuity via velocity fields (flow matching) [B020] |
| Causal / balancing objectives | Remove time-varying confounding | Causal Transformer, G-Net, G-Transformer [A13; B080; A12] | Needs identification assumptions |
| Physics / mechanism residual | Penalise violation of ODE/PDE or sign constraints | ECG-WM, DuoPIC, PhysioWorld, NODE ROMs [B027; B067; B026; B084] | Constrains extrapolation |

**Reconstruction vs control tension** [LS]. Reconstruction-heavy objectives keep detail that does not matter for control, and latent prediction is generally better than pixel prediction for control. The field has moved from *predictive compression* toward *decision-sufficient latent simulation*. Medical echoes of this:

- Latent prediction ignores ultrasound speckle [B008].
- "The patient is not a moving document": next-token LLM training treats a patient as text to summarise rather than a dynamical system to simulate [B055].
- Invariance-based self-supervised learning suppresses the transient pathology it should detect, so action/event-conditioned JEPAs are preferred [B100].
- For small clinical cohorts, a latent future-state objective beats masked reconstruction at matched backbone [B101].

---

## 9. Planning with a world model

| Planner | Mechanism | Strength | Risk | Healthcare use |
|---|---|---|---|---|
| Sampling-based MPC (random shooting, CEM, MPPI) | Sample action sequences, roll out, pick best; execute first action; re-plan | Robust, simple, closed-loop | Compute; myopia if horizon too short | EHR-MPC for sepsis [B092]; MPPI in TD-MPC2 endovascular [B049]; receding-horizon probe navigation [B042] |
| TD-MPC / TD-MPC2 | Latent model + learned value + MPPI | Strong continuous control | Value errors | Endovascular navigation and thrombectomy [B049; B051; B105] |
| Tree search (MCTS) | Value/policy-guided search over a learned model | Discrete decisions; long horizons | Branching; model errors | Rare in medicine so far |
| Gradient-based latent planning | Backpropagate through a differentiable model | Fast | Local optima; adversarial plans | — |
| Imagination-based policy optimisation (Dreamer actor–critic) | Train policy on imagined latent trajectories | Sample efficiency | Model exploitation | medDreamer [A04]; surgical grasping GAS [B048; B052]; PulmoWorld Cap-MBRL [B066] |
| Short-rollout / offline MBRL (MBPO, MOPO) | Short branched rollouts; uncertainty-penalised reward | Safer offline learning | Conservatism | Recommended for retrospective clinical data [LS-126; LS-127] |
| Candidate comparison (proposal + simulation + scoring) | Proposer generates candidates, WM simulates, evaluator scores | Transparent; clinician-compatible | Coverage of candidates | MeWM: VLM policy + tumour generator + survival evaluator [A01]; CLARITY [A02]; CaMeWM [B039] |
| LLM agent propose–simulate–refine | Agent queries WM before committing | Combines knowledge and dynamics | WM access alone gave inconsistent gains; curriculum needed [A07] | SepsisAgent [A07] |
| Retrieval-based planning | Retrieve nearby latent transitions/views | Data efficient | Coverage | Ultrasound operator guidance [B041] |
| Classical optimisation (GA, constrained optimisation) | Optimise over the twin | Handles constraints | Local optima | Microwave ablation planning [B088]; brain-tumour scheduling [B091]; PRIME-Care [088] |
| Model-based RL on discrete MDP | DQN over simulated state transitions | Simple | Coarse states | Bladder cancer [B090]; treatment-response digital twin + RL + safety rules [B096] |

**Planning principles** [LS]:

1. **Closed-loop, horizon-limited planning** outperforms long open-loop imagination because rollout error compounds.
2. Use **short rollouts with value bootstrapping**, **uncertainty penalties** and **receding-horizon re-optimisation**.
3. Guard against **planner exploitation of model artefacts**.
4. Use **probabilistic ensembles and uncertainty bounds** in the objective.
5. Use **residual learning with classical planners** and **switching between classical and neural planning** where appropriate [LS-173].
6. **Decouple dynamics learning from treatment optimisation**, so that objectives can change at inference time without retraining [B092].

---

## 10. Memory, long horizons and temporal abstraction

- **Memory is a first-class bottleneck** for long-horizon prediction, and simple recurrence is not enough [LS].
- **Options** include S4/S5 state-space models, graph-structured memory with routing (FACTS), diffusion + SSM hybrids (EDELINE), explicit memory injection (mLSTM in MemoryMaze), and geometry-grounded spatial memory for video WMs [LS-39–LS-41; LS-137; LS-138].
- **No single backbone dominates.** Long-horizon tasks reward efficient long-context memory *plus* structured state (high confidence) [LS]. Controlled backbone comparisons (RNN vs Transformer vs S4) are recommended [LS-39].
- **Temporal abstraction** (subgoals, options, multi-timescale transitions, high/low-level decomposition) shortens the effective decision horizon and improves recovery of delayed effects [LS].
- **Medical instantiations:**
  - Expose the ordered sequence of preceding states and actions, not only a recurrent summary [B030].
  - Use recurrence-aware next-visit prediction [B103].
  - Use a sparse event-structured hierarchical WM, with an event-level manager plus a primitive-step worker, for long-horizon surgery [B087].
  - Use multi-timescale latent dynamics [LS-91].
  - Use multiscale states from milliseconds (cardiac EP) to decades (chronic disease) and molecules to populations [A18].

---

## 11. Uncertainty

| Aspect | Options | Healthcare guidance |
|---|---|---|
| Type | **Aleatoric** (inherent variability, e.g., biological heterogeneity) vs **epistemic** (model ignorance, reducible with data) | Distinguish uncertainty reducible by better measurement from heterogeneity and stochastic events [A17]; single-model joint quantification [082] |
| Methods | Deep ensembles; Bayesian NN / MC dropout; stochastic latents; diffusion/flow sampling; GP; conformal prediction; tempered posteriors | Review of UQ techniques [098]; Bayesian deep learning [003; 010; 043; 089; 094]; GP with dissimilarities [074]; conformal for genomics [032]; tempered posterior in perfusion twin [B067] |
| Granularity | Per-step vs **trajectory-level** | Trajectory-level calibration is a recognised gap [B056]; uncertainty should grow with horizon [A17] |
| Use in decisions | Penalise uncertain plans; abstain; trigger human review | Entropy-guided abstention [012]; rejection [022]; uncertainty governance layer [015]; disagreement → clinician review [B096]; uncertainty-guided adaptive proton therapy [B073] |
| Diversity | Multiple plausible futures, not one average | Rare but consequential outcomes must remain visible; candidate interventions must produce distinguishable distributions [A17] |

---

## 12. Causality, interventions and counterfactuals

### 12.1 Why conditioning is not intervening

A model trained on observational care learns **how clinicians acted for particular patients**, not how those patients would have evolved under alternatives [A17]. Two examples:

- Because sicker patients receive higher doses, a naive ICU model learns a dose–outcome association that **runs opposite to the drug's effect** and generalises poorly to new dosing practices [B026].
- A treatment-conditioned generator trained on retrospective cohorts can **reproduce historical treatment allocation** instead of simulating interventional dynamics [B039].

### 12.2 Pearl's ladder mapped to medical capability

| Rung | Question | Medical WM level | Requirement |
|---|---|---|---|
| Association | What will happen? | L1 temporal prediction | Predictive accuracy under observed care |
| Intervention | What happens if we do *a*? | L2 action-conditioned prediction | Action semantics; support |
| Counterfactual comparison | What would happen under *a* vs *a′* for this patient? | L3 | Identification: exchangeability (no unmeasured confounding), positivity/overlap, consistency, censoring assumptions [A12; B080] |
| Optimisation | Which sequence is best? | L4 planning/control | L3 + objective + constraints + exploitation tests |

### 12.3 Methods

| Method | Idea | Source |
|---|---|---|
| g-computation with sequence models | Estimate conditional covariate distributions, then Monte Carlo roll forward under a dynamic regime | G-Net [B080]; G-Transformer [A12] |
| Balanced representations | Separate covariate/treatment/outcome streams; adversarial balancing removes time-varying confounding | Causal Transformer [A13] |
| Mechanistic / sign constraints | Encode known directional pharmacological effects, which stay invariant under OOD shift | PhysioWorld sign constraints [B026]; ODE priors [B027]; PK/PD attention [B079] |
| Supported-regimen restriction | Compare only regimens with empirical support; state the causal target | CaMeWM [B039] |
| Treatment bundles | Edit clinically coherent bundles, not single components; 945,707 MIMIC-IV patient-hours show components that never appear apart | [B046] |
| Target-trial emulation, sensitivity analysis, quasi-prospective testing | Required before rollouts count as decision evidence | [A17] |
| Counterfactual trajectory generation from RWD | Modify covariates (age, CRP, creatinine) and generate timelines; validate plausibility | [B102]; HealthFormer compared intervention predictions with 41 published RCT comparisons and a held-out nutrition trial [B099] |
| Causal representation learning | Identifiable causal latents (SCM-VAE, VCD, weak supervision) | [LS-36; LS-37; LS-117] |

### 12.4 Open question: predictive sufficiency vs causal validity

There is **no consensus** on whether causal validity is necessary for useful world models (medium confidence) [LS; LS-55]. In medicine the answer depends on the claim. **L1–L2 claims can rest on predictive sufficiency; L3–L4 claims cannot** [A18].

---

## 13. Evaluation science, failure modes and mitigations

### 13.1 What to evaluate (layers)

| Layer | Metric examples | Note |
|---|---|---|
| E1 One-step fidelity | MAE/MSE, Dice, SSIM/PSNR, AUROC of next-state readouts | Necessary, not sufficient |
| E2 Multi-step / free-running rollout | Error vs horizon; drift; **effective horizon at stated tolerance** | [A19; LS] |
| E3 Distributional realism | FID/FVD, Jaccard of event sets, MMD | Unconditional realism may not separate a model from trivial baselines [B083] |
| E4 Physical / clinical plausibility | Constraint violations; anatomical consistency; mechanism respect under changed actions | Surgical Plausibility Pyramid: visual → instrument operation → environment feedback → surgical intent [B059] |
| E5 Calibration & uncertainty | ECE, Brier, coverage, trajectory calibration | [B056] |
| E6 Action/intervention sensitivity | Direction and magnitude of response to edits; bundle vs single edits | [B046; B026] |
| E7 Counterfactual / causal validity | Agreement with RCTs or known mechanisms; synthetic ground truth | [B099; B080; B066] |
| E8 Personalisation | Does the patient's own history drive the forecast (P³: Patient, Place, Prior); history swap/withhold | [B016; B063] |
| E9 Downstream decision quality | Task success, off-policy value, regret, planning success | Offline/off-policy estimates ≠ patient benefit [A04] |
| E10 Sim-to-real agreement | Policy ranking agreement between simulator and real robot | Varies by task, including inverse agreement [B057]; automated policy evaluation [B104] |
| E11 Robustness & transfer | External site, OOD dosing, subgroups, missing modalities | [B026; A18] |
| E12 Observation-process audit | Did resampling erase the event? (four regimes: sampled values, grid-cell update patterns, native timing, external acquisition channel) | EndoClock [B007] |
| E13 Human/expert evaluation | Clinician rating; reader studies; Turing-style tests | Four board-certified surgeons in SurgVeo [B059] |
| E14 Efficiency | Latency/action, throughput, sample efficiency | Real-time streaming [B057]; V-JEPA 2-AC vs Cosmos [W-6] |
| E15 Clinical utility | Prospective, randomised, workflow outcomes | Rare; staged evaluation and post-deployment monitoring needed [A18] |

General benchmarks (for comparison): Atari100k, DMC, MetaWorld, Crafter, ViZDoom, MuJoCo, MyoSuite. Embodied/multimodal: SILG, gSCAN, GameWorld, CREW-Wildfire, AgentBoard, CRAB [LS]. Video-WM: WorldModelBench, EWMBench, World-in-World, WoW-wo-val [W-5; W-8]. Medical resources include MIMIC-III/IV, eICU, ADNI, BraTS/TCIA, EHRSHOT, Epic Cosmos, Human Phenotype Project and VinDr-CXR [A18; B032; B099; B103; B054].

### 13.2 Failure modes and mitigations

| Failure mode | Description | Mitigation | Source |
|---|---|---|---|
| Compounding rollout drift | Errors accumulate over autoregressive steps; visual "temporal fidelity collapse" | Multi-step losses; closed-loop re-assimilation; short horizons; effective-horizon reporting | [LS; B036; A03; A19] |
| Planner exploitation | Optimiser finds actions where the model is wrong | Uncertainty penalties; support constraints; verify-before-act | [LS; LS-127] |
| Sim-to-real mismatch | Friction, contact, compliance, latency, noise, disturbances | Domain randomisation; residual learning; shadow mode; real-robot evaluation | [LS; B057] |
| Missing modalities / partial observability | State incomplete | Availability-aware encoders; belief filtering | [LS; B030; B066] |
| Weak grounding / sparse supervision | Latent actions do not match executable actions | Grounded action spaces; kinematics alignment | [LS; A09; B061] |
| Intuitive-physics failure | Instrument contact does not deform tissue; objects vanish | Physics priors; interaction coherence losses; neuro-symbolic rules | [LS; B036; B058] |
| Confounding-reversed effects | Learned dose–response opposite to pharmacology | Sign constraints; causal methods | [B026] |
| Unsupported action edits | Single-component edits describe impossible care states | Bundle-aware editing; support checks | [B046] |
| Grid erases event | Resampling removes the acquisition-timing evidence | Preserve native clocks; EndoClock audit | [B007] |
| Population-average masquerading as personalisation | Forecast ignores patient history | P³ audit; history-swap controls | [B016; B063] |
| LLM state inconsistency | LLMs drift under sequential interventions | Causal sequential training on real EHR trajectories; state-consistency objectives | [A03; A06] |
| Plausibility gap | Visual realism without surgical causal plausibility | Expert tiered evaluation | [B059] |
| Silent policy failure | Imitation policy fails without alarm | WM-based failure detection (flow matching on nominal dynamics) | [B050] |
| Automation bias / over-trust | Authoritative predictions miscalibrate human trust; "predictive safety illusions" | Uncertainty display; audit tools; human gating | [R-11; R-49] |

**General mitigations** [LS]: uncertainty-aware planning, receding-horizon control, domain randomisation, continual updating, residual learning with classical planners, **shadow-mode testing**, **safety envelopes**, **verify-before-act** checks.

---

## 14. Why healthcare is a distinct world

| Characteristic | Consequence for architecture | Source |
|---|---|---|
| Partial observability; patient state is latent | Belief state; observation correction only when measured | [B004; B038; B066] |
| Irregular, asynchronous, multi-rate sampling; **informative missingness** | Native timestamps, availability masks, measurement age; continuous time; never treat unmeasured as zero | [A04; B007; B071; B074] |
| Confounded observational actions | Causal design; identification assumptions; sign constraints | [B026; A12; A13; B039] |
| Heterogeneous action semantics (treatment vs acquisition vs operational) | Typed action ontology; separate observation-changing from physiology-changing actions | [A08; A11; B046] |
| Multimodality (imaging, EHR, signals, text, omics, video) | Fusion into shared state; typed decoders | [B030; B054; B062; B068] |
| Multiple time and spatial scales (ms → decades; molecule → population) | Hierarchical / multiscale states; pluggable dynamics backends | [A18; 024] |
| Small cohorts for many tasks | Self-supervised pretraining, hybrid models, compact WMs | [007; B101] |
| Very large data for some tasks (EHR at scale) | Scaling laws for event models | Curiosity: Epic Cosmos 16.3 B encounters, 300 M patients, 310 health systems [B032] |
| High stakes; irreversible harms | Safety constraints, abstention, human oversight, prospective evidence | [013; 036; A18] |
| Privacy; identifying trajectories | Federated training; memorisation audits; de-identification | [038; A18] |
| Regulation of decision software | Intended use, evidence tiers, lifecycle change control | [A18; 095] |
| Clinician reasoning culture (skepticism, pathophysiology) | Inspectable assumptions; mechanistic grounding | [006; 083; 080] |


---

## 15. Medical world models: capability ladder and evidence ladder

### 15.1 Capability ladder (functional claim)

| Level | Name | Definition | Typical evidence | Examples |
|---|---|---|---|---|
| L0 | State representation only | Learns a state/representation inspired by WM objectives; no temporal or action rollout evaluated | Linear probing, transfer | X-WIN, Xray2Xray, CheXWorld, DALE-CT, EchoJEPA, Brain-JEPA, GazeWorld [B001–B003; B005; B008; B006; B012] |
| L1 | Temporal prediction | Forecasts state evolution with actions marginalised or fixed to observed care | Forecast accuracy | Longitudinal imaging (TFM, CRONOS, BrLP, ImageFlowNet, ProgFormer) [B013; B014; B018; B022; B025]; event models [B032; B081; A15] |
| L2 | Action-conditioned prediction | Transition conditioned on specified actions | Accuracy under recorded actions; response direction | EHRWorld [A03], Brain-WM [A05], ECG-WM [B027], respiratory-support dynamics [B069] |
| L3 | Counterfactual comparison | Compares rollouts under alternative action sequences for decision support | Identification assumptions + trial/mechanism agreement | CaMeWM [B039], G-Transformer [A12], HealthFormer [B099], counterfactual timelines [B102] |
| L4 | Planning / control | Optimises action sequences or learns a policy using the WM | Closed-loop task success; off-policy value; real-robot trials | medDreamer [A04], SepsisAgent [A07], EHR-MPC [B092], TD-MPC2 endovascular [B049; B051; B105], surgical WAMs [B060; B061] |

Each step up adds assumptions that **cannot be verified from predictive accuracy under observed care alone** [A18]. Surveys report that most systems sit at L1–L2, with fewer at L3 and rare L4 [B056]. A18's own caveat is that L1–L4 do not capture all distinctions, such as therapeutic vs non-therapeutic actions or world-*action* models [A18].

### 15.2 Evidence / clinical-readiness ladder (a separate axis)

**Functional capability must stay distinct from clinical evidence maturity** [A18].

| Stage | Description |
|---|---|
| R0 Concept / position | Framework or perspective; no implementation [006; 013; 024; 080; 083] |
| R1 Technical feasibility (synthetic / simulated) | Synthetic testbeds, simulators, phantoms [B091; B066 planning comparison] |
| R2 Retrospective internal validation | Single-dataset split |
| R3 Retrospective external / multi-site validation | Held-out sites, cohorts, populations |
| R4 Expert / reader evaluation | Clinician rating, plausibility pyramids, reader studies [B059] |
| R5 Prospective silent / shadow mode | Run alongside care without affecting it |
| R6 Prospective interventional / feasibility | Real-world feasibility (e.g., online adaptive proton-therapy feasibility [B073]; real-robot trials [B051; B061]) |
| R7 Randomised / comparative effectiveness | RCT or quasi-experimental evidence of patient benefit |
| R8 Regulated deployment & post-market monitoring | Cleared/approved product with lifecycle governance; purpose-restricted acceptance, e.g., UVA/Padova simulator [A18; B082] |

ML technology readiness levels [095] give a complementary engineering view (research → proof of concept → system development → deployment → monitoring).

### 15.3 Composition patterns (how components are wired)

| Pattern | Description | Example |
|---|---|---|
| Serial pipeline | Explicit hand-offs: proposer → simulator → evaluator | MeWM: VLM policy proposes treatments, tumour generator simulates, survival model scores [A01; A17] |
| Shared state-space | One latent state serves many readouts and decisions | PatientWM unified state + typed decoders [B030]; Saga [B068]; Brain-WM Y-shaped MoT [A05] |
| Closed-loop simulator | Planner/agent repeatedly queries the simulator and re-plans | SepsisAgent [A07]; EHR-MPC [B092]; PulmoWorld Cap-MBRL [B066] |
| Patient → system composition | A frozen patient model drives operational scenarios (beds, queues) | ICU health-system simulation [A11] |

---

## 16. Healthcare world-model families: the local literature side by side

### 16.1 Overview of families

| Family | What it contributes | Representative papers |
|---|---|---|
| F1 Representation / anatomical state | Self-supervised state geometry (3-D-aware CXR, CT slice trajectories, echo, brain, endoscopy, radiologist gaze, CT + language hidden state) | B001, B002, B003, B004, B005, B006, B008, B011, B012, B054, B100, B101 |
| F2 EHR / ICU event & latent patient dynamics | Timed events, multimodal history, persistent state, autoregressive or latent transitions | A03, A04, A06, A11, B010, B029, B030, B032, B055, B062, B063, B066, B068, B071, B074, B081, B083, B085, B098, B103, A15 |
| F3 Longitudinal imaging & treatment response | Future anatomy/lesion under time and treatment | A01, A02, A05, B013, B014, B015, B017, B018, B019, B020, B021, B022, B023, B025, B039, B076 |
| F4 Physiological signals & interventions | Vital-sign/ECG/wearable dynamics under drugs, ventilation, behaviour | B026, B027, B028, B064, B069, B099, B106, B089 |
| F5 Mechanistic / hybrid digital twins | ODE/PDE physics, PK/PD, transport, closures, agentic structure discovery | 021, 045, 059, B067, B070, B072, B073, B079, B084, B086, B088, B091, B093, B095, B082, A14, A16, A20 |
| F6 Causal patient trajectories | Counterfactual estimands, dynamic regimes, intervention-conditioned twins | A12, A13, B075, B080, B096, B097, B102, B046 |
| F7 Acquisition / ultrasound guidance | Probe-motion → view dynamics; belief registration | A08, B009, B024, B040, B041, B042, B043, B044, B045 |
| F8 Surgical simulation & world-action models | Action-conditioned surgical video/skeleton/Gaussian forecasting; policy learning & evaluation | A09, A10, B033, B034, B035, B036, B037, B047, B048, B050, B052, B057, B058, B059, B060, B061, B065, B077, B078, B087, B104 |
| F9 Endovascular control | TD-MPC2 world-model navigation across patient vasculatures | B049, B051, B105 |
| F10 Ophthalmic & neuro dynamics | Ocular state; visual acuity twins; stimulus-conditioned brain states | B038, B094, B089 |
| F11 Population & health-system | Policy simulation; resource and queue simulation | B053, A11, 092, 093 |
| F12 WM-coupled agents & policies | WM as tool for an LLM agent or RL policy | A07, A04, B092, B090, 088, B096 |
| F13 Verification, semantics & audits | Observation timing, personalisation, action bundles, plausibility, failure detection | B007, B016, B046, B050, B059, A19 |
| F14 Surveys & taxonomies | Field maps, capability rubrics | A17, A18, B056, A16, 045, 039 |

### 16.2 Side-by-side architecture table (selected primary systems)

| ID | System | Domain | State | Action | Dynamics | Planner/use | Level | Key evidence / caveat |
|---|---|---|---|---|---|---|---|---|
| A01 | MeWM | Oncology (liver tumour, TACE) | Imaging (perception → state) | Treatment plans proposed by VLM policy | Tumour progression generative model | "Inverse dynamics" survival analysis on simulated post-treatment tumour selects the plan | L3–L4 (serial) | Radiologist Turing tests; +13% F1 for interventional physicians selecting the optimal TACE protocol (second-reader use); retrospective; realism ≠ benefit |
| A02 | CLARITY | Oncology | Latent image state + clinical/time context | Treatment | Treatment-conditioned latent dynamics | Survival-aware therapy refinement | L3 | Irregular follow-up; causal assumptions needed |
| A03 | EHRWorld | Inpatient EHR | Patient-centric state | Inquiries, medications, procedures | LLM causal sequential generator | Simulation | L2 | LLMs without trajectory training drift; EHRWorld-110K dataset |
| A04 | medDreamer | ICU EHR | Latent; adaptive feature integration for irregular/missing data | Treatments | Latent WM | Two-phase policy learning in imagination | L4 | Offline evaluation ≠ survival gain |
| A05 | Brain-WM | Glioblastoma | Shared latent | Treatment as dynamic decision variable | Y-shaped Mixture-of-Transformers + flow-based MRI generation | Next-treatment prediction | L2 | Agreement ≠ superiority |
| A06 | ChronoMedicalWorld | CKD | Joint-embedding state | Structured + free-text communication actions | Recurrent latent transition; physiology-aware rollout losses | Simulation | L2 | One CKD cohort |
| A07 | SepsisAgent | ICU sepsis | Clinical WM state | Fluids / vasopressors | Learned clinical WM | LLM propose–simulate–refine; 3-stage curriculum | L4 | MIMIC-IV off-policy only; WM access alone inconsistent |
| A08 | EchoWorld | Echo acquisition | Masked anatomy + visual-motion history | Probe motion | Pre-training predicts masked anatomy and visual outcome of probe adjustments | Motion-aware attention for guidance | L2–L4 (acq.) | >1 M images from >200 routine scans; code public; acquisition ≠ treatment |
| A09 | Surgical Vision WM | Surgery | Video latent | Latent actions from unlabeled video | Action-controllable generation | Simulation | L2 | Latent ≠ executable actions |
| A10 | SAW | Surgery | Video | Language, reference scene, tissue mask, 2-D tool-tip trajectory | Video diffusion + depth consistency | Data generation | L2 | Not closed-loop control |
| A11 | ICU patient WM for health-system simulation | ICU operations | Frozen EHR patient dynamics | Capacity / dispatch controls | Neural + scenario mappings to calendars/queues | Operational scenarios | L2–L3 (ops) | Agrees with Markov/semi-Markov baselines on direction |
| A12 | G-Transformer | Causal | Covariate history | Dynamic time-varying regimes | Transformer + Monte Carlo g-computation | Regime comparison | L3 | Identification assumptions |
| A13 | Causal Transformer | Causal | Covariates / treatments / outcomes streams | Treatments | 3 Transformer subnetworks + balancing | Counterfactual outcomes | L3 | Estimator, not full WM |
| A14 | GlyTwin | T1D | Patient-specific glucose twin | Patient-centric behavioural/treatment modifications | Twin + counterfactual explanation | Patient-centric recommendations | L3 | Read methods before causal claims |
| B026 | PhysioWorld (sign-constrained) | ICU vitals | Latent | Drugs | WM + pharmacological sign constraints | Simulation | L2–L3 | OOD dosing robustness |
| B027 | ECG-WM | Cardiac EP | Latent ECG | Drugs | Latent diffusion + physiological ODE priors (energy) | Simulation | L2 | Physiology-informed |
| B029 | Action-conditioned EHR WM | EHR | Latent patient state | Clinical actions (separated from states) | State-dependent linearisation predictor | Multi-step rollout | L2 | — |
| B030 | PatientWM | EHR multi-dataset | Unified patient state; availability-aware encoders | Supplied actions | Conditioned on ordered state–action history | Typed decoders | L2 | Generalisable state claim |
| B032 | Curiosity | EHR events at scale | Event sequence | — | Decoder-only Transformer (scaling study) | Forecasting | L1 | 118 M patients pretraining from Epic Cosmos |
| B039 | CaMeWM | Liver tumour post-TACE | Tumour/latent | Supported regimens | Causal treatment-conditioned generator | Intervention-to-decision loop | L3 | Small cohort; two regimens; no external/prospective validation |
| B046 | Treatment-bundle audit | ICU | — | Ventilator/dialysis bundles | Clinical WM | Counterfactual editing | Audit | Bundle edits move predictions more than single edits |
| B049/B051/B105 | TD-MPC2 endovascular | Thrombectomy | Latent | Guidewire/catheter control | TD-MPC2 | MPPI + value | L4 | Simulation across 10 patient vasculatures; PEF 74% vs SAC 37% success [B049] |
| B057 | Cosmos-H-Dreams | Surgical robotics | Video latent | Robot actions | Action-conditioned generative model, distilled, real-time streaming | Policy evaluation | L2–L4 | Sim-to-real agreement varies by task |
| B058 | SWoMo | Cataract surgery | Scene graphs + rules | Surgical actions | Neuro-symbolic simulator | Simulation | L2 | OOD scenarios via symbolic rules |
| B063 | ICare-DT | ICU | Latent updated hourly | — | Transformer twin | Continuous forecasting | L1 (+update) | 140,473 eICU stays; later forecasts beat own early forecasts; withhold/swap controls |
| B066 | PulmoWorld | Pneumonia | Belief via history-aware filtering | Treatments | Recursive simulation; propagate vs observation-correct | Cap-MBRL in imagination | L4 | Planning comparison on known-mechanism synthetic environments |
| B067 | DuoPIC | Stroke perfusion | Voxel physiology | — | Windkessel + tracer-transport PDE + neural closure; tempered posterior | Estimation | Twin | Conservation by construction |
| B068 | Saga | Multimodal patient | Shared state | — | Event + time generation appended and re-encoded; image generation | Forecasting | L1–L2 | 461,370 patients |
| B072 | APOD | Pharmacology | Population ODE | Dosing | LLM agent discovers population ODEs | Twin construction | Twin | Open-ended model discovery |
| B092 | EHR-MPC | Sepsis | Generative EHR twin | Treatments | Generative EHR model | Inference-time MPC | L4 | Decouples dynamics from objective |
| B096 | TE + DT + RL CDSS | Treatment response | Patient DT | Treatments | DT simulation + TE estimation | RL + rule-based safety + disagreement review | L4 | Continuous-learning loop |
| B097 | UC predictive control | Ulcerative colitis | Discrete disease states | Therapy at visits | Event-based controlled CTMC | Predictive control | L4 | Interpretable stochastic control |
| B099 | HealthFormer | Human physiology | 667 measurements, 7 domains | Interventions (medication, behaviour) | Decoder-only generative Transformer | Intervention simulation | L3 | >15,000 individuals; compared with 41 RCT comparisons and a held-out nutrition trial |
| B102 | Counterfactual timelines | Inpatient (COVID-19) | Timeline | Covariate modifications | Autoregressive generator (300 K patients, 400 M entries) | Counterfactual simulation | L3 | Clinical plausibility validation |

### 16.3 Cross-cutting lessons that should shape any healthcare WM

1. **Make the patient state reusable, but keep clinical readouts typed** (unified state + typed decoders). Do not define the state around one disease score [B030; B068; B062].
2. **Treat the observation process as part of the model.** Keep native timestamps, availability, measurement age and acquisition metadata. An unmeasured value is not a measured zero [B066; B007; B071; A04].
3. **Do not use one undifferentiated action vocabulary.** Distinguish treatment, acquisition, procedural, operational and behavioural actions. Capture units, route, timing, duration, co-interventions, allowed ranges and **bundles** [B046; B042; A11; A06].
4. **Action conditioning ≠ causal identification.** Add sign constraints, g-computation, supported-regimen restriction and explicit estimands [B026; A12; B080; B039].
5. **Use multiple dynamics backends behind a common contract.** Event Transformer, recurrent latent, neural ODE/SDE, mechanistic or hybrid, chosen by time scale and question [B072; B079; A18].
6. **Keep the planner replaceable.** Support imagined RL, MPC and clinician-supplied candidate comparison [A04; A07; B092].
7. **Validate the simulator against the decision, not just the image.** Report sim-to-real agreement, single-transition vs long-horizon scope, and synthetic-environment boundaries [B057; B039; B066].
8. **Personalisation must be demonstrated, not assumed** (P³ audit; history withhold/swap) [B016; B063].
9. **LLMs need trajectory-grounded training or a coupled simulator.** Knowledge alone does not produce consistent state evolution [A03; A06; A07; B055].
10. **Hybrid mechanistic–learned dynamics** constrain extrapolation and give inspectable mechanisms; they can now be discovered agentically [B027; B067; B072; B095; A18].
11. **Latent prediction beats reconstruction for decision-relevant state**, especially for noisy modalities and small cohorts [B008; B100; B101].
12. **Real-time interactivity requires distillation and causal (streaming) students** [B033; B057].
13. **Scaling works for event models,** but unconditional realism can fail to separate a model from trivial baselines; conditional, intervention-response tests matter [B032; B083].

---

## 17. Supporting components from the original numbered collection

Most of the 86 numbered papers are **not** world models. They still supply components, safety layers and governance knowledge that a healthcare WM needs. Scope decisions follow the existing screening in `Papers/Recommended_Additions/Healthcare_World_Model_Literature_Review.md`.

| Blueprint need | Papers | Knowledge contributed |
|---|---|---|
| Hybrid mechanistic + learned patient dynamics | 021, 045, 059, 027, 062, 070 | Glucose–insulin hybrid twin and dosing [021]; physics→data-driven cardiovascular twins and data assimilation [045]; structured neural ODE PK for precision dosing with uncertainty-calibration limits [059]; therapeutic-response transformer with adherence [027]; CRC immunotherapy mechanistic twin perspective [062]; PINN background [070] |
| Planning under uncertainty | 088, 019, 067 | Latent disease dynamics + RL + constraint-enforcing optimisation (PRIME-Care) [088]; Bayesian–XAI multi-objective decisions in dynamic systems [019]; actor–critic RL label alone ≠ WM [067] |
| Belief state / probabilistic fusion | 009, 060, 020, 026, 053, 044, 029, 037, 034 | Bayesian networks with missing observations for triage [009; 060 overlap]; NLP + Bayesian network CDSS [020]; ontology + probabilistic context (SMILE) [026]; hybrid sensor/ontology/Bayesian [053]; LLM-integrated Bayesian SSM [044] |
| Uncertainty, calibration, abstention | 003, 010, 012, 015, 022, 032, 043, 074, 082, 089, 094, 098, 025, 051, 046, 065 | Bayesian DL; entropy-guided abstention [012]; rejection [022]; uncertainty governance layer for LLM CDS [015]; conformal [032]; GP [074]; aleatoric + epistemic in one model [082]; UQ review [098] |
| Measurement error / observation model | 008, 066 | Bayesian correction of measurement error in health data [008; 066] |
| Personalisation, small data, digital phenotyping | 007 | Small-data individual forecasting in psychiatry |
| Data infrastructure, privacy, synthetic data | 038, 016, 030, 050, 063, 048 | Open-source federated platform with FHIR harmonisation (GenoMed4All) [038]; synthetic data tools and privacy trade-offs [016; 030; 050; 063]; distributed learning [048] |
| Multi-agent / agentic orchestration | 001, 002, 014, 097 | NetLogo multi-agent simulation with biosensors [001]; agentic information fusion [002]; cardiovascular agents, from assistance to autonomy [014]; adaptive trust metrics for multi-LLM systems [097] |
| Safety, ethics, trust, risk | 013, 036, 056, 091, 006, 083, 080 | Risk-averse "fear" framework [013]; ethical firewall with provable explainability [036]; risk tiering of operational AI (CORTEX) [056]; Trust-Aware XAI index [091]; structured skepticism as meta-regulation [006]; pathophysiology-grounded critical-care reasoning [083]; population statistics vs individual care [080] |
| Security | 018, 028, 035, 068 | IoMT attack detection [018]; adversarial NLP and policy [028]; crypto/blockchain data protection [035]; IoT security quantification [068] |
| Readiness and reporting | 095, 085 | Technology readiness levels for ML [095]; trial efficacy analysis methods [085] |
| Multimodal smart-health & digital-twin background | 039, 047, 031, 054, 096, 057, 024, 040, 093, 092, 087, 049, 075, 077 | Sense–Map–Generate–Act DT + generative AI taxonomy [039]; multimodal smart-health survey [047]; exposome multiscale brain health [024]; virtual cells [040]; syndemic modelling + AI [093]; population burden fusion [092] |
| Static prediction (out of WM scope, used as contrast) | 005, 010, 033, 042, 058, 073, 076, 079, 099, 084, 004, 011, 017 | Illustrate the "static label" paradigm WMs aim to go beyond |

---

## 18. Safety, security, governance and regulation

### 18.1 World-model-specific risks

| Layer | Risk | Source |
|---|---|---|
| Data / training | Poisoned training data; poisoned latents; supply-chain attacks | [R-11; R-49] |
| Representation / grounding | Sensor spoofing; corrupted state grounding; adversarial examples | [R-49] |
| Dynamics / rollout | Exploited compounding rollout errors; **trajectory-persistent adversarial attacks**; trajectory manipulation | [R-11; R-49] |
| Sim-to-real | Weaponised or accidental sim-to-real gap | [R-11] |
| Alignment | WM-equipped agents can simulate consequences, which raises the risk of goal misgeneralisation, deceptive alignment and reward hacking | [R-11] |
| Human layer | Automation bias, miscalibrated trust, long-horizon "planning hallucinations" users cannot audit | [R-11] |
| Memory / tools | Long-term adaptation via memory and tools opens prompt-injection and feedback-poisoning paths | [R-49] |
| Duality | WMs can be **runtime safety shields**, but when compromised or over-trusted they create **predictive safety illusions** | [R-49] |
| Privacy | Longitudinal multimodal trajectories are highly identifying; generated data may memorise | [A18] |

**Defences across the lifecycle** [R-49]: provenance; robust grounding; uncertainty-aware prediction; **trajectory gating**; feedback auditing; deployment assurance. Threat-model resources include MITRE ATLAS and the OWASP LLM Top 10 [R-11].

### 18.2 Safety architecture patterns

1. **Human-gated LLM/WM-in-the-loop; planner-of-record; runtime assurance envelopes** [R-5].
2. **Rule-based contraindication blocking**, plus routing of cases with strong internal model disagreement to clinicians [B096].
3. **Abstention** when uncertainty or lack of action support is high [012; 022; 015].
4. **Failure detection** with a world model of nominal dynamics [B050].
5. **Shadow-mode testing, safety envelopes, verify-before-act** [LS].
6. **Governed capability evolution**: lifecycle compatibility checking and rollback [LS-162].
7. **Ethical firewalls / risk-averse objectives / risk tiering** [036; 013; 056].
8. **Clinician oversight preserving clinician responsibility** [A18; 083].

### 18.3 Regulatory and reporting frameworks to record

The extraction sheet records any framework a paper names. Frameworks that appear in the corpus (keyword scan of local full texts) or are directly relevant:

| Category | Frameworks |
|---|---|
| Privacy / data protection | HIPAA (US), GDPR (EU), de-identification standards |
| Medical-device / AI regulation | US FDA (SaMD; AI-enabled device software functions; predetermined change control plans), EU AI Act (high-risk AI), EU MDR/IVDR, IMDRF SaMD risk categorisation |
| Quality & safety standards | ISO 14971 (risk management), IEC 62304 (software lifecycle), ISO 13485 (QMS), IEC 61508 / ISO 26262 / ISO 21448 functional safety (cited in industrial WM survey [R-5]) |
| Reporting & appraisal guidelines | TRIPOD+AI, CONSORT-AI, SPIRIT-AI, DECIDE-AI, CLAIM, STARD-AI, MI-CLAIM, FUTURE-AI [A18] |
| Ethics | IRB / ethics committee approval; informed consent / waiver |
| Simulator precedent | Purpose-restricted regulatory acceptance of the UVA/Padova T1D simulator for specific pre-clinical uses [A18; B082] |
| Engineering readiness | ML Technology Readiness Levels [095] |

Keyword scan of the local corpus: GDPR was mentioned in 19 papers, HIPAA in 10, FDA in 14, EU AI Act/MDR in 9, TRIPOD/CONSORT-AI/DECIDE-AI-type guidelines in 9, IRB/ethics approval in 35. Regulation is discussed far more in the original numbered collection than in the world-model papers, which is itself a **research gap** (see `concept_frequency.csv` in the session artifacts).

---

## 19. Recommended healthcare world-model blueprint

This section is a **synthesis** for your architecture design. It is not a validated model. Its intended contribution is an implementable composition contract plus evidence gates, beyond the established idea of combining perception, dynamics and planning [A17; A18].

### 19.1 Module contracts

| Module | Responsibility | Required contract (inputs → outputs) | Best default (rationale) | Alternatives (when) | Evidence obligation |
|---|---|---|---|---|---|
| M1 Data adapters & provenance | Ingest EHR, imaging, signals, text, omics, video | Raw sources → time-stamped, unit-normalised observations with availability masks, measurement age, device/site, consent and provenance | Native-clock event stream + FHIR/OMOP mapping (keeps observation process) [B007; 038] | Fixed grid only after an EndoClock-style audit shows no evidence loss | Leakage checks across patient/site/time; terminology and unit validity |
| M2 Encoders | Modality-specific perception | Observations → embeddings | Self-supervised **latent-predictive (JEPA-style)** pretrained encoders; availability-aware fusion [B008; B010; B030] | Reconstruction/MAE when pixel-level output is the product; frozen foundation encoders (V-JEPA 2.1, LLM-as-encoder) [B041; B010] | Missing-modality tests; robustness to acquisition shift |
| M3 Belief-state service | Maintain the patient state | `initialize(history)`, `assimilate(state, observation)` → posterior state + uncertainty | **Stochastic + deterministic latent (RSSM-style) with propagate/correct filtering**, conditioned on ordered state–action history [LS; B066; B030] | Explicit physiological state for mechanistic twins; scene graphs for acquisition [B042]; discrete states for CTMC control [B097] | State-sufficiency ablations; history-swap; P³ personalisation audit [B016] |
| M4 Action service | Typed, schedulable interventions | Action ontology → validated action schedule (type, agent, dose, units, route, timing, duration, bundle, valid ranges) | **Hierarchical clinical action ontology**: intent → regimen → parameters; bundle-aware editing; separate acquisition / treatment / operational / behavioural actions [A18; B046] | Latent actions learned from unlabeled video (surgery), grounded later [A09; B065] | Contraindication checks; historical support (positivity); explicit assumptions |
| M5 Dynamics adapter (pluggable) | Predict next-state distributions | `simulate(state, action_schedule, Δt)` → distribution of next states | **Hybrid**: learned latent transition + mechanistic/sign constraints where known [B026; B027; A18] | Event Transformer (EHR at scale) [B032]; neural ODE/SDE or flow matching (irregular continuous time) [B074; B071; B013]; diffusion/flow (imaging) [B023; B020]; mechanistic PDE/ODE (PK/PD, perfusion) [B067; B079]; CTMC (chronic visit-based control) [B097] | One-step + free-running multi-step accuracy; mechanism respect under changed actions |
| M6 Rollout service | Generate futures | State + schedule + horizon → N sampled trajectories, observation projections, uncertainty, supported horizon | **Closed-loop rollouts with re-assimilation; report effective horizon at tolerance** [LS; A19] | Open-loop long rollouts only with drift reporting | Error vs horizon; calibration; competing outcomes; extrapolation flags |
| M7 Outcome & causal layer | Turn trajectories into clinical quantities | Trajectories → outcomes, utilities, estimands, identification assumptions | Explicit estimand + g-computation/target-trial framing; sign/mechanism constraints; supported-regimen restriction [A12; B039] | Purely associational readouts for L1–L2 claims | External validation; positivity; confounding sensitivity; RCT/mechanism agreement [B099] |
| M8 Planner (replaceable) | Recommend or compare actions | Objective + constraints + preferences → ranked candidates or policy, with abstention | **Clinician-supplied candidate comparison + short-horizon MPC** with uncertainty penalties [LS; B092] | Imagined actor–critic (Dreamer/medDreamer) for high-volume settings; TD-MPC2 for robotic control; LLM agent propose–simulate–refine for language interfaces [A04; B051; A07] | Credible baselines; model-exploitation tests; off-policy ≠ prospective |
| M9 Safety & governance layer | Guard actions and outputs | Candidate actions/trajectories → allowed/blocked/escalated + audit log | Rule-based contraindications + uncertainty/disagreement gating + human approval for any clinical action [B096; R-5] | Runtime assurance envelopes; failure detectors [B050] | Red-teaming; security threat model [R-11; R-49] |
| M10 Clinician interface & lifecycle | Explain and govern | Assumptions, alternative futures, uncertainty, decisions, overrides, monitoring | Inspectable trajectories and assumptions; override capture; drift monitoring; change control | — | Workflow feasibility; prospective utility; revalidation after every change |

**Minimal common API** (each module also declares its population, schemas, units, time resolution, training support, uncertainty semantics and validated horizon) [DOMAIN_SYNTHESIS; A17]:

```python
state = wm.initialize(history)                       # M3
state = wm.assimilate(state, observation)            # M3 (only when observed)
trajs = wm.simulate(state, action_schedule, horizon) # M5 + M6 (returns distributions)
score = wm.evaluate(trajs, objective, constraints)   # M7 (+ M8 for ranking)
```

A compatible signature is **not enough**. A composed system needs **fresh validation of the composition**, not only of its parts.

### 19.2 "What is best" — decision guide by setting

| Setting / data | Recommended state | Recommended dynamics | Recommended planner | Key safeguard |
|---|---|---|---|---|
| ICU time series, drugs/ventilation (MIMIC/eICU) | Belief latent with availability masks; ordered state–action history | Latent recurrent/Transformer + pharmacological sign constraints; bundle-aware actions | MPC over candidate bundles; offline MBRL with uncertainty penalty | Positivity checks; OOD dosing; clinician gating |
| Longitudinal EHR at population scale | Event-sequence state + latent summary | Autoregressive event model with continuous time heads; or flow matching conditioned on history | Counterfactual timeline comparison (L3) | Target-trial emulation; trivial-baseline tests [B083] |
| Oncology imaging + treatment | Latent image state + clinical/time context | Treatment-conditioned latent diffusion/flow; mechanistic tumour growth hybrid | Candidate comparison with survival/response evaluator | Supported regimens only; external cohort |
| Chronic disease, sparse visits | Low-dim interpretable states | CTMC / transition-based twin / neural ODE | Predictive control at visits | Uncertainty growth with gaps |
| Dosing / PK-PD | Explicit compartments + latent residual | Mechanistic ODE + neural closure; agentic structure discovery | Constrained optimisation | Calibration of uncertainty [059] |
| Ultrasound / acquisition | Scene graph or latent view + pose | Action-conditioned (probe) predictor | Receding-horizon or retrieval planning | Acquisition ≠ treatment |
| Surgical robotics | Latent video / skeleton / Gaussian states | Action-conditioned video WM distilled to causal real-time student; neuro-symbolic for OOD | WAM / TD-MPC2 / policy evaluation in WM | Sim-to-real policy agreement; failure detection |
| Health-system operations | Frozen patient model + operational state | Scenario adapters to queues/resources | Scenario comparison | Do not infer physiological effects |
| Population policy | Spatio-temporal regional state + knowledge graph | Knowledge-guided spatio-temporal WM | Policy optimisation | Counterfactual assumptions [B053] |

### 19.3 Design rules (condensed "best practice")

1. Predict in **latent space**; decode only where outputs must be inspected.
2. Make the state **reusable, uncertain and history-aware**; prove sufficiency and personalisation.
3. Model the **observation process** explicitly.
4. Use **typed, hierarchical, bundle-aware actions** with units and timing.
5. Prefer **hybrid mechanistic–learned dynamics** wherever mechanisms are known.
6. Separate **capability level (L0–L4)** from **evidence stage (R0–R8)** in every claim.
7. Plan **closed-loop, short-horizon**, with uncertainty penalties and abstention.
8. Treat **causal identification** as a declared module with assumptions, not a property of the network.
9. Evaluate across **E1–E15**, especially multi-step rollout, calibration, action sensitivity, personalisation and decision quality.
10. Wrap the WM in **safety, security, privacy and lifecycle governance**; keep the clinician in charge.

---

## 20. Open problems and research gaps

| Gap | Description | Source |
|---|---|---|
| Definition gap | No rigorous definition separating WMs from latent dynamics models, simulators, predictive models and belief states | [LS] |
| Component taxonomy | Need standard interfaces for perception, latent state, transition, decoder, reward/value, uncertainty, planner | [LS] |
| Backbone ablations | Controlled RNN / Transformer / S4 / S5 / Mamba / explicit-memory comparisons | [LS] |
| Reconstruction vs control | Benchmark the trade-off | [LS; W-8] |
| Causal-validity benchmarks | Counterfactual accuracy, intervention robustness, planner exploitability; community benchmarks with known ground truth for L3–L4 | [LS; A18] |
| Sim-to-real | Contact-rich, safety-critical, long-horizon evaluation | [LS; B057] |
| Memory scaling | Unsolved | [LS] |
| Under-specified action spaces & safety constraints | Common across medical WMs | [B056] |
| Weak interventional validation | Few L3–L4 claims with causal evidence | [B056; A17] |
| Incomplete multimodal state construction | States omit determinants of transitions | [B056; A17] |
| Trajectory-level uncertainty calibration | Rarely evaluated | [B056] |
| Data infrastructure | Need records linking (s_t, a_t, Δt) → s_{t+1} with dose/timing; FAIR data | [A17] |
| Multiscale / continuous-time states | Composition of hierarchical states across time and space | [A18] |
| Hierarchical clinical action ontologies | Intent → regimen → parameters | [A18] |
| WMs as substrates for clinical agents | Grounding LLM agents in action-conditioned dynamics | [A18; A07] |
| Privacy & federation | Fragmented trajectories across institutions; memorisation | [A18] |
| Prospective evaluation & lifecycle governance | Few prospective or randomised studies; change control; monitoring | [A18] |
| Security of WMs | Lifecycle threat models and defences | [R-11; R-49] |
| Regulation under-discussed in WM papers | Regulatory frameworks rarely cited by WM papers (Section 18.3) | Corpus scan |
| Personalisation proof | Accuracy does not show that patient history drives prediction | [B016] |
| Observation-clock evidence loss | Synchronisation can erase task-relevant evidence | [B007] |

---

## 21. How this document maps to the extraction sheet

`Healthcare_World_Model_Extraction_Sheet.xlsx` (same folder) operationalises this document as 182 columns in 22 groups. `Healthcare_World_Model_Extraction_Schema.json` gives, for every column, the evidence a paper **must contain** before the column may be filled, where to look, and the value to use when that evidence is absent. Your original agentic-AI columns are kept (group N and others) and extended with world-model-specific fields.

| Column group | Columns | # | Column names |
|---|---|---|---|
| A. Identification & screening | A–M | 13 | Paper ID, Title, Authors, Year, Venue / Journal, Publication status, DOI / URL, Source folder, Local file name, Paper type, Overlap / duplicate flag, Final Included, Exclusion Reason |
| B. Healthcare problem | N–V | 9 | Clinical Domain, Disease / condition, Care setting, Scale of the modelled world, Primary Healthcare Task, Clinical question answered, Target population, Intended user, Decision supported |
| C. World-model identity & capability | W–AH | 12 | Self-described label, World-model family, General WM paradigm, Capability level (L0–L4), Capability level claimed by authors, Has state (Y/N), Has temporal transition (Y/N), Action-conditioned (Y/N), Multi-step rollout (Y/N), Uses rollouts for decisions (Y/N), Complete perception–dynamics–planning loop (Y/N), Composition pattern |
| D. Observation & perception (component 1) | AI–AQ | 9 | Input Modality and Type of Data, Encoder architecture, Pretrained / foundation encoder used, Encoder pretraining objective, Multimodal fusion strategy, Missing-modality / missing-data handling, Irregular sampling handled (Y/N), Observation process modelled (Y/N), Observation-clock audit (EndoClock regime) |
| E. State (component 2) | AR–BA | 10 | State representation type, State dimensionality, Belief / filtering mechanism, Unified / reusable state across tasks (Y/N), State sufficiency tested (Y/N), Personalisation mechanism, Personalisation audit (P³ / history swap), Online updating / assimilation (Y/N), State interpretability, State consistency mechanism |
| F. Action / intervention (component 3) | BB–BH | 7 | Action type, Action representation, Action attributes specified, Treatment bundles handled (Y/N), Action constraints / contraindications, Observation-changing vs physiology-changing actions separated (Y/N), Action grounding |
| G. Dynamics / transition (component 4) | BI–BR | 10 | Model(s) name, Dynamics backbone, Time representation, Time scale & step size, Stochastic transitions (Y/N), Structural / mechanistic priors, Memory mechanism, History / context length, Temporal abstraction / hierarchy, Multiple dynamics backends behind common contract (Y/N) |
| H. Decoders, heads & objectives (component 5) | BS–BX | 6 | Observation decoder / generated outputs, Task readout heads, Reward / value / cost model, Training objective(s), Multi-step training loss (Y/N), Self-supervised pretraining scale |
| I. Model size, openness & compute | BY–CB | 4 | Model(s) size or size range, Open/Closed Models, Training compute reported, Inference latency / real-time capability |
| J. Rollout / imagination | CC–CG | 5 | Rollout mode, Maximum horizon evaluated, Effective / validated horizon, Compounding error measured (Y/N), Number of sampled futures / distributional output |
| K. Planning & decision | CH–CO | 8 | Planning, Planning horizon, Closed-loop re-planning (Y/N), Objective / utility & constraints, Uncertainty used in planning (Y/N), Model-exploitation tested (Y/N), Abstention / deferral (Y/N), Dynamics decoupled from objective (Y/N) |
| L. Uncertainty & calibration | CP–CS | 4 | Uncertainty method, Aleatoric vs epistemic separated (Y/N), Calibration evaluated, OOD / shift detection |
| M. Causality & counterfactuals | CT–CY | 6 | Causal claim level, Causal method, Identification assumptions stated, Positivity / action-support check (Y/N), Counterfactual validation, Sensitivity analysis (Y/N) |
| N. Agentic / LLM integration & autonomy | CZ–DL | 13 | LLM role, Single or Multiagent, If Multi then how many Agents and their roles (if single then type N/A), Memory (agent), Reflection, External API Use, Technology Used (Like RAG, ReACT, Graphs etc), Autonomy Level, Can Call External Systems, Possible Action (Administrative or Clinical), Require System Permissions, Irreversible Action Possible, Human Escalation Available |
| O. Data & evaluation design | DM–DW | 11 | Did their evaluation involve Data?, Dataset name(s), Data source type, Is that Data Publicly available?, Number of Cases (dataset size), Number of sites / institutions, Simulation or Real World, Prospective or Retrospective dataset, Data split strategy, External validation (Y/N), Subgroup / fairness analysis (Y/N) |
| P. Evaluation results by layer (E1–E15) | DX–EK | 14 | E1 One-step fidelity metrics & results, E2 Multi-step rollout metrics & results, E3 Distributional realism metrics, E4 Physical / clinical plausibility, E6 Action / intervention sensitivity, E9 Downstream decision quality, E10 Sim-to-real agreement, E13 Human/SME Evaluation, Number of SMEs, E14 Efficiency / sample efficiency, E15 Clinical utility outcome, Compared with Non-Agentic / non-WM Systems, Compared with other Agentic / WM Systems, Ablations performed |
| Q. Safety, failures & security | EL–EP | 5 | Failures Observed (if none observed type N/A), Safety mechanisms, Security / adversarial considerations, Privacy approach, Automation-bias / trust mitigation |
| R. Regulation, ethics & readiness | EQ–EV | 6 | If they followed any Regulatory Frameworks, (such as HIPAA, EU AI Act etc) name them all, Ethics / IRB approval, Intended-use statement (Y/N), Clinical Readiness Stage, ML Technology Readiness Level, Lifecycle / monitoring plan |
| S. Reproducibility | EW–FA | 5 | Code Available, Code URL, Weights available, Prompts Available, License |
| T. Design-axis scoring (Leapspace five axes & principles) | FB–FK | 10 | DA1 State abstraction – choice, DA2 Uncertainty representation – score, DA3 Memory horizon – score, DA4 Structural bias – score, DA5 Planner interface – score, Principle 1 – latent-space modelling (Y/N), Principle 2 – explicit uncertainty (Y/N), Principle 3 – closed-loop, horizon-limited planning (Y/N), Principle 4 – added structure (Y/N), Principle 5 – evaluated by decision usefulness/robustness/transfer (Y/N) |
| U. Synthesis | FL–FU | 10 | Architecture Description, Main Contribution, Key Findings, Authors Reported Limitations, Authors Reported Future Work, Research Gap Claimed by Authors, Evidence boundary (what is NOT shown), Blueprint module(s) informed, Blueprint lesson (reuse for our architecture), Maps to open problem(s) |
| V. Extraction metadata | FV–FZ | 5 | Extractor, Extraction date, Sections read, Extraction confidence, Notes |

**Coverage proof.** Every principle code in this document maps to at least one column (0 uncovered of 91 codes). Column letters per code:

| Code | Section | Principle / item | Columns |
|---|---|---|---|
| P1 | §5 | Predictive | AB; AC; AE; BW |
| P2 | §5 | Action-conditioned | AD; BB |
| P3 | §5 | Compact latent state | AR; FG |
| P4 | §5 | Decision-sufficient state | AV; EK |
| P5 | §5 | Partial-observability aware (belief state) | AN; AT |
| P6 | §5 | Explicit uncertainty | BM; CG; CP; CQ; FH |
| P7 | §5 | Calibrated | CR |
| P8 | §5 | Useful long-horizon memory | BO; BP; BQ |
| P9 | §5 | Temporal fidelity (irregular / continuous time) | AO; BK; BL |
| P10 | §5 | Structure (objects, discrete, causal, symbolic, physics) | BN; FJ |
| P11 | §5 | Causal validity | CT; CU; CV; CY |
| P12 | §5 | Closed-loop compatible | AF; CC; CI; CJ; FI |
| P13 | §5 | Exploitation-resistant | CL; CM |
| P14 | §5 | Consistent state across rollouts | BA |
| P15 | §5 | Personalised | AW; AX |
| P16 | §5 | Updatable (assimilation / continual) | AY |
| P17 | §5 | Composable / modular | AM; AU |
| P18 | §5 | Efficient for planning | BY; CA; CB |
| P19 | §5 | Interpretable / inspectable | AZ |
| P20 | §5 | Verifiable | CE; CX |
| P21 | §5 | Safe and governed | BF; CN; DK; DL; EM |
| P22 | §5 | Secure and privacy-preserving | EN; EO |
| LS1 | §5 (Leapspace five principles) | Model in latent space for control | FG |
| LS2 | §5 (Leapspace five principles) | Represent uncertainty explicitly | FH |
| LS3 | §5 (Leapspace five principles) | Closed-loop, horizon-limited planning | FI |
| LS4 | §5 (Leapspace five principles) | Add structure (objects, discrete states, causality, symbols) | FJ |
| LS5 | §5 (Leapspace five principles) | Evaluate by control usefulness, robustness, transfer | FK |
| DA1 | §6 | State abstraction | AR; AS; FB |
| DA2 | §6 | Uncertainty representation | BM; CL; CP; FC |
| DA3 | §6 | Memory horizon | BJ; BO; FD |
| DA4 | §6 | Structural bias | BN; FE |
| DA5 | §6 | Planner interface | CH; FF |
| E1 | §13.1 | One-step fidelity | DX |
| E2 | §13.1 | Multi-step rollout / effective horizon | AE; CD; CE; CF; DY |
| E3 | §13.1 | Distributional realism | DZ |
| E4 | §13.1 | Physical / clinical plausibility | EA |
| E5 | §13.1 | Calibration & uncertainty | CR |
| E6 | §13.1 | Action / intervention sensitivity | EB |
| E7 | §13.1 | Counterfactual / causal validity | CX |
| E8 | §13.1 | Personalisation | AX |
| E9 | §13.1 | Downstream decision quality | EC; FK |
| E10 | §13.1 | Sim-to-real agreement | DS; ED |
| E11 | §13.1 | Robustness & transfer (external, OOD, subgroups) | CS; DR; DV; DW; FK |
| E12 | §13.1 | Observation-process audit | AP; AQ |
| E13 | §13.1 | Human / expert evaluation | EE; EF |
| E14 | §13.1 | Efficiency | CB; EG |
| E15 | §13.1 | Clinical utility | EH |
| FM1 | §13.2 | Compounding rollout drift | BW; CF; EL |
| FM2 | §13.2 | Planner exploitation | CM; EL |
| FM3 | §13.2 | Sim-to-real mismatch | CS; ED; EL |
| FM4 | §13.2 | Missing modalities / partial observability | AN; EL |
| FM5 | §13.2 | Weak grounding of actions | BH; EL |
| FM6 | §13.2 | Intuitive-physics failure | EL |
| FM7 | §13.2 | Confounding-reversed effects | EL |
| FM8 | §13.2 | Unsupported action edits (bundles) | BE; EL |
| FM9 | §13.2 | Grid erases event (observation clock) | AP; AQ; EL |
| FM10 | §13.2 | Population-average masquerading as personalisation | AX; EL |
| FM11 | §13.2 | LLM state inconsistency | BA; CZ; EL |
| FM12 | §13.2 | Plausibility gap | EL |
| FM13 | §13.2 | Silent policy failure | EL |
| FM14 | §13.2 | Automation bias / over-trust | EL; EP |
| M1 | §19.1 | Data adapters & provenance | AI; DO; DU; FS |
| M2 | §19.1 | Encoders | AJ; AK; AL; AM; FS |
| M3 | §19.1 | Belief-state service | AG; AT; FS |
| M4 | §19.1 | Action service | BB; BC; BD; BF; CW; FS |
| M5 | §19.1 | Dynamics adapter (pluggable) | AG; BJ; BR; FS |
| M6 | §19.1 | Rollout service | CC; CE; FS |
| M7 | §19.1 | Outcome & causal layer | CW; FS |
| M8 | §19.1 | Planner (replaceable) | AG; CH; CK; FS |
| M9 | §19.1 | Safety & governance layer | BF; CN; DG; DL; EM; FS |
| M10 | §19.1 | Clinician interface & lifecycle | DL; EV; FS |
| C1 | §16.3 | Reusable state, typed readouts | AU; BT; FT |
| C2 | §16.3 | Observation process is part of the model | AN; AP; FT |
| C3 | §16.3 | Typed, bundle-aware action vocabulary | BB; BD; BE; BG; FT |
| C4 | §16.3 | Action conditioning ≠ causal identification | CU; CV; FT |
| C5 | §16.3 | Multiple dynamics backends behind a common contract | BR; FT |
| C6 | §16.3 | Replaceable planner | CH; CO; FT |
| C7 | §16.3 | Validate against the decision, not the image | EC; ED; FT |
| C8 | §16.3 | Personalisation must be demonstrated | AX; FT |
| C9 | §16.3 | LLMs need trajectory grounding or a coupled simulator | CZ; FT |
| C10 | §16.3 | Hybrid mechanistic–learned dynamics | BN; FT |
| C11 | §16.3 | Latent prediction beats reconstruction for decision state | AL; BV; FT |
| C12 | §16.3 | Real-time requires distillation / causal students | CB; CB; FT |
| C13 | §16.3 | Scaling works but conditional tests matter | BX; DZ; FT |
| CL | §15.1 | Capability ladder L0–L4 | Z; AA; CT |
| ES | §15.2 | Evidence / readiness ladder R0–R8 | DT; ET; EU |
| CP | §15.3 | Composition patterns | AH |
| FAM | §7; §16.1 | General and healthcare WM families | X; Y |
| REG | §18.3 | Regulatory, reporting and ethics frameworks | EQ; ER; ES |
| SEC | §18.1 | WM-specific security risks | EN |
| GAP | §20 | Open problems and research gaps | FQ; FU |

---

## 22. Bibliography of all sources used

### 22.1 World Model Principle folder

- **[LS]** *World model architecture and design* (LeapSpace-generated research synthesis), `World Model Principle/Leapspace.pdf`, 26 pp. Reference numbers `[LS-n]` refer to its reference list, including:
  - [LS-1] Hou et al. 2026, World model for robot learning: a comprehensive survey, *IJRR*;
  - [LS-9] Hafner et al. 2019, PlaNet;
  - [LS-12] Sakagami et al. 2023, Robotic world models;
  - [LS-19] Ding et al. 2025/2026, Understanding world or predicting future?, *ACM CSUR*;
  - [LS-20] PILCO;
  - [LS-27] DreamerV2;
  - [LS-34–LS-41] Dyn-O, interactive object-centric WM, VCD, SCM-VAE, discrete codebook WMs, WM backbones (RNN/Transformer/S4), FACTS, EDELINE;
  - [LS-50] Transformer WMs with 100k interactions;
  - [LS-55] Ng et al. 2027, critical review of JEPA, WMs and causal representation learning;
  - [LS-57] PETS;
  - [LS-58] DreamerV3, *Nature* 2025;
  - [LS-59] Ha & Schmidhuber 2018;
  - [LS-60] Friston 2010;
  - [LS-61] Rao & Ballard 1999;
  - [LS-62] Embed to Control;
  - [LS-65] Dreamer;
  - [LS-69] Noori et al. 2026, World models for biomedicine, *Cell*;
  - [LS-77] MuZero;
  - [LS-82] PLM-based WMs for text games;
  - [LS-85] DayDreamer;
  - [LS-91] hierarchical multi-timescale latent dynamics;
  - [LS-95–LS-100] structured inference networks, Neural ODE, Latent ODE, GRU-ODE-Bayes, latent SDE, ODE2VAE;
  - [LS-111–LS-117] slot/object-centric diffusion and causal representation learning;
  - [LS-126] MBPO;
  - [LS-127] MOPO;
  - [LS-130] IRIS;
  - [LS-137] On Memory in WMs;
  - [LS-138] long-term spatial memory for video WMs;
  - [LS-146–LS-148] causal hierarchical RL / temporal abstraction;
  - [LS-162] governed capability evolution;
  - [LS-173] switching classical vs neural planning.
- **response.csv** (`World Model Principle/response.csv`, 50 retrieved references). The 12 judged relevant to world-model principles are cited as `[R-n]` (*n* = `reference_number`). The other 38 (mostly architectural/building design) were screened out as not relevant.

- **[R-2]** Hans-Dieter Burkhard (2002). Real Time Control for Autonomous Mobile Robots. *Fundamenta Informaticae*. doi:10.3233/fun-2002-51301
- **[R-3]** Benedikt Hartl, Léo Pio‐Lopez, Chris Fields, Michael Levin (2026). Remapping and navigation of an embedding space via error minimization: a fundamental organizational principle of cognition in natural and artificial systems. doi:10.48550/arxiv.2601.14096
- **[R-4]** Andrei Furda, Ljubo Vlacic (2010). An object-oriented design of a World Model for autonomous city vehicles. doi:10.1109/ivs.2010.5548138
- **[R-5]** Lorenzo Ricciardi Celsi, James McCann (2026). Beyond Next-Token Prediction: A Standards-Aligned Survey of Autoregressive LLM Failure Modes Deployment Patterns and the Potential Role of World Models. *Electronics*. doi:10.3390/electronics15050966
- **[R-11]** Manoj Parmar (2026). Safety Security and Cognitive Risks in World Models. doi:10.48550/arxiv.2604.01346
- **[R-14]** Eric Dortmans, Teade Punter (2022). Behavior Trees for Smart Robots Practical Guidelines for Robot Software Development. *Journal Of Robotics*. doi:10.1155/2022/3314084
- **[R-19]** Daniel P. W. Ellis (1999). Using knowledge to organize sound: The prediction-driven approach to computational auditory scene analysis and its application to speech/nonspeech mixtures. *Speech Communication*. doi:10.1016/s0167-6393(98)00083-1
- **[R-24]** Kishan Maharaj, Ashita Saxena, Srikanth Tamilselvam (2026). Beyond the Autoregressive Horizon: A Comprehensive Survey of Diffusion Models World Modelling and State Space Models for Code. doi:10.48550/arxiv.2606.23690
- **[R-35]** Kun Xiang, Terry Jingchen Zhang, Yinya Huang, Jixi He, Zirong Liu, Youpeng Wen, Xiuwei Chen, Bingqian Lin, Jianhua Han, Hang Xu, Hanhui Li, Xiaodan Liang (2025). Aligning Perception Reasoning Modeling and Interaction: A Survey on Physical AI. doi:10.48550/arxiv.2510.04978
- **[R-48]** Oscar J. Romero, Angélica de Antonio (2008). Hybrid behaviour orchestration in a multilayered cognitive architecture using an evolutionary approach. doi:10.1109/cec.2008.4630795
- **[R-49]** Fazhong Liu, Zhuoyan Chen, Haozhen Tan, Yan Meng, Guoxing Chen, Haojin Zhu (2026). Security of World-Model-Based Embodied AI: A Lifecycle of Threats Defenses and Evaluation. doi:10.48550/arxiv.2607.28226
- **[R-50]** Somyajit Chakraborty (2026). A Co-Evolutionary Theory of Human–AI Coexistence: Mutualism Governance and Dynamics in Complex Societies. doi:10.21203/rs.3.rs-9749980/v1

### 22.2 Original numbered papers (`Papers/`, 86 PDFs)

- **[001]** Enhancing context-aware SARS disorder management: a proposed multi-agent simulation framework with machine learning and bio-sensor data integration. Abdullah Abdullah, Zulaikha Fatima, Nida Hafeez, Muhammad Ateeb Ather, Rolando Quintero, Grigori Sidorov, et al.. 2026. https://doi.org/10.3389/fmedt.2026.1780837 — file: `Papers/001_2026_Enhancing context-aware SARS disorder management a proposed multi-agent simulation framework with machine learning and bio-sensor data integratio.pdf`
- **[002]** Agentic Artificial Intelligence for Information Fusion. Dawa Chyophel Lepcha, Aaliya Ali, Bhawna Goyal, Shabbir Syed-Abdul, Loveleen Gaur, Ilan Alon, et al.. 2026. https://doi.org/10.4018/joeuc.418738 — file: `Papers/002_2026_Agentic Artificial Intelligence for Information Fusion.pdf`
- **[003]** Bayesian Convolutional Neural Networks in Medical Imaging Classification: A Promising Solution for Deep Learning Limits in Data Scarcity Scenarios. 2023. — file: `Papers/003_2023_Bayesian Convolutional Neural Networks in Medical Imaging Classification A Promising Solution for Deep Learning Limits in Data Scarcity Scenarios.pdf`
- **[004]** The Emergence of Automated Machine Learning (AutoML): Trends and Future Prospects. 2025. — file: `Papers/004_2025_The Emergence of Automated Machine Learning (AutoML) Trends and Future Prospects.pdf`
- **[005]** Machine Learning-Augmented Triage for Sepsis: Real-Time ICU Mortality Prediction Using SHAP-Explained Meta-Ensemble Models. 2025. — file: `Papers/005_2025_Machine Learning-Augmented Triage for Sepsis Real-Time ICU Mortality Prediction Using SHAP-Explained Meta-Ensemble Models.pdf`
- **[006]** Structured Skepticism as a Meta‐Regulatory Architecture in Clinical Reasoning: Toward an Epistemology of Diagnostic Judgment. 2026. — file: `Papers/006_2026_PREPRINT_SSRN_Skepticism as a Meta-Regulatory Tool in Clinical Reasoning Toward a Logic of Medical Knowing.pdf`
- **[007]** Harnessing Small‐Data Machine Learning for Transformative Mental Health Forecasting: Towards Precision Psychiatry With Personalised Digital Phenotyping. Peng Wang, Yiming Shi, Ao Liu, Qingyu Zhu, Irina Albu, Maja Pacholec, et al.. 2025. https://doi.org/10.1002/mdr2.70017 — file: `Papers/007_2025_Harnessing Small‐Data Machine Learning for Transformative Mental Health Forecasting Towards Precision Psychiatry With Personalised Digital Phenot.pdf`
- **[008]** A Hybrid Machine Learning–Bayesian Framework for Correcting Measurement Error in Health Data. 2026. — file: `Papers/008_2026_A Hybrid Machine Learning–Bayesian Framework for Correcting Measurement Error in Health Data.pdf`
- **[009]** Multimodal Bayesian Network for Robust Assessment of Casualties in Autonomous Triage. Szymon Rusiecki, Cecilia G. Morales, Kimberly Elenberg, Leonard Weiss, Artur W. Dubrawski. 2025. https://doi.org/10.48550/arxiv.2512.18908 — file: `Papers/009_2025_Multimodal Bayesian Network for Robust Assessment of Casualties in Autonomous Triage.pdf`
- **[010]** AI-Driven Bayesian Deep Learning for Lung Cancer Prediction: Precision Decision Support in Big Data Health Informatics. 2025. — file: `Papers/010_2025_AI-Driven Bayesian Deep Learning for Lung Cancer Prediction Precision Decision Support in Big Data Health Informatics.pdf`
- **[011]** Bayesian Graphical Models for Multiscale Inference in Medical Image-Based Joint Degeneration Analysis. 2025. — file: `Papers/011_2025_Bayesian Graphical Models for Multiscale Inference in Medical Image-Based Joint Degeneration Analysis.pdf`
- **[012]** Selective Diabetic Retinopathy Screening with Accuracy-Weighted Deep Ensembles and Entropy-Guided Abstention. Jophy Lin. 2025. https://doi.org/10.48550/arxiv.2511.05529 — file: `Papers/012_2025_Selective Diabetic Retinopathy Screening with Accuracy-Weighted Deep Ensembles and Entropy-Guided Abstention.pdf`
- **[013]** Embedding Fear in Medical AI: A Risk-Averse Framework for Safety and Ethics. 2025. — file: `Papers/013_2025_Embedding Fear in Medical AI A Risk-Averse Framework for Safety and Ethics.pdf`
- **[014]** From assistance to autonomy: AI agent systems in cardiovascular medicine—a review of paradigms architectures and clinical translation. Ye Chen, Xiaoqun Qin, Shouping Chen. 2026. https://doi.org/10.3389/fcvm.2026.1838415 — file: `Papers/014_2026_From assistance to autonomy AI agent systems in cardiovascular medicine—a review of paradigms architectures and clinical translation.pdf`
- **[015]** MedBayes-Lite: A Clinical Uncertainty Governance Layer for Risk-Aware Medical Decision Support. 2025. — file: `Papers/015_2025_MedBayes-Lite A Clinical Uncertainty Governance Layer for Risk-Aware Medical Decision Support.pdf`
- **[016]** Synthetic data generation methods in healthcare: A review on open-source tools and methods. Vasileios C. Pezoulas, Dimitrios I. Zaridis, Eugenia Mylona, Christos Androutsos, Kosmas Apostolidis, Nikolaos S. Tachos, et al.. 2024. https://doi.org/10.1016/j.csbj.2024.07.005 — file: `Papers/016_2024_Synthetic data generation methods in healthcare A review on open-source tools and methods.pdf`
- **[017]** Biomedical Image Segmentation Using Denoising Diffusion Probabilistic Models: A Comprehensive Review and Analysis. 2024. — file: `Papers/017_2024_Biomedical Image Segmentation Using Denoising Diffusion Probabilistic Models A Comprehensive Review and Analysis.pdf`
- **[018]** Extreme learning machine and bayesian optimization-driven intelligent framework for IoMT cyber-attack detection. 2022. — file: `Papers/018_2022_Extreme learning machine and bayesian optimization-driven intelligent framework for IoMT cyber-attack detection.pdf`
- **[019]** Scalable Bayesian–XAI Framework for Multi-Objective Decision-Making in Uncertain Dynamic Systems. Mostafa Aboulnour Salem, Zeyad Aly Khalil. 2026. https://doi.org/10.3390/a19050340 — file: `Papers/019_2026_Scalable Bayesian–XAI Framework for Multi-Objective Decision-Making in Uncertain Dynamic Systems.pdf`
- **[020]** A Probabilistic Clinical Decision Support Information System Framework Using NLP and Bayesian Networks with Poor-and-Rich Optimization. 2026. — file: `Papers/020_2026_A Probabilistic Clinical Decision Support Information System Framework Using NLP and Bayesian Networks with Poor-and-Rich Optimization.pdf`
- **[021]** Hybrid Digital Twin Framework for Personalized Diabetes Management Using Mathematical Modelling and Machine Learning. Vathana Dennish, Babu Subramani, Vijayakumar Ponnusamy, K. Suganthi, Janardanan Kumar, Nemanja Zdravković, et al.. 2026. https://doi.org/10.3390/diagnostics16172813 — file: `Papers/021_2026_Hybrid Digital Twin Framework for Personalized Diabetes Management Using Mathematical Modelling and Machine Learning.pdf`
- **[022]** Enhancing Safety in Diabetic Retinopathy Detection: Uncertainty-Aware Deep Learning Models with Rejection Capabilities. 2025. — file: `Papers/022_2025_Enhancing Safety in Diabetic Retinopathy Detection Uncertainty-Aware Deep Learning Models with Rejection Capabilities.pdf`
- **[024]** Computational whole-body-exposome models for global precision brain health. Agustín M. Ibáñez, Claudia A. Duran-Aniotz, Joaquín Migeot, Sandra Báez, Sol Fittipaldi, Carlos Coronel‐Oliveros, et al.. 2025. https://doi.org/10.1038/s41467-025-67448-3 — file: `Papers/024_2025_Computational whole-body-exposome models for global precision brain health.pdf`
- **[025]** A Bayesian Deep Learning Framework for End-To-End Prediction of Emotion From Heartbeat. 2022. — file: `Papers/025_2022_A Bayesian Deep Learning Framework for End-To-End Prediction of Emotion From Heartbeat.pdf`
- **[026]** SMILE: smart monitoring intelligent learning engine: an ontology-based context-aware system for supporting patients subjected to severe emergencies. Malak Khreis, Iyad Zaarour, Hamid Mcheick. 2016. https://doi.org/10.1504/ijhtm.2016.078346 — file: `Papers/026_2016_SMILE smart monitoring intelligent learning engine - An ontology-based context-aware system for supporting patients subjected to severe emergencies.pdf`
- **[027]** An intelligent framework for dynamic modeling of therapeutic response using clinical compliance data. Xinyi Wang, Haoran Xie. 2025. https://doi.org/10.3389/fphar.2025.1631599 — file: `Papers/027_2025_An intelligent framework for dynamic modeling of therapeutic response using clinical compliance data.pdf`
- **[028]** Adversarial natural language processing: overview challenges and policy implications. 2025. — file: `Papers/028_2025_Adversarial natural language processing overview challenges and policy implications.pdf`
- **[029]** Plasma lactate and severity of illness for acute pulmonary embolism: A Bayesian probability model. 2026. — file: `Papers/029_2026_Plasma lactate and severity of illness for acute pulmonary embolism A Bayesian probability model.pdf`
- **[030]** Synthetic data generation: a privacy-preserving approach to accelerate rare disease research. 2025. — file: `Papers/030_2025_Synthetic data generation a privacy-preserving approach to accelerate rare disease research.pdf`
- **[031]** Artificial Intelligence Approaches in Healthcare Informatics Toward Advanced Computation and Analysis. 2024. — file: `Papers/031_2024_Artificial Intelligence Approaches in Healthcare Informatics Toward Advanced Computation and Analysis.pdf`
- **[032]** Reliable machine learning models in genomic medicine using conformal prediction. Christina Papangelou, Konstantinos Kyriakidis, Pantelis Natsiavas, Ioanna Chouvarda, Andigoni Malousi. 2024. https://doi.org/10.1101/2024.09.09.24312995 — file: `Papers/032_2024_Reliable machine learning models in genomic medicine using conformal prediction.pdf`
- **[033]** Radio Frequency Tagging–enabled patient monitoring: integrating mobility tracking with early warning systems for enhanced safety. 2025. — file: `Papers/033_2025_Radio Frequency Tagging–enabled patient monitoring integrating mobility tracking with early warning systems for enhanced safety.pdf`
- **[034]** Probabilistic Model‐Based Malaria Disease Recognition System. 2021. — file: `Papers/034_2021_Probabilistic Model‐Based Malaria Disease Recognition System.pdf`
- **[035]** A Triple-Tier Secure Mobile-Cloud Framework Integrating AES–DES Hybrid Cryptosystem and Blockchain for COVID-Related Cardiovascular Data Protection. 2026. — file: `Papers/035_2026_A Triple-Tier Secure Mobile-Cloud Framework Integrating AES–DES Hybrid Cryptosystem and Blockchain for COVID-Related Cardiovascular Data Protecti.pdf`
- **[036]** Provable AI Ethics and Explainability in Medical and Educational AI Agents: Trustworthy Ethical Firewall. 2025. — file: `Papers/036_2025_Provable AI Ethics and Explainability in Medical and Educational AI Agents Trustworthy Ethical Firewall.pdf`
- **[037]** Recognition of Obstructive Sleep Apnea: An Exploratory Bayesian Modeling Analysis. 2026. — file: `Papers/037_2026_Recognition of Obstructive Sleep Apnea An Exploratory Bayesian Modeling Analysis.pdf`
- **[038]** Development implementation and validation of an open-source Federated Learning platform to accelerate innovation and boost personalized medicine in rare and ultra-rare haematological diseases: an initiative by GenoMed4All Consortium. Gianluca Asti, Patricia A. Apellániz, Luciana Carota, Francesco Casadei, Davide Piscia, Mattia Delleani, et al.. 2025. https://doi.org/10.1101/2025.08.07.25333044 — file: `Papers/038_2025_Development implementation and validation of an open-source Federated Learning platform to accelerate innovation and boost personalized medicine .pdf`
- **[039]** Toward Intelligent AIoT: A Comprehensive Survey on Digital Twin and Multimodal Generative AI Integration. Xiaoyi Luo, Aiwen Wang, Songyu Wang, Lixin Chen. 2025. https://doi.org/10.3390/math13213382 — file: `Papers/039_2025_Toward Intelligent AIoT A Comprehensive Survey on Digital Twin and Multimodal Generative AI Integration.pdf`
- **[040]** Unresolved questions in the application of artificial intelligence virtual cells for cancer research. 2025. — file: `Papers/040_2025_Unresolved questions in the application of artificial intelligence virtual cells for cancer research.pdf`
- **[042]** A hybrid grey wolf optimized eXtreme gradient boosting-based machine learning model for hospital pharmaceutical demand forecasting. 2026. — file: `Papers/042_2026_A hybrid grey wolf optimized eXtreme gradient boosting-based machine learning model for hospital pharmaceutical demand forecasting.pdf`
- **[043]** Artificial Intelligence Based Deep Bayesian Neural Network (DBNN) Toward Personalized Treatment of Leukemia with Stem Cells. 2023. — file: `Papers/043_2023_Artificial Intelligence Based Deep Bayesian Neural Network (DBNN) Toward Personalized Treatment of Leukemia with Stem Cells.pdf`
- **[044]** LLM-Integrated Bayesian State Space Models for Multimodal Time-Series Forecasting. Frédéric Sala. 2025. https://doi.org/10.48550/arxiv.2510.20952 — file: `Papers/044_2025_LLM-Integrated Bayesian State Space Models for Multimodal Time-Series Forecasting.pdf`
- **[045]** Cardiovascular Digital Twins from Physics Based to Data Driven Approaches. Emmanuel Lwele, Francis Chikweto. 2026. https://doi.org/10.48550/arxiv.2608.02135 — file: `Papers/045_2026_Cardiovascular Digital Twins from Physics Based to Data Driven Approaches.pdf`
- **[046]** Bayesian Wavelet Regression for Multiscale Signal Modeling: Mathematical Foundations Uncertainty-Aware Inference and Applications in Neuroscience and Vision Science. 2026. — file: `Papers/046_2026_Bayesian Wavelet Regression for Multiscale Signal Modeling Mathematical Foundations Uncertainty-Aware Inference and Applications in Neuroscience .pdf`
- **[047]** A Survey on Multimodal Data-Driven Smart Healthcare Systems: Approaches and Applications. 2019. — file: `Papers/047_2019_A Survey on Multimodal Data-Driven Smart Healthcare Systems Approaches and Applications.pdf`
- **[048]** Distributed Learning for Heart Disease Risk Prediction Based on Key Clinical Parameters with Evaluation Metrics Analysis. 2025. — file: `Papers/048_2025_Distributed Learning for Heart Disease Risk Prediction Based on Key Clinical Parameters with Evaluation Metrics Analysis.pdf`
- **[049]** Cognitive machine learning techniques for predictive maintenance in industrial systems: A data-driven analysis. 2024. — file: `Papers/049_2024_Cognitive machine learning techniques for predictive maintenance in industrial systems A data-driven analysis.pdf`
- **[050]** Exploring the Untapped Potential of Synthetic Data: A Comprehensive Review. 2023. — file: `Papers/050_2023_Exploring the Untapped Potential of Synthetic Data A Comprehensive Review.pdf`
- **[051]** End-To-End Prediction of Emotion from Heartbeat Data Collected by a Consumer Fitness Tracker. 2019. — file: `Papers/051_2019_End-To-End Prediction of Emotion from Heartbeat Data Collected by a Consumer Fitness Tracker.pdf`
- **[053]** A Hybrid AI Framework for Sensor-Based Personal Health Monitoring towards Precision Health. Mbithe Nzomo. 2024. https://doi.org/10.1609/aaai.v38i21.30403 — file: `Papers/053_2024_A Hybrid AI Framework for Sensor-Based Personal Health Monitoring towards Precision Health.pdf`
- **[054]** Machine Learning Algorithms for Biomedical Image Analysis and Their Applications. 2025. — file: `Papers/054_2025_Machine Learning Algorithms for Biomedical Image Analysis and Their Applications.pdf`
- **[056]** CORTEX: Composite Overlay for Risk Tiering and Exposure in Operational AI Systems. 2025. — file: `Papers/056_2025_CORTEX Composite Overlay for Risk Tiering and Exposure in Operational AI Systems.pdf`
- **[057]** Foundations of Artificial Intelligence in Hepatology: What a Clinician Needs to Know?. 2026. — file: `Papers/057_2026_Foundations of Artificial Intelligence in Hepatology What a Clinician Needs to Know.pdf`
- **[058]** Smart medical system integrating clinical workflows for robust skin cancer detection across heterogeneous pathologies. 2026. — file: `Papers/058_2026_Smart medical system integrating clinical workflows for robust skin cancer detection across heterogeneous pathologies.pdf`
- **[059]** Latent Neural-ODE for Model-Informed Precision Dosing: Overcoming Structural Assumptions in Pharmacokinetics. Agathe Guilloux, Sarah Zohar, Moreno Ursino, Jean‐Baptiste Woillard. 2026. https://doi.org/10.48550/arxiv.2602.03215 — file: `Papers/059_2026_Latent Neural-ODE for Model-Informed Precision Dosing Overcoming Structural Assumptions in Pharmacokinetics.pdf`
- **[060]** A Bayesian Reasoning Framework for Robotic Systems in Autonomous Casualty Triage. 2026. — file: `Papers/060_2026_A Bayesian Reasoning Framework for Robotic Systems in Autonomous Casualty Triage.pdf`
- **[062]** Beyond prediction: AI as a mechanistic microscope and digital twin for colorectal cancer immunotherapy. Zijun Zhou, Jianping Zhou. 2026. https://doi.org/10.3389/fimmu.2026.1746927 — file: `Papers/062_2026_Beyond prediction AI as a mechanistic microscope and digital twin for colorectal cancer immunotherapy.pdf`
- **[063]** Multi-Task TabGraphSyn: Graph-Based Synthetic EHR Generation with Improved Quality-Privacy Trade-offs for Opioid Use Disorder Prediction. 2026. — file: `Papers/063_2026_Multi-Task TabGraphSyn Graph-Based Synthetic EHR Generation with Improved Quality-Privacy Trade-offs for Opioid Use Disorder Prediction.pdf`
- **[065]** Representing Uncertainty in Property Valuation Through a Bayesian Deep Learning Approach. 2020. — file: `Papers/065_2020_Representing Uncertainty in Property Valuation Through a Bayesian Deep Learning Approach.pdf`
- **[066]** Bayesian Deep Learning for Measurement Error Correction in Health Survey Data. 2026. — file: `Papers/066_2026_Bayesian Deep Learning for Measurement Error Correction in Health Survey Data.pdf`
- **[067]** An Actor-Critic Reinforcement Learning Framework for Variant Evidence Interpretation. 2025. — file: `Papers/067_2025_An Actor-Critic Reinforcement Learning Framework for Variant Evidence Interpretation.pdf`
- **[068]** A data-driven security quantification framework for IoT-based systems. 2026. — file: `Papers/068_2026_A data-driven security quantification framework for IoT-based systems.pdf`
- **[070]** Understanding Physics-Informed Neural Networks: Techniques Applications Trends and Challenges. Amer Farea, Olli P. Yli-Harja, Frank Emmert‐Streib. 2024. https://doi.org/10.3390/ai5030074 — file: `Papers/070_2024_Understanding Physics-Informed Neural Networks Techniques Applications Trends and Challenges.pdf`
- **[073]** Machine Learning and Ensemble Methods for Cardiovascular Disease Prediction: A Systematic Review of Approaches Performance Trends and Research Challenges. 2026. — file: `Papers/073_2026_Machine Learning and Ensemble Methods for Cardiovascular Disease Prediction A Systematic Review of Approaches Performance Trends and Research Cha.pdf`
- **[074]** Quantifying uncertainty in microbiome-based prediction using Gaussian processes with microbial community dissimilarities. 2024. — file: `Papers/074_2024_Quantifying uncertainty in microbiome-based prediction using Gaussian processes with microbial community dissimilarities.pdf`
- **[075]** Design of an Iterative Method for Enhanced Multimodal Time Series Analysis Using Graph Attention Networks Variational Graph Autoencoders and Transfer Learning. 2024. — file: `Papers/075_2024_Design of an Iterative Method for Enhanced Multimodal Time Series Analysis Using Graph Attention Networks Variational Graph Autoencoders and Tran.pdf`
- **[076]** Machine Learning-Based Approaches for Early Detection and Risk Stratification of Deep Vein Thrombosis: A Systematic Review. 2025. — file: `Papers/076_2025_Machine Learning-Based Approaches for Early Detection and Risk Stratification of Deep Vein Thrombosis A Systematic Review.pdf`
- **[077]** Toward the Next Generation of Retinal Neuroprosthesis: Visual Computation with Spikes. 2020. — file: `Papers/077_2020_Toward the Next Generation of Retinal Neuroprosthesis Visual Computation with Spikes.pdf`
- **[079]** HA-PI-MADT: A Hybrid Adaptive Multimodal Digital Twin-Inspired Framework for Reliable Healthcare Prediction with Improved Ranking and Calibration Performance. 2026. — file: `Papers/079_2026_HA-PI-MADT A Hybrid Adaptive Multimodal Digital Twin-Inspired Framework for Reliable Healthcare Prediction with Improved Ranking and Calibration .pdf`
- **[080]** Perspectives on the Limits and Clinical Alignment of Medical AI from Population Statistics to Individual Care. 2026. — file: `Papers/080_2026_Perspectives on the Limits and Clinical Alignment of Medical AI from Population Statistics to Individual Care.pdf`
- **[082]** HybridFlow: Quantification of Aleatoric and Epistemic Uncertainty with a Single Hybrid Model. Peter Van Katwyk, Karianne J. Bergen. 2025. https://doi.org/10.48550/arxiv.2510.05054 — file: `Papers/082_2025_HybridFlow Quantification of Aleatoric and Epistemic Uncertainty with a Single Hybrid Model.pdf`
- **[083]** Clinical Reasoning Pathophysiology and Artificial Intelligence in Critical Care: A Conceptual Framework for Integrating Decision-Making. Álvaro Réa-Neto. 2026. https://doi.org/10.3390/jcm15207987 — file: `Papers/083_2026_Clinical Reasoning Pathophysiology and Artificial Intelligence in Critical Care A Conceptual Framework for Integrating Decision-Making.pdf`
- **[084]** Probabilistic Inference Layer Integration in Mistral LLM for Accurate Information Retrieval. 2024. — file: `Papers/084_2024_Probabilistic Inference Layer Integration in Mistral LLM for Accurate Information Retrieval.pdf`
- **[085]** Efficacy Analysis in Clinical Trials: A Comprehensive Review of Statistical and Machine Learning Approaches. 2025. — file: `Papers/085_2025_Efficacy Analysis in Clinical Trials A Comprehensive Review of Statistical and Machine Learning Approaches.pdf`
- **[087]** Deep learning solutions for smart city challenges in urban development. 2024. — file: `Papers/087_2024_Deep learning solutions for smart city challenges in urban development.pdf`
- **[088]** PRIME-Care: A Unified Reinforcement Learning and Mathematical Optimization Framework for Personalized Treatment Planning Under Clinical Uncertainty in Telemedicine. Mina Mohammadi, Ihsan Ullah, Javad Vahidi. 2026 (saved v2; filename says 2025). https://doi.org/10.21203/rs.3.rs-8390633/v1 — file: `Papers/088_2025_PRIME-Care A Unified Reinforcement Learning and Mathematical Optimization Framework for Personalized Treatment Planning Under Clinical Uncertaint.pdf`
- **[089]** Explainable Bayesian Artificial Intelligence for Precision Oncology: A Multimodal Framework for Personalized Cancer Prognosis. 2026. — file: `Papers/089_2026_Explainable Bayesian Artificial Intelligence for Precision Oncology A Multimodal Framework for Personalized Cancer Prognosis.pdf`
- **[091]** The Trust-Aware XAI (TAXAI) framework: a quantitative model for interpretable and reliable clinical AI systems. 2026. — file: `Papers/091_2026_The Trust-Aware XAI (TAXAI) framework a quantitative model for interpretable and reliable clinical AI systems.pdf`
- **[092]** The AFRIDIARRHEA multimodal fusion framework for Estimating the Burden of Diarrheal Diseases Among Children Under Five in Kenya Zimbabwe and Somaliland. 2026. — file: `Papers/092_2026_The AFRIDIARRHEA multimodal fusion framework for Estimating the Burden of Diarrheal Diseases Among Children Under Five in Kenya Zimbabwe and Soma.pdf`
- **[093]** Integrating mathematical modelling and artificial intelligence to combat emerging viral syndemics: A systematic review. 2026. — file: `Papers/093_2026_Integrating mathematical modelling and artificial intelligence to combat emerging viral syndemics A systematic review.pdf`
- **[094]** Bayesian Machine Learning for Precision Oncology: Integrating Clinical Genomic and Imaging Data for Personalized Cancer Prognosis. 2026. — file: `Papers/094_2026_Bayesian Machine Learning for Precision Oncology Integrating Clinical Genomic and Imaging Data for Personalized Cancer Prognosis.pdf`
- **[095]** Technology Readiness Levels for Machine Learning Systems. Alexander Lavin, Ciarán Lee, Alessya Visnjic, Siddha Ganju, Dava Newman, Atılım Güneş Baydin, et al.. 2021. https://doi.org/10.48550/arxiv.2101.03989 — file: `Papers/095_2021_Technology Readiness Levels for Machine Learning Systems.pdf`
- **[096]** Deep learning and generative AI for medical imaging and clinical decision support systems: a structured critical review. 2026. — file: `Papers/096_2026_Deep learning and generative AI for medical imaging and clinical decision support systems a structured critical review.pdf`
- **[097]** Adaptive Trust Metrics for Multi-LLM Systems: Enhancing Reliability in Regulated Industries. 2026. — file: `Papers/097_2026_Adaptive Trust Metrics for Multi-LLM Systems Enhancing Reliability in Regulated Industries.pdf`
- **[098]** A review of uncertainty quantification in deep learning: Techniques applications and challenges. Moloud Abdar, Farhad Pourpanah, Sadiq Hussain, Dana Rezazadegan, Li Liu, Mohammad Ghavamzadeh, et al.. 2021. https://doi.org/10.1016/j.inffus.2021.05.008 — file: `Papers/098_2021_A review of uncertainty quantification in deep learning Techniques applications and challenges.pdf`
- **[099]** Early Oral Cancer Detection with AI: Design and Implementation of a Deep Learning Image-Based Chatbot. 2025. — file: `Papers/099_2025_Early Oral Cancer Detection with AI Design and Implementation of a Deep Learning Image-Based Chatbot.pdf`

Also in the folder: `@Academic @EBSCOhost @Springer Publishing @NEJM @T.pdf`, an earlier search-response summary used only as a discovery aid, not as a research paper.

### 22.3 Expanded Collection (`Papers/Expanded_Collection/`, 104 PDFs + 1 linked-only)

- **[B001]** X-WIN: Building Chest Radiograph World Model via Predictive Sensing. Yang, Zefan, Wang, Ge, Hendler, James, Kalra, Mannudeep K., Yan, Pingkun. 2025. https://arxiv.org/abs/2511.14918
- **[B002]** Xray2Xray: World Model from Chest X-rays with Volumetric Context. Yang, Zefan, Song, Xinrui, Xu, Xuanang, Shi, Yongyi, Wang, Ge, Kalra, Mannudeep K., et al.. 2025. https://arxiv.org/abs/2506.19055
- **[B003]** CheXWorld: Exploring Image World Modeling for Radiograph Representation Learning. Yue, Yang, Wang, Yulin, Tao, Chenxin, Liu, Pan, Song, Shiji, Huang, Gao. 2025. https://arxiv.org/abs/2504.13820
- **[B004]** HounsWorld: A Multimodal World Model for Hidden Patient-State Readout, Reconstruction, and Simulation. Bai, Yunhao, Qiu, Zhongwei, Guo, Guangyu, Huang, Yiming, Mok, Tony C. W., Yu, Qinji, et al.. 2026. https://arxiv.org/abs/2608.12904
- **[B005]** DALE-CT: Depth-Aware 2D Slice Encoders Learn an Anatomical World Model of Chest CT. Damron, Evan W., Gokmen, Mahmut S., Klusty, Mitchell A., Leach, Caroline N., Collier, Emily B., Bumgardner, V. K. Cody. 2026. https://arxiv.org/abs/2606.07775
- **[B006]** Brain-JEPA: Brain Dynamics Foundation Model with Gradient Positioning and Spatiotemporal Masking. Dong, Zijian, Li, Ruilin, Wu, Yilei, Nguyen, Thuan Tinh, Chong, Joanna Su Xian, Ji, Fang, et al.. 2024. https://arxiv.org/abs/2409.19407
- **[B007]** Did the Grid Erase the Event? EndoClock for Auditing Medical World-Model Pipelines. Udi, Yarin, Sharon-Shahak, Tom, Masad, Roee, Pri-Tal, Dan. 2026. https://arxiv.org/abs/2608.09266
- **[B008]** EchoJEPA: A Latent Predictive Foundation Model for Echocardiography. Munim, Alif, Fallahpour, Adibvafa, Szasz, Teodora, Attarpour, Ahmadreza, Jiang, River, Sooriyakanthan, Brana, et al.. 2026. https://arxiv.org/abs/2602.02603
- **[B009]** Structure-aware World Model for Probe Guidance via Large-scale Self-supervised Pre-train. Jiang, Haojun, Li, Meng, Sun, Zhenguo, Jia, Ning, Sun, Yu, Luo, Shaqi, et al.. 2024. https://arxiv.org/abs/2406.19756
- **[B010]** Clin-JEPA: A Multi-Phase Co-Training Framework for Joint-Embedding Predictive Pretraining on EHR Patient Trajectories. Yang, Yixuan, Arora, Mehak, Zhang, Ryan, Abed, Baraa, Kim, Junseob, Choudhary, Tilendra, et al.. 2026. https://arxiv.org/abs/2605.10840
- **[B011]** EndoWorld-JEPA: Motion-Guided Global-Local Latent World Modeling for Endoscopic Video Representation Learning. Wang, Jie, Yang, Shilong, Zhou, Tao, Yu, Juan, Qu, Rong, Ren, Jianfeng, et al.. 2026. https://arxiv.org/abs/2610.27890
- **[B012]** A World Model of Radiologist Reading for Medical Image Representation Learning. Li, Yiwei, Wu, Zihao, Zhao, Huaqin, Zhou, Yifan, Cao, Chao, Zhu, Dajiang, et al.. 2026. https://arxiv.org/abs/2605.23992
- **[B013]** CRONOS: Continuous Time Reconstruction for 4D Medical Longitudinal Series. Disch, Nico Albert, Roy, Saikat, Ulrich, Constantin, Kirchhoff, Yannick, Rokuss, Maximilian, Peretzke, Robin, et al.. 2025. https://arxiv.org/abs/2512.16577
- **[B014]** Temporal Flow Matching for Learning Spatio-Temporal Trajectories in 4D Longitudinal Medical Imaging. Disch, Nico Albert, Kirchhoff, Yannick, Peretzke, Robin, Rokuss, Maximilian, Roy, Saikat, Ulrich, Constantin, et al.. 2025. https://arxiv.org/abs/2508.21580
- **[B015]** CoRe-WM: Conditioned Response-State World Modeling for Longitudinal Treatment-Response Prediction in Breast DCE-MRI. Zhao, Lin, Chen, Bowen, Gao, Qiaohui, Wan, Shaowen, Li, Xiang, Liu, Wei, et al.. 2026. https://arxiv.org/abs/2610.25333
- **[B016]** Patient, Place, Prior (P³): What Counts as Personalization in Medical World Models?. Gu, Xingrui, Gu, Hanxue, Zhang, Yuxiang, Yang, Yang. 2026. https://arxiv.org/abs/2610.09194
- **[B017]** Intervention-Aware Clinical World Model for Post-Op Outcome Forecasting in Cardiology. Chung, Yunsung, Liu, Yingshuo, Hassan, Abboud F., Feng, Han, Maleckar, Mary M., Marrouche, Nassir, et al.. 2026. https://arxiv.org/abs/2608.13518
- **[B018]** ProgFormer: Hierarchical Voxel Diffusion Transformer for Longitudinal Brain MRI Prediction. Ding, Dexuan, Qi, Yuankai, Zhou, Luping, Yang, Jian, Sheng, Quan Z., Yang, Ming-Hsuan. 2026. https://arxiv.org/abs/2607.27537
- **[B019]** MRI Contrast Enhancement Kinetics World Model. Kong, Jindi, He, Yuting, Xia, Cong, Ge, Rongjun, Li, Shuo. 2026. https://arxiv.org/abs/2602.19285
- **[B020]** Learning Patient-Specific Disease Dynamics with Latent Flow Matching for Longitudinal Imaging Generation. Chen, Hao, Yin, Rui, Chen, Yifan, Chen, Qi, Li, Chao. 2025. https://arxiv.org/abs/2512.09185
- **[B021]** Pre to Post-Treatment Glioblastoma MRI Prediction using a Latent Diffusion Model. Leclercq, Alexandre G., Bougleux, Sébastien, Moreau, Noémie N., Desmonts, Alexis, Hérault, Romain, Corroyer-Dulmont, Aurélien. 2025. https://arxiv.org/abs/2510.17851
- **[B022]** Brain Latent Progression: Individual-based Spatiotemporal Disease Progression on 3D Brain MRIs via Latent Diffusion. Puglisi, Lemuel, Alexander, Daniel C., Ravì, Daniele. 2025. https://arxiv.org/abs/2502.08560
- **[B023]** Treatment-aware Diffusion Probabilistic Model for Longitudinal MRI Generation and Diffuse Glioma Growth Prediction. Liu, Qinghui, Fuster-Garcia, Elies, Hovden, Ivar Thokle, MacIntosh, Bradley J, Grødem, Edvard, Brandal, Petter, et al.. 2023. https://arxiv.org/abs/2309.05406
- **[B024]** SonoWorld: Towards Interactive Pose-Controllable Ultrasound World Models. Yang, Zefan, Zhang, Zheyuan, Maihe, Boris, Liu, Yikang, Yu, Hang, Mukherjee, Ankush, et al.. 2026. https://arxiv.org/abs/2610.19327
- **[B025]** ImageFlowNet: Forecasting Multiscale Image-Level Trajectories of Disease Progression with Irregularly-Sampled Longitudinal Medical Images. Liu, Chen, Xu, Ke, Shen, Liangbo L., Huguet, Guillaume, Wang, Zilong, Tong, Alexander, et al.. 2024. https://arxiv.org/abs/2406.14794
- **[B026]** Sign-Constrained Intervention Effects for Domain-Generalizable ICU World Models. Xu, Zhen, Konz, Nicholas, Tan, Zhen, Plotkin, Zachary, Chen, Tianlong. 2026. https://arxiv.org/abs/2610.11090
- **[B027]** ECG-WM: A Physiology-Informed ECG World Model for Clinical Intervention Simulation. Chen, Zhikang, Wang, Yue, Cui, Sen, Zhang, Yu, Zhang, Changshui, Ren, Tianling, et al.. 2026. https://arxiv.org/abs/2605.17580
- **[B028]** Toward World Modeling of Physiological Signals with Chaos-Theoretic Balancing and Latent Dynamics. Luo, Yunfei, Chen, Xi, Chen, Yuliang, Zhang, Lanshuang, Islam, Md Mofijul, Zhao, Siwei, et al.. 2026. https://arxiv.org/abs/2605.15465
- **[B029]** Forecasting Patient Trajectories from the Electronic Health Records with Action-Conditioned World Models. Lee, Simon A., Sha, Jiahang Hank, Chung, Soomin, Akamatsu, Kai, Halperin, Eran, Chiang, Jeffrey N.. 2026. https://arxiv.org/abs/2610.23862
- **[B030]** PatientWM: Towards Generalizable Clinical World Models via Unified Patient States. Kan, Ziwen, Peng, Jie, Yan, Bo, Hobley, Davis, Zhang, Zheng, Tian, Yu, et al.. 2026. https://arxiv.org/abs/2610.17059
- **[B032]** Generative Medical Event Models Improve with Scale. Waxler, Shane, Blazek, Paul, White, Davis, Sneider, Daniel, Chung, Kevin, Nagarathnam, Mani, et al.. 2025. https://arxiv.org/abs/2508.12104
- **[B033]** SurgCast: Action-Conditioned Future Skeletons for Controllable Surgical World Models. Liu, Wanhao, Zhou, Rulin, Shao, Liangjing, Lin, Zhaocheng, Li, Dongyue, Lin, Jinsong, et al.. 2026. https://arxiv.org/abs/2610.15645
- **[B034]** Surg-UniWorld: A Unified Surgical World Model with Multimodal Control Experts. Zhou, Rulin, Liu, Wanhao, Ma, Guoheng, Shao, Liangjin, Song, Qiujie, Wang, Yidu, et al.. 2026. https://arxiv.org/abs/2608.06770
- **[B035]** CrossScope: A Role-Asymmetric World Model for Joint Dual-Scope Surgical Video Prediction. Liu, Wanhao, Lin, Jinsong, Zhou, Rulin, Ng, Chi Kit, Pan, Wenbin, Tang, Zhiqing, et al.. 2026. https://arxiv.org/abs/2608.03211
- **[B036]** SurgVista: Long-Horizon Surgical World Modeling with Plausible Instrument-Tissue Dynamics. Pan, Wentao, Li, Wuyang, Liu, Shengyuan, Liu, Xinyu, Liu, Hengyu, Yuan, Yixuan. 2026. https://arxiv.org/abs/2606.19889
- **[B037]** Towards Suturing World Models: Learning Predictive Models for Robotic Surgical Tasks. Turkcan, Mehmet Kerem, Ballo, Mattia, Filicori, Filippo, Kostic, Zoran. 2025. https://arxiv.org/abs/2503.12531
- **[B038]** EyeWorld: A Generative World Model of Ocular State and Dynamics. Gao, Ziyu, Wu, Xinyuan, Chen, Xiaolan, Liu, Zhuoran, Chen, Ruoyu, Liu, Bowen, et al.. 2026. https://arxiv.org/abs/2603.14039
- **[B039]** CaMeWM: A Causal Medical World Model for Generative Tumor Evolution and Treatment Planning. Gao, Huanlong, He, Xuelei, Zhao, Fengjun, He, Xiaowei. 2026. https://arxiv.org/abs/2610.26923
- **[B040]** UltraWorld: Learning Interactive Ultrasound World Models from Untracked Clinical Videos with Acoustic Sampling Map. Yang, Keke, Wang, Erqi, Guan, Sainan, Ren, Hongliang. 2026. https://arxiv.org/abs/2610.09785
- **[B041]** Ultrasound Operator Guidance Using World Modeling and Retrieval Based Action Planning. Schueler, Noortje I. P., van Gorp, Hans, van Sloun, Ruud J. G.. 2026. https://arxiv.org/abs/2610.06008
- **[B042]** Scanning While Imagining: A Scene-Graph World Model for Robotic Ultrasound Navigation. Li, Xuesong, Chen, Shuai, Li, Feng, Jiang, Zhongliang, Navab, Nassir, Bi, Yuan. 2026. https://arxiv.org/abs/2609.32837
- **[B043]** Action-Conditioned World Model for Goal Plane Guidance in Robotic Neck Ultrasound. Fan, Siqi, Liu, Ran, Yang, Zixuan, Fu, Xiaoyu, Gao, Xiaoqing, Xing, Yingqi, et al.. 2026. https://arxiv.org/abs/2607.21918
- **[B044]** DreamReg: Belief-Driven World Model for 2D-3D Ultrasound Registration. Kang, Luoyao, Zhang, Yuelin, Shan, Jiwei, Gong, Haifan, Ding, Qingpeng, Cheng, Shing Shin. 2026. https://arxiv.org/abs/2606.18825
- **[B045]** Cardiac Copilot: Automatic Probe Guidance for Echocardiography with World Model. Jiang, Haojun, Sun, Zhenguo, Jia, Ning, Li, Meng, Sun, Yu, Luo, Shaqi, et al.. 2024. https://arxiv.org/abs/2406.13165
- **[B046]** Intervention Granularity Matters: Coherent Treatment Bundles in Counterfactual Simulation with Clinical World Models. Wang, Fangzhou, Yang, Yixuan, Balzarotti, Camilla, Kamaleswaran, Rishikesan. 2026. https://arxiv.org/abs/2609.21906
- **[B047]** Cosmos-H-Surgical: Learning Surgical Robot Policies from Videos via World Modeling. He, Yufan, Guo, Pengfei, Xu, Mengya, Li, Zhaoshuo, Myronenko, Andriy, Imans, Dillan, et al.. 2025. https://arxiv.org/abs/2512.23162
- **[B048]** World Models for General Surgical Grasping. Lin, Hongbin, Li, Bin, Wong, Chun Wai, Rojas, Juan, Chu, Xiangyu, Au, Kwok Wai Samuel. 2024. https://arxiv.org/abs/2405.17940
- **[B049]** Progressive Experience Fusion for Multi-Task World Model Control in Endovascular Navigation. Robertshaw, Harry, Boels, Maxence, Fischer, Nikola, Ourselin, Sebastien, Bergeles, Christos, Granados, Alejandro, et al.. 2026. https://arxiv.org/abs/2608.18647
- **[B050]** Failure Detection for Surgical Robot Imitation Policies via Flow-Matching World Modeling. Huang, Zhefeng, Cai, Yilin, Patel, Ankit, Hajiha, Mohammad, Browne, Brendan, Chen, Yue. 2026. https://arxiv.org/abs/2607.27511
- **[B051]** Toward Safe Autonomous Robotic Endovascular Interventions using World Models. Robertshaw, Harry, Fischer, Nikola, Wu, Han-Ru, Perez, Andrea Walker, Deng, Weiyuan, Jackson, Benjamin, et al.. 2026. https://arxiv.org/abs/2604.20151
- **[B052]** Visuomotor Grasping with World Models for Surgical Robots. Lin, Hongbin, Li, Bin, Au, Kwok Wai Samuel. 2025. https://arxiv.org/abs/2508.11200
- **[B053]** Policy4OOD: A Knowledge-Guided World Model for Policy Intervention Simulation against the Opioid Overdose Crisis. Ma, Yijun, Wang, Zehong, Sun, Weixiang, Zhang, Zheyuan, Shi, Kaiwen, Chawla, Nitesh, et al.. 2026. https://arxiv.org/abs/2602.12373
- **[B054]** A radiographic world model for clinical reasoning and evidence generation. Xi, Suyang, Hu, Songtao, Wang, Shansong, Safari, Mojtaba, del Balzo, Luke, Karim, Ehsan Ul, et al.. 2026. https://arxiv.org/abs/2609.07719
- **[B055]** The Patient is not a Moving Document: A World Model Training Paradigm for Longitudinal EHR. Adam, Irsyad, Chen, Zekai, Laprade, David, Porwal, Shaun, Laub, David, Reinertsen, Erik, et al.. 2026. https://arxiv.org/abs/2601.22128
- **[B056]** Beyond Generative AI: World Models for Clinical Prediction, Counterfactuals, and Planning. Qazi, Mohammad Areeb, Nadeem, Maryam, Yaqub, Mohammad. 2025. https://arxiv.org/abs/2511.16333
- **[B057]** NVIDIA Cosmos-H-Dreams: Real-Time Generative Physics Simulation for Surgical Robotics. Tejero, Javier Gamazo, Zbinden, Lukas, Sheth, Keyur, M, Raghavendra K, Daher, Nadim, Maraña, Diego Granero, et al.. 2026. https://arxiv.org/abs/2608.24199
- **[B058]** SWoMo: Neuro-Symbolic World Model for Cataract Surgery Simulation. Sivakumar, Ssharvien Kumar, Johnson, Akwele, Dhingra, Anirudh, Frisch, Yannik, Ghazaei, Ghazal, Mukhopadhyay, Anirban. 2026. https://arxiv.org/abs/2605.16530
- **[B059]** How Far Are Surgeons from Surgical World Models? A Pilot Study on Zero-shot Surgical Video Generation with Expert Assessment. Chen, Zhen, Xu, Qing, Wu, Jinlin, Yang, Biao, Zhai, Yuhao, Guo, Geng, et al.. 2025. https://arxiv.org/abs/2511.01775
- **[B060]** Surgical WAM: A World-Action Model for Data-Efficient Surgical Robot Learning. Bao, Wenrui, Jiang, Tianyun, Chen, Zhiben, Lim, Ser-Nam, Peng, Peter D., Shang, Yuzhang. 2026. https://arxiv.org/abs/2608.11204
- **[B061]** EndoWAM: A Grounded World-Action Model for Generalizable Endoscopic Navigation. Lin, Jinsong, Pan, Zikang, Liu, Wanhao, Ng, Chi Kit, Shao, Liangjing, Yu, Zihang, et al.. 2026. https://arxiv.org/abs/2608.01221
- **[B062]** NOAH: Learning the Full Patient Journey. A Longitudinal Multimodal Time-Aware Model for Representation and Forecasting. Susetzky, Tobias, Rehms, Raphael, Seletkov, Dmitrii, Turgut, Özgün, Liman, Michelle Espranita, Steinhelfer, Lisa, et al.. 2026. https://arxiv.org/abs/2609.09140
- **[B063]** ICare-DT: a digital twin for continuous forecasting of intensive care patients. Li, Yanke, Qi, Yahang, Kim, Yumi, Paez-Granados, Diego. 2026. https://arxiv.org/abs/2611.09712
- **[B064]** Personalized health coaching via coachable health age and counterfactual wearable trajectories. Lee, Simon A., Esmaeilpour, Zeinab, Zhou, Menglian, Guerard, Marius, Sidhu, Sohrab, Solot, Alexandru, et al.. 2026. https://arxiv.org/abs/2611.08568
- **[B065]** SurgTransfer: Multi-Step Latent Action Modeling for Action Transfer in Surgical World Model. Koju, Saurabh, Panta, Love, Thapa, Deepak, Poudel, Rudra P. K., Ghimire, Prajwal, Watson, Angus, et al.. 2026. https://arxiv.org/abs/2611.05443
- **[B066]** PulmoWorld: An Asynchronous Multimodal Medical World Model for Longitudinal Pneumonia Dynamics. Tang, Cheng, Zhang, Xinyu, Chen, Jiawei, Zhang, Minghui, Wei, Shaocong, Li, Wei, et al.. 2026. https://arxiv.org/abs/2610.38289
- **[B067]** DuoPIC: Uncertainty-Aware Voxel-Level Digital Twins of Cerebral Perfusion with Transport PDEs in Acute Stroke. Tran, Anh Duong, D., Quang-Anh N., Pham, Toan Sy, Hoang, Trang H., Do, Minh N., Mai, Duy Ton, et al.. 2026. https://arxiv.org/abs/2610.33071
- **[B068]** Saga: an in silico ontology for a multimodal patient world model. Li, Youcheng, Tian, Fa, Su, Binbin. 2026. https://arxiv.org/abs/2610.33054
- **[B069]** Learning response-aware patient dynamics for respiratory support. Lu, Xiaolei, Nemati, Shamim. 2026. https://arxiv.org/abs/2609.32782
- **[B070]** One Frame, Full Heartbeat: ECG-Free 4D Cardiac Cine MRI Synthesis via Radial-Decomposed Flow Matching. Wang, Shiyi, Sun, Ruochen, Li, Xiang, Liu, Peirong, Xing, Fangxu. 2026. https://arxiv.org/abs/2610.09185
- **[B071]** HyperNSDE: Personalized Neural SDEs for Joint Static-Longitudinal Clinical Data Generation. Chassat, Perrine, Guilloux, Agathe. 2026. https://arxiv.org/abs/2610.07383
- **[B072]** APOD: reasoning-guided agentic population ordinary differential equation discovery for pharmacological digital twins. Ferrara, Romain, Soucail, Martin, Gertner, Victor, Moussali, Adil, Cocquebert, Joris, Oziel-Taieb, Sandrine, et al.. 2026. https://arxiv.org/abs/2610.06227
- **[B073]** An Uncertainty-Guided Digital Twin Framework for Online Adaptive Proton Therapy in Head and Neck Cancer: A Feasibility Study. Wu, Yizhou, Sanford, Ryan J., Xie, Huiqiao, Ding, Jie, Chen, Shupeng, Wu, Tung-Ho, et al.. 2026. https://arxiv.org/abs/2609.39010
- **[B074]** Learning Continuous Patient Trajectories from Electronic Health Records. Estévez, Silas Ruhrberg, Liu, Kara, Chiu, Christopher, Owusu, Benjamin Atta, Kadam, Umesh, Altman, Russ B., et al.. 2026. https://arxiv.org/abs/2609.36144
- **[B075]** Intervention-Conditioned Counterfactual Human Digital Twin Generator. Farzi, Saeed, Michopoulou, Sofia, Kipps, Christopher, Attar, Rahman. 2026. https://arxiv.org/abs/2610.40664
- **[B076]** Reverse Spatio-Temporal Disease Progression Modelling. Shernazarov, Ulugbek, Xu, Moucheng, Ramatov, Inomjon. 2026. https://arxiv.org/abs/2609.14590
- **[B077]** SurgGMF: Fully Causal Gaussian Motion Forecasting for Anticipatory Surgical Scene Rendering. Sun, Jingqian, Tang, Yichao. 2026. https://arxiv.org/abs/2609.34733
- **[B078]** Towards Surgical World-Action Modeling: A Preliminary Joint Visual-Trajectory Forecasting for Surgical Motion Planning. Huang, Weiliang, Liu, Huanrong, Zhang, Bob, Dou, Qi, Chen, Zhen, Gu, Yun, et al.. 2026. https://arxiv.org/abs/2608.20284
- **[B079]** Neural Pharmacodynamic State Space Modeling. Zeshan M Hussain, Rahul G. Krishnan, David Sontag. 2021. https://proceedings.mlr.press/v139/hussain21a.html
- **[B080]** G-Net: a Recurrent Network Approach to G-Computation for Counterfactual Prediction Under a Dynamic Treatment Regime. Rui Li, Stephanie Hu, Mingyu Lu, Yuria Utsumi, Prithwish Chakraborty, Daby M. Sow, et al.. 2021. https://proceedings.mlr.press/v158/li21a.html
- **[B081]** Foresight—a generative pretrained transformer for modelling of patient timelines using electronic health records: a retrospective modelling study. Zeljko Kraljevic, Dan Bean, Anthony Shek, Rebecca Bendayan, Harry Hemingway, Joshua Au Yeung, et al.. 2024. https://pubmed.ncbi.nlm.nih.gov/38519155/
- **[B082]** The UVA/PADOVA Type 1 Diabetes Simulator: New Features. Chiara Dalla Man, Francesco Micheletto, Dayu Lv, Marc Breton, Boris Kovatchev, Claudio Cobelli. 2014. https://journals.sagepub.com/doi/10.1177/1932296813514502 (linked only; no local PDF)
- **[B083]** FlatASCEND: Autoregressive Clinical Sequence Generation with Continuous Time Prediction and Association-Based Pharmacological Testing. Sainsbury, Chris, Dong, Feng, Karwath, Andreas. 2026. https://arxiv.org/abs/2605.04071
- **[B084]** Stable Long-Horizon Neural ODE Reduced-Order Models via Learned Feedback for Biological Growth and Remodeling. Laudo, Joel, Tepole, Adrian Buganza. 2026. https://arxiv.org/abs/2604.13820
- **[B085]** High-Fidelity Longitudinal Patient Simulation Using Real-World Data. Akagi, Yu, Seki, Tomohisa, Ito, Hiromasa, Takiguchi, Toru, Ohe, Kazuhiko, Kawazoe, Yoshimasa. 2026. https://arxiv.org/abs/2601.17310
- **[B086]** A Physiology-Informed Digital Twin Framework for Simulating Liver Health Progression. Mila, Sumaiya Afroz, Ray, Sandip. 2026. https://arxiv.org/abs/2608.14969
- **[B087]** S2-HWM: Sparse Event-Structured Hierarchical World Model for Long-Horizon Surgical Robot Manipulation. Zhang, Shuzhe, Zhu, Xin, Qian, Yinling, Wang, Qiong. 2026. https://arxiv.org/abs/2608.13103
- **[B088]** Automatic Patient-Specific Microwave Ablation Planning Accelerated by a Physics-Guided Deep Learning Model. Cho, Seonaeng, Seo, Minjee, Seol, Minju, Park, Juil, Kwon, Joon Ho, Yoon, Kyungho. 2026. https://arxiv.org/abs/2608.03086
- **[B089]** NeuroWorld: A Latent Brain World Model for Stimulus-Conditioned Human Brain Dynamics. Dong, Zijian, Zhou, Jianxiong, Ng, Kwun Kei, Balagtas, Jan Paolo Macapinlac, Li, Zhizhou, Chen, Zijiao, et al.. 2026. https://arxiv.org/abs/2608.01773
- **[B090]** Enhancing Personalized Bladder Cancer Treatment Through Reinforcement Learning: A Recurrent Patient State Transition Decision Support Framework. Chawla, Divyansh, Garg, Anshu, Singh, Isshaan. 2026. https://arxiv.org/abs/2607.16916
- **[B091]** AI-Augmented Adaptive Digital Twin Modeling for Brain Tumor Evolution Prediction and Treatment Scheduling. Liu, Wenxi, Trimboli, Michael, Li, Xianqi. 2026. https://arxiv.org/abs/2607.13877
- **[B092]** EHR-MPC: Inference-Time Control for Sepsis Treatment with Generative Patient Digital Twins. Pickard, Joshua, Qi, Wei, Li, Na, Woolley, Ann, Cosimi, Lisa, Kishony, Roy, et al.. 2026. https://arxiv.org/abs/2607.08793
- **[B093]** Neural operator-based digital twins for modeling amyloid-β and tau propagation and treatment optimization in Alzheimer's disease. Xu, Xiaofeng, Dan, Tingting, Zhou, Zifan, Li, Bin, Wu, Guorong, Hao, Wenrui. 2026. https://arxiv.org/abs/2606.25185
- **[B094]** OphthaDT: Generative Digital Twins for Forecasting Visual Acuity Trajectories in Ophthalmology. Belligoli, Pietro, Makarov, Nikita, Boushehri, Sayedali Shetab, Schmich, Fabian, Rodriguez-Esteban, Raul, Menden, Michael. 2026. https://arxiv.org/abs/2606.22101
- **[B095]** Learning Cardiac Electrophysiology Digital Twins Through Agentic Discovery of Hybrid Structure. Zhou, Ziqi, Ye, Yubo, Vadhavka, Sumeet Atul, Wang, Linwei, Tao, Zhiqiang. 2026. https://arxiv.org/abs/2606.18154
- **[B096]** Treatment Response Optimized Clinical Decision Support AI System via Digital Twin Simulation. Qin, Xinyu, Sood, Anil K., Yu, Ruiheng, Corvigno, Sara, Stur, Elaine, Wang, Lu. 2026. https://arxiv.org/abs/2606.17405
- **[B097]** Data-Driven Modeling and Predictive Control of Chronic Diseases: An Ulcerative Colitis Application. Kopp, Fionna B., Schalkamp, Ann-Kathrin, Azzam, Shadera, Rudrapatna, Vivek, Borrelli, Francesco. 2026. https://arxiv.org/abs/2610.04242
- **[B098]** Transition-Based Digital Twin Modelling for Alzheimer's Disease under Sparse Longitudinal Data. Huang, Yinyu, Zhang, Yilin, Michopoulou, Sofia, Kipps, Christopher, Attar, Rahman. 2026. https://arxiv.org/abs/2606.09671
- **[B099]** Simulating clinical interventions with a generative multimodal model of human physiology. Lutsker, Guy, Sapir, Gal, Merino, Jordi, Shilo, Smadar, Godneva, Anastasia, Meirom, Eli, et al.. 2026. https://arxiv.org/abs/2604.27899
- **[B100]** Beyond Patient Invariance: Learning Cardiac Dynamics via Action-Conditioned JEPAs. Fernandes, Jose Geraldo, Facury, Luiz, Dutenhefner, Pedro Robles, Meira Jr, Wagner. 2026. https://arxiv.org/abs/2604.22618
- **[B101]** Sonata: A Hybrid World Model for Inertial Kinematics under Clinical Data Scarcity. Delaney, Blaise, Patel, Salil, Xing, Yuji, Dootson, Dominic, Sevegnani, Karin, Antoniades, Chrystalina. 2026. https://arxiv.org/abs/2604.18058
- **[B102]** Generating Counterfactual Patient Timelines from Real-World Data. Akagi, Yu, Seki, Tomohisa, Takiguchi, Toru, Ito, Hiromasa, Kawazoe, Yoshimasa, Ohe, Kazuhiko. 2026. https://arxiv.org/abs/2604.02337
- **[B103]** Scaling Recurrence-aware Foundation Models for Clinical Records via Next-Visit Prediction. Gao, Xiang, Rajamohan, Haresh Rengaraj, Zhu, Weicheng, Huang, Shih-Lun, Chen, Long, Schulman, Gabe, et al.. 2026. https://arxiv.org/abs/2603.24562
- **[B104]** Cosmos-Surg-dVRK: World Foundation Model-based Automated Online Evaluation of Surgical Robot Policy Learning. Zbinden, Lukas, Nelson, Nigel, Chen, Juo-Tung, Chen, Xinhao, Kim, Ji Woong, Azizian, Mahdi, et al.. 2025. https://arxiv.org/abs/2510.16240
- **[B105]** World Model for AI Autonomous Navigation in Mechanical Thrombectomy. Robertshaw, Harry, Wu, Han-Ru, Granados, Alejandro, Booth, Thomas C. 2025. https://arxiv.org/abs/2509.25518
- **[B106]** MM-DADM: Multimodal Drug-Aware Diffusion Model for Virtual Clinical Trials. Shao, Qian, Du, Bang, Li, Zepeng, Chen, Qiyuan, Chen, Jiahe, Xu, Hongxia, et al.. 2025. https://arxiv.org/abs/2502.07297

### 22.4 Recommended Additions (`Papers/Recommended_Additions/`, 17 PDFs + 3 linked-only)

- **[A01]** Medical World Model. 2025. https://openaccess.thecvf.com/content/ICCV2025/html/Yang_Medical_World_Model_ICCV_2025_paper.html
- **[A02]** CLARITY: Medical World Model for Guiding Treatment Decisions by Simulating Context-Aware Disease Trajectories. 2026 (first preprint 2025). https://arxiv.org/abs/2512.08029v3
- **[A03]** EHRWorld: A Patient-Centric Medical World Model for Long-Horizon Clinical Trajectories. 2026. https://arxiv.org/abs/2602.03569v1
- **[A04]** medDreamer: Model-Based Reinforcement Learning with Latent Imagination on Complex EHRs for Clinical Decision Support. 2025 manuscript. https://arxiv.org/abs/2505.19785v3
- **[A05]** Brain-WM: Brain Glioblastoma World Model. 2026. https://arxiv.org/abs/2603.07562v1
- **[A06]** ChronoMedicalWorld: A Medical World Model for Learning Patient Trajectories from Longitudinal Care Data. 2026. https://arxiv.org/abs/2605.21963v1
- **[A07]** Agentifying Patient Dynamics within LLMs through Interacting with Clinical World Model. 2026. https://arxiv.org/abs/2605.14723v1
- **[A08]** EchoWorld: Learning Motion-Aware World Models for Echocardiography Probe Guidance. 2025. https://arxiv.org/abs/2504.13065
- **[A09]** Surgical Vision World Model. 2025. https://arxiv.org/abs/2503.02904
- **[A10]** SAW: Toward a Surgical Action World Model via Controllable and Scalable Video Generation. 2026. https://arxiv.org/abs/2603.13024v1
- **[A11]** Learning a patient world model for health system simulation in intensive care. 2026. https://arxiv.org/abs/2611.08392v1
- **[A12]** G-Transformer: Counterfactual Outcome Prediction under Dynamic and Time-varying Treatment Regimes. 2024. https://proceedings.mlr.press/v252/xiong24a.html
- **[A13]** Causal Transformer for Estimating Counterfactual Outcomes. 2022. https://proceedings.mlr.press/v162/melnychuk22a.html
- **[A14]** GlyTwin: Enhancing Digital Twin for Glucose Control in Type 1 Diabetes using Patient-Centric Counterfactual Treatments. 2026 (first preprint 2025). https://arxiv.org/abs/2504.09846
- **[A15]** Learning the natural history of human disease with generative transformers. 2025. https://www.nature.com/articles/s41586-025-09529-3 (linked only; no local PDF)
- **[A16]** Toward mechanistic medical digital twins: some use cases in immunology. 2024. https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2024.1349595/full
- **[A17]** Medical world models: representing medical states, modelling clinical dynamics and guiding intervention policies. 2026. https://arxiv.org/abs/2606.16721v1
- **[A18]** Medical world models in healthcare: capabilities, evidence, and trustworthy clinical translation. 2026. https://arxiv.org/abs/2607.25242v3
- **[A19]** Toward Verifiable Medical Imaging World Models: An Engineering Framework for Evaluating Simulation Fidelity, Roll-Out Stability, and Clinical Plausibility. 2026. https://link.springer.com/article/10.1007/s10278-026-02413-0 (linked only; no local PDF)
- **[A20]** Archimedes: A trial-validated model of diabetes. 2003. https://diabetesjournals.org/care/article/26/11/3093/22417/ArchimedesA-trial-validated-model-of-diabetes (linked only; no local PDF)

Local screening notes also consulted: `Papers/Expanded_Collection/START_HERE.md`, `DOMAIN_SYNTHESIS.md` (cited as [DOMAIN_SYNTHESIS]), `NEW_PAPERS.md`, `MASTER_CATALOGUE.json`; `Papers/Recommended_Additions/Healthcare_World_Model_Literature_Review.md`, `catalogue.json`.

### 22.5 Web sources (searched 17 November 2026)

- **[W-1]** Wang et al. (2026). Medical world models: representing medical states, modelling clinical dynamics and guiding intervention policies. arXiv:2606.16721 (= A17).
- **[W-2]** Medical world models in healthcare: foundations, applications, and challenges for trustworthy clinical translation. arXiv:2607.25242 (= A18; v3 title differs).
- **[W-3]** Su Z., Lovitt M.H., Lin Y., Dong H., Ding H., Dai H., Bian J., Peng Y. (2026). Medical World Models for Disease Dynamics: A Literature Review. SSRN 7452778.
- **[W-4]** Ding J. et al. (2025/2026). Understanding World or Predicting Future? A Comprehensive Survey of World Models. *ACM Computing Surveys* 58(3). arXiv:2411.14499.
- **[W-5]** World Models: A Comprehensive Survey of Architectures (multi-axis taxonomy). arXiv:2606.00133; and Agentic World Modeling: Foundations, Capabilities, Laws, and Beyond. arXiv:2604.22748.
- **[W-6]** Assran M. et al. (2025). V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning. arXiv:2506.09985.
- **[W-7]** Genie 3 (Google DeepMind, 2025) and NVIDIA Cosmos world foundation model platform (arXiv:2501.03575).
- **[W-8]** What Makes Video World Model Latents Action-Relevant: Prediction over Reconstruction. arXiv:2606.07687; plus pixel-generative vs predictive-latent comparison notes.
- **[W-9]** LeCun Y. (2022). A Path Towards Autonomous Machine Intelligence (JEPA / H-JEPA cognitive architecture). OpenReview.
- **[W-10]** Medical World Model: From Passive Prediction to Active Simulation in Medicine. Preprints.org 202604.2168.
- **[W-11]** Awesome-World-Models-for-Healthcare (GitHub: XuZikang) and awesome_medical_world_models (GitHub: 1999kevin) curated lists.
- **[W-12]** Physiological World Models for Human State Transitions. arXiv:2608.15309.
