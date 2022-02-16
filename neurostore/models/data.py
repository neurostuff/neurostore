from sqlalchemy import event, ForeignKeyConstraint
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
import shortuuid

from ..database import db


def generate_id():
    return shortuuid.ShortUUID().random(length=12)


class BaseMixin(object):

    id = db.Column(db.Text, primary_key=True, default=generate_id)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())

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


class Dataset(BaseMixin, db.Model):
    __tablename__ = "datasets"

    name = db.Column(db.String)
    description = db.Column(db.String)
    publication = db.Column(db.String)
    authors = db.Column(db.String)
    metadata_ = db.Column(db.JSON)
    source = db.Column(db.String)
    source_id = db.Column(db.String)
    source_updated_at = db.Column(db.DateTime(timezone=True))
    doi = db.Column(db.String)
    pmid = db.Column(db.String)
    public = db.Column(db.Boolean, default=True)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    user = relationship("User", backref=backref("datasets"))
    studies = relationship(
        "Study",
        cascade="all",
        secondary="dataset_studies",
        backref=backref("datasets"),
    )
    annotations = relationship("Annotation", cascade="all, delete", backref="dataset")


class Annotation(BaseMixin, db.Model):
    __tablename__ = "annotations"
    name = db.Column(db.Text)
    description = db.Column(db.Text)
    source = db.Column(db.String)
    source_id = db.Column(db.String)
    source_updated_at = db.Column(db.DateTime(timezone=True))
    user_id = db.Column(db.Text, db.ForeignKey('users.external_id'))
    user = relationship('User', backref=backref('annotations'))
    dataset_id = db.Column(db.Text, db.ForeignKey('datasets.id'))
    metadata_ = db.Column(db.JSON)
    public = db.Column(db.Boolean, default=True)
    annotation_analyses = relationship(
        'AnnotationAnalysis',
        backref=backref("annotation"),
        cascade='all, delete-orphan'
    )


class AnnotationAnalysis(db.Model):
    __tablename__ = "annotation_analyses"
    __table_args__ = (
        ForeignKeyConstraint(
            ('study_id', 'dataset_id'),
            ('dataset_studies.study_id', 'dataset_studies.dataset_id'),
            ondelete="CASCADE"),
    )

    study_id = db.Column(db.Text, nullable=False)
    dataset_id = db.Column(db.Text, nullable=False)
    annotation_id = db.Column(db.Text, db.ForeignKey("annotations.id"), primary_key=True)
    analysis_id = db.Column(db.Text, db.ForeignKey("analyses.id"), primary_key=True)
    note = db.Column(MutableDict.as_mutable(db.JSON))


class Study(BaseMixin, db.Model):
    __tablename__ = "studies"

    name = db.Column(db.String)
    description = db.Column(db.String)
    publication = db.Column(db.String)
    doi = db.Column(db.String)
    pmid = db.Column(db.String)
    authors = db.Column(db.String)
    year = db.Column(db.Integer)
    public = db.Column(db.Boolean, default=True)
    metadata_ = db.Column(db.JSON)
    source = db.Column(db.String)
    source_id = db.Column(db.String)
    source_updated_at = db.Column(db.DateTime(timezone=True))
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    user = relationship("User", backref=backref("studies"))
    analyses = relationship(
        "Analysis",
        backref=backref("study"),
        cascade="all, delete, delete-orphan",
    )


class DatasetStudy(db.Model):
    __tablename__ = "dataset_studies"
    study_id = db.Column(db.ForeignKey('studies.id', ondelete='CASCADE'), primary_key=True)
    dataset_id = db.Column(db.ForeignKey('datasets.id', ondelete='CASCADE'), primary_key=True)
    study = relationship("Study", backref=backref("dataset_study", cascade="all, delete-orphan"))
    dataset = relationship("Dataset", backref=backref("dataset_study"))
    annotation_analyses = relationship(
        "AnnotationAnalysis",
        cascade='all, delete-orphan',
        backref=backref("dataset_study")
    )


class Analysis(BaseMixin, db.Model):
    __tablename__ = "analyses"

    study_id = db.Column(db.Text, db.ForeignKey("studies.id", ondelete='CASCADE'))
    name = db.Column(db.String)
    description = db.Column(db.String)
    conditions = relationship(
        "Condition",
        secondary="analysis_conditions",
        backref=backref("analyses"),
        # cascade="all, delete",
    )
    points = relationship(
        "Point",
        backref=backref("analysis"),
        cascade="all, delete, delete-orphan",
    )
    images = relationship(
        "Image",
        backref=backref("analysis"),
        cascade="all, delete, delete-orphan",
        )
    weights = association_proxy("analysis_conditions", "weight")
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    user = relationship("User", backref=backref("analyses"))
    analysis_conditions = relationship(
        "AnalysisConditions", backref=backref("analysis"), cascade="all, delete, delete-orphan"
    )
    annotation_analyses = relationship(
        "AnnotationAnalysis", backref=backref("analysis"), cascade="all, delete, delete-orphan"
    )


class Condition(BaseMixin, db.Model):
    __tablename__ = "conditions"

    name = db.Column(db.String)
    description = db.Column(db.String)
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    user = relationship("User", backref=backref("conditions"))
    analysis_conditions = relationship(
        "AnalysisConditions", backref=backref("condition"), cascade="all, delete"
    )


