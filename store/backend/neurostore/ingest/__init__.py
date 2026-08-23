"""
Ingest and sync data from various sources (Neurosynth, NeuroVault, etc.).
"""

import os.path as op
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import pandas as pd
import requests
import sqlalchemy as sa
from dateutil.parser import parse as parse_date
from scipy import sparse
from sqlalchemy import or_

from neurostore.analysis_levels import (
    NON_GROUP_NORMALIZED_VALUES,
    canonicalize_analysis_level,
    is_non_group_analysis_level,
)
from neurostore.database import db
from neurostore.map_types import canonicalize_map_type
from neurostore.models import (
    Analysis,
    AnalysisConditions,
    Annotation,
    AnnotationAnalysis,
    BaseStudy,
    BaseStudyFlagOutbox,
    BaseStudyMetadataOutbox,
    Condition,
    Entity,
    Image,
    Point,
    Study,
    Studyset,
    Table,
)
from neurostore.models.data import (
    ImageEntityMap,
    PointEntityMap,
    StudysetStudy,
    _check_type,
)
from neurostore.note_keys import resolve_note_key_default
from neurostore.services.has_media_flags import recompute_media_flags

META_ANALYSIS_WORDS = ["meta analysis", "meta-analysis", "systematic review"]


def _coerce_optional(value):
    if pd.isna(value):
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def _coerce_optional_int(value):
    value = _coerce_optional(value)
    if value is None:
        return None
    return int(float(value))


def _invalidate_cached_responses(unique_ids):
    """Bump the cache versions for objects a bulk command changed.

    The api invalidates its own writes; a command that writes straight to the
    database has to do it here, or an endpoint keeps serving the body it cached
    before the change for as long as that entry lives.
    """
    from neurostore.cache_versioning import bump_cache_versions

    bump_cache_versions(
        {resource: ids for resource, ids in unique_ids.items() if ids}
    )


def _recompute_base_study_flag_ids(base_study_ids):
    base_study_ids = [
        base_study_id for base_study_id in base_study_ids if base_study_id
    ]
    if not base_study_ids:
        return
    db.session.remove()
    recompute_media_flags(base_study_ids)
    db.session.commit()
    db.session.remove()


def _recompute_base_study_flags(base_studies):
    _recompute_base_study_flag_ids(
        [getattr(base_study, "id", None) for base_study in base_studies]
    )


NEUROVAULT_COLLECTIONS_URL = "https://neurovault.org/api/collections.json"
NEUROVAULT_IMAGES_URL = "https://neurovault.org/api/collections/{}/images/?format=json"
# Bookkeeping rather than payload: how many images the group level filter dropped,
# so a re-ingest can tell an already-complete collection from a short one.
NEUROVAULT_NON_GROUP_IMAGE_COUNT_KEY = "neurostore_non_group_image_count"


def _neurovault_image_key(image_data):
    """Identify a NeuroVault image so re-ingests can tell new from stored images."""
    image_data = image_data or {}
    image_id = image_data.get("id")
    if image_id is not None:
        return ("id", str(image_id))
    return ("file", image_data.get("file"))


def _stored_image_key(image):
    key = _neurovault_image_key(image.data)
    if key[1] is None:
        return ("file", image.url)
    return key


def _fetch_neurovault_images(collection_id, verbose=False):
    """Return every image in a collection, following NeuroVault's pagination.

    The images endpoint pages at 100 results, so reading only the first page
    silently truncates larger collections.
    """
    url = NEUROVAULT_IMAGES_URL.format(collection_id)
    results = []
    seen_urls = set()
    while url and url not in seen_urls:
        seen_urls.add(url)
        payload = requests.get(url).json()
        results.extend(payload.get("results") or [])
        url = payload.get("next")
    if verbose:
        print(
            "Fetched {} image(s) for collection {}".format(len(results), collection_id)
        )
    return results


def _partition_group_level_images(image_payloads):
    """Split fetched payloads into the ones to ingest and a count of the rest.

    Single-subject, meta-analytic and "other" maps never reach the database.
    Unlabeled images are kept, per :func:`is_non_group_analysis_level`.
    """
    group_level = []
    non_group = 0
    for img in image_payloads:
        if is_non_group_analysis_level((img or {}).get("analysis_level")):
            non_group += 1
        else:
            group_level.append(img)
    return group_level, non_group


def _neurovault_ingested_image_counts():
    """Map each ingested neurovault collection id to how many images are stored."""
    rows = (
        db.session.query(Study.source_id, sa.func.count(Image.id))
        .outerjoin(Image, Image.study_id == Study.id)
        .filter(Study.source == "neurovault", Study.source_id.isnot(None))
        .group_by(Study.source_id)
        .all()
    )
    return {str(source_id): count for source_id, count in rows}


def _coerce_non_group_image_count(value):
    """Read a stored filtered-image count, treating missing or unusable as zero."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _neurovault_non_group_image_counts():
    """How many images each stored collection had filtered out as non-group.

    ``number_of_images`` on the collection payload counts every level, so the
    completeness check has to add the filtered images back or a mixed collection
    looks permanently short and gets its images refetched on every run.
    """
    rows = (
        db.session.query(
            Study.source_id,
            Study.metadata_[NEUROVAULT_NON_GROUP_IMAGE_COUNT_KEY].astext,
        )
        .filter(Study.source == "neurovault", Study.source_id.isnot(None))
        .all()
    )
    counts = {}
    for source_id, value in rows:
        # duplicate stored versions of one collection: the highest count is the
        # one that saw the most of the collection
        source_id = str(source_id)
        counts[source_id] = max(
            counts.get(source_id, 0), _coerce_non_group_image_count(value)
        )
    return counts


def _load_conditions(names):
    """Look up the conditions referenced by a batch of neurovault images."""
    names = {name for name in names if name}
    if not names:
        return {}
    return {
        cond.name: cond
        for cond in Condition.query.filter(Condition.name.in_(names)).all()
    }


NEUROVAULT_ANALYSIS_SAMPLE_SIZE_KEY = "sample_size"
NEUROVAULT_STUDY_SAMPLE_SIZE_KEY = "sample_sizes"


def _parse_number_of_subjects(value):
    """Coerce neurovault's number_of_subjects into a positive int, or None."""
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number <= 0 or number != int(number):
        return None
    return int(number)


def _sample_sizes_from_image_data(image_data):
    """Subject counts for one analysis, deduped to one element when they agree.

    Disagreeing counts are all kept, sorted: ``analysis.images`` has no defined
    order, so sorting is what makes a re-derived list stable.
    """
    values = [
        subjects
        for subjects in (
            _parse_number_of_subjects((data or {}).get("number_of_subjects"))
            for data in image_data
        )
        if subjects is not None
    ]
    if not values:
        return None
    if len(set(values)) == 1:
        return values[:1]
    return sorted(values)


def _set_metadata_key(instance, key, value):
    """Reassign metadata_ so JSONB change tracking notices the update."""
    metadata = instance.metadata_ or {}
    if metadata.get(key) == value:
        return False
    updated = dict(metadata)
    updated[key] = value
    instance.metadata_ = updated
    return True


