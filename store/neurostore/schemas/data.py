import sys

from marshmallow import (
    fields,
    Schema,
    SchemaOpts,
    post_dump,
    pre_dump,
    pre_load,
)
from flask import request
import orjson
from marshmallow.decorators import post_load
from pyld import jsonld
import pandas as pd


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


class StringOrNested(fields.Nested):
    """Custom Field that serializes a nested object as either a string
    or a full object, depending on "nested" or "source" request argument"""

    def __init__(self, nested, **kwargs):
        super().__init__(nested, **kwargs)
        self.use_nested = kwargs.get("use_nested", True)

    def _serialize(self, value, attr, obj, **ser_kwargs):
        if isinstance(self.nested, str):
            self.nested = getattr(sys.modules[__name__], self.nested)
        if value is None:
            return None
        if self.use_nested and (self.context.get("nested") or self.context.get("copy")):
            context = self.context
            nested_schema = self.nested(context=context)
            return nested_schema.dump(value, many=self.many)
        elif self.context.get("info"):
            info_fields = [
                "_id",
                "updated_at",
                "created_at",
                "source",
                "user",
                "username",
                "studysets",
                "has_coordinates",
                "has_images",
            ]
            nested_schema = self.nested(
                context=self.context,
                only=info_fields,
            )
            return nested_schema.dump(value, many=self.many)
        else:
            return [v.id for v in value] if self.many else value.id

    def _deserialize(self, value, attr, data, **ser_kwargs):
        if isinstance(self.nested, str):
            self.nested = getattr(sys.modules[__name__], self.nested)

        if isinstance(value, list):
            if self.context.get("copy"):
                return self.schema.load(
                    [v for v in value if not isinstance(v, str)], many=True
                )
            return self.schema.load(
                [{"id": v} if isinstance(v, str) else v for v in value], many=True
            )
        elif isinstance(value, str):
            if self.context.get("copy"):
                return None
            return self.schema.load({"id": value})
        else:
            return self.schema.load(value)


# https://github.com/marshmallow-code/marshmallow/issues/466#issuecomment-285342071
class BaseSchemaOpts(SchemaOpts):
    def __init__(self, meta, **kwargs):
        super().__init__(meta)
        self.allow_none = getattr(meta, "allow_none", ())


class BaseSchema(Schema):
    def __init__(self, copy=None, *args, **kwargs):
        empty_exclude = "exclude" in kwargs and (
            kwargs["exclude"] == [] or kwargs["exclude"] == ()
        )
        exclude = list(kwargs.pop("exclude", []))
        default_exclude = None
        if getattr(self.Meta, "exclude", None) and empty_exclude:
            default_exclude = self.opts.exclude
            self.opts.exclude = set(exclude)
        if copy is None and kwargs.get("context") and kwargs.get("context").get("copy"):
            copy = kwargs.get("context").get("copy")

        if kwargs.get("context"):
            kwargs["context"]["copy"] = copy
        else:
            kwargs["context"] = {"copy": copy}
        if copy and "_id" not in (kwargs.get("only", []) or []):
            exclude.extend(
                [
                    field
                    for field, f_obj in self._declared_fields.items()
                    if f_obj.metadata.get("db_only")
                ]
            )
        super().__init__(*args, exclude=exclude, **kwargs)
        # TODO: not good practice to change core attribute and change it back
        # could lead to race conditions
        if default_exclude:
            self.opts.exclude = default_exclude

    OPTIONS_CLASS = BaseSchemaOpts
    # normal return key
    id_key = "id"

    _id = fields.String(
        attribute="id", data_key=id_key, dump_only=True, metadata={"db_only": True}
    )
    created_at = fields.DateTime(dump_only=True, metadata={"db_only": True})
    updated_at = fields.DateTime(dump_only=True, metadata={"db_only": True})

    id = fields.String(load_only=True)

    def on_bind_field(self, field_name, field_obj):
        super().on_bind_field(field_name, field_obj)
        if field_name in self.opts.allow_none:
            field_obj.allow_none = True


class BaseDataSchema(BaseSchema):
    user = fields.String(
        attribute="user_id", dump_only=True, metadata={"db_only": True}
    )
    username = fields.String(
        attribute="user.name", dump_only=True, metadata={"db_only": True}
    )


class ConditionSchema(BaseDataSchema):
    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")
        render_module = orjson


