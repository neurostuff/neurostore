from marshmallow import (
    fields,
    Schema,
    SchemaOpts,
    post_dump,
    pre_dump,
    pre_load,
    post_load,
    validates_schema,
    EXCLUDE,
    ValidationError,
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
# preserve_on_clone: field metadata to preserve original values when cloning


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
        self.many = kwargs.pop("many", False)
        super().__init__(*args, **kwargs)

    def _serialize_single(self, value):
        if value is None:
            return None
        if isinstance(value, dict):
            # Already serialized payload
            return value.get("id") if "id" in value else value
        if hasattr(value, "id"):
            return str(value.id)
        return str(value)

    def _serialize(self, value, attr, obj, **kwargs):
        if self.many:
            return [self._serialize_single(v) for v in value]
        return self._serialize_single(value)

    def _deserialize(self, value, attr, data, **kwargs):
        if self.many:
            return [
                (
                    {"id": v}
                    if isinstance(v, (str, int))
                    else (v if isinstance(v, dict) else {"id": getattr(v, "id", v)})
                )
                for v in value
            ]
        if isinstance(value, (str, int)):
            return {"id": value}
        if isinstance(value, dict):
            return value
        if hasattr(value, "id"):
            return {"id": value.id}
        return {"id": value}


class StringOrNested(fields.Nested):
    """Handle read/write only fields. Handle nested serialization/deserialization"""

    def __init__(self, nested, *args, **kwargs):
        super().__init__(nested, **kwargs)
        self.string_field = ObjToString(*args, **kwargs)
        self._explicit_context = {}

    @property
    def context(self):
        if self._explicit_context:
            return self._explicit_context
        parent = getattr(self, "parent", None)
        if parent is not None and hasattr(parent, "context"):
            return parent.context
        return {}

    @context.setter
    def context(self, value):
        self._explicit_context = value or {}

    def _modify_schema(self):
        """Only relevant when nested=True"""
        schema = self.schema
        schema.context = self.context
        if self.context.get("clone"):
            # Check if this schema has preserve_on_clone set for any id field
            has_preserve_on_clone = any(
                f_obj.metadata.get("id_field")
                and f_obj.metadata.get("preserve_on_clone")
                for f_obj in schema._declared_fields.values()
            )

            if has_preserve_on_clone:
                # For schemas with preserve_on_clone,
                # include ONLY id fields with preserve_on_clone=True
                preserve_fields = [
                    field
                    for field, f_obj in schema._declared_fields.items()
                    if f_obj.metadata.get("id_field")
                    and f_obj.metadata.get("preserve_on_clone")
                ]
                if preserve_fields:
                    schema.only = schema.set_class(preserve_fields)
                    schema.exclude = schema.set_class()
            else:
                # Normal cloning behavior: exclude id fields without preserve_on_clone
                id_fields = [
                    field
                    for field, f_obj in schema._declared_fields.items()
                    if f_obj.metadata.get("id_field")
                    and not f_obj.metadata.get("preserve_on_clone")
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


class StudysetStudiesField(StringOrNested):
    """Avoid loading Studyset.studies when only IDs are needed."""

    def get_value(self, obj, attr, accessor=None, default=None):
        if not self.context.get("nested") and not self.context.get("info"):
            assoc = getattr(obj, "studyset_studies", None)
            if assoc is not None:
                return [link.study_id for link in assoc]
        try:
            return super().get_value(obj, attr, accessor=accessor, default=default)
        except TypeError:
            return super().get_value(obj, attr, accessor=accessor)


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
        context = kwargs.pop("context", {})
        only = kwargs.get("only")

        # if cloning and not only id, exclude id fields (unless preserve_on_clone is True)
        if context.get("clone") and only != ("id",):
            # Check if this schema has preserve_on_clone set for any id field
            has_preserve_on_clone = any(
                f_obj.metadata.get("id_field")
                and f_obj.metadata.get("preserve_on_clone")
                for f_obj in self._declared_fields.values()
            )

            if has_preserve_on_clone:
                # For schemas with preserve_on_clone,
                # include ONLY id fields with preserve_on_clone=True
                preserve_fields = [
                    field
                    for field, f_obj in self._declared_fields.items()
                    if f_obj.metadata.get("id_field")
                    and f_obj.metadata.get("preserve_on_clone")
                ]
                if preserve_fields and only is None:
                    kwargs["only"] = tuple(preserve_fields)
            else:
                # Normal cloning behavior: exclude id fields
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
        self.context = context or {}

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
        dump_default=None,
    )
    created_at = fields.DateTime(dump_only=True, metadata={"info_field": True})
    updated_at = fields.DateTime(dump_only=True, metadata={"info_field": True})


class ConditionSchema(BaseDataSchema):
    name = fields.String(allow_none=True)
    description = fields.String(allow_none=True)

    # Override the id field to preserve it during cloning
    id = fields.String(
        metadata={"info_field": True, "id_field": True, "preserve_on_clone": True}
    )


class EntitySchema(BaseDataSchema):
    analysis_id = fields.String(data_key="analysis", metadata={"id_field": True})

    level = fields.String(allow_none=True)
    label = fields.String(allow_none=True)


class ImageSchema(BaseDataSchema):
    # serialization
    analysis_id = fields.String(data_key="analysis", metadata={"id_field": True})
    # analysis = fields.Pluck("AnalysisSchema", "id", metadata={"id_field": True})
    analysis_name = fields.String(allow_none=True, dump_only=True)
    add_date = fields.DateTime(dump_only=True)
    url = fields.String(allow_none=True)
    filename = fields.String(allow_none=True)
    space = fields.String(allow_none=True)
    value_type = fields.String(allow_none=True)


class PointValueSchema(BaseSchema):
    kind = fields.String(allow_none=True)
    value = fields.Float(allow_none=True)


class PointSchema(BaseDataSchema):
    # serialization
    analysis_id = fields.String(data_key="analysis", metadata={"id_field": True})
    # analysis = fields.Pluck("AnalysisSchema", "id", metadata={"id_field": True})
    values = fields.Nested(PointValueSchema, many=True)
    entities = fields.Nested(EntitySchema, many=True, load_only=True)
    cluster_size = fields.Float(allow_none=True)
    cluster_measurement_unit = fields.String(allow_none=True)
    subpeak = fields.Boolean(allow_none=True)
    deactivation = fields.Boolean(load_default=False, allow_none=True)
    order = fields.Integer()
    coordinates = fields.List(fields.Float(), dump_only=True)
    kind = fields.String(allow_none=True)
    space = fields.String(allow_none=True)
    image = fields.String(allow_none=True)
    label_id = fields.Float(allow_none=True)

    # deserialization
    x = fields.Float(load_only=True, allow_none=True)
    y = fields.Float(load_only=True, allow_none=True)
    z = fields.Float(load_only=True, allow_none=True)

    @pre_load
    def process_values(self, data, **kwargs):
        # Handle case where data might be a string ID instead of dict
        if not isinstance(data, dict):
            return data

        # Only process coordinates if they exist in the data
        if "coordinates" in data and data["coordinates"] is not None:
            coords = data.pop("coordinates")

            # Check if all coordinates are null
            if all(c is None for c in coords):
                # During cloning, allow null coordinates but store them as None
                if self.context.get("clone"):
                    data["x"], data["y"], data["z"] = None, None, None
                else:
                    # Don't save points with all null coordinates to database
                    raise ValidationError("Points cannot have all null coordinates")
            else:
                # Convert coordinates to float, handling potential null values
                try:
                    converted_coords = [
                        float(c) if c is not None else None for c in coords
                    ]
                    data["x"], data["y"], data["z"] = converted_coords
                except (TypeError, ValueError) as e:
                    raise ValidationError(f"Invalid coordinate values: {e}")

        if data.get("order") is None:
            # Extract analysis_id first, then check if it exists
            analysis_id = data.get("analysis_id") or (
                data.get("analysis") if isinstance(data.get("analysis"), str) else None
            )

            if analysis_id:
                max_order = (
                    db.session.query(func.max(Point.order))
                    .filter_by(analysis_id=analysis_id)
                    .scalar()
                )
                data["order"] = 1 if max_order is None else max_order + 1
            else:
                data["order"] = 1

        # Convert deactivation None to False
        if data.get("deactivation") is None:
            data["deactivation"] = False

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
    # expose only the study id and optional stub mapping; keep everything else load-only
    id = fields.Function(lambda obj: getattr(obj, "study_id", None), dump_only=True)
    study_id = fields.String(load_only=True)  # primary key needed (no id_field)
    studyset_id = fields.String(load_only=True)  # primary key needed (no id_field)
    curation_stub_uuid = fields.String(allow_none=True)


class AnalysisSchema(BaseDataSchema):
    # serialization
    study_id = fields.String(data_key="study", metadata={"id_field": True})
    table_id = fields.String(
        data_key="table_id", allow_none=True, metadata={"id_field": True}
    )
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
    name = fields.String(allow_none=True)
    description = fields.String(allow_none=True)

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


class TableSchema(BaseDataSchema):
    study_id = fields.String(data_key="study", metadata={"id_field": True})
    t_id = fields.String(allow_none=True)
    name = fields.String(allow_none=True)
    table_label = fields.String(allow_none=True)
    footer = fields.String(allow_none=True)
    caption = fields.String(allow_none=True)
    analyses = StringOrNested(AnalysisSchema, many=True, dump_only=True)


class StudySetStudyInfoSchema(Schema):
    id = fields.String(dump_only=True)
    name = fields.String(dump_only=True)
    description = fields.String(dump_only=True)


class BaseStudySchema(BaseDataSchema):
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)
    name = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    publication = fields.String(allow_none=True)
    doi = fields.String(allow_none=True)
    pmid = fields.String(allow_none=True)
    pmcid = fields.String(allow_none=True)
    authors = fields.String(allow_none=True)
    year = fields.Integer(allow_none=True)
    level = fields.String(allow_none=True)
    is_oa = fields.Boolean(allow_none=True)
    versions = StringOrNested("StudySchema", many=True)
    features = fields.Method("get_features")
    ace_fulltext = fields.String(load_only=True, allow_none=True)
    pubget_fulltext = fields.String(load_only=True, allow_none=True)

    def get_features(self, obj):
        from .pipeline import PipelineStudyResultSchema

        pipelines = self.context.get("feature_display", None)
        pipeline_configs = self.context.get("pipeline_config", None)

        if pipelines is None:
            return {}

        features = obj.display_features(pipelines, pipeline_configs)
        # Flatten each pipeline's predictions
        if features and self.context.get("feature_flatten", False):
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

    @pre_load
    def check_nulls(self, data, **kwargs):
        """
        Sanitize input fields:
        - Replace empty/whitespace strings with None
        - Remove common DOI prefixes
        - Add PMC prefix to numeric PMCIDs
        """
        # Replace empty strings with None for all fields
        text_fields = [
            "name",
            "description",
            "publication",
            "doi",
            "pmid",
            "pmcid",
            "authors",
        ]
        for attr in text_fields:
            val = data.get(attr, None)
            if isinstance(val, str) and (val == "" or val.isspace()):
                data[attr] = None

        # Clean DOI
        if data.get("doi"):
            for prefix in ["https://doi.org/", "https://dx.doi.org/"]:
                if data["doi"].startswith(prefix):
                    data["doi"] = data["doi"][len(prefix) :]  # noqa: E203
                    break

        # Add PMC prefix to numeric PMCIDs
        if data.get("pmcid") and data["pmcid"].isdigit():
            data["pmcid"] = f"PMC{data['pmcid']}"

        return data