def _analysis_sort_key(analysis):
    order = analysis.order
    return (order is None, order or 0, analysis.name or "")


def _drop_metadata_key(instance, key):
    """Reassign metadata_ without ``key``, so JSONB change tracking notices."""
    metadata = instance.metadata_ or {}
    if key not in metadata:
        return False
    updated = {
        existing: value for existing, value in metadata.items() if existing != key
    }
    instance.metadata_ = updated
    return True


def _apply_neurovault_sample_sizes(study, clear_missing=False):
    """Copy subject counts out of stored image data onto analyses and the study.

    The image payloads are the source of truth: each analysis takes the subject
    counts of its own images (a single element when every image agrees) and the
    study takes every analysis' counts flattened in analysis order. A level with
    no counts to report is left alone, so hand-entered metadata survives a
    re-ingest. Callers must flush new rows first, otherwise ``analysis.images``
    misses them.

    ``clear_missing`` drops the key instead, for callers that just deleted the
    images a stored count came from, where the old value is a stale derivation
    rather than metadata worth keeping.
    """
    changed = False
    sample_sizes = []
    for analysis in sorted(study.analyses, key=_analysis_sort_key):
        sizes = _sample_sizes_from_image_data(image.data for image in analysis.images)
        if sizes is None:
            if clear_missing:
                changed |= _drop_metadata_key(
                    analysis, NEUROVAULT_ANALYSIS_SAMPLE_SIZE_KEY
                )
            continue
        changed |= _set_metadata_key(
            analysis, NEUROVAULT_ANALYSIS_SAMPLE_SIZE_KEY, sizes
        )
        sample_sizes.extend(sizes)
    if sample_sizes:
        changed |= _set_metadata_key(
            study, NEUROVAULT_STUDY_SAMPLE_SIZE_KEY, sample_sizes
        )
    elif clear_missing:
        changed |= _drop_metadata_key(study, NEUROVAULT_STUDY_SAMPLE_SIZE_KEY)
    return changed


def _neurovault_sample_size_candidates():
    """Collection ids whose stored image data holds counts the metadata lacks.

    A cheap pre-filter: a run that skips an already-complete collection still
    repairs its sample sizes, without loading every neurovault study to find out
    there is nothing to do.
    """
    rows = (
        db.session.query(Study.source_id)
        .join(Analysis, Analysis.study_id == Study.id)
        .join(Image, Image.analysis_id == Analysis.id)
        .filter(
            Study.source == "neurovault",
            Study.source_id.isnot(None),
            Image.data["number_of_subjects"].astext.isnot(None),
            # ``->>`` rather than the jsonb-only ``?``: studies.metadata_ is json
            sa.or_(
                Analysis.metadata_[NEUROVAULT_ANALYSIS_SAMPLE_SIZE_KEY].astext.is_(
                    None
                ),
                Study.metadata_[NEUROVAULT_STUDY_SAMPLE_SIZE_KEY].astext.is_(None),
            ),
        )
        .distinct()
        .all()
    )
    return {str(source_id) for (source_id,) in rows}


def _repair_neurovault_sample_sizes(source_id, verbose=False):
    """Derive sample sizes for an already-ingested collection, without refetching."""
    studies = Study.query.filter_by(
        source="neurovault", source_id=str(source_id)
    ).all()
    repaired = [_apply_neurovault_sample_sizes(study) for study in studies]
    if not any(repaired):
        return False
    # read the ids before the commit expires the instances and makes this reload
    changed = [study for study, was_changed in zip(studies, repaired) if was_changed]
    changed_ids = {
        "studies": [study.id for study in changed],
        "analyses": [
            analysis.id for study in changed for analysis in study.analyses
        ],
    }
    db.session.commit()
    _invalidate_cached_responses(changed_ids)
    if verbose:
        print(
            "Backfilled sample sizes for collection {} from stored image data".format(
                source_id
            )
        )
    return True


def backfill_neurovault_sample_sizes(verbose=False):
    """Derive sample sizes for every stored neurovault collection, without refetching.

    ``ingest_neurovault`` repairs the collections it walks past, which means a full
    pass over neurovault to fix data ingested before sample sizes were tracked.
    This repairs every stored collection straight from the image payloads instead.
    """
    source_ids = sorted(_neurovault_sample_size_candidates())
    if verbose:
        print("{} collection(s) missing sample sizes".format(len(source_ids)))
    repaired = sum(
        _repair_neurovault_sample_sizes(source_id, verbose=verbose)
        for source_id in source_ids
    )
    print("Backfilled sample sizes for {} collection(s)".format(repaired))
    return repaired


def _build_neurovault_images(
    study,
    image_payloads,
    collection_space,
    analyses,
    existing_conditions,
    start_order=0,
    image_start_orders=None,
):
    """Create Analysis/Image rows for image_payloads, reusing analyses by name.

    ``image_start_orders`` maps an analysis name (``None`` for the study-owned
    images that neurovault gives no name) to the next image order to hand out, so
    topping up a collection continues numbering where the stored images stopped.

    Issues no queries: callers construct these objects only after every lookup is
    done, so autoflush cannot fire while a transient row hangs off a persistent one.
    """
    new_objects = []
    conditions = set()
    order = start_order
    image_orders = dict(image_start_orders or {})
    space = collection_space
    for img in image_payloads:
        aname = img.get("name")
        analysis = None
        if aname and aname not in analyses:
            condition = img.get("cognitive_paradigm_cogatlas")
            analysis = Analysis(
                name=aname,
                description=img["description"],
                study=study,
                order=order,
            )
            order += 1
            if condition:
                cond = next(
                    (cond for cond in conditions if cond.name == condition),
                    existing_conditions.get(condition),
                )
                if cond is None:
                    cond = Condition(name=condition)
                    existing_conditions[condition] = cond
                conditions.add(cond)

                if getattr(cond, "id", None):
                    analysis.analysis_conditions.append(
                        AnalysisConditions(weight=1, condition_id=cond.id)
                    )
                else:
                    analysis.analysis_conditions.append(
                        AnalysisConditions(weight=1, condition=cond)
                    )

            analyses[aname] = analysis
            new_objects.append(analysis)
        elif aname:
            analysis = analyses[aname]
        space = space or "Unknown" if img.get("not_mni", False) else "MNI"
        type_ = canonicalize_map_type(img.get("map_type"))
        entities = []
        if analysis is not None:
            entities.append(
                Entity(level="group", label=analysis.name, analysis=analysis)
            )
        image_order_key = analysis.name if analysis is not None else None
        image_order = image_orders.get(image_order_key, 0)
        image_orders[image_order_key] = image_order + 1
        new_objects.append(
            Image(
                url=img["file"],
                space=space,
                value_type=type_,
                analysis=analysis,
                study=study,
                data=img,
                filename=op.basename(img["file"]),
                add_date=parse_date(img["add_date"]),
                entities=entities,
                order=image_order,
            )
        )
    return new_objects, conditions


