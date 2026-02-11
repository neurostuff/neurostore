import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..cache_versioning import bump_cache_versions
from ..database import db
from ..map_types import (
    BETA_MAP_NORMALIZED_VALUES,
    T_MAP_NORMALIZED_VALUES,
    VARIANCE_MAP_NORMALIZED_VALUES,
    Z_MAP_NORMALIZED_VALUES,
)
from ..models import (
    Analysis,
    BaseStudy,
    BaseStudyFlagOutbox,
    Image,
    Point,
    Study,
)


def _normalize_ids(ids):
    if not ids:
        return []
    return sorted({id_ for id_ in ids if id_})


def _normalized_value_type(column):
    return sa.func.lower(
        sa.func.regexp_replace(
            sa.func.btrim(sa.func.coalesce(column, "")),
            r"\s+",
            " ",
            "g",
        )
    )


def _matches_values(column, accepted_values):
    return _normalized_value_type(column).in_(sorted(accepted_values))


def _clear_cache_for_ids(unique_ids):
    bump_cache_versions(unique_ids)


def enqueue_base_study_flag_updates(base_study_ids, reason="api-write"):
    base_study_ids = _normalize_ids(base_study_ids)
    if not base_study_ids:
        return 0

    rows = [
        {
            "base_study_id": base_study_id,
            "reason": reason,
        }
        for base_study_id in base_study_ids
    ]
    stmt = pg_insert(BaseStudyFlagOutbox).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[BaseStudyFlagOutbox.base_study_id],
        set_={
            "reason": reason,
            "updated_at": sa.func.now(),
        },
    )
    db.session.execute(stmt)
    return len(base_study_ids)