class EntitySchema(BaseDataSchema):
    analysis_id = fields.String(data_key="analysis")

    class Meta:
        additional = ("level", "label")
        allow_none = ("level", "label")
        render_module = orjson


class ImageSchema(BaseDataSchema):
    # serialization
    analysis = StringOrNested("AnalysisSchema", use_nested=False)
    analysis_name = fields.String(dump_only=True, metadata={"db_only": True})
    add_date = fields.DateTime(dump_only=True, metadata={"db_only": True})

    class Meta:
        additional = ("url", "filename", "space", "value_type")
        allow_none = ("url", "filename", "space", "value_type")
        render_module = orjson


class PointValueSchema(BaseDataSchema):
    class Meta:
        additional = allow_none = ("kind", "value")
        render_module = orjson


class PointSchema(BaseDataSchema):
    # serialization
    analysis = StringOrNested("AnalysisSchema", use_nested=False)
    values = fields.Nested(PointValueSchema, many=True)
    entities = fields.Nested(EntitySchema, many=True, load_only=True)
    cluster_size = fields.Float(allow_none=True)
    subpeak = fields.Boolean(allow_none=True)
    order = fields.Integer()

    # deserialization
    x = fields.Float(load_only=True)
    y = fields.Float(load_only=True)
    z = fields.Float(load_only=True)

    class Meta:
        additional = ("kind", "space", "coordinates", "image", "label_id")
        allow_none = ("kind", "space", "coordinates", "image", "label_id")
        render_module = orjson

    @pre_load
    def process_values(self, data, **kwargs):
        # PointValues need special handling
        if data.get("coordinates"):
            coords = [float(c) for c in data.pop("coordinates")]
            data["x"], data["y"], data["z"] = coords
        return data


class AnalysisConditionSchema(BaseDataSchema):
    weight = fields.Float()
    condition = StringOrNested(ConditionSchema)
    analysis_id = fields.String(data_key="analysis")

    class Meta:
        render_module = orjson


class StudysetStudySchema(BaseDataSchema):
    studyset_id = fields.String()
    study_id = fields.String()

    @pre_load
    def process_values(self, data, **kwargs):
        pass

    @pre_dump
    def filter_values(self, data, **kwargs):
        pass

    class Meta:
        render_module = orjson


class AnalysisSchema(BaseDataSchema):
    # serialization
    study = StringOrNested("StudySchema", use_nested=False)
    conditions = StringOrNested(ConditionSchema, many=True, dump_only=True)

    analysis_conditions = fields.Nested(AnalysisConditionSchema, many=True)
    images = StringOrNested(ImageSchema, many=True)
    points = StringOrNested(PointSchema, many=True)
    weights = fields.List(fields.Float())
    entities = fields.Nested(EntitySchema, many=True, load_only=True)

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")
        render_module = orjson

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
                {"condition": cond} for cond in data.get("conditions")
            ]

        data.pop("conditions", None)
        data.pop("weights", None)
        return data

    @post_dump
    def dump_values(self, data, **kwargs):
        if data.get("analysis_conditions") is not None:
            data["conditions"] = [ac["condition"] for ac in data["analysis_conditions"]]
        data.pop("analysis_conditions", None)

        return data


class StudySetStudyInfoSchema(Schema):
    id = fields.String(dump_only=True)
    name = fields.String(dump_only=True)
    description = fields.String(dump_only=True)

    class Meta:
        render_module = orjson


class BaseStudySchema(BaseDataSchema):
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)
    versions = StringOrNested("StudySchema", many=True, use_nested=False)

    class Meta:
        additional = (
            "name",
            "description",
            "publication",
            "doi",
            "pmid",
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
            "authors",
            "year",
            "level",
        )
        render_module = orjson


class StudySchema(BaseDataSchema):
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)
    analyses = StringOrNested(AnalysisSchema, many=True)
    source = fields.String(dump_only=True, metadata={"db_only": True}, allow_none=True)
    source_id = fields.String(
        dump_only=True, metadata={"db_only": True}, allow_none=True
    )
    studysets = fields.Pluck("StudysetSchema", "_id", many=True, dump_only=True)
    base_study = fields.Pluck(
        "BaseStudySchema", "_id", dump_only=True, metadata={"db_only": True}
    )
    has_coordinates = fields.Bool(dump_only=True)
    has_images = fields.Bool(dump_only=True)
    # studysets = fields.Nested(
    #    "StudySetStudyInfoSchema", dump_only=True, metadata={"db_only": True}, many=True
    # )
    source_updated_at = fields.DateTime(
        dump_only=True, metadata={"db_only": True}, allow_none=True
    )

    class Meta:
        # by default exclude this
        exclude = ("has_coordinates", "has_images", "studysets")
        additional = (
            "name",
            "description",
            "publication",
            "doi",
            "pmid",
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
            "authors",
            "year",
            "level",
        )
        render_module = orjson