def ingest_neurovault(verbose=False, limit=20, overwrite=False, max_images=None):
    """Ingest neurovault collections, topping up ones that are missing images.

    Only group level images are ingested: images neurovault marks single-subject,
    meta-analysis or other are dropped without being stored, unlabeled ones kept.

    A collection already in the database is skipped when it holds at least as many
    images as neurovault reports for it, counting the images the group level filter
    dropped. Otherwise its missing images are added to the existing study rather
    than ingested a second time. ``overwrite`` forces that image-level comparison
    even when the counts already agree.
    """
    # How many images are already stored per collection, so a collection that was
    # only partially ingested is topped up instead of skipped forever.
    ingested_image_counts = _neurovault_ingested_image_counts()
    # How many images the group level filter dropped per collection, so a stored
    # collection is not mistaken for a partial one on every later run.
    non_group_image_counts = _neurovault_non_group_image_counts()
    # Collections whose stored images already carry subject counts that never made
    # it onto the analyses, so a skipped collection still gets its metadata.
    sample_size_candidates = _neurovault_sample_size_candidates()

    def backfill_collection(data):
        collection_id = data.get("id")
        source_id = str(collection_id)
        image_payloads, non_group_images = _partition_group_level_images(
            _fetch_neurovault_images(collection_id, verbose=verbose)
        )
        studies = (
            Study.query.filter_by(source="neurovault", source_id=source_id)
            .order_by(Study.created_at)
            .all()
        )
        if not studies:
            # the collection was deleted between the count query and now
            ingested_image_counts.pop(source_id, None)
            return None
        if len(studies) > 1:
            print(
                "Collection {} has {} stored versions; "
                "backfilling the oldest ({})...".format(
                    collection_id, len(studies), studies[0].id
                )
            )
        study = studies[0]
        # every lazy load happens here, before any new object is constructed
        base_study_id = study.base_study_id
        stored_images = list(study.images)
        stored_keys = {_stored_image_key(image) for image in stored_images}
        stored_analyses = list(study.analyses)
        analyses = {
            analysis.name: analysis for analysis in stored_analyses if analysis.name
        }
        start_order = (
            max([analysis.order or 0 for analysis in stored_analyses], default=-1) + 1
        )
        # Continue image numbering from the stored images of each analysis (and
        # of the study, for the images that never got one).
        analysis_names = {analysis.id: analysis.name for analysis in stored_analyses}
        image_start_orders = {}
        for image in stored_images:
            key = analysis_names.get(image.analysis_id) if image.analysis_id else None
            next_order = (image.order or 0) + 1
            if next_order > image_start_orders.get(key, 0):
                image_start_orders[key] = next_order

        missing = [
            img
            for img in image_payloads
            if _neurovault_image_key(img) not in stored_keys
        ]
        ingested_image_counts[source_id] = len(stored_images)
        non_group_image_counts[source_id] = non_group_images
        if not missing:
            print(
                "Skipping collection {} with DOI {} "
                "({} images stored, none missing)...".format(
                    collection_id, data.get("DOI"), len(stored_images)
                )
            )
            changed = _set_metadata_key(
                study, NEUROVAULT_NON_GROUP_IMAGE_COUNT_KEY, non_group_images
            )
            changed |= _apply_neurovault_sample_sizes(study)
            if changed:
                db.session.commit()
            sample_size_candidates.discard(source_id)
            return None

        print(
            "Backfilling collection {} with DOI {} ({} of {} images missing)...".format(
                collection_id, data.get("DOI"), len(missing), len(image_payloads)
            )
        )
        existing_conditions = _load_conditions(
            img.get("cognitive_paradigm_cogatlas") for img in missing
        )
        with db.session.no_autoflush:
            new_objects, conditions = _build_neurovault_images(
                study,
                missing,
                data.get("coordinate_space"),
                analyses,
                existing_conditions,
                start_order=start_order,
                image_start_orders=image_start_orders,
            )
        db.session.add_all(new_objects + list(conditions))
        # flush first: _apply_neurovault_sample_sizes reads analysis.images, which
        # would not see the new rows while they are still pending
        db.session.flush()
        _apply_neurovault_sample_sizes(study)
        _set_metadata_key(study, NEUROVAULT_NON_GROUP_IMAGE_COUNT_KEY, non_group_images)
        db.session.commit()
        sample_size_candidates.discard(source_id)
        _recompute_base_study_flag_ids([base_study_id])
        ingested_image_counts[source_id] = len(stored_images) + len(missing)
        return study

    def add_collection(data):
        collection_id = data.get("id")
        source_id = str(collection_id)
        ingested_images = ingested_image_counts.get(source_id)
        expected_images = data.get("number_of_images")
        if ingested_images is not None:
            # number_of_images counts every level, so filtered images count as
            # seen rather than missing
            accounted_images = ingested_images + non_group_image_counts.get(
                source_id, 0
            )
            complete = (
                expected_images is not None and accounted_images >= expected_images
            )
            if complete and not overwrite:
                print(
                    "Skipping collection {} with DOI {} "
                    "({} of {} images already accounted for)...".format(
                        collection_id,
                        data.get("DOI"),
                        accounted_images,
                        expected_images,
                    )
                )
                if source_id in sample_size_candidates:
                    _repair_neurovault_sample_sizes(source_id, verbose=verbose)
                    sample_size_candidates.discard(source_id)
                return None
            return backfill_collection(data)

        image_payloads, non_group_images = _partition_group_level_images(
            _fetch_neurovault_images(collection_id, verbose=verbose)
        )
        if not image_payloads:
            # no group level image means nothing worth a study row
            print(
                "Skipping collection {} with DOI {} "
                "({} images, none at the group level)...".format(
                    collection_id, data.get("DOI"), non_group_images
                )
            )
            return None

        collection_id = data.pop("id")
        doi = data.pop("DOI", None)
        base_study = None
        if doi:
            base_study = BaseStudy.query.filter_by(doi=doi).one_or_none()
        existing_conditions = _load_conditions(
            img.get("cognitive_paradigm_cogatlas") for img in image_payloads
        )

        with db.session.no_autoflush:
            if base_study is None:
                base_study = BaseStudy(
                    name=data.pop("name", None),
                    description=data.pop("description", None),
                    doi=doi,
                    authors=data.pop("authors", None),
                    publication=data.pop("journal_name", None),
                    metadata_=data,
                    level="group",
                )
            s = Study(
                name=data.pop("name", None) or base_study.name,
                description=data.pop("description", None) or base_study.description,
                doi=doi,
                pmid=base_study.pmid,
                authors=data.pop("authors", None) or base_study.authors,
                publication=data.pop("journal_name", None) or base_study.publication,
                source_id=collection_id,
                metadata_=data,
                source="neurovault",
                level="group",
                base_study=base_study,
            )
            new_objects, conditions = _build_neurovault_images(
                s,
                image_payloads,
                data.get("coordinate_space"),
                {},
                existing_conditions,
            )

        study_source_id = str(s.source_id) if s.source_id is not None else None
        db.session.add_all([base_study] + [s] + new_objects + list(conditions))
        db.session.flush()
        _apply_neurovault_sample_sizes(s)
        _set_metadata_key(s, NEUROVAULT_NON_GROUP_IMAGE_COUNT_KEY, non_group_images)
        db.session.commit()
        _recompute_base_study_flags([base_study])
        if study_source_id is not None:
            ingested_image_counts[study_source_id] = len(image_payloads)
            non_group_image_counts[study_source_id] = non_group_images
        return s

    url = NEUROVAULT_COLLECTIONS_URL
    count = 0

    while True:
        data = requests.get(url).json()
        url = data["next"]
        studies = list(
            filter(
                None,
                [
                    add_collection(c)
                    for c in data["results"]
                    if c["DOI"] is not None
                    and c["number_of_images"] > 0
                    and (max_images is None or c["number_of_images"] < max_images)
                ],
            )
        )
        db.session.add_all(studies)
        db.session.commit()
        count += len(studies)
        if (limit is not None and count >= int(limit)) or not url:
            break


