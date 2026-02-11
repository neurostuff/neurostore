import re

import sqlalchemy as sa
from sqlalchemy import exists
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.dialects.postgresql import JSONB, ENUM as PGEnum
from sqlalchemy import ForeignKeyConstraint, func, text
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import relationship, backref, validates, aliased
import shortuuid


from .migration_types import TSVector, VectorType
from ..database import db
from ..map_types import MAP_TYPE_CODES, canonicalize_map_type
from ..utils import parse_json_filter, build_jsonpath

# status of pipeline run
STATUS_ENUM = PGEnum(
    "SUCCESS",
    "FAILURE",
    "ERROR",
    "UNKNOWN",
    name="status_enum",
    create_type=True,
)

SEMVER_REGEX = r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"  # noqa E501
IMAGE_VALUE_TYPE_CHECK_SQL = "value_type IS NULL OR value_type IN ({})".format(
    ", ".join(f"'{code}'" for code in MAP_TYPE_CODES)
)


def _check_type(x):
    """check annotation key type"""
    if isinstance(x, (int, float)):
        return "number"
    elif isinstance(x, str):
        return "string"
    elif isinstance(x, bool):
        return "boolean"
    elif x is None:
        return None
    else:
        return None


def generate_id():
    return shortuuid.ShortUUID().random(length=12)


class BaseMixin(object):
    id = db.Column(db.Text, primary_key=True, index=True, default=generate_id)
    created_at = db.Column(
        db.DateTime(timezone=True), index=True, server_default=func.now()
    )
    updated_at = db.Column(db.DateTime(timezone=True), index=True, onupdate=func.now())

    # this _should_ work, but user sometimes is not properly committed,
    # look into as time permits
    # @declared_attr
    # def user_id(cls):
    #     return db.Column(db.Text, db.ForeignKey("users.id"))

    # @declared_attr.cascading
    # def user(cls):
    #     relationship("User", backref=cls.__tablename__, uselist=False)

    @property
    def IRI(self):
        return f"http://neurostore.org/api/{self.__tablename__}/{self.id}"


class Studyset(BaseMixin, db.Model):
    __tablename__ = "studysets"

    name = db.Column(db.String)
    description = db.Column(db.String)
    publication = db.Column(db.String)
    authors = db.Column(db.String)
    metadata_ = db.Column(JSONB)
    source = db.Column(db.String)
    source_id = db.Column(db.String)
    source_updated_at = db.Column(db.DateTime(timezone=True))
    doi = db.Column(db.String)
    pmid = db.Column(db.String)
    public = db.Column(db.Boolean, default=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("studysets", passive_deletes=True))
    studyset_studies = relationship(
        "StudysetStudy",
        back_populates="studyset",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )
    studies = relationship(
        "Study",
        secondary="studyset_studies",
        back_populates="studysets",
        lazy="selectin",
        viewonly=True,
    )
    annotations = relationship(
        "Annotation",
        backref="studyset",
        passive_deletes=True,
        cascade="all, delete-orphan",
    )
    _ts_vector = db.Column(
        "__ts_vector__",
        TSVector(),
        db.Computed(
            "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))",
            persisted=True,
        ),
    )


class Annotation(BaseMixin, db.Model):
    __tablename__ = "annotations"
    name = db.Column(db.Text)
    description = db.Column(db.Text)
    source = db.Column(db.String)
    source_id = db.Column(db.String)
    source_updated_at = db.Column(db.DateTime(timezone=True))
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("annotations", passive_deletes=True))
    studyset_id = db.Column(
        db.Text, db.ForeignKey("studysets.id", ondelete="CASCADE"), index=True
    )
    metadata_ = db.Column(JSONB)
    public = db.Column(db.Boolean, default=True)
    note_keys = db.Column(MutableDict.as_mutable(JSONB))
    annotation_analyses = relationship(
        "AnnotationAnalysis",
        backref=backref("annotation", passive_deletes=True),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )


