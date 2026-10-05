# Writing in the discipline's language

Use this reference for substantial drafting, translation, or a review that
finds the manuscript generic, formulaic, or detached from its mathematics.
The aim is good academic exposition. Perceived authorship is not a reliable
test of correctness, and stylistic revision does not change actual provenance.

## Establish the local conventions

For a long manuscript, use a small set of relevant papers whose text has
actually been inspected. A close mathematical predecessor teaches what the
reader knows; an appropriate journal paper teaches scale and presentation;
the coauthors' text teaches local notation and voice. These roles may be
filled by the same paper. Reuse available sources before retrieving more.
Never treat a title, citation count, or an inaccessible paper as a style
sample. Do not claim a sample is human-authored without evidence.

Privately notice the choices that change exposition:

- What problem appears before the first definition or theorem?
- Which terms are conventional and which must be introduced?
- What calculations are written out, and what is left to the reader?
- How do citations distinguish the inherited theorem from the new step?
- Where are hypotheses, exceptional indices and computational premises stated?
- How many named results are needed for the proof's actual dependencies?

Use the answers to fit the present argument. Do not reproduce a sample's
section count, rhetorical phrases, sentence lengths or author mannerisms.
A short recurrence note and a broad empirical paper need different forms.

## Turn a research record into an argument

A development log answers what was tried and checked. A paper answers what
follows and why. Begin with the mathematical dependency order, not the
chronology of computations, email replies or tool sessions.

For a mathematical note the relevant sequence is often: the recurrence and
its initial values; the obstacle; the structural description; the estimate
or induction; the consequence. It need not become five titled sections.
Move failed experiments to the paper only when they explain a genuine
obstruction or a choice in the proof.

Distinguish a lemma needed by the main theorem from a calculation worth one
display. Do not promote every useful identity to a named theorem. A name such
as “dispersion lemma” is useful when a specific dispersion inequality is
defined and reused. A long label assembled from several attractive nouns
usually tells the reader less than the inequality itself.

Replace internal labels with the object or property they stand for:

- “profile interface” may mean the specified functions and identities;
  give those definitions rather than importing a software metaphor.
- “finite certificate” is appropriate if a finite object and its checking
  condition are defined and logically used. Give that condition.
- “landing” or “collar” can be appropriate in a field or a paper that defines
  them. Otherwise say where the orbit enters or state the interval.

These are choices about meaning, not a blacklist. A valid technical term
should remain stable even when repetition is stylistically noticeable.

## Make each paragraph carry an inference

Before revising sentences, describe the paragraph's mathematical job in one
line. If its job is only to call the method robust, rigorous, illuminating or
important, replace that assessment with the result or reason that earns it.
If two paragraphs have the same job, combine them or give each a distinct step.

Useful connective phrases identify an operation: “Summing (3) gives …”,
“The two contributions cancel because …”, or “Since the starting discrepancy
is bounded, …”. A chain of “Furthermore”, “Importantly” and “This highlights”
can conceal the absence of a dependency. Keep transitions that help, and
remove those that merely announce another sentence.

Vary paragraph length according to the mathematics. A one-line consequence
and a longer induction can sit naturally beside each other. Do not impose a
result/evidence/caveat/open-question template on every paragraph.

## Show the decisive calculation

### Review theorem labels and proof dependencies

When a coauthor flags excessive theorem or corollary titles, inspect the
optional printed titles separately from LaTeX cross-reference labels. Keep
cross-references working. Retain a printed title when it names a standard
result or helps the reader find a result used later; omit a decorative title
when the numbered statement already says what is needed. Do not remove all
names mechanically.

For each affected statement, check its mathematical role. An immediate
substitution may fit in the preceding proof or in one sentence after it;
an independent result used later can justify its own environment. Write the
inference that connects it to the main argument. Reducing the number of
environments is useful only when the dependency order stays clear.

When a note uses finite verification, explain the reduction that makes those
checks sufficient, the exact finite premises and how they can be checked.
Keep essential evidence accessible while moving execution logs out of the
argument. Replacing the word “certificate” cannot repair a missing proof,
and removing a computational premise can invalidate a theorem.