class StudySchema(BaseDataSchema):
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)
    name = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    publication = fields.String(allow_none=True)
    doi = fields.String(allow_none=True)
    pmid = fields.String(allow_none=True)
    pmcid = fields.String(allow_none=True)
    authors = fields.String(allow_none=True)
    year = fields.Integer(allow_none=True)
    level = fields.String(allow_none=True)
    analyses = StringOrNested(AnalysisSchema, many=True)
    tables = fields.Method("get_table_ids", dump_only=True)
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

    @pre_load
    def check_nulls(self, data, **kwargs):
        """ensure data is not empty string or whitespace"""
        if not isinstance(data, dict):
            return data
        for attr in ["pmid", "pmcid", "doi"]:
            val = data.get(attr, None)
            if val is not None and (val == "" or val.isspace()):
                data[attr] = None
        return data

    def get_table_ids(self, obj):
        if not getattr(obj, "tables", None):
            return []
        return [getattr(table, "id", table) for table in obj.tables]


class StudysetSchema(BaseDataSchema):
    # serialize
    studies = StudysetStudiesField(
        StudySchema, many=True
    )  # This needs to be nested, but not cloned
    # expose association records for stub mapping
    studyset_studies = fields.Nested("StudysetStudySchema", many=True, dump_only=True)
    curation_stub_map = fields.Dict(load_only=True)
    source = fields.String(dump_only=True, allow_none=True)
    source_id = fields.String(dump_only=True, allow_none=True)
    source_updated_at = fields.DateTime(dump_only=True, allow_none=True)
    name = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    publication = fields.String(allow_none=True)
    doi = fields.String(allow_none=True)
    pmid = fields.String(allow_none=True)

    class Meta:
        render_module = orjson

    @pre_load
    def capture_curation_stub_uuids(self, data, **kwargs):
        if not isinstance(data, dict):
            return data

        # Always derive stub mapping from inline study payload; ignore any incoming map.
        data.pop("curation_stub_map", None)
        studies = data.get("studies")
        if not studies:
            return data

        stub_map = {}
        cleaned = []
        for item in studies:
            if isinstance(item, dict):
                stub = item.get("curation_stub_uuid")
                study_id = item.get("id")
                if stub and study_id:
                    stub_map[study_id] = stub
                cleaned.append(
                    {k: v for k, v in item.items() if k != "curation_stub_uuid"}
                )
            else:
                # Downstream schemas (e.g., StudySchema) expect each study
                # to be an object with at least an 'id' key.
                # This normalization ensures that string study IDs
                # are converted to the required object form,
                # enabling proper deserialization and validation by those schemas.
                cleaned.append({"id": item})

        data["studies"] = cleaned
        if stub_map:
            data["curation_stub_map"] = stub_map

        return data

    @post_dump
    def normalize_studyset_studies(self, data, **kwargs):
        """
        Emit minimal association records with id and optional curation_stub_uuid.
        If there is no stub mapping, return the study id with curation_stub_uuid as null.
        """
        if "studyset_studies" in data and data["studyset_studies"] is not None:
            normalized = []
            for assoc in data["studyset_studies"]:
                normalized.append(
                    {
                        "id": assoc.get("id") or assoc.get("study_id"),
                        "curation_stub_uuid": assoc.get("curation_stub_uuid"),
                    }
                )
            data["studyset_studies"] = normalized
        return data


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


