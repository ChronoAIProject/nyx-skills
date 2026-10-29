# Sources and adaptation decisions

Initially reviewed on 2026-09-26; expanded on 2026-10-29 for version 2.0.
This is a synthesized writing method, not a verbatim
bundle of upstream skills. References below identify the exact repositories
and versions read. Their authors do not endorse this synthesis.

## Public skills consulted

### Master-cai: Research-Paper-Writing-Skills

- Repository: https://github.com/Master-cai/Research-Paper-Writing-Skills
- Read revision: `77e7c2c1ba06f7d71844873147665437a03aac1b`.
- Read `research-paper-writing/SKILL.md` and
  `research-paper-writing/references/paper-review.md` at that revision.
- Repository license: MIT. It credits Prof. Peng Sida's public writing notes;
  that pedagogical provenance is author-reported here, not a separately audited
  license or endorsement of the original notes.
- Retained: argument before sentence polishing, paragraph roles, reverse
  outlining, terminology consistency, and claim-support alignment.
- Adapted: experimental evidence is appropriate for empirical claims; proof or
  exact certificates are appropriate for theorems. Teaser figures, ablations,
  baseline superiority, and a five-part self-review appended to every draft
  are not universal requirements. Internal review questions stay outside the
  publication text unless requested.

### David Sosa: scientific-writing-skills

- Repository: https://github.com/dvdsosa/scientific-writing-skills
- Read revision: `80e010fe58a44314998308c6ee68aff40bfd8ded`.
- Read `skills/sciwrite-prose/SKILL.md` and `LICENSE`.
- Repository code and original prose: MIT. The repository attributes its
  teaching basis to Kristin Sainani's Stanford course. We did not copy or
  independently license course videos, slides, transcripts, or examples.
- Retained: concrete rewrites, structure before line edits, stable technical
  terminology, and context-sensitive treatment of passive voice and punctuation.
- Adapted: review mode reports findings; revision mode can fix verified technical
  errors within scope, while making changed scientific meaning explicit.
  Whole-manuscript work proceeds when requested, without requiring a new
  clarification merely because the document is long.

### Seifallah El Fetni: Scientific-Writing-Skills-Claude-Code-Codex

- Repository: https://github.com/SFETNI/Scientific-Writing-Skills-Claude-Code-Codex
- Read revision: `ae6cdf414fd0c1f745b219e2ac741a52a99dec9c`.
- Read `skills/writing/skill_claim_calibration.md` and `LICENSE`.
- Skills/documentation license: CC BY 4.0,
  https://creativecommons.org/licenses/by/4.0/ . Copyright 2026 Seifallah El Fetni.
- Adapted its claim-source calibration approach: added proof, formal theorem,
  exact certificate, experiment, and reported-check distinctions. Removed
  mandatory per-claim status syntax, compulsory registry inputs, and automatic
  human checkpoints for every section. A compact map is optional working
  support, not a publication requirement. No scripts or templates were copied.

## Version 2.0 public-source review

Read on 2026-10-29. The dates below are repository commit dates, not asserted
publication dates of every file. These nine sources were inspected at the
pinned revisions; none endorses this synthesis. All new guidance and examples
are written for this skill. No upstream scripts, checklists, templates, or
example passages were imported.

