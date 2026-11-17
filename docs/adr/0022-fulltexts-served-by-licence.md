# 0022. Full texts are served by id, with the text only when its copy may be passed on

Status: accepted, built

## Context

Ingestion stores one `fulltexts` row per copy of a paper it read (pubget/PMC, Europe PMC, Elsevier, Springer, ACE, PDFs), with the copy it was read from (`text_copy`, study_schema's HeldCopy: route, version, `access`, `license`) and that copy's licence category (`license`, ADR 0017). `base_studies.fulltext_id` names the preferred copy. Full-text search (ADR 0016) matched on the text but returned only base studies. Agents, through the REST API and the MCP server, need to read the texts. Sending a text to an agent is redistribution: it goes on to the user's model provider.

## Decision

**The rule.** A text may be passed on when study_schema's `licensing.text_may_be_redistributed(text_copy)` says so (a Creative Commons, CC0 or public-domain licence stated by a named source, in a copy obtained `public`ly) and the `license` column is one of `REDISTRIBUTABLE_LICENSES` too. Everything else is withheld: `all_rights_reserved` (including PMC author manuscripts whose record says TDM), `other` (such as Elsevier's user licence), any copy obtained under a TDM grant or whose access was not recorded (ACE), and a row with no `text_copy`. This reading of the licences is the project's policy, written in study_schema's `LicenseId`, not legal advice.

**One gate.** `neurostore/fulltext_access.py` holds `may_redistribute`, `released_text` and `withheld_reason`. `FulltextSchema.text` is `released_text`, and it is a `detail_field`: dumped only when the response turns `text` on, which only `GET /fulltexts/{id}` does. No other schema names the text.

**Routes.** `GET /api/fulltexts/{id}` returns the provenance always (`base_study_id`, `source`, `source_version`, `license`, `text_copy`, `sha256`, timestamps), `preferred`, `redistributable`, `attribution` (title, authors, year, publication, DOI, licence and the licence as stated), and `text`. A withheld text is `text: null` with `text_withheld: {reason, message, read_at}`, `reason` one of `license`, `access`, `no_copy_record`, and `read_at` the DOI link (else the PMC page). `GET /api/fulltexts/` lists them, filtered by `base_study_id`, `source` and `license` and paginated like every list, with no text. Base studies carry `fulltext_id`; they never carry text.

**Who sees one.** Whoever may see its base study (`visibility_filters(BaseStudy)`): a full text's own `public` and `user_id` are search copies held by the preferred row only. A full text of a paper the caller may not see is a 404. Neither route is cached, so a licence an upload changes or a paper made private applies at once. Only ingestion writes full texts; the routes are read only.

**Search.** Hits carry no snippet and no position: search says which papers match, nothing of the text. Of the sources a withheld text comes from, only Elsevier allows snippets in its TDM output (up to 200 characters around the matched entity, with a DOI link and credit, for non-commercial research, from a corpus that "should not be shared with third parties": its [TDM policy FAQ](https://www.elsevier.com/about/policies-and-standards/text-and-data-mining/faq)). Springer Nature's [TDM terms](https://www.springernature.com/gp/researchers/text-and-data-mining) state no snippet allowance and require content to stay "without access for third parties". PMC says an author manuscript is free "to read, text mine, and for other uses consistent with the principles of Fair Use" ([PMC copyright](https://pmc.ncbi.nlm.nih.gov/about/copyright/)), with no licence to quote from. A snippet sent to an agent reaches a third party, so none is sent.

## Consequences

- An agent reads an openly licensed text in one call, and learns for any other where to read it.
- A text ingested before its copy was recorded is withheld until an upload records its copy.
- Admin-reviewers still read every text through `/review` (bundles and exports): staff use, not redistribution. It is the only path that reads `Fulltext.text` besides the gate; the admin panel has no full-text view.
- The legacy `base_studies.ace_fulltext` and `pubget_fulltext` columns stay load-only in the API; the admin panel's base-study pages show them to admins.
- Abstracts (`base_studies.description`) are still served whatever `base_studies.license` says; that is a separate decision.

## Rejected

- **A 403 on `?include=text`.** One call would no longer return the provenance, and the list could not say which texts are readable; a null with a reason tells an agent what to do next.
- **Visibility from the full text's own `public`/`user_id`.** They are NULL on every copy but the preferred one, so other copies would vanish.
- **Trusting the `license` column alone.** It does not say how the copy was obtained: a CC BY article fetched through Elsevier's TDM key is still a TDM copy.
- **Snippets for open texts in search hits.** The whole text is one call away; a snippet path would be a second place that reads the text.
- **Sorting a list by the text.** It orders withheld texts against each other (`Fulltext.__unsortable__`).