class AnnotationPipelineSchema(BaseSchema):
    name = fields.String(required=True)
    version = fields.String(load_default=None, allow_none=True)
    config_id = fields.String(load_default=None, allow_none=True)
    columns = fields.List(fields.String(), required=True)


class NoteKeysField(fields.Field):
    allowed_types = {"string", "number", "boolean"}

    def _serialize(self, value, attr, obj, **kwargs):
        if not value:
            return {}
        serialized = {}
        for key, descriptor in value.items():
            if not isinstance(descriptor, dict):
                continue
            serialized[key] = {
                "type": descriptor.get("type"),
                "order": descriptor.get("order"),
            }
        return serialized

    def _deserialize(self, value, attr, data, **kwargs):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValidationError("`note_keys` must be an object.")

        normalized = {}
        used_orders = set()
        explicit_orders = []
        for descriptor in value.values():
            if isinstance(descriptor, dict) and isinstance(
                descriptor.get("order"), int
            ):
                explicit_orders.append(descriptor["order"])
        next_order = max(explicit_orders, default=-1) + 1

        for key, descriptor in value.items():
            if not isinstance(descriptor, dict):
                raise ValidationError("Each note key must map to an object.")

            note_type = descriptor.get("type")
            if note_type not in self.allowed_types:
                raise ValidationError(
                    f"Invalid note type for '{key}', choose from: {sorted(self.allowed_types)}"
                )

            order = descriptor.get("order")
            if isinstance(order, bool) or (
                order is not None and not isinstance(order, int)
            ):
                order = None

            if isinstance(order, int) and order not in used_orders:
                used_orders.add(order)
                if order >= next_order:
                    next_order = order + 1
            else:
                while next_order in used_orders:
                    next_order += 1
                order = next_order
                used_orders.add(order)
                next_order += 1

            normalized[key] = {"type": note_type, "order": order}

        return normalized


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

    note_keys = NoteKeysField()
    metadata = fields.Dict(attribute="metadata_", dump_only=True)
    # deserialization
    metadata_ = fields.Dict(data_key="metadata", load_only=True, allow_none=True)
    name = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    pipelines = fields.List(
        fields.Nested(AnnotationPipelineSchema), load_only=True, required=False
    )

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

    @validates_schema
    def validate_notes(self, data, **kwargs):
        notes = data.get("annotation_analyses") or []
        invalid = {}

        for idx, note in enumerate(notes):
            note_payload = note.get("note") if isinstance(note, dict) else None
            if not isinstance(note_payload, dict) or len(note_payload) == 0:
                invalid[idx] = ["note must include at least one field"]

        if invalid:
            raise ValidationError({"notes": invalid})

    @pre_dump
    def sort_notes(self, annotation, **kwargs):
        notes = getattr(annotation, "annotation_analyses", None)
        if not notes:
            return annotation

        def sort_key(note):
            study_id = getattr(note, "study_id", None) or ""
            analysis = getattr(note, "analysis", None)
            order = getattr(analysis, "order", None)
            if isinstance(order, bool) or not isinstance(order, int):
                order = None
            if order is not None:
                return (study_id, 0, order, note.analysis_id or "")

            created_at = getattr(analysis, "created_at", None) or getattr(
                note, "created_at", None
            )
            created_ts = created_at.timestamp() if created_at else 0
            return (study_id, 1, created_ts, note.analysis_id or "")

        annotation.annotation_analyses = sorted(notes, key=sort_key)
        return annotation


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
            # Include association records so the frontend can
            # maintain stub mappings even in nested responses.
            "studyset_studies": [
                {
                    "id": assoc.study_id,
                    "curation_stub_uuid": getattr(assoc, "curation_stub_uuid", None),
                }
                for assoc in getattr(studyset, "studyset_studies", []) or []
            ],
        }