def _chunked(values, size):
    """Yield ``values`` in lists of at most ``size``, to bound sql parameter counts."""
    chunk = []
    for value in values:
        chunk.append(value)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def _non_group_neurovault_image_condition():
    """The sql half of :func:`is_non_group_analysis_level`, over stored payloads."""
    level = sa.func.lower(sa.func.btrim(Image.data["analysis_level"].astext))
    return level.in_(sorted(NON_GROUP_NORMALIZED_VALUES))


def _no_child_rows(selectable, child_column, parent_column):
    """Sql for "no row in ``selectable`` points at ``parent_column``"."""
    return ~sa.exists(
        sa.select(sa.literal(1))
        .select_from(selectable)
        .where(child_column == parent_column)
    )


def _ids_where(model, ids, *conditions, batch_size):
    """Which of ``ids`` satisfy ``conditions``, asked in batches."""
    matched = []
    for chunk in _chunked(ids, batch_size):
        matched.extend(
            row_id
            for (row_id,) in db.session.query(model.id).filter(
                model.id.in_(chunk), *conditions
            )
        )
    return matched


def _delete_by_ids(model, ids, batch_size):
    """Delete ``ids`` in batches, returning how many rows went."""
    deleted = 0
    for chunk in _chunked(ids, batch_size):
        result = db.session.execute(sa.delete(model).where(model.id.in_(chunk)))
        deleted += result.rowcount or 0
    return deleted


def _study_holds_data():
    """Sql for "this study still has an image or a coordinate somewhere".

    Images hang off a study either directly or through one of its analyses;
    coordinates only ever hang off an analysis.
    """
    return sa.or_(
        sa.exists(
            sa.select(sa.literal(1))
            .select_from(Image)
            .where(Image.study_id == Study.id)
        ),
        sa.exists(
            sa.select(sa.literal(1))
            .select_from(Analysis)
            .join(Image, Image.analysis_id == Analysis.id)
            .where(Analysis.study_id == Study.id)
        ),
        sa.exists(
            sa.select(sa.literal(1))
            .select_from(Analysis)
            .join(Point, Point.analysis_id == Analysis.id)
            .where(Analysis.study_id == Study.id)
        ),
    )


def _empty_neurovault_studies():
    """Neurovault studies left holding neither an image nor a coordinate."""
    return db.session.execute(
        sa.select(Study.id, Study.base_study_id).where(
            Study.source == "neurovault", ~_study_holds_data()
        )
    ).all()


def _deactivate_base_studies_without_data(base_study_ids, batch_size):
    """Mark base studies inactive once no surviving version carries data.

    A base study can hold a coordinate version alongside the image one that was
    just deleted, so this asks what is left rather than assuming the deletion
    emptied it.
    """
    base_study_ids = [
        base_study_id for base_study_id in base_study_ids if base_study_id
    ]
    if not base_study_ids:
        return 0

    still_holding = set()
    for chunk in _chunked(base_study_ids, batch_size):
        still_holding.update(
            base_study_id
            for (base_study_id,) in db.session.query(Study.base_study_id)
            .filter(Study.base_study_id.in_(chunk), _study_holds_data())
            .distinct()
        )

    empty_ids = [
        base_study_id
        for base_study_id in dict.fromkeys(base_study_ids)
        if base_study_id not in still_holding
    ]
    deactivated = 0
    for chunk in _chunked(empty_ids, batch_size):
        result = db.session.execute(
            sa.update(BaseStudy)
            .where(BaseStudy.id.in_(chunk), BaseStudy.is_active.is_(True))
            .values(is_active=False)
        )
        deactivated += result.rowcount or 0
    return deactivated


def _prune_empty_neurovault_studies(verbose=False, batch_size=1000):
    """Delete neurovault studies holding neither images nor coordinates.

    A study whose every image was non-group keeps nothing a meta-analysis can
    read, so it goes rather than staying as an empty shell, and its base study is
    deactivated when no other version carries data either. Deleting a study also
    drops its studyset memberships by cascade; since the study holds nothing
    computable, no meta-analysis result changes, but the studysets do get smaller.

    Returns ``(counts, touched_ids)``, the ids being what the caller invalidates
    once it commits. Caller owns the transaction.
    """
    rows = _empty_neurovault_studies()
    counts = {
        "studies_deleted": 0,
        "base_studies_deactivated": 0,
        "studyset_memberships_dropped": 0,
    }
    touched = {"studies": [], "studysets": []}
    if not rows:
        return counts, touched

    study_ids = [row[0] for row in rows]
    base_study_ids = {row[1] for row in rows if row[1]}
    touched["studies"] = study_ids

    for chunk in _chunked(study_ids, batch_size):
        # the studysets these studies belong to lose a member, so note them for
        # the cache while the association rows are still there to be read
        for studyset_id, in db.session.query(StudysetStudy.studyset_id).filter(
            StudysetStudy.study_id.in_(chunk)
        ):
            counts["studyset_memberships_dropped"] += 1
            touched["studysets"].append(studyset_id)

    if verbose:
        for chunk in _chunked(study_ids, batch_size):
            for study in Study.query.filter(Study.id.in_(chunk)):
                print(
                    "Study {} (collection {}) holds no images or coordinates".format(
                        study.id, study.source_id
                    )
                )

    counts["studies_deleted"] = _delete_by_ids(Study, study_ids, batch_size)
    db.session.expire_all()
    counts["base_studies_deactivated"] = _deactivate_base_studies_without_data(
        base_study_ids, batch_size
    )
    return counts, touched


# The suffixes summarize_nifti_file can actually read, as a postgres regex.
_NIFTI_URL_PATTERN = r"[.](nii|nii[.]gz|mgz|mgh)$"
_NIFTI_FILE_URL_PATTERN = r"^https?://.*" + _NIFTI_URL_PATTERN