def recompute_media_flags(base_study_ids):
    base_study_ids = _normalize_ids(base_study_ids)
    if not base_study_ids:
        return {"base-studies": set(), "studies": set(), "analyses": set()}

    study_ids = set(
        db.session.scalars(
            sa.select(Study.id).where(Study.base_study_id.in_(base_study_ids))
        ).all()
    )

    analysis_ids = set()
    if study_ids:
        analysis_ids = set(
            db.session.scalars(
                sa.select(Analysis.id).where(Analysis.study_id.in_(study_ids))
            ).all()
        )

    changed_analysis_ids = set()
    changed_study_ids = set()
    changed_base_study_ids = set()

    # Analysis flags from direct child rows
    if analysis_ids:
        analysis_points_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Point)
            .where(Point.analysis_id == Analysis.id)
        )
        analysis_images_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Image)
            .where(Image.analysis_id == Analysis.id)
        )
        analysis_z_maps_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Image)
            .where(
                Image.analysis_id == Analysis.id,
                _matches_values(Image.value_type, Z_MAP_NORMALIZED_VALUES),
            )
        )
        analysis_t_maps_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Image)
            .where(
                Image.analysis_id == Analysis.id,
                _matches_values(Image.value_type, T_MAP_NORMALIZED_VALUES),
            )
        )
        analysis_beta_maps_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Image)
            .where(
                Image.analysis_id == Analysis.id,
                _matches_values(Image.value_type, BETA_MAP_NORMALIZED_VALUES),
            )
        )
        analysis_variance_maps_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Image)
            .where(
                Image.analysis_id == Analysis.id,
                _matches_values(Image.value_type, VARIANCE_MAP_NORMALIZED_VALUES),
            )
        )
        analysis_beta_and_variance_maps = sa.and_(
            analysis_beta_maps_exist, analysis_variance_maps_exist
        )
        changed_analysis_ids = set(
            db.session.scalars(
                sa.update(Analysis)
                .where(Analysis.id.in_(analysis_ids))
                .where(
                    sa.or_(
                        Analysis.has_coordinates != analysis_points_exist,
                        Analysis.has_images != analysis_images_exist,
                        Analysis.has_z_maps != analysis_z_maps_exist,
                        Analysis.has_t_maps != analysis_t_maps_exist,
                        Analysis.has_beta_and_variance_maps
                        != analysis_beta_and_variance_maps,
                    )
                )
                .values(
                    has_coordinates=analysis_points_exist,
                    has_images=analysis_images_exist,
                    has_z_maps=analysis_z_maps_exist,
                    has_t_maps=analysis_t_maps_exist,
                    has_beta_and_variance_maps=analysis_beta_and_variance_maps,
                )
                .returning(Analysis.id)
            ).all()
        )

    # Study flags from analyses + child rows
    if study_ids:
        study_points_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Analysis)
            .join(Point, Point.analysis_id == Analysis.id)
            .where(Analysis.study_id == Study.id)
        )
        study_images_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Analysis)
            .join(Image, Image.analysis_id == Analysis.id)
            .where(Analysis.study_id == Study.id)
        )
        study_z_maps_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Analysis)
            .join(Image, Image.analysis_id == Analysis.id)
            .where(
                Analysis.study_id == Study.id,
                _matches_values(Image.value_type, Z_MAP_NORMALIZED_VALUES),
            )
        )
        study_t_maps_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Analysis)
            .join(Image, Image.analysis_id == Analysis.id)
            .where(
                Analysis.study_id == Study.id,
                _matches_values(Image.value_type, T_MAP_NORMALIZED_VALUES),
            )
        )
        study_beta_maps_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Analysis)
            .join(Image, Image.analysis_id == Analysis.id)
            .where(
                Analysis.study_id == Study.id,
                _matches_values(Image.value_type, BETA_MAP_NORMALIZED_VALUES),
            )
        )
        study_variance_maps_exist = sa.exists(
            sa.select(sa.literal(1))
            .select_from(Analysis)
            .join(Image, Image.analysis_id == Analysis.id)
            .where(
                Analysis.study_id == Study.id,
                _matches_values(Image.value_type, VARIANCE_MAP_NORMALIZED_VALUES),
            )
        )
        study_beta_and_variance_maps = sa.and_(
            study_beta_maps_exist, study_variance_maps_exist
        )
        changed_study_ids = set(
            db.session.scalars(
                sa.update(Study)
                .where(Study.id.in_(study_ids))
                .where(
                    sa.or_(
                        Study.has_coordinates != study_points_exist,
                        Study.has_images != study_images_exist,
                        Study.has_z_maps != study_z_maps_exist,
                        Study.has_t_maps != study_t_maps_exist,
                        Study.has_beta_and_variance_maps
                        != study_beta_and_variance_maps,
                    )
                )
                .values(
                    has_coordinates=study_points_exist,
                    has_images=study_images_exist,
                    has_z_maps=study_z_maps_exist,
                    has_t_maps=study_t_maps_exist,
                    has_beta_and_variance_maps=study_beta_and_variance_maps,
                )
                .returning(Study.id)
            ).all()
        )

    # Base-study flags from studies + analyses + child rows
    base_points_exist = sa.exists(
        sa.select(sa.literal(1))
        .select_from(Study)
        .join(Analysis, Analysis.study_id == Study.id)
        .join(Point, Point.analysis_id == Analysis.id)
        .where(Study.base_study_id == BaseStudy.id)
    )
    base_images_exist = sa.exists(
        sa.select(sa.literal(1))
        .select_from(Study)
        .join(Analysis, Analysis.study_id == Study.id)
        .join(Image, Image.analysis_id == Analysis.id)
        .where(Study.base_study_id == BaseStudy.id)
    )
    base_z_maps_exist = sa.exists(
        sa.select(sa.literal(1))
        .select_from(Study)
        .join(Analysis, Analysis.study_id == Study.id)
        .join(Image, Image.analysis_id == Analysis.id)
        .where(
            Study.base_study_id == BaseStudy.id,
            _matches_values(Image.value_type, Z_MAP_NORMALIZED_VALUES),
        )
    )
    base_t_maps_exist = sa.exists(
        sa.select(sa.literal(1))
        .select_from(Study)
        .join(Analysis, Analysis.study_id == Study.id)
        .join(Image, Image.analysis_id == Analysis.id)
        .where(
            Study.base_study_id == BaseStudy.id,
            _matches_values(Image.value_type, T_MAP_NORMALIZED_VALUES),
        )
    )
    base_beta_maps_exist = sa.exists(
        sa.select(sa.literal(1))
        .select_from(Study)
        .join(Analysis, Analysis.study_id == Study.id)
        .join(Image, Image.analysis_id == Analysis.id)
        .where(
            Study.base_study_id == BaseStudy.id,
            _matches_values(Image.value_type, BETA_MAP_NORMALIZED_VALUES),
        )
    )
    base_variance_maps_exist = sa.exists(
        sa.select(sa.literal(1))
        .select_from(Study)
        .join(Analysis, Analysis.study_id == Study.id)
        .join(Image, Image.analysis_id == Analysis.id)
        .where(
            Study.base_study_id == BaseStudy.id,
            _matches_values(Image.value_type, VARIANCE_MAP_NORMALIZED_VALUES),
        )
    )
    base_beta_and_variance_maps = sa.and_(
        base_beta_maps_exist, base_variance_maps_exist
    )
    changed_base_study_ids = set(
        db.session.scalars(
            sa.update(BaseStudy)
            .where(BaseStudy.id.in_(base_study_ids))
            .values(
                has_coordinates=base_points_exist,
                has_images=base_images_exist,
                has_z_maps=base_z_maps_exist,
                has_t_maps=base_t_maps_exist,
                has_beta_and_variance_maps=base_beta_and_variance_maps,
            )
            .where(
                sa.or_(
                    BaseStudy.has_coordinates != base_points_exist,
                    BaseStudy.has_images != base_images_exist,
                    BaseStudy.has_z_maps != base_z_maps_exist,
                    BaseStudy.has_t_maps != base_t_maps_exist,
                    BaseStudy.has_beta_and_variance_maps != base_beta_and_variance_maps,
                )
            )
            .returning(BaseStudy.id)
        ).all()
    )

    return {
        "base-studies": changed_base_study_ids,
        "studies": changed_study_ids,
        "analyses": changed_analysis_ids,
    }


def process_base_study_flag_outbox_batch(batch_size=200):
    batch_size = max(1, int(batch_size))

    claimed_ids = []
    cache_ids = {"base-studies": set(), "studies": set(), "analyses": set()}
    try:
        claim_query = (
            sa.select(BaseStudyFlagOutbox.base_study_id)
            .order_by(
                BaseStudyFlagOutbox.updated_at.asc(),
                BaseStudyFlagOutbox.base_study_id.asc(),
            )
            .limit(batch_size)
            .with_for_update(skip_locked=True)
        )
        claimed_ids = list(db.session.scalars(claim_query).all())
        if not claimed_ids:
            db.session.rollback()
            return 0

        cache_ids = recompute_media_flags(claimed_ids)

        db.session.execute(
            sa.delete(BaseStudyFlagOutbox).where(
                BaseStudyFlagOutbox.base_study_id.in_(claimed_ids)
            )
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    _clear_cache_for_ids(cache_ids)
    return len(claimed_ids)
