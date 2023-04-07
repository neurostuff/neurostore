import { useProjectExtractionAnnotationId } from 'pages/Projects/ProjectPage/ProjectStore';
import { Box } from '@mui/material';
import { useGetAnnotationById, useUpdateAnnotationById } from 'hooks';
import AnnotationsHotTable from './AnnotationsHotTable/AnnotationsHotTable';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    AnnotationNoteValue,
    NoteKeyType,
    annotationNotesToHotData,
    hotDataToAnnotationNotes,
    noteKeyArrToObj,
    noteKeyObjToArr,
} from './helpers/utils';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { ColumnSettings } from 'handsontable/settings';
import { DetailedSettings as MergeCellsSettings } from 'handsontable/plugins/mergeCells';
import { createColumns } from './helpers/utils';
import { useParams } from 'react-router-dom';
import { useStudyAnalyses } from 'pages/Studies/StudyStore';

const hardCodedColumns = ['Analysis', 'Description'];

const EditStudyAnnotations: React.FC = (props) => {
    const { studyId } = useParams<{ studyId: string }>();
    const annotationId = useProjectExtractionAnnotationId();
    const analyses = useStudyAnalyses();
    const { mutate, isLoading: updateAnnotationIsLoading } = useUpdateAnnotationById(annotationId);
    const { data, isLoading: getAnnotationIsLoading, isError } = useGetAnnotationById(annotationId);

    // tracks the changes made to hot table
    const hotTableDataUpdatesRef = useRef<{
        initialized: boolean;
        hotData: (string | number | boolean | null)[][];
        noteKeys: NoteKeyType[];
    }>({
        initialized: false,
        hotData: [],
        noteKeys: [],
    });
    const [annotationIsEdited, setAnnotationIsEdited] = useState(false);
    const [initialAnnotationHotState, setInitialAnnotationHotState] = useState<{
        hotDataToStudyMapping: Map<number, { studyId: string; analysisId: string }>;
        noteKeys: NoteKeyType[];
        hotData: AnnotationNoteValue[][];
        hotColumns: ColumnSettings[];
        mergeCells: MergeCellsSettings[];
    }>({
        hotDataToStudyMapping: new Map<number, { studyId: string; analysisId: string }>(),
        noteKeys: [],
        hotData: [],
        hotColumns: [],
        mergeCells: [],
    });

    useEffect(() => {
        if (data && !hotTableDataUpdatesRef.current.initialized) {
            hotTableDataUpdatesRef.current.initialized = true;
            const noteKeys = noteKeyObjToArr(data.note_keys);

            const studyNotes = ((data.notes as NoteCollectionReturn[]) || []).filter(
                (x) => x.study === studyId
            );

            const { hotData, hotDataToStudyMapping } = annotationNotesToHotData(
                noteKeys,
                studyNotes,
                (annotationNote) => {
                    const analysis = analyses.find((x) => x.id === annotationNote.analysis);
                    return [annotationNote.analysis_name || '', analysis?.description || ''];
                }
            );

            setInitialAnnotationHotState({
                hotDataToStudyMapping,
                noteKeys,
                hotColumns: createColumns(noteKeys),
                hotData: hotData,
                mergeCells: [],
            });
        }
    }, [data, studyId, analyses]);

    const handleClickSave = () => {
        if (!annotationId) return;

        const { hotData, noteKeys } = hotTableDataUpdatesRef.current;

        const convertedAnnotationNotes = hotDataToAnnotationNotes(
            hotData,
            initialAnnotationHotState.hotDataToStudyMapping,
            noteKeys
        );
        const updatedNoteKeyObj = noteKeyArrToObj(noteKeys);

        const updatedAnnotationNotes = ((data?.notes || []) as NoteCollectionReturn[]).map(
            (annotationNote) => {
                const foundAnnotationNote = convertedAnnotationNotes.find(
                    (x) => x.analysis === annotationNote.analysis
                );
                // if we have not found it (i.e. the annotation is not part of the study annotations we are editing) then we just return a copy of the original.
                // if we have found it, (i.e. the annotation is part of the study annotations we are editing) then we return the version we have edited
                if (!foundAnnotationNote) {
                    return {
                        ...annotationNote,
                    };
                } else {
                    return {
                        ...foundAnnotationNote,
                    };
                }
            }
        );

        mutate(
            {
                argAnnotationId: annotationId,
                annotation: {
                    notes: updatedAnnotationNotes.map((annotationNote) => ({
                        note: annotationNote.note,
                        analysis: annotationNote.analysis,
                        study: annotationNote.study,
                    })),
                    note_keys: updatedNoteKeyObj,
                },
            },
            {
                onSuccess: () => {
                    setAnnotationIsEdited(false);
                },
            }
        );
    };

    const handleChange = useCallback(
        (hotData: AnnotationNoteValue[][], noteKeys: NoteKeyType[]) => {
            setAnnotationIsEdited(true);
            hotTableDataUpdatesRef.current = {
                ...hotTableDataUpdatesRef.current,
                hotData,
                noteKeys,
            };
        },
        []
    );

    return (
        <StateHandlerComponent isLoading={getAnnotationIsLoading} isError={isError}>
            <Box>
                <AnnotationsHotTable
                    {...initialAnnotationHotState}
                    hardCodedReadOnlyCols={hardCodedColumns}
                    allowAddColumn={false}
                    allowRemoveColumns={false}
                    onChange={handleChange}
                />
            </Box>
            <Box
                sx={{
                    position: 'fixed',
                    bottom: 0,
                    zIndex: 999,
                    width: {
                        xs: '90%',
                        md: '80%',
                    },
                    padding: '1rem 0 1.5rem 0',
                    backgroundColor: 'white',
                    textAlign: 'end',
                }}
            >
                <LoadingButton
                    size="large"
                    text="save"
                    disabled={!annotationIsEdited}
                    isLoading={updateAnnotationIsLoading}
                    loaderColor="secondary"
                    color="primary"
                    variant="contained"
                    sx={{ width: '300px' }}
                    onClick={handleClickSave}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default EditStudyAnnotations;