class StudysetSchema(BaseDataSchema):
    # serialize
    studies = StringOrNested(
        StudySchema, many=True
    )  # This needs to be nested, but not cloned

    class Meta:
        additional = ("name", "description", "publication", "doi", "pmid")
        allow_none = ("name", "description", "publication", "doi", "pmid")
        render_module = orjson


class AnnotationAnalysisSchema(BaseDataSchema):
    note = fields.Dict()
    annotation = StringOrNested("AnnotationSchema", use_nested=False, load_only=True)
    analysis_id = fields.String(data_key="analysis")
    study_id = fields.String(data_key="study")
    studyset_id = fields.String(data_key="studyset", load_only=True)
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

    class Meta:
        render_module = orjson

    @post_load
    def add_id(self, data, **kwargs):
        if isinstance(data["analysis_id"], str):
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
    source = fields.String(dump_only=True, metadata={"db_only": True}, allow_none=True)
    source_id = fields.String(
        dump_only=True, metadata={"db_only": True}, allow_none=True
    )
    source_updated_at = fields.DateTime(
        dump_only=True, metadata={"db_only": True}, allow_none=True
    )

    note_keys = fields.Dict()
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    # deserialization
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)

    class Meta:
        additional = ("name", "description")
        allow_none = ("name", "description")
        render_module = orjson

    @pre_load
    def add_studyset_id(self, data, **kwargs):
        if data.get("studyset") and data.get("notes"):
            for note in data["notes"]:
                note["studyset"] = data["studyset"]

        return data

    @pre_dump
    def export_annotations(self, data, **kwargs):
        if getattr(data, "annotation_analyses") and self.context.get("export"):
            annotations = pd.DataFrame.from_records(
                [
                    {"study_id": aa.study_id, "analysis_id": aa.analysis_id, **aa.note}
                    for aa in data.annotation_analyses
                ]
            ).to_csv(index=False)
            metadata = {
                "studyset_id": data.studyset_id,
                "annotation_id": data.id,
                "created_at": data.created_at,
            }
            metadata = {**metadata, **data.metadata_} if data.metadata_ else metadata
            export_data = {"metadata_": metadata, "annotation_csv": annotations}

            return export_data

        return data

    @post_load
    def add_id(self, data, **kwargs):
        if isinstance(data.get("studyset_id"), str):
            data["studyset"] = {"id": data.pop("studyset_id")}
        return data


class JSONLDBaseSchema(BaseSchema):
    id_key = "@id"
    # Serialization fields
    context = fields.Constant(
        {"@vocab": "http://neurostore.org/nimads/"}, data_key="@context", dump_only=True
    )
    _type = fields.Function(
        lambda model: model.__class__.__name__, data_key="@type", dump_only=True
    )

    # De-serialization fields
    id = fields.Method(None, "_extract_id", data_key=id_key, load_only=True)

    def _extract_id(self, iri):
        return iri.strip("/").split("/")[-1]

    @post_dump(pass_original=True)
    def process_jsonld(self, data, original, **kwargs):
        if isinstance(original, (list, tuple)):
            return data
        method = request.args.get("process", "compact")
        context = {"@context": {"@vocab": "http://neurostore.org/nimads/"}}
        if method == "flatten":
            return jsonld.flatten(data, context)
        elif method == "expand":
            return jsonld.expand(data)
        else:
            return jsonld.compact(data, context)


class JSONLDPointSchema(PointSchema):
    # serialization
    analysis = fields.Function(lambda image: image.analysis.IRI, dump_only=True)


class JSONLDImageSchema(ImageSchema):
    # serialization
    analysis = fields.Function(lambda image: image.analysis.IRI, dump_only=True)


class JSONLSAnalysisSchema(AnalysisSchema):
    # serialization
    study = fields.Function(lambda analysis: analysis.study.IRI, dump_only=True)


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