def _image_file_url_candidates(limit=None):
    """Images whose ``url`` is a landing page while ``filename`` holds the file.

    An older ingest path stored the neurovault page in ``url`` and the direct file
    url in ``filename``, the opposite of what the neurovault ingest stores now.
    """
    query = (
        db.session.query(Image.id, Image.filename)
        .filter(
            Image.url.isnot(None),
            Image.filename.isnot(None),
            ~Image.url.op("~*")(_NIFTI_URL_PATTERN),
            Image.filename.op("~*")(_NIFTI_FILE_URL_PATTERN),
        )
        .order_by(Image.id)
    )
    if limit:
        query = query.limit(limit)
    return query.all()


def _as_https(url):
    """http downloads pay a redirect to https, and there are thousands of them."""
    if url.startswith("http://"):
        return url.replace("http://", "https://", 1)
    return url


def _url_basename(url):
    """The trailing path segment, matching the filename the newer rows store."""
    return (urlparse(url).path or "").rsplit("/", 1)[-1]


def migrate_image_file_urls(
    dry_run=True, verbose=False, batch_size=1000, limit=None, verify=0
):
    """Point ``Image.url`` at the nifti file rather than a neurovault page.

    Rows ingested by an older path hold the landing page in ``url`` and the file
    url in ``filename``, so the summarizer downloads html and every image fails.
    This moves the file url into ``url``, reduces ``filename`` to the basename the
    neurovault ingest stores, and upgrades http to https so a download does not
    pay a redirect. Rows whose ``url`` already names a file are left alone.

    ``verify`` head-requests that many of the migrated urls and refuses to commit
    if any of them does not resolve.
    """
    rows = _image_file_url_candidates(limit=limit)
    summary = {"migrated": 0, "verified": 0, "unresolved": []}
    if not rows:
        print("No image urls to migrate; every url already names a file.")
        return summary

    updates = []
    for image_id, filename in rows:
        file_url = _as_https(filename)
        updates.append(
            {"id": image_id, "url": file_url, "filename": _url_basename(file_url)}
        )
        if verbose:
            print("{}: url -> {}".format(image_id, file_url))

    if verify:
        # a sample is enough: these rows all came from one ingest path and share
        # a shape, so a wrong rewrite shows up in the first few
        for update in updates[:verify]:
            try:
                response = requests.head(
                    update["url"], timeout=60, allow_redirects=True
                )
                response.raise_for_status()
            except Exception as exc:
                summary["unresolved"].append((update["url"], str(exc)))
            else:
                summary["verified"] += 1
        if summary["unresolved"]:
            db.session.rollback()
            print(
                "{} of {} sampled url(s) did not resolve; nothing was changed:".format(
                    len(summary["unresolved"]), min(verify, len(updates))
                )
            )
            for url, error in summary["unresolved"][:10]:
                print("  {}: {}".format(url, error))
            return summary

    for chunk in _chunked(updates, batch_size):
        db.session.execute(sa.update(Image), chunk)
        summary["migrated"] += len(chunk)

    if dry_run:
        db.session.rollback()
    else:
        db.session.commit()
        _invalidate_cached_responses({"images": [row[0] for row in rows]})

    print(
        "{} {} image url(s) to point at the nifti file{}.".format(
            "Would migrate" if dry_run else "Migrated",
            summary["migrated"],
            "" if not verify else ", {} verified".format(summary["verified"]),
        )
    )
    if dry_run:
        print("Dry run: nothing was committed. Re-run with --apply to migrate.")
    return summary


def prune_non_group_neurovault_images(dry_run=True, verbose=False, batch_size=1000):
    """Delete stored neurovault images that are not group level results.

    The mirror of the ingest filter, for data stored before that filter existed, and
    reading the same stored payloads rather than refetching. Rows that only existed
    to hold a deleted image go too: analyses left with neither images nor coordinates,
    and entities left with neither images nor points. Studies are kept and reported,
    so a collection that turns out to be entirely single-subject stays visible.

    Also re-derives the sample sizes taken from the deleted images and updates the
    filtered-image count, so a later ``ingest_neurovault`` neither trusts stale
    counts nor reads the study as partially ingested.

    Everything runs in one transaction, so ``dry_run`` reports exactly what a real
    run would do and then rolls it back.
    """
    rows = (
        db.session.query(
            Image.id,
            Image.analysis_id,
            Image.study_id,
            Study.base_study_id,
            Image.data["analysis_level"].astext,
        )
        .join(Study, Study.id == Image.study_id)
        .filter(
            Study.source == "neurovault",
            _non_group_neurovault_image_condition(),
        )
        .all()
    )

    summary = {
        "images_deleted": 0,
        "analyses_deleted": 0,
        "entities_deleted": 0,
        "studies_affected": 0,
        "studies_left_without_images": 0,
        "studies_deleted": 0,
        "base_studies_deactivated": 0,
        "studyset_memberships_dropped": 0,
        "levels": {},
    }
    if not rows:
        # the empty-study sweep below still has work to do: a previous run may have
        # deleted the images and left the shells, so this must not return early
        print("No non-group neurovault images stored.")

    image_ids = [row[0] for row in rows]
    analysis_ids = {row[1] for row in rows if row[1]}
    study_ids = {row[2] for row in rows if row[2]}
    base_study_ids = {row[3] for row in rows if row[3]}
    per_study_counts = {}
    for _, _, study_id, _, level in rows:
        canonical = canonicalize_analysis_level(level) or "unrecognized"
        summary["levels"][canonical] = summary["levels"].get(canonical, 0) + 1
        if study_id:
            per_study_counts[study_id] = per_study_counts.get(study_id, 0) + 1

    # image_entities cascades when the image goes, leaving the entity row itself
    # behind, so note them now while the association rows still exist
    entity_ids = set()
    for chunk in _chunked(image_ids, batch_size):
        entity_ids.update(
            row_id
            for (row_id,) in db.session.execute(
                sa.select(ImageEntityMap.c.entity).where(
                    ImageEntityMap.c.image.in_(chunk)
                )
            )
        )

    summary["images_deleted"] = _delete_by_ids(Image, image_ids, batch_size)
    emptied_analysis_ids = _ids_where(
        Analysis,
        analysis_ids,
        _no_child_rows(Image, Image.analysis_id, Analysis.id),
        _no_child_rows(Point, Point.analysis_id, Analysis.id),
        batch_size=batch_size,
    )
    summary["analyses_deleted"] = _delete_by_ids(
        Analysis, emptied_analysis_ids, batch_size
    )
    # entities of a deleted analysis went with it by cascade; these are the ones left
    # hanging off an analysis that survived because it kept a group image
    dangling_entity_ids = _ids_where(
        Entity,
        entity_ids,
        _no_child_rows(ImageEntityMap, ImageEntityMap.c.entity, Entity.id),
        _no_child_rows(PointEntityMap, PointEntityMap.c.entity, Entity.id),
        batch_size=batch_size,
    )
    summary["entities_deleted"] = _delete_by_ids(
        Entity, dangling_entity_ids, batch_size
    )

    # the bulk deletes went round the orm, so drop anything it still remembers
    # before reading images back through the relationships
    db.session.expire_all()
    summary["studies_affected"] = len(study_ids)
    for chunk in _chunked(study_ids, batch_size):
        for study in Study.query.filter(Study.id.in_(chunk)):
            removed = per_study_counts.get(study.id, 0)
            _apply_neurovault_sample_sizes(study, clear_missing=True)
            # the images deleted here and the ones a filtered ingest already reported
            # dropping are one set counted from two sides, so take the larger, not
            # the sum: an inflated count reads as a complete collection
            stored_count = _coerce_non_group_image_count(
                (study.metadata_ or {}).get(NEUROVAULT_NON_GROUP_IMAGE_COUNT_KEY)
            )
            _set_metadata_key(
                study,
                NEUROVAULT_NON_GROUP_IMAGE_COUNT_KEY,
                max(stored_count, removed),
            )
            if not study.images:
                summary["studies_left_without_images"] += 1
            if verbose:
                print(
                    "Study {} (collection {}): removed {} image(s), {} left".format(
                        study.id, study.source_id, removed, len(study.images)
                    )
                )

    # a study stripped of every image keeps nothing a meta-analysis can read, so
    # it goes too, along with the base study when no version is left holding data
    empty_counts, emptied = _prune_empty_neurovault_studies(
        verbose=verbose, batch_size=batch_size
    )
    summary.update(empty_counts)

    if dry_run:
        db.session.rollback()
    else:
        db.session.commit()
        _recompute_base_study_flag_ids(base_study_ids)
        _invalidate_cached_responses(
            {
                "images": image_ids,
                "analyses": emptied_analysis_ids,
                "studies": list(study_ids) + emptied["studies"],
                "base-studies": list(base_study_ids),
                "studysets": sorted(set(emptied["studysets"])),
            }
        )

    print(
        "{} {} non-group image(s) across {} study(ies): {}".format(
            "Would delete" if dry_run else "Deleted",
            summary["images_deleted"],
            summary["studies_affected"],
            ", ".join(
                "{} {}".format(count, level)
                for level, count in sorted(summary["levels"].items())
            ),
        )
    )
    print(
        "{} {} emptied analysis(es) and {} orphaned entity(ies); "
        "{} study(ies) left without any images.".format(
            "Would delete" if dry_run else "Deleted",
            summary["analyses_deleted"],
            summary["entities_deleted"],
            summary["studies_left_without_images"],
        )
    )
    print(
        "{} {} study(ies) holding neither images nor coordinates, dropping {} "
        "studyset membership(s); {} base study(ies) marked inactive.".format(
            "Would delete" if dry_run else "Deleted",
            summary["studies_deleted"],
            summary["studyset_memberships_dropped"],
            summary["base_studies_deactivated"],
        )
    )
    if dry_run:
        print("Dry run: nothing was committed. Re-run with --apply to delete.")
    return summary


