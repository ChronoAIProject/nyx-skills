# Complete proofs in compact mathematical notes

Use this guide for substantial mathematical-note drafting, revision after a
coauthor asks for more detail, or review of an argument that reads like a sketch.
The reader should be able to check the retained result from the manuscript,
its appendices, and the specific standard results it cites.

## Start from the actual request and source

Identify the exact question, current statement, and latest coauthor source.
Keep completed coauthor edits and notation unless a verified correction or the
requested scope requires a change. Distinguish observed changes between actual
versions from an editorial inference about what an author intended. A request
to complete a local proof does not call for merging unrelated research.

## Expose the inference that does the work

Trace the main claim through its definitions, auxiliary results, and conclusion.
Use an existing outline or a small private dependency list when helpful; no
separate ledger is required for every note. For a nonroutine transition, write
the operation, the assumption that permits it, and the resulting expression.
Concentrate detail where a reader would otherwise have to invent an argument.

- On substituting normalized variables, track numerator and denominator powers,
  logarithmic corrections, integration measures, and the final normalization.
- In a subset sum or average, count how often a fixed term occurs and show how
  that multiplicity combines with the prefactor. Check the first admissible
  index and endpoint coefficients when they matter.
- When a scalar statement is used for matrices, give the theorem or matrix
  argument that licenses the passage. Ordered eigenvalues are generally not
  affine functions of a matrix. A difference of concave functions has no
  automatic convexity sign. Identify the representation or inequality that
  actually proves the desired property.
- Replace "a standard calculation", "by continuity", or "similarly" when it
  hides a central new step. A standard theorem can supply a short proof when
  its precise statement is cited and its hypotheses are checked here.

If a needed step cannot be proved, repair it, narrow the claim, or mark the
precise issue. Adding explanatory sentences around a missing inference does
not establish the result.

## Keep the objects and their domains visible

When passing between representations, check the object, its domain, parameter
range, dimension, and normalization on both sides. In particular:

- A normalized state and a positive matrix of arbitrary trace may obey
  different scaling identities. Define a conditional object only when its
  normalizing mass is positive and account for the zero-mass case separately.
- Rank and ambient dimension are different parameters. Equality of nonzero
  spectra of two Gram matrices does not justify equating a dimension-dependent
  functional. Check the actual rule for embeddings or appended zero entries.
- A formula derived for distinct positive parameters cannot be evaluated at
  coincident or zero parameters by simply cancelling undefined fractions.
  Identify a valid approximation, recursion, integral representation, or
  confluent formula and justify its limit, including any interchange required.

Do not generalize an endpoint's invariance, strictness, or equality behavior to
an interpolating family without a proof. Keep domain conventions effective in
later applications as well as in the definition section.

## Use appendices to preserve a compact argument

Keep the question, theorem, proof mechanism, and decisive inference in the main
text. Put a longer derivation in an appendix when that improves the reading
order, with a precise equation or lemma reference at the point of use. The
appendix should state what it proves, define its local variables, supply the
derivation, and reconnect it to the claim in the main text.

The mathematical proof belongs in the manuscript or an explicitly identified
mathematical supplement; execution logs and reproduction commands belong in
the supporting package. Neither a repository link nor an assurance that code
passed fills a missing mathematical argument. Conversely, do not expand every
routine substitution or duplicate a standard theorem's proof. Keep a second
proof when it checks a delicate point or explains a distinct mechanism.

Under a strict length limit, simplify the scope or use an allowed appendix.
Do not retain the same theorem while replacing its essential proof with a
summary. Judge concision at the same mathematical scope, not by page count
alone.

## Check equality and the simplest relevant controls

For an equality characterization, track where equality is needed in each
inequality of the proof, establish necessity on its stated domain, and verify
the converse. A proof of nonnegativity alone does not characterize its zeros;
strictness for an interior case need not cover boundary points.

Where helpful, try inexpensive exact controls before polishing a broad claim:
the smallest admissible dimension, pure and product inputs, a symmetric or
maximally mixed input, boundary rank, and an intermediate parameter. Choose
controls relevant to the argument, not a compulsory battery for every edit.
A genuine counterexample falsifies the claim even if other examples or a model
review support it. Passing finite controls diagnoses a proof; it does not
replace a proof for all parameters.

## Read the deliverable without the surrounding conversation

For a substantial proof revision, check that a suitably prepared reader can
reconstruct the nonroutine derivations using the delivered source, appendices,
and cited statements, without the chat, private working notes, or hints about
the intended argument. Identify the first unjustified inference and repair it;
do not use a global "looks correct" assessment as its substitute.

Recheck affected dependencies and the abstract's scope after a normalization,
domain, or dimension correction. If the task is confined to one lemma, record
a demonstrated downstream error with its location and witness, preserve work
outside the requested scope, and report exactly what has been completed.
