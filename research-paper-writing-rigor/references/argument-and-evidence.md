# Argument, attribution, and evidence

Evidence calibration works in both directions: reduce claims that exceed their
support and strengthen language that understates established results. Use this
guide to write a precise affirmative account of the contribution. Its list of
evidence boundaries is a working aid, not a list of disclaimers to paste into
the manuscript.

## Match a claim to the right kind of support

Use this distinction in working notes when useful; the labels need not appear
in the paper. A claim can have more than one kind of support.

| Support | What it can justify | What it does not justify alone |
| --- | --- | --- |
| Mathematical proof | A conclusion under the stated hypotheses and quantifiers | Priority, independent review, or implementation correctness |
| Kernel-checked theorem | The literal formal statement under its audited axioms, definitions, and source version | Every informal interpretation, the whole manuscript, or unrelated numerical results |
| Exhaustive finite certificate | A finite property; an infinite conclusion when a proved reduction connects them | An all-input conclusion without that reduction |
| Exact arithmetic computation | The checked identity, interval, witness, or bound, including rounding direction | A result never checked or all-input extrapolation |
| Floating-point or finite experiment | Observations over the stated range and precision | Exact equality, universal truth, or nonexistence outside the search |
| Prior theorem | The cited conclusion with hypotheses matched to this setting | Applicability based only on similar terminology or spectral behavior |
| Author or reviewer report | What that person reports checking or believing | A run we performed or a verified replication of every tool |
| Conjecture or interpretation | A motivated question or explicitly qualified explanation | A proved claim |

### Read the literal statement

Track the domain, indexing, exceptional initial values, strict versus weak
bounds, universal versus existential quantifiers, and parameter restrictions.
Do not convert "the set of possible offsets is exactly S" into "all offsets
lie in S" without noticing the loss of witnesses. An experimental match with
a substitution is different from a proved morphic presentation, and a variable-
length output morphism is different from a letter coding.

Global infimum/supremum, attained minimum/maximum, and asymptotic liminf/limsup
are different claims. Compressing the prose must not identify them accidentally.

## Computer-assisted mathematics

Explain the logical chain, not merely a list of tools:

1. What finite objects encode the mathematical problem?
2. Why do accepted objects have the claimed meaning (soundness)?
3. Why are all required mathematical cases represented (completeness)?
4. What finite check was executed, and how does its result imply the theorem?

A chosen state or carry cutoff produces a candidate; completeness needs a
proved bound or successful inclusion/coverage certificate. Stabilizing state
counts as the cutoff increases is not that certificate. If automata use padded
representations and existential projection, account for the representation
length of witnesses. State this once at the relevant proof step.

For recurrence identification, distinguish a guessed description from the
proof of initial conditions, index bounds, recurrence, and uniqueness. If one
step is absent, identify that step rather than weakening every sentence.

For formal verification, record the theorem entry points, source revision,
compiler/library versions, and axiom scope in the artifact documentation. Check
the bridge between the formal definitions and the paper's intended objects.
Neither a generated proof file nor a compiler exit code alone explains that
bridge. Distinguish an archived successful build from a new run.

Independence is specific. Two programs can independently implement language
operations while sharing a literal transition table. Two agents from the same
model family are not independent mathematical evidence merely because they
agree. A coauthor running Python is not evidence that they ran Lean and Walnut.

## Algebraic dependencies

Before removing "using hypothesis H", determine which equality uses H. An
identity may hold for a free parameter while its positivity or interpretation
requires a special algebraic root. Exact symbolic expansion can validate the
identity; floating-point examples cannot establish it. Retain nonzero-denominator
conditions and do not remove H from neighboring steps without checking them.

## Literature and contribution

Match references to precise claims: existence of normalization, finite
expansions, regularity of a language, conversion from automatic to morphic,
or an effective optimization method are not interchangeable topics.
Read the relevant statement and assumptions in the primary source when a proof
depends on it. A title or abstract can locate a reference but cannot establish
all its hypotheses. Mark inaccessible or author-supplied bibliographic details
in working notes; do not silently upgrade them to independently verified facts.

For an application, compare the base, polynomial, initial values, digit set,
recognition order, and indexing against the theorem's assumptions. Explain a
direct construction when it avoids a failed or uncertain applicability step.

State prior method and present contribution separately, for example:

> We use the finite-tail method of [reference]. Our contribution is the
> identification of this recurrence and an explicit non-erasing presentation.

Do not require every theorem paper to outperform an empirical baseline. Do not
hide the method's provenance behind "related background" when it is actually
used. A formalization of a published theorem can be valuable; call it that.
Bounded literature searches cannot certify "first ever". Record the scope of
a priority search when it matters without flooding the paper with disclaimers.

## Scoped private claim map

When the task warrants one, use a small table in working notes:

| Claim and location | Exact scope | Source or theorem | Check actually performed | Remaining issue |
| --- | --- | --- | --- | --- |

Populate it with actual evidence. Do not demand new registry files for a one-
paragraph edit, attach status labels to every manuscript sentence, or block
supported sections while an unrelated claim is still being investigated.
