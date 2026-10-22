# 0003. Character offsets are Unicode code points

Status: accepted

## Context

Evidence spans are `[start_char, end_char)` offsets into the paper's text, and the text carries a sha256 that the extraction record pins. Python indexes strings by code point. Browsers index by UTF-16 code unit. A character outside the Basic Multilingual Plane (an emoji, some mathematical letters) is one code point and two code units, so the two disagree for every offset after it.

## Decision

Offsets are code points everywhere in the contract: study_schema, the stored records, the bundle and the ops. The front end converts at the boundary and nowhere else: `store/review-frontend/src/model/offsets.ts` turns code points into UTF-16 units when it reads a bundle and back when it sends an op. Inside the front end, the text pane, highlights and selections use UTF-16.

## Consequences

- Exported records are valid for Python consumers (pondie, the ingester, training jobs) with no conversion.
- Every place that reads or writes an offset on the front end must go through the converter. A missed conversion is silent: highlights shift only on papers containing such characters, which is rare, so tests use text outside the BMP deliberately.
- The op history kept in the store (`store.ops`) stays in code points while the rest of the store is UTF-16; convert it when something reads it.

## Rejected

- **UTF-16 offsets in the contract.** Easy for the browser, but the record is study_schema's, which Python tools read as code points, and every consumer would need to convert.
- **Normalizing the text to the BMP.** The sha256 and the span texts must match the text the extraction read.
