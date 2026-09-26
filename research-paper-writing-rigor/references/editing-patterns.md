# Concrete editing patterns

These are original generalized examples. They preserve lessons from a
mathematical coauthor review without reproducing the private email.

## State the result and mechanism

When a theorem is established, "We prove that every admissible input has a
unique output" communicates more accurately than "We attempt to provide some
evidence that admissible inputs may have unique outputs". When the evidence
is limited to a finite test, state the observed range instead. Confidence
comes from matching the sentence to the strongest available support.

Weak: "A finite comparison cannot establish the result. Instead, we undertake
a verification process with several checks."

Better, when supported: "We construct an addition automaton, prove soundness
by a carry invariant and completeness by language inclusion, and verify the
recurrence on synchronized representations."

The revision names the proof mechanism. It does not make the finite computation
optional or replace it with an appeal to an experiment.

## Foreground the completed construction

Weak emphasis: "We do not establish the experimental six-symbol description,
and our construction is not claimed to be minimal."

Better contribution statement, when proved: "We construct an explicit
non-erasing morphic presentation of the difference sequence and prove its
equivalence to the recurrence."

The relation to a smaller candidate and the minimality question can appear
briefly in the discussion of open problems. If the surrounding text would
otherwise imply that the smaller candidate was proved, clarify the distinction
there. An open extension should not displace the result actually obtained.

## Remove unnecessary self-diminishment

Weak: "Our work is merely an application of existing automata methods."

Better, when supported: "Using synchronized automata, we identify the recurrence,
derive explicit discrepancy bounds, and construct a morphic presentation."

Cite the existing method where it is introduced. A known method can yield a
substantial new result; it does not require describing the result as trivial.
Similarly, replace "we only formalize" with the actual formalization result
and its scope. Preserve a paper's true relationship to earlier work.

## Replace repeated novelty denials with attribution

Weak: "These are precedents; we do not claim that the general optimization
method is a new contribution."

Better: "We apply the optimization method of [reference] to the correction
automaton E. The new result is the identification of the sequence."

Credit must remain attached to the actual borrowed method. Do not remove the
citation or call the whole method new while making the prose more confident.

## Keep one effective completeness qualification

Repetitive: "The cutoff is only a candidate. Stabilization is not proof. We do
not infer correctness from state counts."

Better: "The carry bound restricts the candidate automaton; completeness is
certified by the inclusion in (equation)."

If that inclusion has not been checked, this is not a permissible rewrite.
State the missing check instead. If no proof reduction exists, keep the claim
experimental.

## Condense a witness argument without deleting it

Supported shortening: "The witnesses are bounded by n, and their padded
representations fit the synchronized tracks. Thus projection loses no witness."

Unsupported shortening: "Projection is valid."

The first version retains the reason. Review the actual bound and padding
convention before using it.

## Use standard, self-contained objects

- Replace "the supplied finite-state correction" with "the correction automaton E".
- Replace an unexplained "all-index recurrence" with "the recurrence ..., valid
  for every n >= 0" when that domain is correct.
- Attribute an imported "canonical polynomial" to its source rather than
  assuming the adjective identifies a unique convention.
- Remove "Revised draft with verification appendices" from a publication title
  page unless a venue or user specifically requires that label.

## Describe open questions directly

Verbose: "No minimality is asserted, nor should this be taken as establishing
the separate experimental substitution."

Better: "Whether this presentation is minimal, and whether it agrees with
the experimental substitution, remain open."

Do not change the second clause to "the substitutions differ". An unproved
relation is not a negative result. Identify whose construction it is when
attribution matters.

For extrema, "We do not know whether these extrema are attained" is often
enough locally. If equality with asymptotic extrema is a separate open question,
retain that distinction where the paper discusses it.

## Remove a false dependency, not a real assumption

If exact expansion proves an energy identity for every nonzero parameter r,
write "Expanding gives ..." instead of "Using the cubic equation for r gives ...".
Keep the cubic relation where it establishes positivity, bounds, or the
recurrence. Verify the algebra rather than trusting a stylistic suggestion.

## Put execution detail in its proper place

Paper: "The package rebuilds the formal development with pinned dependencies
and records source hashes and final axiom closures. See the package README."

Package README: exact command, versions, dependency acquisition, source hash
manifest, validation scope, archived run date, and any platform requirements.

Do not substitute the short paper sentence for the full instructions if no
accessible README exists. Do not describe an archived local run as hosted CI.

## Keep necessary scope statements without repeating them mechanically

If fine numerical bounds are not kernel checked, state that at their first
potentially ambiguous presentation or in a nearby verification description,
and give the exact scope in the verification appendix. Remove repetitive copies
only when a reader can still tell which results are formalized.

Keep AI disclosure focused on roles and responsibility. A separate discussion
of model reliability or an internal audit history is unnecessary unless it
affects the scientific conclusion or is requested by the venue.

## Structure before cosmetics

Privately summarize each paragraph in one sentence. Remove duplicates, order
definitions before use, and connect obstacle to construction to consequence.
Then edit wording. Do not force every paragraph into the same length or make
all sentences short. A theorem's exact technical noun should not be replaced
with a loose synonym merely to reduce repetition.