class AnnotationAnalysis(db.Model):
    __tablename__ = "annotation_analyses"
    __table_args__ = (
        ForeignKeyConstraint(
            ["study_id", "studyset_id"],
            ["studyset_studies.study_id", "studyset_studies.studyset_id"],
            ondelete="CASCADE",
        ),
    )
    __mapper_args__ = {"confirm_deleted_rows": False}

    created_at = db.Column(
        db.DateTime(timezone=True), index=True, server_default=func.now()
    )
    updated_at = db.Column(db.DateTime(timezone=True), index=True, onupdate=func.now())

    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    study_id = db.Column(db.Text, nullable=False)
    studyset_id = db.Column(db.Text, nullable=False)
    annotation_id = db.Column(
        db.Text,
        db.ForeignKey("annotations.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    analysis_id = db.Column(
        db.Text,
        db.ForeignKey("analyses.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    note = db.Column(MutableDict.as_mutable(JSONB))

    user = relationship(
        "User", backref=backref("annotation_analyses", passive_deletes=True)
    )

    @hybrid_property
    def id(self):
        return f"{self.annotation_id}_{self.analysis_id}"

    @id.expression
    def id(cls):
        return cls.annotation_id + "_" + cls.analysis_id


class BaseStudy(BaseMixin, db.Model):
    __tablename__ = "base_studies"
    name = db.Column(db.String)
    description = db.Column(db.String)
    publication = db.Column(db.String, index=True)
    doi = db.Column(db.String, nullable=True, index=True)
    pmid = db.Column(db.String, nullable=True, index=True)
    pmcid = db.Column(db.String, nullable=True, index=True)
    authors = db.Column(db.String, index=True)
    year = db.Column(db.Integer, index=True)
    public = db.Column(db.Boolean, default=True)
    level = db.Column(db.String)
    metadata_ = db.Column(JSONB)
    is_oa = db.Column(db.Boolean, default=None, nullable=True)
    has_coordinates = db.Column(db.Boolean, default=False, nullable=False)
    has_images = db.Column(db.Boolean, default=False, nullable=False)
    has_z_maps = db.Column(db.Boolean, default=False, nullable=False)
    has_t_maps = db.Column(db.Boolean, default=False, nullable=False)
    has_beta_and_variance_maps = db.Column(db.Boolean, default=False, nullable=False)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    ace_fulltext = db.Column(db.Text)
    pubget_fulltext = db.Column(db.Text)
    is_active = db.Column(
        db.Boolean, default=True, server_default=sa.true(), nullable=False, index=True
    )
    superseded_by = db.Column(db.Text, db.ForeignKey("base_studies.id"), nullable=True)
    _ts_vector = db.Column(
        "__ts_vector__",
        TSVector(),
        db.Computed(
            """
            setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
            setweight(to_tsvector('english',
                coalesce(
                    CASE
                        WHEN pubget_fulltext IS NOT NULL THEN pubget_fulltext
                        ELSE ace_fulltext
                    END,
                    ''
                )
            ), 'C')
            """,
            persisted=True,
        ),
    )

    user = relationship("User", backref=backref("base_studies", passive_deletes=True))
    # retrieve versions of same study
    versions = relationship(
        "Study", backref=backref("base_study"), passive_deletes=True
    )
    pipeline_study_results = relationship(
        "PipelineStudyResult", backref=backref("base_study"), passive_deletes=True
    )
    # self-referential relationship for superseded_by
    superseded_by_study = relationship(
        "BaseStudy",
        remote_side="BaseStudy.id",
        foreign_keys=[superseded_by],
        backref=backref("supersedes", passive_deletes=True),
    )

    __table_args__ = (
        db.CheckConstraint(level.in_(["group", "meta"])),
        db.UniqueConstraint("doi", "pmid", name="doi_pmid"),
        db.CheckConstraint("pmid ~ '^(?=.*\\S).+$' OR name IS NULL"),
        db.CheckConstraint("doi ~ '^(?=.*\\S).+$' OR name IS NULL"),
        db.CheckConstraint("id != superseded_by", name="no_self_reference"),
        sa.Index("ix_base_study___ts_vector__", _ts_vector, postgresql_using="gin"),
    )

    @hybrid_property
    def points_exist(self):
        # Check if the points exist for the BaseStudy
        query = db.session.query(
            exists().where(
                BaseStudy.id == self.id,
                Study.base_study_id == BaseStudy.id,
                Analysis.study_id == Study.id,
                Point.analysis_id == Analysis.id,
            )
        )
        return query.scalar()

    @points_exist.expression
    def points_exist(cls):
        # SQL expression for the points_exist property
        return exists().where(
            cls.id == BaseStudy.id,
            Study.base_study_id == BaseStudy.id,
            Analysis.study_id == Study.id,
            Point.analysis_id == Analysis.id,
        )

    @points_exist.setter
    def points_exist(self, value):
        # Update has_coordinates column based on the result of the points_exist property
        self.has_coordinates = value

    @hybrid_property
    def images_exist(self):
        # Check if the points exist for the BaseStudy
        query = db.session.query(
            exists().where(
                BaseStudy.id == self.id,
                Study.base_study_id == BaseStudy.id,
                Analysis.study_id == Study.id,
                Image.analysis_id == Analysis.id,
            )
        )
        return query.scalar()

    @images_exist.expression
    def images_exist(cls):
        # SQL expression for the images_exist property
        return exists().where(
            cls.id == BaseStudy.id,
            Study.base_study_id == BaseStudy.id,
            Analysis.study_id == Study.id,
            Image.analysis_id == Analysis.id,
        )

    @images_exist.setter
    def images_exist(self, value):
        # Update has_images column based on the result of the points_exist property
        self.has_images = value

    def update_has_images_and_points(self):
        # Keep analysis/study/base flags consistent for this base study.
        from ..services.has_media_flags import recompute_media_flags

        recompute_media_flags([self.id])

    def display_features(self, pipelines=None, pipeline_configs=None):
        """
        Display pipeline features for the base study.
        Only loads and returns features if pipelines are explicitly specified.

        Args:
            pipelines (list, optional): List of pipeline names to display features from,
                                      optionally with versions (e.g. "Pipeline:1.0.0").
                                      If None or empty, returns empty dict.
            pipeline_configs (list, optional): List of pipeline config filters in format
                                           "PipelineName:version:field_path(operator)value"
                                           Only show results matching these configs.
        """
        if not pipelines:
            return {}

        # Parse pipeline names and versions
        pipeline_specs = {}
        for pipeline in pipelines:
            parts = pipeline.split(":", 1)
            if len(parts) == 2:
                name, version = parts
                pipeline_specs[name] = version
            else:
                pipeline_specs[parts[0]] = None

        # Parse pipeline configs and match with pipeline specs
        config_filters = []
        if pipeline_configs:
            for pipeline_config in pipeline_configs:
                try:
                    pipeline_name, version, field_path, operator, value = (
                        parse_json_filter(pipeline_config)
                    )

                    # Only process if pipeline is in pipelines list
                    if pipeline_name in pipeline_specs:
                        pipeline_version = pipeline_specs[pipeline_name]

                        # Skip if pipeline specifies version but config doesn't match
                        if pipeline_version and version and pipeline_version != version:
                            continue

                        # Use pipeline version if config doesn't specify one
                        version_to_use = version or pipeline_version

                        config_filters.append(
                            {
                                "pipeline_name": pipeline_name,
                                "version": version_to_use,
                                "field_path": field_path,
                                "operator": operator,
                                "value": value,
                            }
                        )
                except ValueError:
                    continue

        # Create aliases for the tables
        PipelineAlias = aliased(Pipeline)
        PipelineConfigAlias = aliased(PipelineConfig)
        PipelineStudyResultAlias = aliased(PipelineStudyResult)

        # Base query
        query = (
            db.session.query(
                PipelineStudyResultAlias.result_data,
                PipelineAlias.name.label("pipeline_name"),
            )
            .join(
                PipelineConfigAlias,
                PipelineStudyResultAlias.config_id == PipelineConfigAlias.id,
            )
            .join(PipelineAlias, PipelineConfigAlias.pipeline_id == PipelineAlias.id)
            .filter(PipelineStudyResultAlias.base_study_id == self.id)
            .filter(PipelineAlias.name.in_(pipeline_specs.keys()))
        )

        # Apply config filters if any exist
        if config_filters:
            for config in config_filters:
                conditions = [PipelineAlias.name == config["pipeline_name"]]

                if config["version"]:
                    conditions.append(PipelineConfigAlias.version == config["version"])

                jsonpath = build_jsonpath(
                    config["field_path"], config["operator"], config["value"]
                )
                conditions.append(
                    text("jsonb_path_exists(config_args, :jsonpath)").params(
                        jsonpath=jsonpath
                    )
                )

                query = query.filter(*conditions)
        else:
            # If no config filters, just use latest version for each pipeline
            latest_results = (
                db.session.query(
                    PipelineStudyResultAlias.base_study_id,
                    PipelineAlias.name.label("pipeline_name"),
                    func.max(PipelineStudyResultAlias.date_executed).label("max_date"),
                )
                .join(
                    PipelineConfigAlias,
                    PipelineStudyResultAlias.config_id == PipelineConfigAlias.id,
                )
                .join(
                    PipelineAlias, PipelineConfigAlias.pipeline_id == PipelineAlias.id
                )
                .filter(PipelineStudyResultAlias.base_study_id == self.id)
                .filter(PipelineAlias.name.in_(pipeline_specs.keys()))
                .group_by(PipelineStudyResultAlias.base_study_id, PipelineAlias.name)
                .subquery()
            )

            # Add version filters from pipeline specs
            for name, version in pipeline_specs.items():
                if version:
                    query = query.filter(
                        (PipelineAlias.name != name)
                        | (PipelineConfigAlias.version == version)
                    )

            query = query.join(
                latest_results,
                (
                    PipelineStudyResultAlias.base_study_id
                    == latest_results.c.base_study_id
                )
                & (PipelineAlias.name == latest_results.c.pipeline_name)
                & (PipelineStudyResultAlias.date_executed == latest_results.c.max_date),
            )

        # Execute query and build response
        results = query.all()
        features = {}
        for result in results:
            features[result.pipeline_name] = result.result_data

        return features


class BaseStudyFlagOutbox(db.Model):
    __tablename__ = "base_study_flag_outbox"

    base_study_id = db.Column(
        db.Text,
        db.ForeignKey("base_studies.id", ondelete="CASCADE"),
        primary_key=True,
    )
    reason = db.Column(db.String, nullable=True)
    enqueued_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        index=True,
    )

    base_study = relationship(
        "BaseStudy", backref=backref("flag_outbox_entry", passive_deletes=True)
    )


class Study(BaseMixin, db.Model):
    __tablename__ = "studies"

    name = db.Column(db.String)
    description = db.Column(db.String)
    publication = db.Column(db.String, index=True)
    doi = db.Column(db.String, index=True)
    pmid = db.Column(db.String, index=True)
    pmcid = db.Column(db.String, index=True)
    authors = db.Column(db.String, index=True)
    year = db.Column(db.Integer, index=True)
    public = db.Column(db.Boolean, default=True)
    level = db.Column(db.String)
    metadata_ = db.Column(JSONB)
    source = db.Column(db.String, index=True)
    base_study_id = db.Column(db.Text, db.ForeignKey("base_studies.id"), index=True)
    source_id = db.Column(db.String, index=True)
    source_updated_at = db.Column(db.DateTime(timezone=True))
    base_study_id = db.Column(db.Text, db.ForeignKey("base_studies.id"), index=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    has_coordinates = db.Column(db.Boolean, default=False, nullable=False)
    has_images = db.Column(db.Boolean, default=False, nullable=False)
    has_z_maps = db.Column(db.Boolean, default=False, nullable=False)
    has_t_maps = db.Column(db.Boolean, default=False, nullable=False)
    has_beta_and_variance_maps = db.Column(db.Boolean, default=False, nullable=False)
    _ts_vector = db.Column(
        "__ts_vector__",
        TSVector(),
        db.Computed(
            "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))",
            persisted=True,
        ),
    )
    user = relationship("User", backref=backref("studies", passive_deletes=True))
    analyses = relationship(
        "Analysis",
        backref=backref("study"),
        passive_deletes=True,
        cascade="all, delete-orphan",
    )
    tables = relationship(
        "Table",
        back_populates="study",
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
        lazy="selectin",
    )
    studyset_studies = relationship(
        "StudysetStudy",
        back_populates="study",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )
    studysets = relationship(
        "Studyset",
        secondary="studyset_studies",
        back_populates="studies",
        lazy="dynamic",
        viewonly=True,
    )

    __table_args__ = (
        db.CheckConstraint(level.in_(["group", "meta"])),
        db.CheckConstraint("pmid ~ '^(?=.*\\S).+$' OR name IS NULL"),
        db.CheckConstraint("doi ~ '^(?=.*\\S).+$' OR name IS NULL"),
        sa.Index(
            "ix_studies_source_source_id_neurovault",
            "source",
            "source_id",
            postgresql_where=sa.text("source = 'neurovault'"),
        ),
        sa.Index("ix_study___ts_vector__", _ts_vector, postgresql_using="gin"),
    )


class StudysetStudy(db.Model):
    __tablename__ = "studyset_studies"
    # Define a unique constraint on study_id and studyset_id

    study_id = db.Column(
        db.ForeignKey("studies.id", ondelete="CASCADE"), index=True, primary_key=True
    )
    studyset_id = db.Column(
        db.ForeignKey("studysets.id", ondelete="CASCADE"), index=True, primary_key=True
    )
    curation_stub_uuid = db.Column(db.Text, nullable=True, index=True)
    study = relationship(
        "Study",
        back_populates="studyset_studies",
        passive_deletes=True,
    )
    studyset = relationship(
        "Studyset",
        back_populates="studyset_studies",
        passive_deletes=True,
    )
    __table_args__ = (
        db.UniqueConstraint(
            "studyset_id",
            "curation_stub_uuid",
            name="uq_studyset_stub_uuid",
        ),
    )
    annotation_analyses = relationship(
        "AnnotationAnalysis",
        backref=backref("studyset_study", passive_deletes=True),
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Table(BaseMixin, db.Model):
    __tablename__ = "tables"

    study_id = db.Column(
        db.Text, db.ForeignKey("studies.id", ondelete="CASCADE"), index=True
    )
    t_id = db.Column(db.Text)
    name = db.Column(db.Text)
    table_label = db.Column(db.Text)
    footer = db.Column(db.Text)
    caption = db.Column(db.Text)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)

    study = relationship(
        "Study",
        back_populates="tables",
        passive_deletes=True,
    )
    user = relationship(
        "User", backref=backref("tables", cascade_backrefs=False, passive_deletes=True)
    )

    __table_args__ = (
        db.UniqueConstraint("study_id", "t_id", name="uq_tables_study_t_id"),
    )


class Analysis(BaseMixin, db.Model):
    __tablename__ = "analyses"

    study_id = db.Column(
        db.Text, db.ForeignKey("studies.id", ondelete="CASCADE"), index=True
    )
    table_id = db.Column(
        db.Text, db.ForeignKey("tables.id", ondelete="SET NULL"), index=True
    )
    name = db.Column(db.String)
    description = db.Column(db.String)
    metadata_ = db.Column(JSONB)
    order = db.Column(db.Integer)
    has_coordinates = db.Column(db.Boolean, default=False, nullable=False)
    has_images = db.Column(db.Boolean, default=False, nullable=False)
    has_z_maps = db.Column(db.Boolean, default=False, nullable=False)
    has_t_maps = db.Column(db.Boolean, default=False, nullable=False)
    has_beta_and_variance_maps = db.Column(db.Boolean, default=False, nullable=False)
    points = relationship(
        "Point",
        backref=backref("analysis", passive_deletes=True),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )
    images = relationship(
        "Image",
        backref=backref("analysis"),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )
    weights = association_proxy("analysis_conditions", "weight")
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("analyses", passive_deletes=True))
    analysis_conditions = relationship(
        "AnalysisConditions",
        backref=backref("analysis"),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )
    annotation_analyses = relationship(
        "AnnotationAnalysis",
        backref=backref("analysis"),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )
    table = relationship(
        "Table",
        backref=backref("analyses", cascade_backrefs=False, passive_deletes=True),
        foreign_keys=[table_id],
        passive_deletes=True,
    )


class Condition(BaseMixin, db.Model):
    __tablename__ = "conditions"

    name = db.Column(db.String)
    description = db.Column(db.String)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship(
        "User",
        backref=backref("conditions", cascade_backrefs=False, passive_deletes=True),
        cascade_backrefs=False,
    )
    analysis_conditions = relationship(
        "AnalysisConditions",
        backref=backref("condition", cascade_backrefs=False),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
    )


class AnalysisConditions(db.Model):
    __tablename__ = "analysis_conditions"
    weight = db.Column(db.Float)
    analysis_id = db.Column(
        db.Text,
        db.ForeignKey("analyses.id", ondelete="CASCADE"),
        index=True,
        primary_key=True,
    )
    condition_id = db.Column(
        db.Text,
        db.ForeignKey("conditions.id", ondelete="CASCADE"),
        index=True,
        primary_key=True,
    )


PointEntityMap = db.Table(
    "point_entities",
    db.Model.metadata,
    db.Column(
        "point", db.Text, db.ForeignKey("points.id", ondelete="CASCADE"), index=True
    ),
    db.Column(
        "entity", db.Text, db.ForeignKey("entities.id", ondelete="CASCADE"), index=True
    ),
)


ImageEntityMap = db.Table(
    "image_entities",
    db.Model.metadata,
    db.Column(
        "image", db.Text, db.ForeignKey("images.id", ondelete="CASCADE"), index=True
    ),
    db.Column(
        "entity", db.Text, db.ForeignKey("entities.id", ondelete="CASCADE"), index=True
    ),
)


# purpose of Entity: you have an image/coordinate, but you do not
# know what level of analysis it represents
# NOT USED CURRENTLY
class Entity(BaseMixin, db.Model):
    __tablename__ = "entities"

    # link to analysis
    analysis_id = db.Column(
        db.Text, db.ForeignKey("analyses.id", ondelete="CASCADE"), index=True
    )
    label = db.Column(db.String)  # bids-entity
    # constrained enumeration (bids-entity, run, session, subject, group, meta)
    level = db.Column(db.String)
    data = db.Column(JSONB)  # metadata (participants.tsv, or something else)
    analysis = relationship(
        "Analysis",
        backref=backref("entities", cascade_backrefs=False, passive_deletes=True),
        cascade_backrefs=False,
    )
    __table_args__ = (db.CheckConstraint(level.in_(["group", "meta"])),)


class Point(BaseMixin, db.Model):
    __tablename__ = "points"
    __table_args__ = (sa.Index("ix_points_xyz", "x", "y", "z"),)

    @hybrid_property
    def coordinates(self):
        return [self.x, self.y, self.z]

    @coordinates.expression
    def coordinates(cls):
        return func.array(cls.x, cls.y, cls.z)

    x = db.Column(db.Float)
    y = db.Column(db.Float)
    z = db.Column(db.Float)
    space = db.Column(db.String)
    kind = db.Column(db.String)
    image = db.Column(db.String)  # what does image represent
    label_id = db.Column(db.Float, default=None)
    analysis_id = db.Column(
        db.Text, db.ForeignKey("analyses.id", ondelete="CASCADE"), index=True
    )
    cluster_size = db.Column(db.Float)
    cluster_measurement_unit = db.Column(db.String)
    subpeak = db.Column(db.Boolean)
    deactivation = db.Column(db.Boolean, default=False, index=True)
    order = db.Column(db.Integer)

    entities = relationship(
        "Entity",
        secondary=PointEntityMap,
        backref=backref("points"),
        passive_deletes=True,
    )
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("points", passive_deletes=True))


class Image(BaseMixin, db.Model):
    __tablename__ = "images"
    __table_args__ = (
        db.CheckConstraint(
            IMAGE_VALUE_TYPE_CHECK_SQL,
            name="ck_images_value_type",
        ),
    )

    url = db.Column(db.String)
    filename = db.Column(db.String)
    space = db.Column(db.String)
    value_type = db.Column(db.String)
    analysis_id = db.Column(
        db.Text, db.ForeignKey("analyses.id", ondelete="CASCADE"), index=True
    )
    data = db.Column(JSONB)
    add_date = db.Column(db.DateTime(timezone=True))

    analysis_name = association_proxy("analysis", "name")
    entities = relationship(
        "Entity",
        secondary=ImageEntityMap,
        backref=backref("images"),
        passive_deletes=True,
    )
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("images", passive_deletes=True))

    @validates("value_type")
    def validate_value_type(self, key, value):
        return canonicalize_map_type(value)