class AnalysisConditions(db.Model):
    __tablename__ = "analysis_conditions"
    weight = db.Column(db.Float)
    analysis_id = db.Column(
        db.Text, db.ForeignKey("analyses.id"), primary_key=True
    )
    condition_id = db.Column(
        db.Text, db.ForeignKey("conditions.id"), primary_key=True
    )


PointEntityMap = db.Table(
    "point_entities",
    db.Model.metadata,
    db.Column("point", db.Text, db.ForeignKey("points.id", ondelete='CASCADE')),
    db.Column("entity", db.Text, db.ForeignKey("entities.id", ondelete='CASCADE')),
)


ImageEntityMap = db.Table(
    "image_entities",
    db.Model.metadata,
    db.Column("image", db.Text, db.ForeignKey("images.id", ondelete='CASCADE')),
    db.Column("entity", db.Text, db.ForeignKey("entities.id", ondelete='CASCADE')),
)


# purpose of Entity: you have an image/coordinate, but you do not
# know what level of analysis it represents
class Entity(BaseMixin, db.Model):
    __tablename__ = "entities"

    # link to analysis
    study_id = db.Column(db.Text, db.ForeignKey("studies.id", ondelete='CASCADE'))
    label = db.Column(db.String)  # bids-entity
    level = db.Column(db.String)  # constrained enumeration (bids-entity, run, session, subject)
    data = db.Column(db.JSON)  # metadata (participants.tsv, or something else)
    study = relationship("Study", backref=backref("entities"))


class Point(BaseMixin, db.Model):
    __tablename__ = "points"

    @property
    def coordinates(self):
        return [self.x, self.y, self.z]

    x = db.Column(db.Float)
    y = db.Column(db.Float)
    z = db.Column(db.Float)
    space = db.Column(db.String)
    kind = db.Column(db.String)
    image = db.Column(db.String)  # what does image represent
    label_id = db.Column(db.Float, default=None)
    analysis_id = db.Column(db.Text, db.ForeignKey("analyses.id", ondelete='CASCADE'))

    entities = relationship(
        "Entity", secondary=PointEntityMap, backref=backref("points")
    )
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    user = relationship("User", backref=backref("points"))


class Image(BaseMixin, db.Model):
    __tablename__ = "images"

    url = db.Column(db.String)
    filename = db.Column(db.String)
    space = db.Column(db.String)
    value_type = db.Column(db.String)
    analysis_id = db.Column(db.Text, db.ForeignKey("analyses.id", ondelete='CASCADE'))
    data = db.Column(db.JSON)
    add_date = db.Column(db.DateTime(timezone=True))

    analysis_name = association_proxy("analysis", "name")
    entities = relationship(
        "Entity", secondary=ImageEntityMap, backref=backref("images")
    )
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    user = relationship("User", backref=backref("images"))


class PointValue(BaseMixin, db.Model):
    __tablename__ = "point_values"

    point_id = db.Column(db.Text, db.ForeignKey("points.id", ondelete='CASCADE'))
    kind = db.Column(db.String)
    value = db.Column(db.String)
    dtype = db.Column(db.String, default="str")
    point = relationship("Point", backref=backref("values"))
    user_id = db.Column(db.Text, db.ForeignKey("users.external_id"))
    user = relationship("User", backref=backref("point_values"))


def check_note_columns(annotation, annotation_analyses, collection_adapter):
    "listen for the 'bulk_replace' event"

    def _combine_compare_keys(aa1, aa2):
        """compare keys """
        aa1_dict = {aa.analysis.id: set(aa.note.keys()) for aa in aa1}
        aa2_dict = {aa.analysis.id: set(aa.note.keys()) for aa in aa2}
        aa_dict = {}
        for key in aa1_dict.keys():
            if key in aa2_dict:
                aa_dict[key] = aa2_dict.pop(key)
            else:
                aa_dict[key] = aa1_dict[key]

        aa_list = [*aa_dict.values(), *aa2_dict.values()]
        return all([aa_list[0] == note for note in aa_list[1:]])

    all_equal = _combine_compare_keys(annotation.annotation_analyses, annotation_analyses)
    if not all_equal:
        raise ValueError("All analyses must have the same annotations")


def add_necessary_annotation_analyses(dataset, studies, collection_adapter):
    new_studies = set(studies) - set(dataset.studies)
    new_aas = []
    for annot in dataset.annotations:
        for study in new_studies:
            for analysis in study.analyses:
                if annot.annotation_analyses:
                    keys = list(annot.annotation_analyses[0].note.keys())
                else:
                    keys = None
                new_aas.append(
                    AnnotationAnalysis(
                        study_id=study.id,
                        dataset_id=dataset.id,
                        annotation_id=annot.id,
                        analysis_id=analysis.id,
                        note={} if not keys else {k: None for k in keys},
                        analysis=analysis,
                        annotation=annot,
                    )
                )
    if new_aas:
        db.session.add_all(new_aas)


# ensure all keys are the same across all notes
event.listen(Annotation.annotation_analyses, 'bulk_replace', check_note_columns)


# ensure new annotation_analyses are added when study is added to dataset
event.listen(Dataset.studies, 'bulk_replace', add_necessary_annotation_analyses)
