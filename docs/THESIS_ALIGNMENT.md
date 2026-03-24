# EduSmart Thesis Alignment: Solved vs Pending

This document maps the current EduSmart implementation to the research proposal claims so you can defend what is complete and what remains for full thesis closure.

## 1) Problem Statement Coverage

| Proposal Claim | Current Status | Evidence in Project | Gap to Close |
|---|---|---|---|
| Bridge CBC-KBC transition gap in university learning | Partially solved | Bloom detection, competency mapping, prompt engineering, RAG flow are implemented in backend service pipeline and AI route | Need measurable learning outcomes from real users showing improved higher-order thinking and competency alignment |
| Move away from recall-heavy support to higher-order support | Partially solved | Bloom-aware processing is integrated before response generation | Need rubric-based evaluation proving responses actually target Apply/Analyze/Evaluate/Create in practice |
| Provide structured AI support aligned to CBC outcomes | Partially solved | Competency mapping and curriculum-aware retrieval are in place | Need validated competency-to-task mapping quality and consistency checks |
| Support both students and lecturers | Mostly solved at prototype level | Student, lecturer, admin role model and workflow surfaces exist across routes/pages | Some frontend endpoint groups are ahead of backend wiring, reducing full end-to-end completeness |

## 2) Specific Objectives Coverage

| Specific Objective | Status | What is Already Done | What is Still Needed |
|---|---|---|---|
| Analyze curriculum, pedagogical, and technological requirements | Partially solved | Core architecture reflects CBC + Bloom + RAG design assumptions | Add explicit requirements traceability matrix linking each requirement to an implemented feature and test evidence |
| Design architecture and functional components | Solved (prototype scope) | Modular architecture and service boundaries are implemented | Add final architecture diagram revision matching code as-built |
| Develop functional prototype | Solved (prototype scope) | Working backend domains: auth, chat, AI query, ingestion, courses, enrollment, roadmap, assessments, progress | Close incomplete API parity for setup/admin/institution/lecturer endpoints referenced by frontend service layer |

## 3) Research Question Coverage

Research Question:
How can an AI-powered, curriculum-aware system align university learning with CBC outcomes and Bloom through Bloom detection, competency mapping, prompt engineering, and RAG?

Answer based on current prototype:

1. It can be implemented through a modular pipeline that classifies query cognition (Bloom), applies competency-aware prompt shaping, and grounds output using course-context retrieval.
2. The current codebase demonstrates technical feasibility of this design in a usable multi-role prototype.
3. Full research closure still requires empirical validation of pedagogical impact and adoption quality.

## 4) Expected Outcomes Coverage

| Expected Outcome from Proposal | Status | Notes |
|---|---|---|
| Functional CBC-aligned AI prototype | Achieved | Core prototype is implemented and operational across major modules |
| Empirical evidence on AI support for competency learning | Not yet achieved | Requires pilot design, instrumented data collection, and analysis |
| Proposed framework for responsible curriculum-aligned AI adoption | Partially achieved | Architecture exists; policy/governance and institutional deployment framework need formalization |

## 5) Scope and Delimitations Check

Within current scope (design and prototype):

1. Architecture and prototype implementation are consistent with proposal scope.
2. Large-scale deployment and labor-market impact evaluation were correctly not included.

Beyond current scope but needed for thesis strength:

1. Controlled pilot with students and lecturers.
2. Usability and alignment measurement using predefined instruments.
3. Comparative or baseline-informed interpretation of learning gains.

## 6) Thesis-Ready Conclusion Statement

Use this wording in your report discussion/defense:

"EduSmart has solved the design-and-build phase of the CBC-aligned AI support problem by delivering a functional prototype that integrates Bloom level detection, competency mapping, structured prompt engineering, and RAG in a multi-role university context. However, full resolution of the educational problem requires the next phase: controlled empirical validation to demonstrate measurable improvements in higher-order cognition, competency development, and instructional effectiveness."

## 7) Immediate Next Actions (High Priority)

1. Build an evaluation protocol:
   Define metrics for Bloom-level shift, competency alignment score, task performance quality, and user trust/usability.
2. Instrument the system:
   Log prompt features, Bloom classification outputs, competency tags, citation usage, and user feedback per interaction.
3. Run pilot study:
   Execute small controlled cohorts (students + lecturers), then analyze pre/post or rubric-based outcomes.
4. Close API parity gaps:
   Either implement missing backend routes used by frontend (`/admin`, `/setup`, `/institution`, `/lecturers`) or refactor frontend to only call currently implemented endpoints.
5. Finalize responsible AI framework:
   Document citation policy, limitation disclosure, human-in-the-loop guardrails, and institutional usage recommendations.