def ingest_neurosynth(max_rows=None):
    """Ingest the bundled Neurosynth coordinate dataset.

    Deprecated:
        This still creates the legacy public ``neurosynth`` Studyset and
        Annotation for backwards compatibility with tests and older local
        bootstrap flows. New platform-wide studyset creation should use the
        canonical platform/release builders instead of adding dataset-specific
        studysets during ingestion.
    """
    coords_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neurosynth_version-7_coordinates.tsv.gz"
    )
    metadata_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neurosynth_version-7_metadata.tsv.gz"
    )

    feature_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neurosynth_version-7_vocab-terms_source-abstract_type-tfidf_features.npz"
    )

    vocab_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neurosynth_version-7_vocab-terms_vocabulary.txt"
    )

    coord_data = pd.read_table(coords_file, dtype={"id": str})
    coord_data = coord_data.set_index("id")
    metadata = pd.read_table(metadata_file, dtype={"id": str, "doi": str})
    metadata = metadata.set_index("id")
    # load annotations
    features = sparse.load_npz(feature_file).todense()
    vocabulary = np.loadtxt(vocab_file, dtype=str, delimiter="\t")
    annotations = pd.DataFrame(features, columns=vocabulary)

    if max_rows is not None:
        metadata = metadata.iloc[:max_rows]
        annotations = annotations.iloc[:max_rows]

    # DEPRECATED: retained only for backwards compatibility with tests and older
    # bootstrap flows. New platform-wide studyset creation happens outside these
    # source-specific ingest routines.
    d = Studyset(
        name="neurosynth",
        description="TODO",
        publication="Nature Methods",
        pmid="21706013",
        doi="10.1038/nmeth.1635",
        authors="Yarkoni T, Poldrack RA, Nichols TE, Van Essen DC, Wager TD",
        public=True,
    )

    studies = []
    to_commit = []
    all_studies = {s.pmid: s for s in Study.query.filter_by(source="neurosynth").all()}
    base_study_records = []
    with db.session.no_autoflush:
        for metadata_row, annotation_row in zip(
            metadata.itertuples(), annotations.itertuples(index=False)
        ):
            base_study = None
            doi = _coerce_optional(metadata_row.doi)
            id_ = pmid = metadata_row.Index

            # find an base_study based on available information
            if doi is not None:
                existing_base_studies = BaseStudy.query.filter(
                    or_(BaseStudy.doi == doi, BaseStudy.pmid == pmid)
                ).all()

                if len(existing_base_studies) == 1:
                    base_study = existing_base_studies[0]
                elif len(existing_base_studies) > 1:
                    source_base_study = existing_base_studies[0]
                    # do not overwrite the versions column
                    # we want to append to this column
                    columns = [
                        c
                        for c in source_base_study.__table__.columns
                        if c not in ("versions", "__ts_vector__")
                    ]
                    for ab in existing_base_studies[1:]:
                        for col in columns:
                            source_attr = getattr(source_base_study, col)
                            new_attr = getattr(ab, col)
                            setattr(source_base_study, col, source_attr or new_attr)
                        source_base_study.versions.extend(ab.versions)
                        # delete the extraneous record
                        db.session.execute(
                            sa.delete(BaseStudyFlagOutbox).where(
                                BaseStudyFlagOutbox.base_study_id == ab.id
                            )
                        )
                        db.session.execute(
                            sa.delete(BaseStudyMetadataOutbox).where(
                                BaseStudyMetadataOutbox.base_study_id == ab.id
                            )
                        )
                        db.session.delete(ab)

            if doi is None:
                base_study = BaseStudy.query.filter_by(pmid=pmid).one_or_none()

            if base_study is None:
                base_study = BaseStudy(
                    name=metadata_row.title,
                    doi=doi,
                    pmid=pmid,
                    authors=metadata_row.authors,
                    publication=metadata_row.journal,
                    year=metadata_row.year,
                    level="group",
                )
            else:
                # try to update the abstract study if information is missing
                study_info = {
                    "name": metadata_row.title,
                    "doi": doi,
                    "pmid": pmid,
                    "authors": metadata_row.authors,
                    "publication": metadata_row.journal,
                    "year": metadata_row.year,
                    "level": "group",
                }
                for col, value in study_info.items():
                    source_attr = getattr(base_study, col)
                    setattr(base_study, col, source_attr or value)
            to_commit.append(base_study)
            base_study_records.append(base_study)
            study_coord_data = coord_data.loc[[id_]]
            md = {
                "year": int(metadata_row.year),
            }
            if metadata_row.doi in all_studies:
                continue
            s = Study(
                name=metadata_row.title,
                authors=metadata_row.authors,
                year=metadata_row.year,
                publication=metadata_row.journal,
                metadata=md,
                pmid=id_,
                doi=doi,
                source="neurosynth",
                source_id=id_,
                level="group",
                base_study=base_study,
            )
            analyses = []
            points = []
            tables = {}

            for order, (t_id, df) in enumerate(study_coord_data.groupby("table_id")):
                table = tables.get(t_id) or Table(
                    t_id=str(t_id), name=str(t_id), study=s, user_id=s.user_id
                )
                tables[t_id] = table
                a = Analysis(name=str(t_id), study=s, order=order, table=table)
                analyses.append(a)
                point_idx = 0
                for _, p in df.iterrows():
                    point = Point(
                        x=p["x"],
                        y=p["y"],
                        z=p["z"],
                        space=metadata_row.space,
                        kind="unknown",
                        analysis=a,
                        entities=[Entity(label=a.name, level="group", analysis=a)],
                        order=point_idx,
                    )
                    points.append(point)
                    point_idx += 1
            to_commit.extend(tables.values())
            to_commit.extend(points)
            to_commit.extend(analyses)
            studies.append(s)

        # add studies to studyset via association objects
        d.studyset_studies = [StudysetStudy(study=s, studyset=d) for s in studies]
        db.session.add_all([d] + studies + to_commit + d.studyset_studies)
        db.session.commit()

        # create annotation object
        annot = Annotation(
            name="neurosynth",
            source="neurostore",
            source_id=None,
            description="TODO",
            studyset=d,
        )

        # collect notes (single annotations) for each analysis
        notes = []
        for metadata_row, annotation_row in zip(
            metadata.itertuples(), annotations.itertuples(index=False)
        ):
            id_ = metadata_row.Index
            study_coord_data = coord_data.loc[[id_]]
            study = Study.query.filter_by(pmid=id_).one()
            studyset_study = StudysetStudy.query.filter_by(
                study_id=study.id, studyset_id=d.id
            ).one()
            to_commit.extend([study, studyset_study] + study.analyses)
            for analysis in study.analyses:
                to_commit.append(analysis)
                # add note
                aa = AnnotationAnalysis(
                    annotation=annot,
                    studyset_study=studyset_study,
                    analysis=analysis,
                    note=annotation_row._asdict(),
                )
                notes.append(aa)

        # add notes to annotation
        annot.note_keys = {}
        for idx, (k, v) in enumerate(annotation_row._asdict().items()):
            note_type = _check_type(v) or "string"
            annot.note_keys[k] = {
                "type": note_type,
                "order": idx,
                "default": resolve_note_key_default(k, note_type),
            }
        annot.annotation_analyses = notes
        for note in notes:
            to_commit.append(note.analysis)
        db.session.add_all([annot] + notes + to_commit + [d])
        db.session.commit()
        _recompute_base_study_flags(base_study_records)