For substantive revisions, inspect the rendered title, abstract, a central
theorem and its proof as continuous exposition. Check that technical nouns
are defined, named results have a purpose, and transitions give the actual
inference. Record unresolved mathematical objections separately from style.

A proof must let the intended reader recover the conclusion. “A standard
induction establishes the claim” is adequate only when the actual induction
step is straightforward in the stated setting. If a recurrence uses its own
values as indices, write the index bounds and the step that makes induction
legal. If a limiting argument needs uniformity, state which constant is
uniform and why.

For example, suppose a binary pair consists of a run of R ones followed by
a word of length B containing B-R ones. Let alpha satisfy alpha+alpha^2=1
and put d=R/B, with B>0. The useful proof passage is:

> The pair has length B+R and contains B ones. Its excess over density alpha
> is therefore B-alpha(B+R)=alpha B(alpha-d). Thus the paired error vanishes
> at d=alpha.

“An exact cancellation mechanism yields density alignment” omits the reason.
The concrete passage is both shorter and more informative. It does not
assert that an unrelated recurrence has this paired structure.

A calculation can still be wrong in fluent academic English. Verify the
identity and assumptions before polishing it.

## Calibrate the visible qualification

Put an unproved structural assumption into the proposition's hypothesis:

> If the first-difference segments have the stated paired-word form, then
> A(n)=alpha n+O(n/sqrt(log n)).

The proof can then develop the implication directly. Finite agreement with
the word formula belongs in a separate numerical statement with its range.
It cannot silently discharge the hypothesis.

When the structural identity has been proved, state the unconditional result
and cite or prove the identity. Remove obsolete hedging. Do not compensate
for cautious prose by hiding a required assumption in a footnote.

State indispensable verification scope where it matters. Consolidate
reproduction commands, source hashes and machine details in the supporting
package. Retain essential finite premises and enough information to check
them in the argument; presentation polish cannot erase a logical dependency.

## Translate meaning before rhetoric

For translation, extract the literal claim, assumptions, attribution and
inference first. Preserve them while writing idiomatic sentences in the
target academic language. Verify quantifiers, index ranges, inequality
directions, theorems cited and the level of certainty after translation.
Choose target-language terminology from relevant usage rather than
translating technical words one by one.

An English article need not preserve Chinese sentence order or repeated
summary phrases. Nor should translation upgrade “the computations agree”
to “we establish”. Resolve genuine source ambiguity with a comment or the
user's context rather than fluent invention.

## Preserve voice and authorship

Where coauthors already have a consistent prose style, edit locally in that
style. Do not rewrite the entire paper to prove that a skill was applied.
Keep useful conventional passive constructions, ordinary notation and
technical repetition. Avoid added anecdotes, emotional language, deliberate
awkwardness or invented personal motivations.

There is no dependable vocabulary test for AI authorship. A reviewer's
reaction can reveal inflated labels, repetitive framing, missing proof or
poor disciplinary fit. It is a reason to improve those concrete defects,
not to declare every suspect-looking term illegitimate.

Venue policy is separate. If model-written submission wording is prohibited,
help in the permitted roles: derive the mathematics, check sources, organize
dependencies and identify deficiencies in the authors' own text. A polished
model paragraph remains model-written working material. Do not describe it
as human-authored after approval, translation or surface changes.

## Check the result

Read the main theorem and its proof as a specialist encountering the paper
for the first time. Can the reader tell what is new, which step is borrowed,
and how the conclusion follows? Check this against the source evidence,
not an AI detector.

Also read representative passages aloud or as continuous prose: notation
must have antecedents, transitions must express actual dependencies, and
the explanatory density should follow the difficulty of the argument.
There is no required score, caveat count or prescribed percentage of edits.
Report material improvements and remaining proof or author decisions.

## Iterate from actual coauthor feedback

Keep a short private record when learning from a substantive review: the
actual comment, the affected passage, the concrete change and what was
rechecked. Distinguish the reviewer's explicit objection from the editor's
interpretation; do not turn a reaction to one label into a universal ban.
Carry recurring, generalizable lessons into this skill with synthetic
examples, keeping private correspondence out of a distributed package.

At the next revision, check whether the same defect recurs in representative
passages. Record whether a coauthor has actually reviewed the new version;
local validation or a self-review does not establish their acceptance.
