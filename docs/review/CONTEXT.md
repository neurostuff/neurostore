# Review

The vocabulary of neurostore's /review app, where `admin-reviewer` users correct what the extraction pipeline read from each paper, with the paper's full text beside every claim's evidence.

## Language

**Paper**:
A base study, as the reviewer sees it. Assignment is per paper, and a paper can have several sources.
_Avoid_: study, article (except `article_id`, the id in a parsed paper's header)

**Base study**:
neurostore's record of one paper (`BaseStudy`); the code's name for a paper.

**Source**:
One extraction of a paper loaded for review (`ReviewSource`): its parsed paper, coordinate parse and extraction record as loaded, and where they came from. Immutable; reviews copy from it.

**Bundle**:
Everything the app loads to review one paper for one user: text, documents, the caller's review and ops, the entity index, the hidden set and the other reviewers.

**Record**:
The extraction record, the study_schema document of entities and slot values. A source holds the original; a review holds the edited copy.

**Entity**:
One thing the record describes (an analysis, group, task, region and so on), with its own slots.

**local_id**:
An entity's id within one record. Unique only there; a rename or re-run does not preserve it.

**stable_id**:
An entity's neurostore-minted UUID, kept on its StudyEntity, that survives renames and re-runs (ADR 0009).

**Slot**:
One field of an entity, holding a value, an extraction status and evidence.

**Reference**:
Four senses, kept apart. A *reference slot* holds the `local_id` of another entity (the schema's `x-reference`); a *relationship* is such a link as a reviewer sees it; a *dangling reference* points to an entity that no longer exists; a *reference review* is below.
_Avoid_: bare "reference" when the sense is not clear from the words around it

**Coordinate parse**:
The study_schema document grouping a paper's points into analyses keyed by content. A source holds the original; a review holds a revision of it.

**Revision**:
A new coordinate parse naming the one it revises, with a verdict for every original analysis. A review has one, of the original parse, and its verdicts are derived (ADR 0004).

**Original**:
The documents of a source as loaded: its coordinate parse (the parse a revision revises) and its record. The diff against the original compares a review with them.
_Avoid_: base, initial

**Pipeline chain**:
The revisions a pipeline made of a parse, each revising the one before. A source from a pipeline run holds its chain folded into one revision of the original, and a review starts from it.

**Authorship**:
Who gave a coordinate analysis its current form: the original parse, the model (a pipeline's revision) or the reviewer. Derived, not stored.

**Verdict**:
Two senses. The schema's per-analysis outcome in a revision (accept, relabel, split, merge, omit, add; `edit` is not in the schema yet). And the `verdict` op: a reviewer's accept or reject of a slot, entity, relationship or coordinate analysis.

**Provenance**:
Per target, whether a person has checked or changed it: unchecked, verified, edited, added or removed, kept in `reviews.provenance`. Also the exported wrapper document beside a record (`run/provenance/`, ADR 0008).

**Reviewed**:
A person has verified or changed the target (provenance `verified`, `edited`, `added` or `removed`). Counts toward progress.

**Verified**:
A person accepted the target without changing it.

**Judgeable target**:
A slot that was extracted, or a coordinate analysis, of a source: what percent reviewed counts. Entities are not judgeable targets.

**Judged**:
A coordinate analysis has a verdict in the exported revision, taken from provenance; one nobody has checked is "not judged by the reviewer".

**Review**:
One reviewer's work on one source (`Review`): an op log and the materialized record, with a state of in progress, submitted, reference or set aside.

**Reference review**:
The one review of a source that a lead reviewer marks as the answer; the state `reference`. At most one per source, and once marked it stays (ADR 0010).

**Set aside**:
A review state with a reason (no usable text, out of scope, no results, duplicate, other): the paper cannot be reviewed.

**Assignment**:
A reviewer taking a paper, or a lead giving it to one (`ReviewAssignment`), per paper rather than per source.

**Lead**:
A reviewer who is also an `admin`. Leads load papers, assign them to others and mark the reference review.
_Avoid_: lead reviewer vs admin-reviewer: the role is `admin-reviewer`, and "lead" means that role plus `admin`.

**Op**:
One typed edit in a review's log (`ReviewOp`), applied by `apply_batch`.

**Pending op**:
An op a reviewer has made that the server has not yet stored. It is kept on the device until the server stores it (ADR 0012).
_Avoid_: draft, unsaved change

**Read-only tab**:
A second tab open on a review that another tab of the same browser is editing; it can be browsed but not edited (ADR 0012).
