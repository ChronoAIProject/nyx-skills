# Reproduction and manuscript delivery

Read this for a submission package or a reproducibility review, not every prose
edit. Distinguish preparing a releasable package from publishing it. Existing
user authorization governs external actions; a coauthor's email alone does
not authorize changing repository visibility or submitting a paper.

## What must be reachable

When a computer-assisted proof depends on code, finite tables, or certificates,
provide the actual materials through a stable accessible route at release.
An email attachment or a local path in Appendix S2 is not a public reader's
access route. A stable repository release, archival service, or allowed arXiv
ancillary material may serve; GitHub plus Zenodo is useful, not mandatory.

Place the working link where the reproduction instructions begin. For a
versioned archive, identify the version used by the paper and the relevant
commit or hash. Prefer a version-specific DOI when exact reproducibility is
important; a concept DOI tracks all versions and needs an explicit version.
Check that the URL resolves for its intended audience, that required files are
present, and that citation metadata names the correct authors. Never invent a
DOI or call a private repository public. An anonymous-review submission may
require an anonymized artifact instead; follow venue policy.

Do not release a private collaboration directory wholesale. Select necessary
sources, certificates, licenses, provenance, and reproduction instructions.
Exclude email bodies, unrelated correspondence, tokens, local credentials,
and unneeded personal paths. Preserve legitimate authorship and source credit.
Private review comments guide editing; they are not public bibliography entries
without an appropriate basis and authorization.

## Package structure

For a single merged paper, provide one unambiguous main TeX document with all
inputs, bibliography material, figures, and generated tables. Keep a separate
supplement only when the intended submission actually has one. Do not leave
an obsolete alternative main document in the submission ZIP.

If delivering both a small source ZIP and a larger reproducibility ZIP, explain
their purposes. Any duplicate manuscript inside the latter must match the
delivered source/PDF. Include a root reproduction guide with paths relative to
the extracted package, software requirements, commands, expected outputs, and
the boundary between archived evidence and a fresh run.

A meaningful manuscript table or morphism file is a required dependency even
if packaging scripts previously omitted it. Check the actual include graph;
do not assume that an old allowlist remains complete after revisions.

## Validate the exact deliverable

1. Freeze the candidate files and generate a member-hash manifest.
2. Extract the final ZIP into a new temporary directory. Compile without access
   to undeclared files from the author's working directory. Use enough passes
   to resolve references; inspect warnings and relevant rendered pages.
3. Compare the extracted sources, tables, and PDF content/layout with the
   intended delivery. PDF byte hashes alone can differ because of build metadata.
4. Run appropriate included smoke checks or independent finite checks from the
   extracted copy. Report exactly what ran, with source version and result.
5. After any repackaging, refresh hashes and validate affected dependencies.
   Do not attach an earlier ZIP because the filename stayed the same.

For a prose-only change with unchanged proof sources, reuse existing formal
build evidence after checking its scope and hashes unless repository rules or
changed claims require a new run. A new expensive run is not automatically
justified by producing a new ZIP. Follow existing remote execution requirements;
do not change shared CI, runner defaults, or release gates to unblock one task.

## Submission and coauthor communication

Keep the paper, response letter, and artifact README consistent. A concise
reply can state accepted changes, material unresolved questions, and the exact
purpose of each attachment. Do not narrate every internal tool action.

Confirm author spelling, order, affiliations, emails, contributions, and AI-use
details from supplied evidence. Treat proposed author-responsibility text as
part of a draft awaiting coauthor review, not evidence that approval occurred.

When saving a requested email draft, verify the actual saved body, recipient,
and attachment identities. Preserve user edits and avoid duplicate versions.
Sending, submission, publication, and sharing are distinct actions with their
own actual receipts. Do not label a local draft "sent", a ZIP "published", or
an arXiv offer "submitted". Stop at the authorized deliverable.
