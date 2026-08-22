"""Backfill :class:`ImageValueSummary` rows by downloading and summarizing images."""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import load_only, selectinload

from neurostore.database import db
from neurostore.map_types import canonicalize_map_type
from neurostore.models import Image, ImageValueSummary, Study
from neurostore.services.image_value_summary import (
    DEFAULT_MAX_DOWNLOAD_BYTES,
    DEFAULT_MAX_VOXELS,
    DEFAULT_TIMEOUT_SECONDS,
    IMAGE_VALUE_SUMMARY_VERSION,
    compute_image_value_summary,
)


def _select_images(
    *,
    image_id=None,
    source=None,
    value_type=None,
    force=False,
    retry_failed=False,
    limit=None,
):
    query = sa.select(Image).where(Image.url.isnot(None))

    if image_id:
        return query.where(Image.id == image_id)

    if source:
        query = query.join(Study, Study.id == Image.study_id).where(
            Study.source == source
        )
    if value_type:
        canonical = canonicalize_map_type(value_type)
        query = query.where(Image.value_type == canonical)

    if not force:
        # An image is due when it has no summary, when the summary predates the
        # current summarizer, or -- with --retry-failed -- when the last attempt
        # failed. A stored failure is otherwise a decision not to try again.
        settled = ImageValueSummary.summarizer_version == IMAGE_VALUE_SUMMARY_VERSION
        if retry_failed:
            settled = sa.and_(settled, ImageValueSummary.status == "SUCCESS")
        query = query.where(
            ~sa.exists(
                sa.select(sa.literal(1))
                .select_from(ImageValueSummary)
                .where(ImageValueSummary.image_id == Image.id)
                .where(settled)
            )
        )

    query = query.order_by(Image.id).options(
        # only what compute_image_value_summary touches: Image.data is dead weight
        # here, and the summary would otherwise lazy-load once per image
        load_only(Image.id, Image.url),
        selectinload(Image.value_summary),
    )
    if limit:
        query = query.limit(limit)
    return query


def run_compute_image_summaries(
    *,
    limit=None,
    image_id=None,
    source=None,
    value_type=None,
    force=False,
    retry_failed=False,
    timeout=None,
    max_bytes=None,
    max_voxels=None,
    commit_every=25,
    verbose=False,
    session=None,
):
    """Summarize every due image, committing in batches. Returns a count dict."""
    timeout = DEFAULT_TIMEOUT_SECONDS if timeout is None else timeout
    max_bytes = DEFAULT_MAX_DOWNLOAD_BYTES if max_bytes is None else max_bytes
    max_voxels = DEFAULT_MAX_VOXELS if max_voxels is None else max_voxels

    query = _select_images(
        image_id=image_id,
        source=source,
        value_type=value_type,
        force=force,
        retry_failed=retry_failed,
        limit=limit,
    )
    images = db.session.scalars(query).all()

    counts = {"succeeded": 0, "failed": 0, "skipped": 0}
    pending = 0

    for index, image in enumerate(images, start=1):
        summary = compute_image_value_summary(
            image,
            timeout=timeout,
            max_bytes=max_bytes,
            max_voxels=max_voxels,
            session=session,
        )
        if summary.status == "SUCCESS":
            counts["succeeded"] += 1
        else:
            counts["failed"] += 1

        pending += 1
        if commit_every and pending >= commit_every:
            db.session.commit()
            pending = 0

        if verbose:
            if summary.status == "SUCCESS":
                detail = "n={} min={} max={}".format(
                    summary.n_values, summary.value_min, summary.value_max
                )
            else:
                detail = summary.error
            # flush: a run of this length is watched through a redirected log,
            # where block buffering would hide progress until the very end
            print(
                f"[{index}/{len(images)}] {image.id} {summary.status}: {detail}",
                flush=True,
            )

    db.session.commit()
    return counts
