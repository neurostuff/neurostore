"""Run the whole neurovault image clean-up in the order the steps depend on.

The steps are separately useful and separately re-runnable; this exists so a
fresh database can be brought to the same state without remembering the order or
which step invalidates what.
"""

from __future__ import annotations

# The sources whose images carry a direct file url, so summarizing them fetches a
# nifti rather than a landing page. Anything else needs the url migration first.
SUMMARIZABLE_SOURCES = ("neurovault", "neurostore")


def run_process_neurovault_images(
    *,
    dry_run=True,
    verbose=False,
    skip_url_migration=False,
    skip_prune=False,
    skip_sample_sizes=False,
    skip_summaries=False,
    summary_sources=SUMMARIZABLE_SOURCES,
    summary_limit=None,
    verify_urls=0,
    session=None,
):
    """Migrate urls, drop non-group images, derive sample sizes, then summarize.

    The order matters. Urls come first so the summarizer has a file to fetch. The
    prune comes before the sample sizes, which are derived from the images that
    survive it, and before the summaries so nothing is downloaded for an image
    that is about to be deleted.

    ``dry_run`` covers the two destructive steps; deriving sample sizes and
    summaries only adds rows, so those are skipped rather than faked.
    """
    from neurostore import ingest
    from neurostore.scripts.compute_image_summaries import (
        run_compute_image_summaries,
    )

    results = {}

    def _step(number, title):
        print("\n[{}/4] {}".format(number, title), flush=True)

    if skip_url_migration:
        print("\n[1/4] skipped: image url migration", flush=True)
    else:
        _step(1, "migrating image urls to point at nifti files")
        results["url_migration"] = ingest.migrate_image_file_urls(
            dry_run=dry_run, verbose=verbose, verify=verify_urls
        )

    if skip_prune:
        print("\n[2/4] skipped: non-group image prune", flush=True)
    else:
        _step(2, "pruning non-group images and the studies left empty")
        results["prune"] = ingest.prune_non_group_neurovault_images(
            dry_run=dry_run, verbose=verbose
        )

    if dry_run:
        print(
            "\nDry run: stopping before the sample sizes and summaries, which "
            "only add rows and so have nothing to preview.",
            flush=True,
        )
        return results

    if skip_sample_sizes:
        print("\n[3/4] skipped: sample size backfill", flush=True)
    else:
        _step(3, "deriving sample sizes from the surviving images")
        results["sample_sizes"] = ingest.backfill_neurovault_sample_sizes(
            verbose=verbose
        )

    if skip_summaries:
        print("\n[4/4] skipped: image value summaries", flush=True)
    else:
        _step(4, "summarizing the voxel values of every remaining image")
        summaries = {}
        for source in summary_sources:
            print("  source: {}".format(source), flush=True)
            summaries[source] = run_compute_image_summaries(
                source=source,
                limit=summary_limit,
                verbose=verbose,
                session=session,
            )
            print(
                "  {}: {succeeded} summarized, {failed} failed, "
                "{skipped} skipped".format(source, **summaries[source]),
                flush=True,
            )
        results["summaries"] = summaries

    return results