| Source and inspected file | Repository revision; commit date | Contribution and adaptation |
| --- | --- | --- |
| [Anthropic, doc-coauthoring](https://github.com/anthropics/skills/blob/ca45fc496a3436251f191354091d557da31c15b5/skills/doc-coauthoring/SKILL.md) | `ca45fc496a3436251f191354091d557da31c15b5`; 2026-10-28 | Reader perspective, section purpose, and a final test without hidden conversation context. Do not import repeated questionnaires, approval pauses, or product-document structure. |
| [Siqi Chen, Humanizer](https://github.com/blader/humanizer/blob/0ef9fe5bc3572734fd3ae6c448fe00a30cd5dcf0/SKILL.md) | `0ef9fe5bc3572734fd3ae6c448fe00a30cd5dcf0`; 2026-10-28 | Identify empty contrasts, defensive objections, stacked qualifiers, repeated endings, and monotonous rhythm. Retain real mathematical distinctions and necessary uncertainty; no detector scores or provenance claims. |
| [K-Dense, scientific-writing](https://github.com/K-Dense-AI/claude-scientific-skills/blob/5f2bc0341354fd5590aef76a533ada1e1e5b4e62/skills/scientific-writing/SKILL.md) | `5f2bc0341354fd5590aef76a533ada1e1e5b4e62`; 2026-10-26 | Separate source identity from claim support, preserve factual consistency, and remove unsupported content. Do not require clinical reporting structures, inline evidence IDs, registries, or universal human checkpoints. |
| [Master-cai, research-paper-writing](https://github.com/Master-cai/Research-Paper-Writing-Skills/blob/77e7c2c1ba06f7d71844873147665437a03aac1b/research-paper-writing/SKILL.md) | `77e7c2c1ba06f7d71844873147665437a03aac1b`; 2026-06-23 | Revisit paragraph purpose and reverse outlining before sentence polish. Translate empirical claim checks into complete proofs and matched citations for theorem papers; do not import mandatory ablations or promotional figures. |
| [David Sosa, sciwrite-prose](https://github.com/dvdsosa/scientific-writing-skills/blob/9e9e87adedcda0224a9a74a4ba9cb7ed0452d2b8/skills/sciwrite-prose/SKILL.md) | `9e9e87adedcda0224a9a74a4ba9cb7ed0452d2b8`; 2026-10-07 | Compare paragraph meanings to find duplication, remove empty openers, use precise verbs, and preserve technical repetition. Do not turn stylistic shortening into stronger mathematical or causal claims. |
| [Seifallah El Fetni, claim calibration](https://github.com/SFETNI/Scientific-Writing-Skills-Claude-Code-Codex/blob/ae6cdf414fd0c1f745b219e2ac741a52a99dec9c/skills/writing/skill_claim_calibration.md) | `ae6cdf414fd0c1f745b219e2ac741a52a99dec9c`; 2026-06-26 | Recheck unsupported assertions and the separation between evidence review and prose polish. Also read prose-quality and anti-AI-style guidance; keep scientific uncertainty without universal word bans or per-claim labels in the paper. |
| [dontbesilent, dbs-ai-check](https://github.com/dontbesilent2025/dbskill/blob/bab93c0376ced995c30cb841cb0d12622a430bcc/skills/dbs-ai-check/SKILL.md) | `bab93c0376ced995c30cb841cb0d12622a430bcc`; 2026-10-28 | Comparison reading on repetitive rhetorical forms and genre dependence. No text, taxonomy, thresholds, diagnostic format, or question-by-question workflow is incorporated. Do not manufacture hesitation or treat prose traits as authorship evidence. |
| [fcescob, mathematical-writing](https://github.com/fcescob/terence-tao-skills/blob/a35929906b50b803e436f9a1e8d33190d781a24e/skills/mathematical-writing/SKILL.md) | `a35929906b50b803e436f9a1e8d33190d781a24e`; 2026-09-06 | A secondary synthesis of Tao's advice: organize by proof milestones, explain the difficult inference, and make the result visible. Do not convert brevity into removal of necessary explanation or impose a theorem-label quota. |
| [inverno15, Notes on Mathematical Writing](https://github.com/inverno15/math-writing-notes/blob/c4f9813abce669393081e8ffc23b5dd1784926d9/main.tex) | `c4f9813abce669393081e8ffc23b5dd1784926d9`; 2025-12-19 | Secondary notes based on Knuth–Larrabee–Roberts's 1987 course: reader expectations, prose around formulas, semantic precision, and reading aloud at natural speed. No quoted attribution in these notes is treated as independently checked against the original course or Halmos essay. |

Additional inspected files: the first source's README; Humanizer's LICENSE;
K-Dense's writing-principles and source-ledger references; Master-cai's
paper-review reference; sciwrite-prose's clutter-lexicon and paragraphs
references; El Fetni's prose-quality and anti-AI-style files; dbskill's README;
the Tao synthesis's REFERENCE.md; and the mathematical notes' README. Licenses
were read for the MIT and CC BY sources identified below.

Tao's primary writing index, supplied by the secondary synthesis, is
https://terrytao.wordpress.com/advice-on-writing-papers/ . This review does not
claim a new reading of every linked original essay. Likewise the mathematical
notes are a secondary source for the 1987 course, not a substitute for its
original publication or an audited Halmos quotation.

The first-paragraph acceptance check, one-home verification status rule,
complete-support requirement, and 12–20-reference short-paper search target are
the present synthesis's editorial choices. The public sources do not establish
a universal reference-count standard. The target always requires relevant
citations and verified source support, with a documented reason for a smaller
bibliography in a genuinely narrower note.

## Direct mathematical review

The user's explicit writing priority is to foreground what the work achieves,
use confident language for supported results, and avoid excessive modesty or
a defensive catalogue of unaddressed questions. This is the leading editorial
principle; evidence checks support it and retain scientifically necessary scope.

A private mathematical coauthor review dated 2026-09-26 supplied the practical
editing lessons: publicly reachable proof artifacts; precise citation topics;
soundness/completeness separation; removing a redundant algebraic dependency;
direct contribution statements; concise open problems; and moving detailed
build procedures from the paper to an accessible package README.

These are paraphrased and generalized. The package contains no raw email,
addresses, message identifiers, unpublished proof tables, or asserted permission
to publish a coauthor's private material. A future user must inspect their own
paper and evidence; the originating project's validation results do not transfer.

User feedback and a further private mathematical review on 2026-10-03 motivate
the discipline-and-voice reference: learn field-specific exposition, avoid
inflated result labels, write the decisive proof steps, and distinguish
stylistic quality from actual authorship. The new reference uses original
generalized examples. It does not claim that prose style detects AI, and it
does not encode one journal's human-wording rule as a ban for every venue.

The 2026-10-05 follow-up adds an operational review of printed theorem titles,
cross-reference labels, proof dependencies and finite-verification reductions.
It also adds a feedback loop that separates explicit coauthor comments from
editorial interpretations and checks whether a defect recurs in later drafts.
The examples remain generalized; raw correspondence stays in private records.

A private coauthor manuscript revision reviewed on 2026-10-29 motivates the
proof-completeness reference: retain the reasoning behind normalization and
subset coefficients, separate the compact main argument from checkable appendix
derivations, and follow domain, dimension, boundary, and equality conditions
through later uses. This is a generalized writing lesson, not a claim that
every step of the motivating draft was correct. No private manuscript formula,
correspondence, author identifier, or project validation result is distributed.

## Skill discovery documentation

Official Codex documentation inspected:
https://developers.openai.com/codex/skills/ . It describes progressive loading,
local discovery, supported skill folders, and symlink support. A remote registry
entry is not itself proof that a local agent has installed or loaded a skill.
Distribution/access instructions and receipts live outside this reusable method.

## License notices

The original synthesis has no additional license grant declared here. Preserve
the upstream attribution above and the notices below when redistributing this
package; do not mislabel the whole package as solely MIT.

MIT notice for the consulted/adapted repository material:

Copyright (c) 2025 K-Dense Inc.

Copyright (c) 2025 Siqi Chen

Copyright (c) 2025 inverno15

Copyright (c) 2026 Master-cai

Copyright (c) 2026 David Sosa

Copyright (c) 2026 fcescob

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

El Fetni's skills/documentation remain attributed under CC BY 4.0 as specified
above; the existing adaptations and this revision change their application
to proof-based writing. K-Dense, Humanizer, the Tao synthesis, and the course
notes declare MIT for their original repository material; that declaration
does not independently license quotations from their underlying sources.
Anthropic was consulted for workflow ideas without copying its document.
dbskill declares CC BY-NC 4.0 in its README; it was read for comparison only,
and none of its licensed expressive material is included in this package.
