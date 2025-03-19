from marshmallow import (
    fields,
    Schema,
    SchemaOpts,
    post_dump,
    pre_dump,
    pre_load,
    post_load,
    EXCLUDE,
)

from sqlalchemy import func
import orjson

from neurostore.core import db
from neurostore.models import Analysis, Point

# context parameters
# clone: create a new object with new ids (true or false)
# nested: serialize nested objects (true or false)
# flat: do not display any relationships
# info: only display info fields


class BooleanOrString(fields.Field):
    def __init__(self, *args, **kwargs):
        self.bool_field = fields.Boolean(*args, **kwargs)
        self.string_field = fields.String(*args, **kwargs)
        super().__init__()

    def _serialize(self, value, attr, obj, **kwargs):
        if isinstance(value, bool):
            return self.bool_field._serialize(value, attr, obj, **kwargs)
        return self.string_field._serialize(value, attr, obj, **kwargs)

    def _deserialize(self, value, attr, data, **kwargs):
        if value in ["true", "false"]:
            return self.bool_field._deserialize(value, attr, data, **kwargs)
        return self.string_field._deserialize(value, attr, data, **kwargs)


class ObjToString(fields.Field):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.many = kwargs.get("many", False)

    def _serialize(self, value, attr, obj, **kwargs):
        if self.many:
            return [v.id for v in value]
        return str(value.id)

    def _deserialize(self, value, attr, data, **kwargs):
        if self.many:
            return [{"id": v} if isinstance(v, str) else v for v in value]
        return {"id": value} if isinstance(value, str) else value


class StringOrNested(fields.Nested):
    """Handle read/write only fields. Handle nested serialization/deserialization"""

    def __init__(self, nested, *args, **kwargs):
        super().__init__(nested, **kwargs)
        self.string_field = ObjToString(*args, **kwargs)

    def _modify_schema(self):
        """Only relevant when nested=True"""
        schema = self.schema
        schema.context = self.context
        if self.context.get("clone"):
            id_fields = [
                field
                for field, f_obj in schema._declared_fields.items()
                if f_obj.metadata.get("id_field")
            ]
            for f in id_fields:
                schema.exclude.add(f)
        if self.context.get("info"):
            info_fields = [
                field
                for field, f_obj in schema._declared_fields.items()
                if f_obj.metadata.get("info_field")
            ]
            schema.only = schema.set_class(info_fields)
            # set exclude to an empty set
            schema.exclude = schema.set_class()
        # have the changes take effect
        schema._init_fields()

        return schema

    def _serialize(self, value, attr, obj, **kwargs):
        if self.many:
            value_instance = value[0] if len(value) > 0 else None
        else:
            value_instance = value

        if not value_instance:
            return value

        if not self.context.get("nested") and not self.context.get("info"):
            return self.string_field._serialize(value, attr, obj, many=self.many)

        schema = self._modify_schema()
        return schema.dump(value, many=self.many)

    def _deserialize(self, value, attr, data, **kwargs):
        if self.many:
            value_instance = value[0] if len(value) > 0 else None
        else:
            value_instance = value

        if not value_instance:
            return value

        if isinstance(value_instance, str):
            return self.string_field._deserialize(value, attr, data, many=self.many)

        schema = self._modify_schema()
        return schema.load(value, many=self.many)


# https://github.com/marshmallow-code/marshmallow/issues/466#issuecomment-285342071
class BaseSchemaOpts(SchemaOpts):
    def __init__(self, meta, *args, **kwargs):
        meta.unknown = EXCLUDE
        super().__init__(meta, *args, **kwargs)
        self.allow_none = getattr(meta, "allow_none", ())
        self.render_module = orjson


class BaseSchema(Schema):
    def __init__(self, *args, **kwargs):
        exclude = kwargs.get("exclude") or self.opts.exclude
        context = kwargs.get("context", {})
        # if cloning and not only id, exclude id fields
        if context.get("clone") and kwargs.get("only") != ("id",):
            id_fields = [
                field
                for field, f_obj in self._declared_fields.items()
                if f_obj.metadata.get("id_field")
            ]
            for f in id_fields:
                exclude += (f,)
        if context.get("flat"):
            relationships = [
                field
                for field, f_obj in self._declared_fields.items()
                if isinstance(f_obj, (fields.Nested, fields.Pluck, StringOrNested))
            ]
            for f in relationships:
                exclude += (f,)
        kwargs["exclude"] = exclude
        super().__init__(*args, **kwargs)

    OPTIONS_CLASS = BaseSchemaOpts
    # normal return key

    id = fields.String(metadata={"info_field": True, "id_field": True})

    def on_bind_field(self, field_name, field_obj):
        super().on_bind_field(field_name, field_obj)
        if field_name in self.opts.allow_none:
            field_obj.allow_none = True


