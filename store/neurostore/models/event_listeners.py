import traceback
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import joinedload
from flask_sqlalchemy.session import Session
import time
from sqlalchemy import event
from .data import (
    AnnotationAnalysis,
    Annotation,
    Studyset,
    StudysetStudy,
    BaseStudy,
    Study,
    Analysis,
    Point,
    Image,
    _check_type,
)

from ..database import db


def check_note_columns(mapper, connection, annotation):
    """ensure note_keys and notes in annotationanalyses are consistent"""

    note_keys = annotation.note_keys
    aa_list = annotation.annotation_analyses
    any_notes = any([aa.note for aa in aa_list])
    if not any_notes:
        # there are no notes to check
        return
    if not note_keys and any_notes:
        raise SQLAlchemyError("Cannot have empty note_keys with annotations")
    for aa in aa_list:
        if set(note_keys.keys()) != set(aa.note.keys()):
            msg = "ERROR: "
            nk_set = set(note_keys.keys())
            aa_set = set(aa.note.keys())
            if nk_set - aa_set:
                msg = msg + f"Annotations are missing these keys: {nk_set - aa_set}. "
            if aa_set - nk_set:
                msg = msg + f"Annotations have extra keys: {aa_set - nk_set}."
            raise SQLAlchemyError(msg)

        for key, _type in note_keys.items():
            aa_type = _check_type(aa.note[key])
            if aa_type is not None and aa_type != _type:
                raise SQLAlchemyError(f"value for key {key} is not of type {_type}")


def create_blank_notes(studyset, annotation, initiator):
    if not annotation.annotation_analyses:
        annotation_analyses = []
        for dset_study in studyset.studyset_studies:
            for analysis in dset_study.study.analyses:
                annotation_analyses.append(
                    AnnotationAnalysis(
                        study_id=dset_study.study.id,
                        studyset_id=studyset.id,
                        annotation_id=annotation.id,
                        analysis_id=analysis.id,
                        analysis=analysis,
                        annotation=annotation,
                        studyset_study=dset_study,
                    )
                )
        # cache.delete(f"/api/annotations/{annotation.id}")
        db.session.add_all(annotation_analyses)


def add_annotation_analyses_studyset(studyset, studies, collection_adapter):
    if not (inspect(studyset).pending or inspect(studyset).transient):
        studyset = (
            Studyset.query.filter_by(id=studyset.id)
            .options(
                joinedload(Studyset.studies).options(joinedload(Study.analyses)),
                joinedload(Studyset.annotations),
            )
            .one()
        )
    all_studies = set(studyset.studies + studies)
    existing_studies = [
        s for s in all_studies if not (inspect(s).pending or inspect(s).transient)
    ]
    study_query = (
        Study.query.filter(Study.id.in_([s.id for s in existing_studies]))
        .options(joinedload(Study.analyses))
        .all()
    )

    all_studies.union(set(study_query))

    all_analyses = [analysis for study in studies for analysis in study.analyses]
    existing_analyses = [
        analysis for study in studyset.studies for analysis in study.analyses
    ]
    new_analyses = set(all_analyses) - set(existing_analyses)
    new_aas = []
    for annot in studyset.annotations:
        # cache.delete(f"/api/annotations/{annot.id}")
        for analysis in new_analyses:
            keys = annot.note_keys.keys()
            new_aas.append(
                AnnotationAnalysis(
                    study_id=analysis.study_id,
                    studyset_id=studyset.id,
                    annotation_id=annot.id,
                    analysis_id=analysis.id,
                    note={} if not keys else {k: None for k in keys},
                    analysis=analysis,
                    annotation=annot,
                )
            )
    # cache.delete("/api/annotations/")
    if new_aas:
        db.session.add_all(new_aas)


