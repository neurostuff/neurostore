import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import { getType, IMetadataRowModel } from 'components/EditMetadata';
import EditMetadata from 'components/EditMetadata/EditMetadata';
import { useGetAnnotationById, useGetStudysetById, useUpdateAnnotationById } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const EditAnalysisAnnotation: React.FC<{ analysisId?: string }> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const [update, setUpdate] = useState<IMetadataRowModel>();
    const [confirmationDialogState, setConfirmationDialogState] = useState<{
        isOpen: boolean;
        data: IMetadataRowModel | undefined;
    }>({
        isOpen: false,
        data: undefined,
    });
    const { data: project } = useGetProjectById(projectId);
    const { data: annotation } = useGetAnnotationById(
        project?.provenance?.extractionMetadata?.annotationId
    );
    const { mutate } = useUpdateAnnotationById(
        project?.provenance?.extractionMetadata?.annotationId
    );
    const [annotationList, setAnnotationList] = useState<IMetadataRowModel[]>([]);

    useEffect(() => {
        if (annotation && props.analysisId) {
            setAnnotationList((prev) => {
                const annotationNotes = (annotation.notes as NoteCollectionReturn[]) || [];

                const thisAnalysisNoteIndex = annotationNotes.findIndex(
                    (annotationNote) => annotationNote.analysis === props.analysisId
                );

                if (thisAnalysisNoteIndex < 0) return [];

                const noteList: IMetadataRowModel[] = [];
                for (const [key, value] of Object.entries(
                    annotationNotes[thisAnalysisNoteIndex].note || {}
                )) {
                    noteList.push({
                        metadataKey: key,
                        metadataValue: value,
                    });
                }

                return noteList;
            });
        }
    }, [annotation, props.analysisId]);

    useEffect(() => {
        setAnnotationList((prev) => {
            if (!update) return prev;
            const updatedVal = [...prev];
            const updatedIndex = updatedVal.findIndex((x) => x.metadataKey === update.metadataKey);
            if (updatedIndex < 0) return prev;

            updatedVal[updatedIndex] = {
                ...updatedVal[updatedIndex],
                metadataValue: update.metadataValue,
            };

            return updatedVal;
        });
        const timeout = setTimeout(() => {
            handleUpdateAnnotationNote(update);
        }, 500);

        return () => {
            clearTimeout(timeout);
        };
    }, [update]);

    const handleDeleteAnnotationNote = (update?: IMetadataRowModel) => {
        if (
            project?.provenance?.extractionMetadata?.annotationId &&
            annotation?.notes &&
            annotation?.note_keys &&
            props?.analysisId &&
            update
        ) {
            const updatedNotes = [...(annotation.notes as NoteCollectionReturn[])];
            const updatedNoteKeys = { ...annotation.note_keys } as {
                [key: string]: string | number | boolean;
            };

            delete updatedNoteKeys[update.metadataKey];

            for (let i = 0; i < updatedNotes.length; i++) {
                const updatedNote = { ...updatedNotes[i].note } as {
                    [key: string]: string | number | boolean;
                };
                delete updatedNote[update.metadataKey];
                updatedNotes[i] = {
                    ...updatedNotes[i],
                    note: updatedNote,
                };
            }

            mutate({
                argAnnotationId: project.provenance.extractionMetadata.annotationId,
                annotation: {
                    note_keys: updatedNoteKeys,
                    notes: updatedNotes.map((note) => ({
                        note: note.note,
                        analysis: note.analysis,
                        study: note.study,
                    })),
                },
            });
        }
    };

    const handleUpdateAnnotationNote = (update?: IMetadataRowModel) => {
        if (
            project?.provenance?.extractionMetadata?.annotationId &&
            update &&
            annotation?.notes &&
            annotation?.note_keys &&
            props?.analysisId
        ) {
            const updatedNotes = [...(annotation.notes as NoteCollectionReturn[])];
            const analysisNoteToUpdateIndex = updatedNotes.findIndex(
                (x) => x.analysis === props.analysisId
            );

            if (analysisNoteToUpdateIndex < 0) return;

            updatedNotes[analysisNoteToUpdateIndex] = {
                ...updatedNotes[analysisNoteToUpdateIndex],
                note: {
                    ...updatedNotes[analysisNoteToUpdateIndex].note,
                    [update.metadataKey]: update.metadataValue,
                },
            };

            mutate({
                argAnnotationId: project.provenance.extractionMetadata.annotationId,
                annotation: {
                    notes: updatedNotes.map((note) => ({
                        note: note.note,
                        analysis: note.analysis,
                        study: note.study,
                    })),
                },
            });
        }
    };

    const handleAddAnnotationNote = (update: IMetadataRowModel) => {
        if (
            project?.provenance?.extractionMetadata?.annotationId &&
            annotation?.notes &&
            annotation?.note_keys
        ) {
            const updatedNotes = [...(annotation.notes as NoteCollectionReturn[])];
            const updatedNoteKeys = { ...annotation.note_keys } as {
                [key: string]: string | number | boolean;
            };

            if (updatedNoteKeys[update.metadataKey] !== undefined) return false;

            updatedNoteKeys[update.metadataKey] = getType(update.metadataValue);

            for (let i = 0; i < updatedNotes.length; i++) {
                updatedNotes[i] = {
                    ...updatedNotes[i],
                    note: {
                        ...updatedNotes[i].note,
                        [update.metadataKey]: update.metadataValue,
                    },
                };
            }

            mutate({
                argAnnotationId: project.provenance.extractionMetadata.annotationId,
                annotation: {
                    note_keys: updatedNoteKeys,
                    notes: updatedNotes.map((note) => ({
                        note: note.note,
                        analysis: note.analysis,
                        study: note.study,
                    })),
                },
            });
            return true;
        }

        return false;
    };

    return (
        <>
            <ConfirmationDialog
                dialogTitle="Are you sure you want to delete this annotation key?"
                dialogMessage="This key will be deleted for all other analyses in each study within this studyset"
                isOpen={confirmationDialogState.isOpen}
                data={confirmationDialogState.data}
                onCloseDialog={(confirm, confirmationData) => {
                    setConfirmationDialogState((prev) => ({ ...prev, isOpen: false }));
                    if (confirm) handleDeleteAnnotationNote(confirmationData);
                }}
            />
            <EditMetadata
                keyPlaceholderText="annotation key"
                valuePlaceholderText="default value for all analyses for this key"
                metadata={annotationList}
                onMetadataRowAdd={handleAddAnnotationNote}
                onMetadataRowDelete={(update) =>
                    setConfirmationDialogState({
                        isOpen: true,
                        data: update,
                    })
                }
                onMetadataRowEdit={(u) => setUpdate(u)}
            />
        </>
    );
};

export default EditAnalysisAnnotation;