class BaseDataSchema(BaseSchema):
    user = fields.String(
        attribute="user_id", dump_only=True, metadata={"info_field": True}
    )
    username = fields.String(
        attribute="user.name",
        dump_only=True,
        metadata={"info_field": True},
        default=None,
    )
    created_at = fields.DateTime(dump_only=True, metadata={"info_field": True})
    updated_at = fields.DateTime(dump_only=True, metadata={"info_field": True})


class ConditionSchema(BaseDataSchema):
    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")


class EntitySchema(BaseDataSchema):
    analysis_id = fields.String(data_key="analysis", metadata={"id_field": True})

    class Meta:
        additional = ("level", "label")
        allow_none = ("level", "label")


class ImageSchema(BaseDataSchema):
    # serialization
    analysis_id = fields.String(data_key="analysis", metadata={"id_field": True})
    # analysis = fields.Pluck("AnalysisSchema", "id", metadata={"id_field": True})
    analysis_name = fields.String(allow_none=True, dump_only=True)
    add_date = fields.DateTime(dump_only=True)

    class Meta:
        additional = ("url", "filename", "space", "value_type")
        allow_none = ("url", "filename", "space", "value_type")


class PointValueSchema(BaseSchema):
    class Meta:
        additional = allow_none = ("kind", "value")


class PointSchema(BaseDataSchema):
    # serialization
    analysis_id = fields.String(data_key="analysis", metadata={"id_field": True})
    # analysis = fields.Pluck("AnalysisSchema", "id", metadata={"id_field": True})
    values = fields.Nested(PointValueSchema, many=True)
    entities = fields.Nested(EntitySchema, many=True, load_only=True)
    cluster_size = fields.Float(allow_none=True)
    subpeak = fields.Boolean(allow_none=True)
    order = fields.Integer()
    coordinates = fields.List(fields.Float(), dump_only=True)

    # deserialization
    x = fields.Float(load_only=True)
    y = fields.Float(load_only=True)
    z = fields.Float(load_only=True)

    class Meta:
        additional = ("kind", "space", "image", "label_id")
        allow_none = ("kind", "space", "image", "label_id")

    @pre_load
    def process_values(self, data, **kwargs):
        # PointValues need special handling
        if data.get("coordinates"):
            coords = [float(c) for c in data.pop("coordinates")]
            data["x"], data["y"], data["z"] = coords

        if data.get("order") is None:
            if data.get("analysis_id") is not None:
                max_order = (
                    db.session.query(func.max(Point.order))
                    .filter_by(analysis_id=data["analysis_id"])
                    .scalar()
                )
                data["order"] = 1 if max_order is None else max_order + 1
            else:
                data["order"] = 1
        return data

    @pre_dump
    def pre_dump_process(self, data, **kwargs):
        if hasattr(data, "coordinates") or data.get("coordinates"):
            return data
        if isinstance(data, dict):
            data["coordinates"] = [data.pop("x"), data.pop("y"), data.pop("z")]
        return data


class AnalysisConditionSchema(BaseDataSchema):
    weight = fields.Float()
    condition = StringOrNested(ConditionSchema)
    analysis_id = fields.String(data_key="analysis", metadata={"id_field": True})


class StudysetStudySchema(BaseDataSchema):
    studyset_id = fields.String()  # primary key needed (no id_field)
    study_id = fields.String()  # primary key needed (no id_field)


class AnalysisSchema(BaseDataSchema):
    # serialization
    study_id = fields.String(data_key="study", metadata={"id_field": True})
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)
    # study = fields.Pluck("StudySchema", "id", metadata={"id_field": True})
    conditions = StringOrNested(ConditionSchema, many=True, dump_only=True)
    order = fields.Integer()
    analysis_conditions = fields.Nested(AnalysisConditionSchema, many=True)
    images = StringOrNested(ImageSchema, many=True)
    points = StringOrNested(PointSchema, many=True)
    weights = fields.List(fields.Float())
    entities = fields.Nested(EntitySchema, many=True, load_only=True)

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")

    @pre_load
    def load_values(self, data, **kwargs):
        # conditions/weights need special processing
        if data.get("conditions") is not None and data.get("weights") is not None:
            assert len(data.get("conditions")) == len(data.get("weights"))
            data["analysis_conditions"] = [
                {"condition": c, "weight": w}
                for c, w in zip(data.get("conditions"), data.get("weights"))
            ]
        elif data.get("conditions") is not None:
            data["analysis_conditions"] = [
                {"condition": cond, "weight": 0} for cond in data.get("conditions")
            ]

        data.pop("conditions", None)
        data.pop("weights", None)

        if data.get("order") is None:
            if data.get("study_id") is not None:
                max_order = (
                    db.session.query(func.max(Analysis.order))
                    .filter_by(study_id=data["study_id"])
                    .scalar()
                )
                data["order"] = 1 if max_order is None else max_order + 1
            else:
                data["order"] = 1
        return data

    @post_dump
    def dump_values(self, data, **kwargs):
        if data.get("analysis_conditions") is not None:
            data["conditions"] = [ac["condition"] for ac in data["analysis_conditions"]]
            data["weights"] = [ac["weight"] for ac in data["analysis_conditions"]]
        data.pop("analysis_conditions", None)

        return data


