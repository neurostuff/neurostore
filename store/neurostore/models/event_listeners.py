from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import event
from .data import (
    AnnotationAnalysis, Annotation, Studyset, Study, Analysis, Point, Image, _check_type
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


# Define an event listener to update Base-Study flags
@event.listens_for(Analysis.points, 'append')
@event.listens_for(Analysis.points, 'remove')
@event.listens_for(Analysis.images, 'append')
@event.listens_for(Analysis.images, 'remove')
def update_base_study_flags(target, value, initiator):
    base_study = getattr(getattr(target, 'study', None), 'base_study', None)
    updated = False
    if base_study is not None:
        base_study.has_coordinates = isinstance(value, Point) or any(
            analysis.points for study in base_study.versions for analysis in study.analyses
        )
        base_study.has_images = isinstance(value, Image) or any(
            analysis.images for study in base_study.versions for analysis in study.analyses
        )
        db.session.add(base_study)
        updated = True

    return updated


@event.listens_for(db.session, 'after_flush')
def update_base_study_flags_item_delete(session, flush_context):
    any_updates = False
    for obj in session.deleted:
        if isinstance(obj, (Point, Image)):
            target = obj.analysis_id
            value = obj
            initiator = "DELETE"
            res = update_base_study_flags(target, value, initiator)
            if not any_updates and res:
                any_updates = True

    if any_updates:
        db.session.commit()