def add_annotation_analyses_study(study, analyses, collection_adapter):
    if not (inspect(study).pending or inspect(study).transient):
        study = (
            Study.query.filter_by(id=study.id)
            .options(
                joinedload(Study.analyses),
                joinedload(Study.studyset_studies)
                .joinedload(StudysetStudy.studyset)
                .joinedload(Studyset.annotations),
            )
            .one()
        )
    new_analyses = set(analyses) - set([a for a in study.analyses])

    all_annotations = set(
        [annot for sss in study.studyset_studies for annot in sss.studyset.annotations]
    )

    new_aas = []
    for analysis in new_analyses:
        for annot in all_annotations:
            # cache.delete(f"/api/annotations/{annot.id}")
            keys = annot.note_keys.keys()
            new_aas.append(
                AnnotationAnalysis(
                    study_id=study.id,
                    studyset_id=annot.studyset_id,
                    annotation_id=annot.id,
                    analysis_id=analysis.id,
                    note={} if not keys else {k: None for k in keys},
                    analysis=analysis,
                    annotation=annot,
                )
            )
    # cache.delete("/api/annotations/")
    if new_aas:
        db.session.add_all(new_aas)


# ensure all keys are the same across all notes
event.listen(Annotation, "before_insert", check_note_columns, retval=True)


# create notes when annotation is first created
event.listen(Studyset.annotations, "append", create_blank_notes)


# ensure new annotation_analyses are added when study is added to studyset
event.listen(Studyset.studies, "bulk_replace", add_annotation_analyses_studyset)

event.listen(Study.analyses, "bulk_replace", add_annotation_analyses_study)


@event.listens_for(Session, "after_flush_postexec")
def receive_after_flush_postexec(session, flush_context):
    "listen for the 'after_flush_postexec' event"
    base_studies = getattr(flush_context, "base_studies_to_update", [])
    for bs in base_studies:
        bs.update_has_images_and_points()
    setattr(flush_context, "base_studies_to_update", [])


@event.listens_for(Session, "before_flush")
def before_flush(session, flush_context, instances):
    """Update the base study attributes has_coordinates and has_images"""
    # TODO: check for lazy loads here
    changed_objects = set(session.dirty) | set(session.new) | set(session.deleted)

    # Find unique BaseStudies affected by the changes
    def get_nested_attr(obj, nested_attr):
        attrs = nested_attr.split(".")
        result = obj
        for attr in attrs:
            result = getattr(result, attr, None)
            if result is None:
                return
        return result

    def get_base_study(obj):
        base_study = None

        if isinstance(obj, (Point, Image)):
            if obj in session.new or session.deleted:
                base_study = get_nested_attr(obj, "analysis.study.base_study")
        elif isinstance(obj, Analysis):
            relevant_attrs = ("study", "points", "images")
            for attr in relevant_attrs:
                attr_history = get_nested_attr(inspect(obj), f"attrs.{attr}.history")
                if attr_history.added or attr_history.deleted:
                    base_study = get_nested_attr(obj, "study.base_study")
                    break
        elif isinstance(obj, Study):
            relevant_attrs = ("base_study", "analyses")
            for attr in relevant_attrs:
                attr_history = get_nested_attr(inspect(obj), f"attrs.{attr}.history")
                if attr_history.added or attr_history.deleted:
                    base_study = obj.base_study
                    break
        elif isinstance(obj, BaseStudy):
            relevant_attrs = ("versions",)
            for attr in relevant_attrs:
                attr_history = get_nested_attr(inspect(obj), f"attrs.{attr}.history")
                if attr_history.added or attr_history.deleted:
                    base_study = obj
                    break

        return base_study

    unique_base_studies = {
        base_study
        for base_study in [get_base_study(obj) for obj in changed_objects]
        if base_study is not None and base_study not in session.deleted
    }

    setattr(flush_context, "base_studies_to_update", unique_base_studies)


# @event.listens_for(Engine, "before_cursor_execute")
# def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
#     if (
#         (not any([ ('ingest_' in a and "before_cursor_execute" not in a) for a in traceback.format_stack()]))
#         and (any([ ('_emit_lazyload' in a and "before_cursor_execute" not in a) for a in traceback.format_stack()]))
#         and (not any([ ('conftest' in a and "before_cursor_execute" not in a) for a in traceback.format_stack()]))
#         and ("SELECT" in statement or "INSERT" in statement or "UPDATE" in statement)
#     ):
#         conn.info.setdefault("query_start_time", []).append(time.time())


# @event.listens_for(Engine, "after_cursor_execute")
# def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
#     # total = time.time() - conn.info["query_start_time"].pop(-1)
#     pass