def ingest_neuroquery(max_rows=None):
    """Ingest the bundled NeuroQuery coordinate dataset.

    Deprecated:
        This still creates the legacy public ``neuroquery`` Studyset for
        backwards compatibility with tests and older local bootstrap flows. New
        platform-wide studyset creation should use the canonical platform/release
        builders instead of adding dataset-specific studysets during ingestion.
    """
    coords_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neuroquery_version-1_coordinates.tsv.gz"
    )
    metadata_file = (
        Path(__file__).parent.parent
        / "data"
        / "data-neuroquery_version-1_metadata.tsv.gz"
    )

    coord_data = pd.read_table(coords_file, dtype={"id": str})
    coord_data = coord_data.set_index("id")
    metadata = pd.read_table(metadata_file, dtype={"id": str})
    metadata = metadata.set_index("id")

    base_studies = []
    if max_rows is not None:
        metadata = metadata.iloc[:max_rows]

    # all_studies = {s.pmid: s for s in Study.query.filter(source="neuroquery").all()}
    for id_, metadata_row in metadata.iterrows():
        base_study = BaseStudy.query.filter_by(pmid=id_).one_or_none()

        if base_study is None:
            base_study = BaseStudy(name=metadata_row["title"], level="group", pmid=id_)
        base_studies.append(base_study)
        study_coord_data = coord_data.loc[[id_]]
        s = Study(
            name=metadata_row["title"] or base_study.name,
            source="neuroquery",
            pmid=id_,
            doi=base_study.doi,
            year=base_study.year,
            publication=base_study.publication,
            authors=base_study.authors,
            source_id=id_,
            level="group",
            base_study=base_study,
        )
        analyses = []
        points = []
        tables = {}

        for order, (t_id, df) in enumerate(study_coord_data.groupby("table_id")):
            table = tables.get(t_id) or Table(
                t_id=str(t_id), name=str(t_id), study=s, user_id=s.user_id
            )
            tables[t_id] = table
            a = Analysis(name=str(t_id), table=table, order=order, study=s)
            analyses.append(a)
            point_idx = 0
            for _, p in df.iterrows():
                point = Point(
                    x=p["x"],
                    y=p["y"],
                    z=p["z"],
                    space="MNI",
                    kind="unknown",
                    analysis=a,
                    entities=[Entity(label=a.name, level="group", analysis=a)],
                    order=point_idx,
                )
                points.append(point)
                point_idx += 1

        db.session.add_all(
            [s] + analyses + points + list(tables.values()) + [base_study]
        )
        # db.session.commit()

    # DEPRECATED: retained only for backwards compatibility with tests and older
    # bootstrap flows. New platform-wide studyset creation happens outside these
    # source-specific ingest routines.
    d = Studyset(
        name="neuroquery",
        description="TODO",
        publication="eLife",
        pmid="32129761",
        doi="10.7554/eLife.53385",
        public=True,
        studies=Study.query.filter_by(source="neuroquery").all(),
    )
    db.session.add(d)
    db.session.commit()
    _recompute_base_study_flags(base_studies)


def load_ace_files(coordinates_file, metadata_file, text_file):
    coordinates_df = pd.read_table(coordinates_file, sep=",", dtype=str)
    metadata_df = pd.read_table(metadata_file, sep=",", dtype=str)
    text_df = pd.read_table(text_file, sep=",", dtype=str)

    for col in ["x", "y", "z"]:
        if col in coordinates_df.columns:
            coordinates_df[col] = pd.to_numeric(coordinates_df[col], errors="coerce")

    text_df.fillna("", inplace=True)
    metadata_df.fillna("", inplace=True)
    coordinates_df.fillna("", inplace=True)

    for df in [coordinates_df, metadata_df, text_df]:
        df.pmid = df.pmid.str.split(".").str[0]
    # preprocessing
    metadata_df.set_index("pmid", inplace=True)
    text_df.set_index("pmid", inplace=True)
    coordinates_df.set_index("pmid", inplace=True)

    # ensure same order
    text_df = text_df.reindex(metadata_df.index)

    return coordinates_df, metadata_df, text_df