class StudySetStudyInfoSchema(Schema):
    id = fields.String(dump_only=True)
    name = fields.String(dump_only=True)
    description = fields.String(dump_only=True)


class BaseStudySchema(BaseDataSchema):
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)
    versions = StringOrNested("StudySchema", many=True)
    features = fields.Method("get_features")

    def get_features(self, obj):
        from .pipeline import PipelineStudyResultSchema

        pipelines = self.context.get("feature_display", None)

        if pipelines is None:
            return {}

        features = obj.display_features(pipelines)
        # Flatten each pipeline's predictions
        if features:
            flattened_features = {}
            for pipeline_name, feature_data in features.items():
                if isinstance(feature_data, dict):
                    flattened_features[pipeline_name] = (
                        PipelineStudyResultSchema.flatten_dict(feature_data)
                    )
                else:
                    flattened_features[pipeline_name] = feature_data
            return flattened_features

        return features

    class Meta:
        additional = (
            "name",
            "description",
            "publication",
            "doi",
            "pmid",
            "pmcid",
            "authors",
            "year",
            "level",
        )
        allow_none = (
            "name",
            "description",
            "publication",
            "doi",
            "pmid",
            "pmcid",
            "authors",
            "year",
            "level",
        )

    @pre_load
    def check_nulls(self, data, **kwargs):
        """ensure data is not empty string or whitespace"""
        for attr in ["pmid", "pmcid", "doi"]:
            val = data.get(attr, None)
            if val is not None and (val == "" or val.isspace()):
                data[attr] = None
        return data


class StudySchema(BaseDataSchema):
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)
    analyses = StringOrNested(AnalysisSchema, many=True)
    source = fields.String(
        dump_only=True, metadata={"info_field": True}, allow_none=True
    )
    source_id = fields.String(dump_only=True, allow_none=True)
    studysets = fields.Pluck(
        "StudysetSchema",
        "id",
        many=True,
        dump_only=True,
        metadata={"id_field": True},
    )
    base_study_id = fields.String(data_key="base_study", allow_none=True)
    has_coordinates = fields.Bool(dump_only=True)
    has_images = fields.Bool(dump_only=True)
    source_updated_at = fields.DateTime(dump_only=True, allow_none=True)

    class Meta:
        # by default exclude this
        exclude = ("has_coordinates", "has_images", "studysets")
        additional = (
            "name",
            "description",
            "publication",
            "doi",
            "pmid",
            "pmcid",
            "authors",
            "year",
            "level",
        )
        allow_none = (
            "name",
            "description",
            "publication",
            "doi",
            "pmid",
            "pmcid",
            "authors",
            "year",
            "level",
        )

    @pre_load
    def check_nulls(self, data, **kwargs):
        """ensure data is not empty string or whitespace"""
        for attr in ["pmid", "pmcid", "doi"]:
            val = data.get(attr, None)
            if val is not None and (val == "" or val.isspace()):
                data[attr] = None
        return data


class StudysetSchema(BaseDataSchema):
    # serialize
    studies = StringOrNested(
        StudySchema, many=True
    )  # This needs to be nested, but not cloned

    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid")
        allow_none = ("name", "description", "publication", "doi", "pmid")
        render_module = orjson


class AnnotationAnalysisSchema(BaseSchema):
    id = fields.String(metadata={"info_field": True, "id_field": True})
    note = fields.Dict()
    annotation = StringOrNested("AnnotationSchema", load_only=True)
    analysis_id = fields.String(
        data_key="analysis"
    )  # not marked with id_field because it's a primary relationship
    study_id = fields.String(data_key="study")  # primary key needed for StudysetStudy
    studyset_id = fields.String(
        data_key="studyset", load_only=True
    )  # primary key needed for StudysetStudy
    study_name = fields.Function(
        lambda aa: aa.studyset_study.study.name, dump_only=True
    )
    analysis_name = fields.Function(lambda aa: aa.analysis.name, dump_only=True)
    studyset_study = fields.Nested(StudysetStudySchema, load_only=True)
    study_year = fields.Function(
        lambda aa: aa.studyset_study.study.year, dump_only=True
    )
    authors = fields.Function(
        lambda aa: aa.studyset_study.study.authors, dump_only=True
    )
    publication = fields.Function(
        lambda aa: aa.studyset_study.study.publication, dump_only=True
    )

    @pre_load
    def create_id(self, data, **kwargs):
        if not data.get("id") and data.get("annotation") and data.get("analysis"):
            data["id"] = "_".join([data["annotation"], data["analysis"]])
            data.pop("annotation")  # do not need to load/update annotation
        return data

    @post_load
    def add_id(self, data, **kwargs):
        if isinstance(data.get("analysis_id"), str):
            data["analysis"] = {"id": data.pop("analysis_id")}
        if isinstance(data.get("study_id"), str) and isinstance(
            data.get("studyset_id"), str
        ):
            data["studyset_study"] = {
                "study": {"id": data.pop("study_id")},
                "studyset": {"id": data.pop("studyset_id")},
            }

        return data


