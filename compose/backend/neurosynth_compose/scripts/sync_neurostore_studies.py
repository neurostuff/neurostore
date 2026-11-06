"""Copy every project's name, description and privacy to its Neurostore meta study."""

from dataclasses import dataclass, field

from sqlalchemy import select

from neurosynth_compose.database import commit_session, db
from neurosynth_compose.models.analysis import NeurostoreStudy
from neurosynth_compose.resources.resource_services import (
    compose_client_token,
    create_or_update_neurostore_study,
)

BATCH = 100


@dataclass
class SyncSummary:
    #: Projects with a Neurostore study, by the privacy their study is given.
    counts: dict
    dry_run: bool
    #: Neurostore ids whose write failed (the study row records why).
    failed: list = field(default_factory=list)


def sync_neurostore_studies(*, settings, dry_run):
    """Write each project's privacy (and name and description) to its Neurostore
    study as Compose's own client, which may edit any study; dry-run only counts."""
    studies = (
        db.session.execute(
            select(NeurostoreStudy)
            .where(NeurostoreStudy.neurostore_id.is_not(None))
            .where(NeurostoreStudy.project_id.is_not(None))
            .order_by(NeurostoreStudy.neurostore_id)
        )
        .scalars()
        .all()
    )
    private = sum(study.project.public is False for study in studies)
    summary = SyncSummary(
        counts={"private": private, "public": len(studies) - private}, dry_run=dry_run
    )
    if dry_run:
        return summary

    access_token = compose_client_token(settings)
    for done, study in enumerate(studies, start=1):
        create_or_update_neurostore_study(
            study, settings=settings, access_token=access_token
        )
        if study.status != "OK":
            summary.failed.append(study.neurostore_id)
        if done % BATCH == 0:
            commit_session()
    commit_session()
    return summary