class PointValue(BaseMixin, db.Model):
    __tablename__ = "point_values"

    point_id = db.Column(
        db.Text, db.ForeignKey("points.id", ondelete="CASCADE"), index=True
    )
    kind = db.Column(db.String)
    value = db.Column(db.Float)
    point = relationship(
        "Point",
        backref=backref("values", passive_deletes=True, cascade="all, delete-orphan"),
    )
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("point_values", passive_deletes=True))


class Pipeline(BaseMixin, db.Model):
    __tablename__ = "pipelines"

    name = db.Column(db.String, index=True, unique=True)
    description = db.Column(db.String)
    study_dependent = db.Column(db.Boolean, default=False)
    ace_compatible = db.Column(db.Boolean, default=False)
    pubget_compatible = db.Column(db.Boolean, default=False)
    derived_from = db.Column(JSONB)


class PipelineConfig(BaseMixin, db.Model):
    __tablename__ = "pipeline_configs"

    pipeline_id = db.Column(
        db.Text, db.ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    version = db.Column(db.String, index=True)
    config_args = db.Column(JSONB)
    schema = db.Column(JSONB)
    executed_at = db.Column(
        db.DateTime(timezone=True)
    )  # when the pipeline was executed on the filesystem (not when it was ingested)
    config_hash = db.Column(db.String, index=True)
    has_embeddings = db.Column(db.Boolean, default=False)
    embedding_dimensions = db.Column(db.Integer, default=0, nullable=True)
    pipeline = relationship(
        "Pipeline", backref=backref("configs", passive_deletes=True)
    )

    @validates("version")
    def validate_version(self, key, value):
        if not re.match(SEMVER_REGEX, value):
            raise ValueError(f"Invalid version format: {value}")
        return value


class PipelineStudyResult(BaseMixin, db.Model):
    __tablename__ = "pipeline_study_results"
    __table_args__ = (
        sa.Index(
            "ix_pipeline_study_results__modality",
            sa.text("(result_data -> 'Modality')"),
            postgresql_using="gin",
        ),
    )

    config_id = db.Column(
        db.Text, db.ForeignKey("pipeline_configs.id", ondelete="CASCADE"), index=True
    )
    base_study_id = db.Column(db.Text, db.ForeignKey("base_studies.id"), index=True)
    date_executed = db.Column(db.DateTime(timezone=True))
    result_data = db.Column(JSONB)
    file_inputs = db.Column(JSONB)
    status = db.Column(STATUS_ENUM)
    config = relationship(
        "PipelineConfig", backref=backref("results", passive_deletes=True)
    )


class PipelineEmbedding(db.Model):
    __tablename__ = "pipeline_embeddings"
    # Partition by LIST on config_id (parent table)
    __table_args__ = ({"postgresql_partition_by": "LIST (config_id)"},)

    # Primary key MUST include the partition key for partitioned tables
    id = db.Column(db.Text, primary_key=True)
    config_id = db.Column(
        db.Text,
        db.ForeignKey("pipeline_configs.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )

    created_at = db.Column(
        db.DateTime(timezone=True), index=True, server_default=func.now()
    )
    updated_at = db.Column(db.DateTime(timezone=True), index=True, onupdate=func.now())
    base_study_id = db.Column(db.Text, db.ForeignKey("base_studies.id"), index=True)
    date_executed = db.Column(db.DateTime(timezone=True))
    file_inputs = db.Column(JSONB)
    status = db.Column(STATUS_ENUM)

    # Store the vector directly on the parent; partitions will add per-dimension CHECKs
    embedding = db.Column(VectorType(), nullable=False)


# from . import event_listeners  # noqa E402

# del event_listeners
