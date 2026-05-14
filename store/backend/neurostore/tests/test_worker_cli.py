import os
import subprocess
import sys
import textwrap
from pathlib import Path

from neurostore.models import (
    Analysis,
    BaseStudy,
    BaseStudyFlagOutbox,
    BaseStudyMetadataOutbox,
    Image,
    Study,
)

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _run_flask_command(args, *, extra_env=None):
    env = os.environ.copy()
    env.setdefault("APP_ENV", "docker_test")
    env.setdefault("FLASK_APP", "manage")
    if extra_env:
        env.update(extra_env)

    return subprocess.run(
        [sys.executable, "-m", "flask", *args],
        cwd=BACKEND_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def _run_cli_runner_command(args, *, patch_script="", extra_env=None):
    env = os.environ.copy()
    env.setdefault("APP_ENV", "docker_test")
    env.setdefault("FLASK_APP", "manage")
    if extra_env:
        env.update(extra_env)

    script = "\n".join(
        [
            "import sys",
            "import traceback",
            "",
            "from manage import app",
            textwrap.dedent(patch_script).strip(),
            f"result = app.test_cli_runner().invoke(args={args!r})",
            "sys.stdout.write(result.output)",
            "if result.exception is not None:",
            "    traceback.print_exception(",
            "        result.exception,",
            "        result.exception,",
            "        result.exception.__traceback__,",
            "        file=sys.stderr,",
            "    )",
            "raise SystemExit(result.exit_code)",
            "",
        ]
    )

    return subprocess.run(
        [sys.executable, "-c", script],
        cwd=BACKEND_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def _assert_success(result):
    if result.returncode == 0:
        return

    raise AssertionError(
        "Worker CLI command failed.\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )


def test_flag_worker_cli_processes_outbox_batch(session):
    base_study = BaseStudy(
        name="CLI Flag Worker Study",
        pmid="991001",
        doi="10.9910/flag-worker",
        level="group",
    )
    study = Study(
        name="CLI Flag Worker Version",
        level="group",
        base_study=base_study,
    )
    analysis = Analysis(name="CLI Flag Worker Analysis", study=study)
    image = Image(
        filename="cli-flag-worker-z.nii.gz",
        value_type="Z map",
        analysis=analysis,
    )
    session.add_all([base_study, study, analysis, image])
    session.commit()

    session.add(
        BaseStudyFlagOutbox(
            base_study_id=base_study.id,
            reason="test-worker-cli-flag",
        )
    )
    session.commit()

    result = _run_flask_command(
        ["process-base-study-flag-outbox", "--batch-size", "10", "--no-loop"]
    )
    _assert_success(result)
    assert "Processed 1 base-study flag outbox rows." in result.stdout

    session.expire_all()
    refreshed_analysis = session.get(Analysis, analysis.id)
    refreshed_study = session.get(Study, study.id)
    refreshed_base_study = session.get(BaseStudy, base_study.id)

    assert refreshed_analysis.has_images is True
    assert refreshed_analysis.has_z_maps is True
    assert refreshed_study.has_images is True
    assert refreshed_study.has_z_maps is True
    assert refreshed_base_study.has_images is True
    assert refreshed_base_study.has_z_maps is True
    assert (
        session.query(BaseStudyFlagOutbox)
        .filter(BaseStudyFlagOutbox.base_study_id == base_study.id)
        .count()
        == 0
    )


def test_metadata_worker_cli_processes_outbox_batch(session):
    base_study = BaseStudy(
        name=None,
        pmid="991002",
        level="group",
    )
    version = Study(
        name=None,
        publication=None,
        authors=None,
        year=None,
        doi=None,
        pmid=None,
        pmcid=None,
        level="group",
        base_study=base_study,
    )
    session.add_all([base_study, version])
    session.commit()

    session.add(
        BaseStudyMetadataOutbox(
            base_study_id=base_study.id,
            reason="test-worker-cli-metadata",
        )
    )
    session.commit()

    patch_script = """
from neurostore.services import base_study_metadata_enrichment as metadata_service

metadata_service.lookup_ids_semantic_scholar = (
    lambda *_args, **_kwargs: {
        "doi": "10.9910/metadata-worker",
        "pmcid": "PMC991002",
    }
)
metadata_service.lookup_ids_pubmed = lambda *_args, **_kwargs: {}
metadata_service.lookup_ids_openalex = lambda *_args, **_kwargs: {}
metadata_service.fetch_metadata_semantic_scholar = (
    lambda *_args, **_kwargs: {
        "name": "CLI Metadata Worker Title",
        "description": "CLI metadata worker abstract",
        "publication": "CLI Metadata Journal",
        "authors": "CLI Author",
        "year": 2024,
        "is_oa": True,
        "doi": "10.9910/metadata-worker",
        "pmid": "991002",
        "pmcid": "PMC991002",
    }
)
metadata_service.fetch_metadata_pubmed = lambda *_args, **_kwargs: {}
"""

    result = _run_cli_runner_command(
        ["process-base-study-metadata-outbox", "--batch-size", "10", "--no-loop"],
        patch_script=patch_script,
    )
    _assert_success(result)
    assert "Processed 1 base-study metadata outbox rows." in result.stdout

    session.expire_all()
    refreshed_base_study = session.get(BaseStudy, base_study.id)
    refreshed_version = session.get(Study, version.id)

    assert refreshed_base_study.name == "CLI Metadata Worker Title"
    assert refreshed_base_study.description == "CLI metadata worker abstract"
    assert refreshed_base_study.publication == "CLI Metadata Journal"
    assert refreshed_base_study.authors == "CLI Author"
    assert refreshed_base_study.year == 2024
    assert refreshed_base_study.doi == "10.9910/metadata-worker"
    assert refreshed_base_study.pmcid == "PMC991002"
    assert refreshed_base_study.is_oa is True

    assert refreshed_version.name == "CLI Metadata Worker Title"
    assert refreshed_version.publication == "CLI Metadata Journal"
    assert refreshed_version.authors == "CLI Author"
    assert refreshed_version.year == 2024
    assert refreshed_version.doi == "10.9910/metadata-worker"
    assert refreshed_version.pmid == "991002"
    assert refreshed_version.pmcid == "PMC991002"

    assert (
        session.query(BaseStudyMetadataOutbox)
        .filter(BaseStudyMetadataOutbox.base_study_id == base_study.id)
        .count()
        == 0
    )
    assert (
        session.query(BaseStudyFlagOutbox)
        .filter(BaseStudyFlagOutbox.base_study_id == base_study.id)
        .count()
        == 1
    )
