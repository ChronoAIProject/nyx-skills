# Focus, structure, and a complete short argument

Read this for a new note, a substantial paper revision, or feedback that the
draft repeats itself, sounds defensive, or compresses proofs too far.

## Choose one question before choosing a length

Privately write the question, the exact main result, and the inference that
makes it work. The introduction's first paragraph must identify the question
and answer, with the hypotheses that determine its scope. An abstract does
this independently in its opening paragraph. A technical theorem can follow
after notation; the opening still needs an accurate, informative version.
Background such as "This topic has attracted considerable attention" does
not answer either question.

Reverse-outline the manuscript: give each paragraph one short description of
what it contributes. Keep a paragraph if it poses the question, establishes a
needed definition or dependency, supplies a proof step, explains the mechanism,
compares a relevant prior result, or draws a useful proved consequence. Remove
material with no such job. A supporting example can earn its place by exposing
a boundary case or explaining why a hypothesis is needed.

Focus first on one main result and its necessary dependencies. Keep a second
result when it advances the same question and merits a complete argument.
Cutting a secondary theorem requires updating its abstract promise, introduction,
later deductions, cross-references, and citations. A shorter paper must still
prove everything it presents as established.

## Give repeated material one home

Audit the abstract, introduction, result statements, proofs, and ending together.
Mark passages that repeat the same explanation, novelty claim, example, or
qualification even when they use different words. Give each passage one home:

| Location | Job | Remove |
| --- | --- | --- |
| Abstract | Question, answer, essential scope, brief mechanism | Background tour, caveat list, section roadmap |
| Introduction | Why the question matters, exact relation to prior work, idea of the proof | A paragraph copied or paraphrased from the abstract |
| Setting and statements | Definitions, hypotheses, precise theorem | Another promotional contribution summary |
| Proof | The inferences that establish the statement | Repeated announcements of what will be proved |
| Ending, if useful | A new consequence, sharpness observation, or precise open question | A second abstract or a list of things not done |

The abstract must stand alone, and the main theorem needs a formal statement
in the body. Identifying that result again serves navigation; duplicating its
surrounding narrative does not. Use a short pointer when a reader needs to
return to a proof or definition. Keep technical terms and notation stable;
deduplication never means replacing a defined object with loose synonyms.

Omit a conclusion section from a short note when it would merely repeat the
answer. A venue-required conclusion can state the consequence in its context
without repeating the abstract's wording or every result.

## Complete support for every retained conclusion

For each theorem, lemma, corollary, equality case, claimed extension, and
substantive assertion in the prose, locate its proof or exact supporting
reference. A prose claim can need proof even without a theorem environment.
For a citation, read the relevant statement, record its theorem/section/page,
and show why its assumptions hold in this application. A central new inference
needs its argument in the manuscript or an explicitly identified mathematical
supplement. A code link or reassuring adjective cannot supply it.

Use [proof-completeness.md](proof-completeness.md) for transformations, domains,
boundary cases, and equality. For a computer-assisted result, the written
argument must connect the finite check to the stated conclusion as described
in [argument-and-evidence.md](argument-and-evidence.md).

If support fails, repair the proof, prove a narrower useful statement, or remove
the conclusion and every dependent assertion. Adding "plausibly", "we do not
claim", or "not fully verified" does not make it a result. A relevant open
question can be stated separately; do not turn every deleted claim into one.
Empirical papers retain supported observations with their actual uncertainty;
this rule does not require a mathematical proof of an empirical estimate.

## Template when the requested note is 2–4 pages

Use this as an allocation of jobs, not a demand for six titled sections. Check
whether the page limit includes references and appendices before allocating
space. The complete proof has priority over a decorative roadmap or conclusion.

1. **Title and optional abstract.** Name the mathematical answer. In three to
   five sentences, give the question, result with essential scope, and mechanism.
2. **Opening and literature.** In the first paragraph state the question and
   answer. In the next paragraph locate the precise source question, closest
   previous result, and contribution. Use a compact related-literature paragraph
   rather than a general history. Rough guide: half a page.
3. **Setting and theorem.** Introduce only the definitions and notation needed
   now; cite their sources. State the theorem with every effective hypothesis.
   Rough guide: one quarter to half a page.
