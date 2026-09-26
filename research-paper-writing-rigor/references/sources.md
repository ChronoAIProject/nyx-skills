# Sources and adaptation decisions

Reviewed on 2026-09-26. This is a synthesized writing method, not a verbatim
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

Copyright (c) 2026 Master-cai

Copyright (c) 2026 David Sosa

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
