# Concrete editing patterns

These are original generalized examples. They preserve lessons from a
mathematical coauthor review without reproducing the private email.

## Defensive patterns to remove in manuscript prose

The following patterns are banned as routine rhetorical padding. Search for
them and read each hit in context; rewrite the whole sentence when needed.
Quoted language, analysis of these phrases, and indispensable mathematical
negation are not padding. A hypothesis or uncertainty that changes the claim
must survive the edit. Replacements below are examples, usable only when the
stated proof or source supports them.

| Pattern | Replacement or action |
| --- | --- |
| "We do not claim ..." / "No claim is made ..." | State the proved result with its scope. If a relevant extension is open, name that question once. |
| "It should be noted that ..." / "It is worth noting that ..." | Delete the opener; give the fact, equation, or citation directly. |
| "To the best of our knowledge ..." stacked with "appears", "may", or "subject to ..." | Give a checked comparison with the closest sources. Remove unsupported priority language. |
| "This does not establish ..." / "This should not be taken as ..." after each result | State the result actually obtained. Put one relevant unresolved question in the discussion, or cut the aside. |
| "We merely ..." / "only a modest ..." / "we attempt to prove ..." for a completed proof | "We prove ...", "We construct ...", or "Applying [source, theorem] gives ...", as supported. |
| "It may possibly suggest ..." for an established conclusion | State the conclusion and its proof/reference. For a genuine estimate or interpretation, keep its actual uncertainty. |
| Repeated "exactly computed", "not independently verified", "we did not verify", or "not kernel checked" | Give one status sentence/table identifying the results and actual checking scope. Keep the finite range and arithmetic assumptions where logically needed. |
| "This is not X; rather, it is Y" when X is an invented objection | State Y. Keep a contrast when both sides distinguish actual mathematical objects or correct a documented misunderstanding. |
| "Clearly", "obviously", "by a standard calculation" at the decisive new step | Write the missing calculation or inference. For a borrowed standard tool, give a precise citation and its instantiation. |
| "It is well known ..." / "Various approaches exist ..." with no source | State the relevant fact or comparison and cite its actual sources. |
| "This rigorous/comprehensive/robust framework ..." without a defined property | Name the construction and the property proved. Keep technical uses of these words when defined and supported. |
| "In conclusion, we have shown ..." repeating the abstract | Cut the repeated summary; give a new consequence or relevant open question if one is needed. |

For example, after proving an upper bound, replace "We do not claim optimality"
with the bound itself; if sharpness matters, say "Whether the bound is sharp
remains open" once. Never change this to "The bound is sharp" without a proof.
Likewise, removing "we did not verify" does not permit inventing a completed
check. Unsupported result claims must be repaired or removed before polishing.

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

For mixed verification, choose one nearby status sentence or table as the home
of the distinction. For example, when accurate: "The formal development covers
Theorems 1–2; Table 1 reports rational-arithmetic checks for 1 <= n <= N."
Point to it when needed instead of adding a disclaimer after every result.
If a later result has a different status, update that single account and make
the result's own scope explicit. A separately distributed supplement may need
its own self-contained status statement.

Keep arithmetic exactness where it is a premise of a proof, finite ranges with
computational claims, and hypotheses in theorem statements. These carry
mathematical information. Machine identities, source hashes, commands, and
archived-run details belong in the supporting package.

Keep AI disclosure focused on roles and responsibility. A separate discussion
of model reliability or an internal audit history is unnecessary unless it
affects the scientific conclusion or is requested by the venue.

## Structure before cosmetics

Privately summarize each paragraph in one sentence. Remove duplicates, order
definitions before use, and connect obstacle to construction to consequence.
Then edit wording. Do not force every paragraph into the same length or make
all sentences short. A theorem's exact technical noun should not be replaced
with a loose synonym merely to reduce repetition.