4. **Complete proof.** Expose the decisive construction or estimate, use only
   needed lemmas, and check exceptional and equality cases. Put a longer
   necessary derivation in an allowed, precisely linked appendix. This normally
   receives most of the space, often one to two pages.
5. **Optional final remark.** Give a useful example, sharpness consequence, or
   one relevant open question that the proof has not already explained. Omit
   this part if it adds nothing.
6. **References and required declarations.** Retain the sources needed for
   attribution and context. See [literature-and-citations.md](literature-and-citations.md).

If the result plus complete proof and necessary references cannot fit, reduce
the scope or use an allowed supplement. Do not shrink the proof into a sketch,
squeeze the type, or cut essential sources to meet an arbitrary page count.
Other requested note lengths remain valid.

## Template for a short paper

1. **Abstract.** Question and main result first; then the mechanism and one
   informative consequence. Keep the strongest supported claim visible.
2. **Introduction and related literature.** First paragraph: question and
   answer. Then explain the obstacle, compare the closest earlier results,
   distinguish the new step, and give a brief proof plan when useful. A real
   literature discussion is required; it can be integrated here or have its
   own section. Plan 12–20 or more relevant, verified references using the
   coverage map in [literature-and-citations.md](literature-and-citations.md).
3. **Preliminaries.** Define the objects and conventions actually used, give
   precise sources, and state the borrowed results with effective hypotheses.
4. **Main results and proofs.** Organize by dependencies and milestones.
   State the main theorem early. Each retained conclusion has a full proof or
   an exact checked reference, including its local instantiation.
5. **Consequences or computations, when needed.** Give new deductions,
   illustrative examples, sharpness, or finite results with their ranges and
   methods. If evidence types differ, use one nearby status sentence or table
   specifying their scopes; keep proof premises with the relevant results.
6. **Further remarks, when useful.** Discuss the consequence or precise open
   extension. Do not replay the result list or add generic future-work claims.
7. **References, declarations, and appendices.** Give required disclosures and
   availability statements once, under the applicable venue rules. Appendices
   contain complete arguments referred to at their point of use.

For empirical work, adapt the middle sections to the actual study design;
Methods and Results may be appropriate. Do not invent experiments or impose
IMRaD on a theorem paper.

## Final read-aloud and acceptance pass

Read the final prose aloud at normal speaking speed. In a text-only session,
perform the same cadence pass sentence by sentence without claiming an audio
check. Read formulas as the objects and operations they express; a formula
can be correct while its sentence has no readable grammatical structure.

Repair stumbling points, overloaded subjects, unclear pronouns, monotonous
openings, forced three-part lists, and stock transitions. Let sentence and
paragraph length follow the reasoning. Do not introduce slang, anecdotes,
artificial doubt, errors, or decorative punctuation to simulate human prose.
Keep authors' established voice and every necessary technical term. Recheck
quantifiers, hypotheses, attribution, and formula meaning after fluency edits.

Before calling a substantial draft ready, check the following against actual
locations or working evidence. Keep this checklist outside the manuscript.

- [ ] The first introduction paragraph states the question and answer with
  accurate scope; the abstract does so independently if present.
- [ ] Every retained section and paragraph serves the question or its necessary
  proof, explanation, or literature placement.
- [ ] Repeated narrative has one home; any retained restatement has a distinct
  navigational or formal role. The ending adds information or is omitted.
- [ ] Every retained conclusion has a complete proof or a checked precise
  citation and matched hypotheses. Unsupported assertions and their dependent
  promises have been removed.
- [ ] Defensive boilerplate has been revised using
  [editing-patterns.md](editing-patterns.md). Verification status has one clear
  home; theorem hypotheses and finite premises remain explicit.
- [ ] The literature coverage and index/source checks in
  [literature-and-citations.md](literature-and-citations.md) are complete;
  relevant prior work and the precise new step are visible.
- [ ] A final read-aloud or explicit text cadence pass repaired rhythm without
  altering the mathematics. Required rendering checks passed.

If an essential proof or citation check remains unresolved, deliver the
supported revision with that concrete issue identified; do not label the
whole manuscript ready.