class AnnotationSchema(BaseDataSchema):
    # serialization
    studyset_id = fields.String(data_key="studyset")
    annotation_analyses = fields.Nested(
        AnnotationAnalysisSchema, data_key="notes", many=True
    )
    annotation = fields.String(dump_only=True)
    annotation_csv = fields.String(dump_only=True)
    source = fields.String(dump_only=True, allow_none=True)
    source_id = fields.String(dump_only=True, allow_none=True)
    source_updated_at = fields.DateTime(dump_only=True, allow_none=True)

    note_keys = fields.Dict()
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    # deserialization
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")

    @pre_load
    def add_studyset_id(self, data, **kwargs):
        if data.get("studyset") and data.get("notes"):
            for note in data["notes"]:
                note["studyset"] = data["studyset"]

        return data

    @post_load
    def add_id(self, data, **kwargs):
        if isinstance(data.get("studyset_id"), str):
            data["studyset"] = {"id": data.pop("studyset_id")}
        return data


class BaseSnapshot(object):
    def __init__(self):
        pass

    def _serialize_dt(self, dt):
        return dt.isoformat() if dt else dt

    def serialize(self, resource_dict):
        return orjson.dumps(resource_dict)

    def dump_and_serialize(self, resource):
        return self.serialize(self.dump(resource))


class ImageSnapshot(BaseSnapshot):
    def dump(self, i):
        return {
            "id": i.id,
            "user": i.user_id,
            "url": i.url,
            "space": i.space,
            "value_type": i.value_type,
            "filename": i.filename,
            "add_date": i.add_date,
        }


class PointValueSnapshot(BaseSnapshot):
    def dump(self, v):
        return {
            "kind": v.kind,
            "value": v.value,
        }


class PointSnapshot(BaseSnapshot):
    def dump(self, p):
        v_schema = PointValueSnapshot()
        return {
            "id": p.id,
            "coordinates": p.coordinates,
            "kind": p.kind,
            "space": p.space,
            "image": p.image,
            "label_id": p.label_id,
            "values": [v_schema.dump(v) for v in p.values],
        }


class ConditionSnapshot(BaseSnapshot):
    def dump(self, ac):
        return {
            "id": ac.condition_id,
            "user": ac.condition.user_id,
            "name": ac.condition.name,
            "description": ac.condition.description,
        }


class AnalysisSnapshot(BaseSnapshot):
    def dump(self, a):
        ac_schema = ConditionSnapshot()
        p_schema = PointSnapshot()
        i_schema = ImageSnapshot()
        return {
            "id": a.id,
            "user": a.user_id,
            "name": a.name,
            "metadata": a.metadata_,
            "description": a.description,
            "conditions": [ac_schema.dump(ac) for ac in a.analysis_conditions],
            "weights": list(a.weights),
            "points": [p_schema.dump(p) for p in a.points],
            "images": [i_schema.dump(i) for i in a.images],
        }


class StudySnapshot(BaseSnapshot):
    def dump(self, s):
        a_schema = AnalysisSnapshot()
        return {
            "id": s.id,
            "created_at": self._serialize_dt(s.created_at),
            "updated_at": self._serialize_dt(s.updated_at),
            "user": s.user_id,
            "name": s.name,
            "description": s.description,
            "publication": s.publication,
            "doi": s.doi,
            "pmid": s.pmid,
            "authors": s.authors,
            "year": s.year,
            "metadata": s.metadata_,
            "source": s.source,
            "source_id": s.source_id,
            "source_updated_at": self._serialize_dt(s.source_updated_at),
            "analyses": [a_schema.dump(a) for a in s.analyses],
        }


class StudysetSnapshot(BaseSnapshot):
    def dump(self, studyset):
        s_schema = StudySnapshot()
        return {
            "id": studyset.id,
            "name": studyset.name,
            "user": studyset.user_id,
            "description": studyset.description,
            "publication": studyset.publication,
            "doi": studyset.doi,
            "pmid": studyset.pmid,
            "created_at": self._serialize_dt(studyset.created_at),
            "updated_at": self._serialize_dt(studyset.updated_at),
            "studies": [s_schema.dump(s) for s in studyset.studies],
        }
