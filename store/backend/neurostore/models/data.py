import hashlib
import json
import uuid

import shortuuid
import sqlalchemy as sa
from sqlalchemy import ForeignKeyConstraint, exists, func, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import aliased, backref, relationship, validates
from study_schema.keys import normalize_name

from neurostore.coordinate_spaces import normalize_space
from neurostore.database import db
from neurostore import encryption
from neurostore.encryption import EncryptedText
from neurostore.map_types import MAP_TYPE_CODES, canonicalize_map_type
from neurostore.models.migration_types import TSVector, VectorType
from neurostore.utils import build_jsonpath, parse_json_filter

# status of pipeline run
STATUS_ENUM = PGEnum(
    "SUCCESS",
    "FAILURE",
    "ERROR",
    "UNKNOWN",
    name="status_enum",
    create_type=True,
)

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


def generate_stable_id():
    return str(uuid.uuid4())


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
        backref=backref("studyset", cascade_backrefs=False),
        passive_deletes=True,
        cascade="all, delete-orphan",
        cascade_backrefs=False,
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
        sa.Index(
            "ix_annotation_analyses_study_id_studyset_id", "study_id", "studyset_id"
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


def _identifiers_of(kind, scheme):
    """The base study's ``kind`` ids of ``scheme``, as the API lists them. The views load
    ``identifier_rows`` with the base studies they list."""

    def read(self):
        rows = [r for r in self.identifier_rows if (r.kind, r.scheme) == (kind, scheme)]
        if (kind, scheme) == ("preprint", "doi"):
            return [{"doi": r.value, "server": r.server} for r in rows]
        return [r.value for r in rows]

    return property(read)


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
    #: Legacy; fulltexts holds the reviewed text (docs/adr/0005-fulltexts-table.md).
    ace_fulltext = db.Column(db.Text)
    pubget_fulltext = db.Column(db.Text)
    fulltext_id = db.Column(
        db.Text,
        db.ForeignKey(
            "fulltexts.id",
            name="fk_base_studies_fulltext_id",
            ondelete="SET NULL",
            use_alter=True,
        ),
        nullable=True,
        index=True,
    )
    fulltext = relationship("Fulltext", foreign_keys=[fulltext_id], lazy="raise", viewonly=True)
    is_active = db.Column(
        db.Boolean, default=True, server_default=sa.true(), nullable=False, index=True
    )
    superseded_by = db.Column(db.Text, db.ForeignKey("base_studies.id"), nullable=True)
    #: study_schema's ``ArticleIdentifiers.publication_status``: preprint until a
    #: version of record is known. Null where no producer stated it.
    publication_status = db.Column(db.Text, nullable=True)
    # From the parsed paper's bibliography.corrections; null until a parsed paper with
    # corrections looked up is ingested. A retracted paper is kept, and releases leave
    # it out unless asked. Not indexed: the release filters on IS NOT TRUE, nearly every
    # row, so a scan is what the planner uses.
    is_retracted = db.Column(db.Boolean, nullable=True)
    retraction_notice = db.Column(JSONB, nullable=True)
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
    # Never loaded by accident: reading them is a query that names them.
    corresponding_author_emails = relationship(
        "CorrespondingAuthorEmail", lazy="raise", passive_deletes=True
    )
    identifier_rows = relationship(
        "BaseStudyIdentifier",
        passive_deletes=True,
        order_by="BaseStudyIdentifier.value",
    )

    __table_args__ = (
        db.CheckConstraint(level.in_(["group", "meta"])),
        db.CheckConstraint(
            "publication_status IN ('preprint', 'published')",
            name="ck_base_studies_publication_status",
        ),
        db.CheckConstraint("pmid ~ '^(?=.*\\S).+$' OR name IS NULL"),
        db.CheckConstraint("doi ~ '^(?=.*\\S).+$' OR name IS NULL"),
        db.CheckConstraint("id != superseded_by", name="no_self_reference"),
        sa.Index("ix_base_study___ts_vector__", _ts_vector, postgresql_using="gin"),
    )

    preprint_dois = _identifiers_of("preprint", "doi")
    preprint_pmids = _identifiers_of("preprint", "pmid")
    preprint_pmcids = _identifiers_of("preprint", "pmcid")
    alternative_dois = _identifiers_of("alternative", "doi")
    alternative_pmids = _identifiers_of("alternative", "pmid")
    alternative_pmcids = _identifiers_of("alternative", "pmcid")

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
        from neurostore.services.has_media_flags import recompute_media_flags

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


class BaseStudyIdentifier(db.Model):
    """One article identifier an active base study holds, in one of study_schema's three
    buckets: its version of record's ids, a preprint's, or any other version's.

    ``(scheme, value)`` is the key, so no two base studies hold one id. The version of
    record's rows follow base_studies.doi, pmid and pmcid through the trigger created by
    the migration; a base study that stops being active gives its rows to the one that
    supersedes it, or drops them.
    """

    __tablename__ = "base_study_identifiers"
    scheme = db.Column(db.Text, primary_key=True)
    #: Normalized: DOIs case-folded, PMIDs digits, PMCIDs ``PMC`` and digits.
    value = db.Column(db.Text, primary_key=True)
    base_study_id = db.Column(
        db.Text,
        db.ForeignKey("base_studies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = db.Column(db.Text, nullable=False)
    #: The preprint server a preprint DOI was registered by.
    server = db.Column(db.Text, nullable=True)

    __table_args__ = (
        db.CheckConstraint("scheme IN ('doi', 'pmid', 'pmcid')", name="ck_identifier_scheme"),
        db.CheckConstraint(
            "kind IN ('vor', 'preprint', 'alternative')", name="ck_identifier_kind"
        ),
        db.CheckConstraint(
            "server IS NULL OR (kind = 'preprint' AND scheme = 'doi')",
            name="ck_identifier_server",
        ),
        sa.Index(
            "uq_base_study_identifiers_vor",
            "base_study_id",
            "scheme",
            unique=True,
            postgresql_where=sa.text("kind = 'vor'"),
        ),
    )


class BaseStudyMergeCandidate(BaseMixin, db.Model):
    """Two active base studies a write found to name one paper. ``manage
    plan-base-study-merges`` writes the open ones as a plan for ``manage
    merge-base-studies``, and a merge of the pair closes the row.

    ``matched`` lists the identifiers that tied them, as ``{scheme, value, kind}``;
    ``source`` is the write that found them (``post``, ``put``, ``ingest``, ``enrichment``,
    ``trigger`` or ``migration``). The pair is stored with the smaller id first, once.
    """

    __tablename__ = "base_study_merge_candidates"
    first_base_study_id = db.Column(
        db.Text, db.ForeignKey("base_studies.id", ondelete="CASCADE"), nullable=False
    )
    second_base_study_id = db.Column(
        db.Text,
        db.ForeignKey("base_studies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    matched = db.Column(JSONB, nullable=False)
    source = db.Column(db.Text, nullable=False)

    __table_args__ = (
        db.CheckConstraint(
            'first_base_study_id COLLATE "C" < second_base_study_id COLLATE "C"',
            name="ck_merge_candidate_order",
        ),
        sa.UniqueConstraint(
            "first_base_study_id",
            "second_base_study_id",
            name="uq_base_study_merge_candidates_pair",
        ),
    )


class BaseStudyFlagOutbox(db.Model):
    __tablename__ = "base_study_flag_outbox"

    # No FK to base_studies.id: an FK here would make every insert/update take
    # an incidental lock on the referenced base_studies row, which is exactly
    # what causes this table to deadlock against the metadata-enrichment
    # worker's own base_studies lock. The worker already tolerates a
    # base_study_id with no matching base_studies row (it's a no-op that just
    # gets cleaned up), so the cascade isn't load-bearing for correctness.
    base_study_id = db.Column(db.Text, primary_key=True)
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


class BaseStudyMetadataOutbox(db.Model):
    __tablename__ = "base_study_metadata_outbox"

    # See BaseStudyFlagOutbox for why there's deliberately no FK here.
    base_study_id = db.Column(db.Text, primary_key=True)
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


class CorrespondingAuthorEmail(BaseMixin, db.Model):
    """An email a paper prints for one of its corresponding authors, and whether we have
    written to them, heard back, and been sent their data.

    Never served: no schema or endpoint names this table, and the address is stored
    encrypted (`neurostore.encryption`), found by its keyed hash `email_index`.
    """

    __tablename__ = "corresponding_author_emails"
    base_study_id = db.Column(
        db.Text,
        db.ForeignKey("base_studies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email = db.Column(EncryptedText, nullable=False)
    email_index = db.Column(db.Text, nullable=False)
    contacted = db.Column(db.Boolean, nullable=False, default=False, server_default=sa.false())
    responded = db.Column(db.Boolean, nullable=False, default=False, server_default=sa.false())
    shared = db.Column(db.Boolean, nullable=False, default=False, server_default=sa.false())

    __table_args__ = (
        sa.UniqueConstraint(
            "base_study_id",
            "email_index",
            name="uq_corresponding_author_emails_base_study_id_email_index",
        ),
    )

    @validates("email")
    def _index(self, key, value):
        self.email_index = encryption.email_index(value)
        return value.strip()


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
    #: The base study this version was merged in from; the release ranks such versions
    #: after the paper's own. No foreign key: a second one to base_studies would make the
    #: Study-BaseStudy joins ambiguous.
    merged_from = db.Column(db.Text, nullable=True)
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
    images = relationship(
        "Image",
        backref=backref("study"),
        passive_deletes=True,
        cascade_backrefs=False,
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
    source_id = db.Column(db.String, index=True)
    point_count = db.Column(db.Integer, default=0, nullable=False)
    image_count = db.Column(db.Integer, default=0, nullable=False)
    has_coordinates = db.Column(db.Boolean, default=False, nullable=False)
    has_images = db.Column(db.Boolean, default=False, nullable=False)
    has_z_maps = db.Column(db.Boolean, default=False, nullable=False)
    has_t_maps = db.Column(db.Boolean, default=False, nullable=False)
    has_beta_and_variance_maps = db.Column(db.Boolean, default=False, nullable=False)
    # study_schema values: the extraction record's Analysis.outcome (AnalysisOutcome),
    # and the coordinate parse's role (CoordinateRole) and from_prior_study.
    outcome = db.Column(db.String, nullable=True, index=True)
    role = db.Column(db.String, nullable=True, index=True)
    # The parse_id of the revision whose relabel verdict set ``role``; null while the role
    # is the classifier's (named in ``metadata.role_source``, study_schema's field). A
    # relabelled role is kept over later parses' roles.
    relabelled_by = db.Column(db.String, nullable=True)
    from_prior_study = db.Column(db.Boolean, nullable=True)
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
        cascade_backrefs=False,
    )
    weights = association_proxy("analysis_conditions", "weight")
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship(
        "User",
        backref=backref("analyses", cascade_backrefs=False, passive_deletes=True),
        cascade_backrefs=False,
    )
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
    # deactivation and is_seed hold existing data and remain settable through the
    # API, but the extraction pipeline does not write them. It splits a set by
    # the sign of its statistic and stores the points with negative values as their
    # own analysis, the inverse half, so direction is a property of the analysis. A seed is
    # the role of a coordinate set (study_schema ParsedAnalysis.role), not of its points.
    # NiMARE reads neither column.
    deactivation = db.Column(db.Boolean, default=False, index=True)
    is_seed = db.Column(db.Boolean, default=False, nullable=False)
    order = db.Column(db.Integer)

    entities = relationship(
        "Entity",
        secondary=PointEntityMap,
        backref=backref("points"),
        passive_deletes=True,
    )
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)
    user = relationship("User", backref=backref("points", passive_deletes=True))

    @validates("space")
    def validate_space(self, key, value):
        return normalize_space(value)


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
        db.Text, db.ForeignKey("analyses.id", ondelete="SET NULL"), index=True
    )
    study_id = db.Column(
        db.Text, db.ForeignKey("studies.id", ondelete="CASCADE"), index=True
    )
    data = db.Column(JSONB)
    add_date = db.Column(db.DateTime(timezone=True))
    order = db.Column(db.Integer)

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

    @validates("analysis")
    def validate_analysis(self, key, value):
        if value is not None:
            if getattr(value, "study", None) is not None:
                self.study = value.study
            elif getattr(value, "study_id", None) is not None:
                self.study_id = value.study_id
        return value


class ImageValueSummary(BaseMixin, db.Model):
    """Distribution statistics for the voxel values of an :class:`Image`.

    Beside ``images`` rather than on it: the numbers are derived, absent for most
    rows, recomputed when the summarizer changes, and never wanted by the studyset
    payloads that read ``images`` constantly.

    Counts are over all voxels in the file. The distribution columns (``value_*``,
    ``percentiles``, the histogram) cover only the finite, non-zero voxels, counted
    by ``n_values``: a neuroimaging map stores its background as zero or nan, and
    including it puts the median on the background rather than on the data.
    """

    __tablename__ = "image_value_summaries"

    image_id = db.Column(
        db.Text,
        db.ForeignKey("images.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    image = relationship(
        "Image",
        backref=backref(
            "value_summary",
            uselist=False,
            passive_deletes=True,
            cascade="all, delete-orphan",
        ),
    )

    summarizer_version = db.Column(db.Integer, nullable=False)
    computed_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    source_url = db.Column(db.String)
    # tells an unchanged file from one replaced under a url the database still holds
    source_sha256 = db.Column(db.String(64))
    source_bytes = db.Column(db.BigInteger)
    status = db.Column(STATUS_ENUM, nullable=False)
    error = db.Column(db.String)

    # counts, not fractions: exact and 8 bytes each; the api divides for display
    n_voxels = db.Column(db.BigInteger)
    n_nan = db.Column(db.BigInteger)
    n_zero = db.Column(db.BigInteger)
    n_negative = db.Column(db.BigInteger)
    n_values = db.Column(db.BigInteger)

    value_min = db.Column(db.Float)
    value_max = db.Column(db.Float)
    value_mean = db.Column(db.Float)
    value_std = db.Column(db.Float)
    # aligned with IMAGE_VALUE_SUMMARY_PERCENTILES; one array rather than a column
    # per probe keeps the probe set defined once, and percentiles[n] still indexes
    percentiles = db.Column(ARRAY(db.Float))

    # equal-width bins; edges are implied by the bounds and len(histogram_counts)
    histogram_min = db.Column(db.Float)
    histogram_max = db.Column(db.Float)
    histogram_counts = db.Column(ARRAY(db.Integer))
    histogram_underflow = db.Column(db.BigInteger)
    histogram_overflow = db.Column(db.BigInteger)


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
        if not value:
            raise ValueError("A pipeline config needs a version")
        return value


class PipelineStudyResult(BaseMixin, db.Model):
    __tablename__ = "pipeline_study_results"
    __table_args__ = (
        sa.Index(
            "ix_pipeline_study_results__modality",
            sa.text("(result_data -> 'Modality')"),
            postgresql_using="gin",
        ),
        # A run uploads one result per config and paper; replaying it is a no-op.
        # Rows without a run_id (NULLs are distinct) are not constrained.
        sa.UniqueConstraint(
            "config_id",
            "run_id",
            "base_study_id",
            name="uq_psr__config_run_study",
        ),
    )

    config_id = db.Column(
        db.Text, db.ForeignKey("pipeline_configs.id", ondelete="CASCADE"), index=True
    )
    base_study_id = db.Column(db.Text, db.ForeignKey("base_studies.id"), index=True)
    # The caller's id for the pipeline run that produced this result.
    run_id = db.Column(db.String, nullable=True, index=True)
    date_executed = db.Column(db.DateTime(timezone=True))
    result_data = db.Column(JSONB)
    file_inputs = db.Column(JSONB)
    status = db.Column(STATUS_ENUM)
    config = relationship(
        "PipelineConfig",
        backref=backref("results", cascade_backrefs=False, passive_deletes=True),
        cascade_backrefs=False,
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


# ---------------------------------------------------------------------------
# study_schema extraction: the truth layer
#
# Documents and claims, written by ingest. Internal for now: no API schema,
# route or admin view reads these tables (tests/test_truth_layer.py holds that),
# and there is no feedback or voting table yet. Not the query surface -- see
# store/backend/docs/study-schema-ingestion-design.md, which these implement.
# Nothing here replaces the coordinate tables; an extraction hangs off the
# studies/analyses/tables/points skeleton rather than duplicating it.
# ---------------------------------------------------------------------------


class PipelineAnalysisResult(BaseMixin, db.Model):
    """One extraction run's payload for one analysis.

    The analysis-level counterpart to PipelineStudyResult. Coordinates and the
    LLM payload change on different schedules -- coordinates come from the
    table parse and move rarely, the payload changes every run -- so one
    durable coordinate skeleton carries N versioned payloads.
    """

    __tablename__ = "pipeline_analysis_results"
    __table_args__ = (
        # Keys are per paper (table ids like "tbl2" repeat across papers), so
        # the study is part of what makes one unique within a run.
        sa.UniqueConstraint(
            "config_id",
            "base_study_id",
            "source_table_analysis",
            name="uq_par__config_study_source_analysis",
        ),
        sa.Index(
            "ix_par__analysis_type",
            sa.text("(result_data -> 'analysis_type')"),
            postgresql_using="gin",
        ),
    )

    config_id = db.Column(
        db.Text, db.ForeignKey("pipeline_configs.id", ondelete="CASCADE"), index=True
    )
    base_study_id = db.Column(db.Text, db.ForeignKey("base_studies.id"), index=True)
    # Nullable because an extraction can describe an analysis whose coordinates
    # were never parsed. It must not be *silently* null: the ingester records
    # status FAILURE when source_table_analysis does not resolve, because a
    # payload quietly detached from its coordinates is the worst failure here.
    analysis_id = db.Column(
        db.Text, db.ForeignKey("analyses.id", ondelete="CASCADE"), index=True, nullable=True
    )
    source_table_analysis = db.Column(db.String, index=True)
    result_data = db.Column(JSONB)
    status = db.Column(STATUS_ENUM)
    date_executed = db.Column(db.DateTime(timezone=True))

    config = relationship(
        "PipelineConfig",
        backref=backref("analysis_results", cascade_backrefs=False, passive_deletes=True),
        cascade_backrefs=False,
    )


#: Bump to change what an entity hash covers. Every entity row stores what its
#: hash was computed from (`identity`, `parent_id`), so after a bump
#: `neurostore.ingest.study_entities.rehash_entities` recomputes the hashes in
#: place; claims hang off the entity's id, so no claim moves. Any change to
#: study_schema's `normalize_name` changes identities, so it needs a bump here
#: too: the stale-hash guard at ingest only trips on a version change.
ENTITY_HASH_VERSION = "study-entity/3"


def study_entity_hash(base_study_id, entity_class, identity, parent_hash=None):
    """The `StudyEntity.entity_hash` of one schema entity in one base study.

    A full sha256 (64 hex characters) over the version, the base study, the
    class, the hash of the entity it sits under and what identifies it there.
    Base study and class are inside the hash, so a hash names one entity across
    the whole database, and two papers' coordinate sets never collide even when
    their tables share ids and layouts. `identity` is:

    - Analysis, CoordinateSet: the parse's content key (`ParsedAnalysis.key`,
      `study_schema.keys.key_for`), with no parent -- what was extracted, its
      name, space and points, never where it was read, so the same analysis
      read from another table or sentence, or re-parsed unchanged, reaches the
      same hash, and a renamed analysis or a changed point is a new one;
    - Study: '', with no parent;
    - every other class: `sibling_identity(...)`, under its parent's hash.
    """
    payload = json.dumps(
        [ENTITY_HASH_VERSION, base_study_id, entity_class, parent_hash, identity],
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def entity_name_key(name):
    """`study_schema.keys.normalize_name(name)`; None for a missing or empty name."""
    return normalize_name(name) or None if isinstance(name, str) else None


def sibling_identity(name, ordinal):
    """The identity of an entity that is not an analysis or coordinate set.

    `[normalized name, ordinal]`, the ordinal counting earlier siblings of the
    same class and the same normalized name under the same parent. A class with
    no name (Device, Preprocessing, ...) has name None, so its ordinal counts
    every earlier sibling of its class.
    """
    return [entity_name_key(name), ordinal]


class StudyEntity(BaseMixin, db.Model):
    """Durable identity for one schema entity within one base study.

    Positions and per-run local_ids are reminted by every extraction, so a
    reviewer's judgement cannot hang off them. This is the foreign key claims
    point at instead, and `entity_hash` is how an entity is found again.

    Analyses and coordinate sets are identified by their content key: their
    name, space and points. Every other entity is identified under its parent (the Study, or
    the Task of a Condition, the ModelEstimation of a ModelTerm) by its
    normalized name and its ordinal among same-named siblings, so two groups
    both called "patients" are two entities and "Healthy controls" re-extracted
    as "healthy  controls" is the same one. The trade-off: when an extraction
    reorders same-named siblings (or, for a class with no name, any siblings),
    the ordinals follow the new order and the siblings swap claims. A name that
    changes beyond normalization is a new entity; the old one keeps its claims.
    """

    __tablename__ = "study_entities"
    __table_args__ = (
        sa.UniqueConstraint("entity_hash", name="uq_study_entity__hash"),
        sa.UniqueConstraint("stable_id", name="uq_study_entity__stable_id"),
    )

    #: The id a record's entity carries as study_schema's ``stable_id``.
    stable_id = db.Column(db.Text, nullable=False, default=generate_stable_id)

    base_study_id = db.Column(
        db.Text, db.ForeignKey("base_studies.id", ondelete="CASCADE"), index=True
    )
    #: The study_schema class: Study, Group, Task, Condition, Acquisition,
    #: Device, Preprocessing, ModelEstimation, ModelTerm, InferenceSettings,
    #: Measure, Assessment, Region, Arm, Timepoint, Table, Analysis or
    #: CoordinateSet. Every acquisition modality is an Acquisition.
    entity_class = db.Column(db.String, index=True)
    #: study_entity_hash(base_study_id, entity_class, identity, parent's hash).
    entity_hash = db.Column(db.String(64), nullable=False)
    #: The entity this one is identified under; None for Study, Analysis and
    #: CoordinateSet.
    parent_id = db.Column(
        db.Text, db.ForeignKey("study_entities.id", ondelete="CASCADE"), index=True
    )
    #: What the hash covers besides version, study, class and parent, so a
    #: version bump can re-hash the row.
    identity = db.Column(JSONB, nullable=False)
    analysis_id = db.Column(
        db.Text, db.ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True
    )
    #: The existing `tables` row an Analysis, CoordinateSet or Table entity was
    #: read from, resolved through (study_id, t_id). Set for a coordinate set
    #: with no points too, which has no `analyses` row to reach a table through.
    table_id = db.Column(
        db.Text, db.ForeignKey("tables.id", ondelete="SET NULL"), nullable=True
    )
    first_seen_config_id = db.Column(
        db.Text, db.ForeignKey("pipeline_configs.id"), nullable=True
    )
    last_seen_config_id = db.Column(
        db.Text, db.ForeignKey("pipeline_configs.id"), nullable=True
    )

    parent = relationship("StudyEntity", remote_side="StudyEntity.id")


class StudyEntityCandidateLink(db.Model):
    """A link between two entities that the pipeline suspects but has not applied.

    'renamed_by_extractor': a re-extraction stopped naming `entity_id` and named
    `candidate_id` in its place, at the same parent, class and ordinal. Claims
    stay where they are until a curator confirms the link.
    """

    __tablename__ = "study_entity_candidate_links"

    entity_id = db.Column(
        db.Text,
        db.ForeignKey("study_entities.id", ondelete="CASCADE"),
        primary_key=True,
    )
    candidate_id = db.Column(
        db.Text,
        db.ForeignKey("study_entities.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    reason = db.Column(db.String, primary_key=True)
    config_id = db.Column(
        db.Text, db.ForeignKey("pipeline_configs.id"), nullable=True
    )
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())


class ExtractionEntityLink(db.Model):
    """One run's local_id for an entity.

    What makes a record's internal references resolvable to durable entities
    rather than only within the one document that minted them.
    """

    __tablename__ = "extraction_entity_links"

    config_id = db.Column(
        db.Text,
        db.ForeignKey("pipeline_configs.id", ondelete="CASCADE"),
        primary_key=True,
    )
    local_id = db.Column(db.String, primary_key=True)
    entity_id = db.Column(
        db.Text, db.ForeignKey("study_entities.id", ondelete="CASCADE"), index=True
    )


class FieldClaim(BaseMixin, db.Model):
    """One value a field has been given, by a run or by a person.

    Not a correction against a record: a correction is one more option on a
    field, the same kind of thing an extraction produces, so machines and
    people write here on equal terms. Keyed by value rather than by run, which
    is what makes carry-forward across re-extraction free.
    """

    __tablename__ = "field_claims"
    __table_args__ = (
        sa.UniqueConstraint(
            "entity_id", "field_path", "value_hash", name="uq_field_claim__value"
        ),
        sa.Index("ix_field_claims_entity_field", "entity_id", "field_path"),
    )

    entity_id = db.Column(
        db.Text, db.ForeignKey("study_entities.id", ondelete="CASCADE"), index=True
    )
    #: entity-relative and key-predicated, e.g. 'terms[name=IC25].local_id'
    field_path = db.Column(db.String)
    schema_version = db.Column(db.String)

    value = db.Column(JSONB, nullable=True)
    #: 'extracted' | 'not_reported'
    extraction_status = db.Column(db.String)
    #: 'reported' | 'generated'
    value_source = db.Column(db.String)
    value_hash = db.Column(db.String, index=True)

    #: 'extraction' | 'user'
    origin = db.Column(db.String)
    origin_user_id = db.Column(
        db.Text, db.ForeignKey("users.external_id"), nullable=True, index=True
    )

    #: The claim this one was copied from, when a revised coordinate parse
    #: split or merged the analysis that claim was made against; its entity is
    #: the superseded analysis, kept unchanged as history. Null for a claim
    #: made against this entity directly. A merge can collapse two copies into
    #: one claim, and this then names the first one copied.
    carried_from = db.Column(
        db.Text,
        db.ForeignKey("field_claims.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )


class FieldClaimRun(db.Model):
    """Which runs produced a claim.

    Separate from the claim because two runs agreeing produce one claim, not
    two -- which is what makes independent model agreement countable beside
    human agreement.
    """

    __tablename__ = "field_claim_runs"

    claim_id = db.Column(
        db.Text, db.ForeignKey("field_claims.id", ondelete="CASCADE"), primary_key=True
    )
    config_id = db.Column(
        db.Text,
        db.ForeignKey("pipeline_configs.id", ondelete="CASCADE"),
        primary_key=True,
    )


class FieldClaimEvidence(BaseMixin, db.Model):
    """The passage supporting one claim.

    Hangs off the claim rather than the field, because two claims for one field
    are supported by different sentences.
    """

    __tablename__ = "field_claim_evidence"

    claim_id = db.Column(
        db.Text, db.ForeignKey("field_claims.id", ondelete="CASCADE"), index=True
    )
    #: present | not_found | not_applicable
    status = db.Column(db.String)
    #: EvidenceSource, plus 'user'
    source = db.Column(db.String)
    #: [{text, start_char, end_char}]; text == fulltext[start_char:end_char]
    spans = db.Column(JSONB)

    origin = db.Column(db.String)
    origin_user_id = db.Column(
        db.Text, db.ForeignKey("users.external_id"), nullable=True
    )
    config_id = db.Column(
        db.Text, db.ForeignKey("pipeline_configs.id"), nullable=True
    )


# Study.source of the study_schema ingester's versions of a paper: the current one and
# the superseded history.
STUDY_SOURCE = "study_schema"
HISTORY_SOURCE = "study_schema:superseded"
PIPELINE_STUDY_SOURCES = (STUDY_SOURCE, HISTORY_SOURCE)
# The PipelineConfig schema name of a pondie extraction record (study_schema's record).
RECORD_SCHEMA_NAME = "neuroimaging-study-extraction"
# The pipeline whose PipelineStudyResults are the coordinate parses the ingester stored whole.
PARSE_PIPELINE = "coordinate-parse"
RESULT_ROLE = "result"


def is_result_analysis(analysis, study=None):
    """Whether ``analysis`` is a result: the analyses releases export and coordinates count.

    A role says so directly. With no role, only a set the study_schema ingester wrote to
    a pipeline Study (its metadata has a ``parse_id``) is unclassified, never a result.
    Every other analysis with no role reads as a result, as before roles existed: a
    curator's, an older upload's, or one added through the API to a pipeline Study.
    """
    if analysis.role is not None:
        return analysis.role == RESULT_ROLE
    if "parse_id" not in (analysis.metadata_ or {}):
        return True
    study = study if study is not None else analysis.study
    return study is None or study.source not in PIPELINE_STUDY_SOURCES


def result_analysis_clause():
    """``is_result_analysis`` as SQL on ``Analysis``."""
    pipeline_study = aliased(Study)
    in_pipeline_study = (
        sa.select(pipeline_study.id)
        .where(
            pipeline_study.id == Analysis.study_id,
            pipeline_study.source.in_(PIPELINE_STUDY_SOURCES),
        )
        .exists()
    )
    ingested = sa.func.coalesce(Analysis.metadata_.has_key("parse_id"), False)
    # Never NULL: the flag recompute writes this into a NOT NULL column.
    return sa.or_(
        sa.func.coalesce(Analysis.role, "") == RESULT_ROLE,
        sa.and_(Analysis.role.is_(None), ~sa.and_(ingested, in_pipeline_study)),
    )


def analysis_role_clause(role):
    """SQL on ``Analysis``: it has ``role``, where ``result`` is ``is_result_analysis``."""
    if role == RESULT_ROLE:
        return result_analysis_clause()
    return Analysis.role == role


from neurostore.models import fulltext_listeners  # noqa E402
from neurostore.models import image_count_listeners  # noqa E402
from neurostore.models import point_count_listeners  # noqa E402

del fulltext_listeners
del image_count_listeners
del point_count_listeners
