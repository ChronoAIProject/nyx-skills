---
name: research-paper-writing-rigor
version: "1.1"
description: Draft, revise, or review research manuscripts that foreground completed contributions with confident, evidence-grounded prose. Remove excessive modesty and defensive repetition while preserving exact claims, attribution, and reproducibility. Especially useful for mathematical, theoretical-CS, and computer-assisted papers, short notes, and coauthor revisions; adaptable to empirical papers. Use for manuscript work, not outreach campaigns or standalone theorem proving.
metadata:
  category: tool-based
  tool-list: [filesystem, shell, web-search]
  tag: [research-writing, mathematics, scientific-writing, reproducibility, peer-review]
  depends-on: []
---

# Research Paper Writing with Rigor

Write a paper that lets a knowledgeable reader see the result, understand why
it follows, identify what is new, and obtain the evidence needed to check it.
Use direct language for established facts and precise uncertainty for open
questions. Concision must preserve the mathematical or scientific meaning.

## Primary principle: make the completed contribution visible

The paper's main job is to explain what the authors accomplished, how they
accomplished it, and why it matters. Organize the abstract, introduction, result
summaries, and conclusion around those completed contributions. Give supported
results their full strength: "we prove", "we construct", "we establish", and
"we formalize" are appropriate when the evidence warrants them.

Excessive modesty can misrepresent the work as surely as exaggeration. Remove
"merely", "only a modest step", "we attempt to", or "may suggest" when they
weaken an established result without a scientific reason. Preserve qualifiers
that express actual uncertainty, statistical evidence, or mathematical scope.
Neither routine attribution nor an unresolved extension requires an apology
for the present result.

Evaluate a proposed caveat by the reader's needs: would omitting it materially
change the claim's meaning, evidence level, applicability, or attribution? If
yes, state it precisely at the relevant point. If no, remove it or move useful
operational detail to the supporting documentation. Do not invent hypothetical
claims a reader might make merely to deny them. Avoid opening or closing a
contribution paragraph with a catalogue of things the paper does not do.

Use evidence checks to earn confident writing. A review finding should lead
to the strongest accurate statement supported by the work; default hedging is
not the goal. The final reader should remember the result and its mechanism.

## Choose the requested work

- For a sentence or paragraph, give the concrete revision and only material
  explanations. Do not create a manuscript-wide audit or release workflow.
- For drafting or substantial revision, read the current source, relevant
  results, and coauthor comments before editing. Work from the actual latest
  version, not a remembered draft or stale line numbers.
- For review only, lead with findings and locations; do not silently rewrite
  files. Distinguish a demonstrated error from an unresolved concern.
- For a submission package, read [release-and-reproduction.md](references/release-and-reproduction.md).
  Editing prose alone does not authorize repository publication, journal or
  arXiv submission, messages to others, or shared CI changes.

Adapt the structure to the discipline, venue, and requested length. A short
mathematical note need not have IMRaD sections, ablations, a teaser figure,
or an experimental-performance narrative. Follow explicit user instructions
and applicable venue requirements over these defaults.

## Establish the argument before polishing

Identify the question, main result, key obstacle, proof or method mechanism,
closest prior result, and remaining uncertainty. For long work, use a short
private outline or claim-source map if it helps; reuse existing records.
Do not insert drafting labels or audit tables into the manuscript by default.

For each central claim, know its scope and supporting evidence. Preserve
quantifiers, initial indices, exceptional cases, hypotheses, and constants.
Separate new mathematics from a new proof, a formalization, an implementation,
and an empirical observation. Do not equate an agent's agreement or a finite
prefix match with an all-input proof. Read
[argument-and-evidence.md](references/argument-and-evidence.md) for proofs,
computer-assisted results, literature application, or mixed verification.

Unsupported claims need a narrower statement, evidence, or a clearly marked
open question. Do not invent proof steps, references, numbers, author actions,
model identities, successful checks, or public artifact links. A blocked claim
need not stop independent writing work on supported results.

