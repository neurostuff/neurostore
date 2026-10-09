"""Chain the neurovault image clean-up steps in the order they depend on.

Each step is separately runnable; this exists so a fresh database can be brought
to the same state without having to remember the order.
"""

from __future__ import annotations

TOTAL_STEPS = 4


def _announce(number, title, skipped):
    """Print the step banner. True when the step should run."""
    print(
        "\n[{}/{}] {}{}".format(
            number, TOTAL_STEPS, "skipped: " if skipped else "", title
        ),
        flush=True,
    )
    return not skipped


def run_process_neurovault_images(
    *,
    dry_run=True,
    verbose=False,
    skip_url_migration=False,
    skip_prune=False,
    skip_sample_sizes=False,
    skip_summaries=False,
    summary_sources=None,
    summary_limit=None,
    verify_urls=0,
    session=None,
):
    """Migrate urls, drop non-group images, derive sample sizes, then summarize.

    The order is a dependency rather than a preference: urls first so the
    summarizer has a file to fetch, and the prune before both the sample sizes
    derived from the images that survive it and the summaries, so nothing is
    downloaded for an image that is about to be deleted.

    ``dry_run`` covers the two destructive steps and then stops; the sample sizes
    and summaries only add rows, so there is nothing to preview.
    """
    from neurostore import ingest
    from neurostore.scripts.compute_image_summaries import (
        run_compute_image_summaries,
    )

    results = {}

    if _announce(1, "migrating image urls onto nifti files", skip_url_migration):
        results["url_migration"] = ingest.migrate_image_file_urls(
            dry_run=dry_run, verbose=verbose, verify=verify_urls
        )

    if _announce(2, "pruning non-group images and emptied studies", skip_prune):
        results["prune"] = ingest.prune_non_group_neurovault_images(
            dry_run=dry_run, verbose=verbose
        )

    if dry_run:
        print("\nDry run: stopping before the steps that only add rows.", flush=True)
        return results

    if _announce(3, "deriving sample sizes from surviving images", skip_sample_sizes):
        results["sample_sizes"] = ingest.backfill_neurovault_sample_sizes(
            verbose=verbose
        )

    if _announce(4, "summarizing voxel values of every image", skip_summaries):
        # No source filter by default: step 1 leaves every stored url naming a
        # file, and the rows it repairs have no source to filter on anyway.
        summaries = {}
        for source in summary_sources or (None,):
            label = source or "all"
            print("  source: {}".format(label), flush=True)
            counts = run_compute_image_summaries(
                source=source,
                limit=summary_limit,
                verbose=verbose,
                session=session,
            )
            summaries[label] = counts
            print(
                "  {}: {succeeded} summarized, {failed} failed, "
                "{skipped} skipped".format(label, **counts),
                flush=True,
            )
        results["summaries"] = summaries

    return results