def ace_ingestion_logic(coordinates_df, metadata_df, text_df, skip_existing=False):
    def get_base_study(metadata_row):
        doi = _coerce_optional(metadata_row.doi)
        pmid = metadata_row.Index
        base_studies = BaseStudy.query.filter(
            or_(BaseStudy.doi == doi, BaseStudy.pmid == pmid)
        ).all()

        if len(base_studies) == 1:
            return base_studies[0]
        elif len(base_studies) > 1:
            return merge_base_studies(base_studies, doi, pmid)

        else:
            created_bs = [
                bs for bs in all_base_studies if bs.doi == doi and bs.pmid == pmid
            ]
            if created_bs:
                return created_bs[0]
            return BaseStudy.query.filter_by(pmid=pmid).one_or_none()

    def merge_base_studies(base_studies, doi, pmid):
        if doi is None:
            source_base_study = next(
                filter(lambda bs: bs.pmid == pmid and bs.doi is not None, base_studies),
                base_studies[0],
            )
        else:
            source_base_study = next(
                filter(lambda bs: bs.pmid == pmid and bs.doi == doi, base_studies),
                base_studies[0],
            )

        other_base_studies = [
            bs for bs in base_studies if bs.id != source_base_study.id
        ]
        columns = [
            c.name
            for c in source_base_study.__table__.columns
            if c.name not in ("versions", "__ts_vector__")
        ]
        for ab in other_base_studies:
            for col in columns:
                source_attr = getattr(source_base_study, col)
                new_attr = getattr(ab, col)
                setattr(source_base_study, col, source_attr or new_attr)
            source_base_study.versions.extend(ab.versions)
            db.session.execute(
                sa.delete(BaseStudyFlagOutbox).where(
                    BaseStudyFlagOutbox.base_study_id == ab.id
                )
            )
            db.session.execute(
                sa.delete(BaseStudyMetadataOutbox).where(
                    BaseStudyMetadataOutbox.base_study_id == ab.id
                )
            )
            db.session.delete(ab)
        return source_base_study

    def update_study_info(study, metadata_row, text_row, doi, pmcid, year, level):
        study_info = {
            "name": metadata_row.title,
            "doi": doi,
            "pmid": metadata_row.Index,
            "pmcid": pmcid,
            "description": text_row.abstract,
            "authors": metadata_row.authors,
            "publication": metadata_row.journal,
            "year": year,
            "level": level,
        }
        if isinstance(study, Study):
            study_info["source"] = (
                "neurosynth" if "ace" in metadata_row.source else "pubget",
            )
        for col, value in study_info.items():
            source_attr = getattr(study, col)
            setattr(study, col, source_attr or value)

    def process_coordinates(id_, s, metadata_row):
        analyses = []
        points = []
        tables = []
        try:
            study_coord_data = coordinates_df.loc[[id_]]
        except KeyError:
            print(f"pmid: {id_} has no coordinates")
            return analyses, points, tables
        for order, (t_id, df) in enumerate(study_coord_data.groupby("table_id")):
            first_row = df.iloc[0]
            table_label = _coerce_optional(first_row["table_label"])
            table_caption = _coerce_optional(first_row["table_caption"])
            statistic = _coerce_optional(first_row["statistic"])
            resolved_table_label = table_label if table_label is not None else str(t_id)
            table = Table.query.filter_by(
                t_id=str(t_id), study_id=s.id
            ).one_or_none() or Table(t_id=str(t_id), study=s, user_id=s.user_id)
            if table not in tables:
                tables.append(table)
            if not table.table_label:
                table.table_label = resolved_table_label
            if not table.name:
                table.name = resolved_table_label
            if table.caption is None:
                table.caption = table_caption
            existing_analysis = (
                Analysis.query.filter_by(table_id=table.id, study_id=s.id).one_or_none()
                if table.id
                else None
            )
            a = existing_analysis or Analysis()
            a.name = resolved_table_label
            a.table = table
            a.order = a.order or order
            a.description = table_caption
            if not a.study:
                a.study = s
            analyses.append(a)
            point_idx = 0
            for _, p in df.iterrows():
                point = Point(
                    x=p["x"],
                    y=p["y"],
                    z=p["z"],
                    space=metadata_row.coordinate_space,
                    kind=statistic if statistic is not None else "unknown",
                    analysis=a,
                    order=point_idx,
                )
                points.append(point)
                point_idx += 1
        return analyses, points, tables

    to_commit = []
    all_base_studies = []

    with db.session.no_autoflush:
        all_studies = {
            s.pmid: s for s in Study.query.filter_by(source="neurosynth").all()
        }
        for metadata_row, text_row in zip(
            metadata_df.itertuples(), text_df.itertuples()
        ):
            level = (
                "meta"
                if any(
                    word in metadata_row.title.lower() for word in META_ANALYSIS_WORDS
                )
                else "group"
            )
            base_study = get_base_study(metadata_row)
            pmid = metadata_row.Index
            pmcid = _coerce_optional(metadata_row.pmcid)
            doi = _coerce_optional(metadata_row.doi)
            year = _coerce_optional_int(metadata_row.publication_year)

            if (
                skip_existing
                and base_study is not None
                and any(s.source == "neurosynth" for s in base_study.versions)
            ):
                continue

            if base_study is None:

                base_study = BaseStudy(
                    name=metadata_row.title,
                    doi=doi,
                    pmid=pmid,
                    pmcid=pmcid,
                    authors=metadata_row.authors or None,
                    publication=metadata_row.journal or None,
                    description=text_row.abstract or None,
                    ace_fulltext=text_row.body or None,
                    year=year,
                    level=level,
                )
            else:
                update_study_info(
                    base_study, metadata_row, text_row, doi, pmcid, year, level
                )

            to_commit.append(base_study)
            all_base_studies.append(base_study)

            s = all_studies.get(pmid, Study())
            update_study_info(s, metadata_row, text_row, doi, pmcid, year, level)

            analyses, points, tables = process_coordinates(pmid, s, metadata_row)
            to_commit.extend(points)
            to_commit.extend(analyses)
            to_commit.extend(tables)
            base_study.versions.append(s)

    db.session.add_all(to_commit)
    db.session.commit()
    _recompute_base_study_flags(all_base_studies)


def ingest_ace(max_rows=None):
    coords_file = (
        Path(__file__).parent.parent / "data" / "ace" / "sample_coordinates.csv"
    )

    metadata_file = (
        Path(__file__).parent.parent / "data" / "ace" / "sample_metadata.csv"
    )

    text_file = Path(__file__).parent.parent / "data" / "ace" / "sample_text.csv"

    coordinates_df, metadata_df, text_df = load_ace_files(
        coords_file, metadata_file, text_file
    )

    ace_ingestion_logic(coordinates_df, metadata_df, text_df)