## Write as a research paper

1. Lead with the mathematical or scientific content: what is established and
   the mechanism that establishes it. State the contribution specifically and
   at its full supported strength; keep it as the paragraph's main message.
2. Give each paragraph a clear job. Check the sequence of paragraph messages
   before polishing sentences. Connect definitions, arguments, evidence, and
   consequences in the order a reader needs them.
3. Use precise verbs and stable terminology. Prefer an identifiable object,
   such as "the correction automaton E", to "the supplied correction".
   Avoid internal project language and chronology unless they matter to the
   result. Repeating a defined term is preferable to a misleading synonym.
4. Credit the specific method or theorem being used, where it is used. Replace
   repeated novelty denials with positive attribution and a clear statement of
   this paper's extension. A citation must support the exact attached claim.
5. Separate indispensable limitations from defensive repetition. Keep a
   qualification beside a claim if omitting it would change its interpretation;
   consolidate remaining scope details in the verification or limitations
   section. There is no fixed quota for caveats.
6. State open problems as open problems. Distinguish an unproved identity,
   minimality, attainment, asymptotic behavior, and a dynamical interpretation.
   Do not replace "not established" with "false" or "unnecessary".
7. Put operational details where readers need them: essential proof evidence
   in the paper or a precise accessible reference, reproduction commands and
   detailed environment records in the supporting package. The main text
   should not become an account of internal orchestration or mail handling.

Read [editing-patterns.md](references/editing-patterns.md) when tightening prose
or applying coauthor comments. Its examples are decision patterns, not mandatory
sentences to paste into every manuscript. Do not mechanically ban passive voice,
hedging, repeated terms, or punctuation that serves the argument.

## Apply comments with judgment

Classify material comments as correctness, attribution, scope, reproducibility,
or presentation. Check technical replacements against their surrounding proof;
do not infer validity from the reviewer's authority alone. A shorter sentence
must retain the witness bounds or hypotheses that make it true. Verify removal
of an algebraic assumption with exact reasoning where feasible.

Implement supported changes when revision is requested. Explain disagreements
with evidence and propose a precise alternative. Keep a compact disposition
record only when the number or importance of comments warrants one. Do not
require a separate approval checkpoint for every reversible edit.

## Verification, authorship, and AI use

Report the actual verification scope: which statements were proved, which were
kernel checked, which computations ran, and which results are merely reported
by another author. A successful build is evidence about a specific source
version; it is not validation of all prose or a fresh independent review.

Describe actual AI roles when disclosure is required or requested: exploration,
code generation, formalization, debugging, cross-checking, literature assistance,
or writing. Use confirmed model names, with "primarily" when appropriate.
Do not reduce substantial AI involvement to grammar correction or code review.
Do not say that every proof was kernel checked when the formalization covers
only a subset. Human review or responsibility statements must not pretend that
every coauthor personally reran every tool or already approved a pending draft.
Follow the target venue's disclosure rules. Do not fix one project's models,
author contributions, institutions, or acceptance status into future papers.

## Finish proportionately

Check that the abstract, introduction, theorem statements, tables, conclusion,
and verification description agree on the central claims. Read the abstract
and conclusion once just for emphasis: do they make the completed result and
its significance clear, or does a list of exclusions obscure them? Correct
unnecessary hedging as well as overstatement. For changed LaTeX,
compile the affected deliverable when available and inspect relevant rendered
pages; report unavailable validation honestly. Do not rerun expensive formal
jobs solely for prose changes unless changed claims or project rules require it.
Respect the configured validation machine and existing repository gates.

Deliver the requested prose or artifact first, then a short account of material
changes, completed checks, and remaining decisions. Keep internal checklists out
of the publication text. Do not promise acceptance, universal novelty, or that
all possible objections have been eliminated.

For provenance and deliberate departures from upstream writing skills, read
[sources.md](references/sources.md). This skill contains paraphrased lessons
from a private mathematical coauthor review, not the correspondence itself.
