# 0017. A paper's links and licences are stored as rows and categories from the upload, and served nowhere yet

Status: accepted, built

## Context

The pipeline (ns-pond) finds the links a paper gives (its text, markup, supplements and reference list, a dataset DOI counting as a link) and, for OSF and OpenNeuro, checks whether the repository holds NIfTI files. The question these answer is which papers share imaging data on OSF or OpenNeuro and have no NeuroVault collection, so that their authors can be asked to put it there. study_schema carries the links in `ParsedPaper.links` (`url`, normalized, and `has_nifti` when checked) and two licences: the paper's (`bibliography.license`, which governs the abstract) and that of the copy the text was read from (`text_copy.license`). Before this, neurostore kept neither, and the parsed paper it stored only on review sources.

Whether an abstract or text whose licence does not allow redistribution should be hidden is not decided. Until it is, nothing here is served.

## Decision

**Licences.** `base_studies.license` and `fulltexts.license` hold study_schema's `LicenseId` (`sa.Enum(LicenseId, native_enum=False)`): text with a CHECK of its ten values. Each value is its member name (`cc_by`, `all_rights_reserved`), the one spelling documents, APIs and the database share, so a row compares equal to the `license_id` in a stored document with nothing translated. NULL means no pipeline upload has set it. Every upload with a parsed paper overwrites the base study's from `bibliography.license.license_id`, and every upload with a text overwrites that text's from `text_copy.license.license_id`. Where a licence was stated and whether it was assumed (`determination`, `stated_by`) stay in ns-pond and in the stored `text_copy`.

**Links.** `base_study_links` has one row per link of a base study: `url` (as the producer normalized it, unique per base study), `host`, `registrable_domain`, `has_nifti` (NULL until checked) and `source` (`pipeline` or `user`), with timestamps; it is deleted with its base study. `registrable_domain` is the domain under the host's public suffix, read from the public suffix list snapshot `tldextract` ships, never fetched: `files.osf.io` gives `osf.io`, `data.example.co.uk` gives `example.co.uk`. A DOI is a link to `https://doi.org/…`, so its host and domain are `doi.org`.

An upload whose parsed paper lists links (an empty list included) replaces the base study's `pipeline` rows with them; one that lists none (`links` absent or null) leaves them. A link a user gave stays theirs: the upload adds no second row for its url and only sets its `has_nifti` when it checked one. A url that is not http(s) with a host is refused (422, `SCHEMA`, at `parsed-paper/links/<i>/url`).

**Categories.** `link_domains(pattern, repository, kind)`, `kind` one of `data_repository`, `code`, `preprint`, `publisher`, `doi_prefix`, `other`. A link falls under the row whose pattern is its host or registrable domain and, for a doi.org link, under the row of each prefix of its DOI that ends at a `/` or `.` (`10.18112/openneuro` covers `10.18112/openneuro.ds000001…`; `10.5281` covers `10.5281/zenodo.1` and not `10.52810/…`). `LinkDomain.matches()` is that join condition. The category is never copied onto the link row, so recategorising a domain is an update of one row and needs no re-run. The migration seeds OSF (`osf.io`, `10.17605/osf.io`), OpenNeuro (`openneuro.org`, `10.18112/openneuro`), NeuroVault (`neurovault.org`), Zenodo (`zenodo.org`, `10.5281`) and figshare (`figshare.com`, `10.6084`) as data repositories, GitHub and GitLab as code, and `doi.org` as `doi_prefix`: the resolver says only that the link is a DOI, whose repository its prefix row gives. A domain with no row has no category. NeuroVault is a domain like any other; nothing matches papers against its collections.

The outreach list is then one query: base studies with a link under OSF or OpenNeuro whose `has_nifti` is true, and no link under NeuroVault.

**Merges.** `merge_base_study` moves the old base study's links to the keeper. Of two links with one url, the keeper's stays, taking the old one's `has_nifti` when its own was not checked, and the old one is deleted; each step is a recorded change.

**Not served.** No marshmallow schema, resource or spec route names `base_study_links`, `link_domains` or either `license` column. The spec changes only for the upload itself.

## Consequences

- The licence columns are ready for the redistribution decision; until it is made, an abstract or text is shown whatever its licence.
- A new link category is a row in `link_domains`, written by a migration or by hand; it applies to every stored link at once.
- A new licence value in study_schema needs a migration of both CHECKs before an upload carrying it is accepted.
- Only the ingester writes `pipeline` links. `user` links have no writer yet.
- `tldextract`'s snapshot ages with its version: a suffix added to the list since is not known until the dependency is updated.

## Rejected

- **Storing the category on the link row.** Recategorising would need every paper re-uploaded.
- **The last two labels of the host as its domain.** Wrong under multi-label suffixes (`co.uk`, `ac.jp`).
- **Fetching the public suffix list at runtime.** A network call in the upload path for a list that changes slowly.
- **A native Postgres enum for licences.** A value added by `ALTER TYPE … ADD VALUE` cannot be used in the transaction that adds it, and one cannot be removed without recreating the type; text with a CHECK changes like any constraint.
- **Storing `determination` and `stated_by`.** They describe how ns-pond found the licence, which neurostore does not act on.
- **Serving links and licences now.** The read routes and the base-study filters (`link_repository`, `link_has_nifti`, `no_link_repository`) wait until they are wanted, and the licence routes wait for the redistribution decision.
