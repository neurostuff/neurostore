"""The pipeline that chains the neurovault clean-up steps."""

import pytest

from neurostore.scripts import process_neurovault_images as pipeline


@pytest.fixture
def recorded(monkeypatch):
    """Record which steps ran, in order, without doing any of the work."""
    calls = []

    class FakeIngest:
        @staticmethod
        def migrate_image_file_urls(**kwargs):
            calls.append(("urls", kwargs))
            return {"migrated": 0}

        @staticmethod
        def prune_non_group_neurovault_images(**kwargs):
            calls.append(("prune", kwargs))
            return {"images_deleted": 0}

        @staticmethod
        def backfill_neurovault_sample_sizes(**kwargs):
            calls.append(("sample_sizes", kwargs))
            return 0

    def fake_summaries(**kwargs):
        calls.append(("summaries", kwargs))
        return {"succeeded": 0, "failed": 0, "skipped": 0}

    import neurostore.ingest
    import neurostore.scripts.compute_image_summaries as summaries_module

    for name in ("migrate_image_file_urls", "prune_non_group_neurovault_images",
                 "backfill_neurovault_sample_sizes"):
        monkeypatch.setattr(neurostore.ingest, name, getattr(FakeIngest, name))
    monkeypatch.setattr(
        summaries_module, "run_compute_image_summaries", fake_summaries
    )
    return calls


def test_steps_run_in_dependency_order(recorded):
    """Urls before summaries, prune before sample sizes."""
    pipeline.run_process_neurovault_images(dry_run=False)

    assert [name for name, _ in recorded] == [
        "urls",
        "prune",
        "sample_sizes",
        "summaries",
        "summaries",
    ]


def test_both_summarizable_sources_are_covered(recorded):
    pipeline.run_process_neurovault_images(dry_run=False)

    sources = [kwargs["source"] for name, kwargs in recorded if name == "summaries"]
    assert sources == ["neurovault", "neurostore"]


def test_dry_run_stops_before_the_additive_steps(recorded):
    """Sample sizes and summaries only add rows, so a dry run must not fake them."""
    pipeline.run_process_neurovault_images(dry_run=True)

    assert [name for name, _ in recorded] == ["urls", "prune"]
    assert all(kwargs["dry_run"] is True for _, kwargs in recorded)


def test_skips_are_honoured(recorded):
    pipeline.run_process_neurovault_images(
        dry_run=False, skip_url_migration=True, skip_sample_sizes=True
    )

    assert [name for name, _ in recorded] == ["prune", "summaries", "summaries"]


def test_summary_source_can_be_narrowed(recorded):
    pipeline.run_process_neurovault_images(
        dry_run=False, summary_sources=("neurovault",), summary_limit=5
    )

    summaries = [kwargs for name, kwargs in recorded if name == "summaries"]
    assert len(summaries) == 1
    assert summaries[0]["source"] == "neurovault"
    assert summaries[0]["limit"] == 5
