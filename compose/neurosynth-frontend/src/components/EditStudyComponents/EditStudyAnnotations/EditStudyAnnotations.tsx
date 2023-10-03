import { Box, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { DetailedSettings as MergeCellsSettings } from 'handsontable/plugins/mergeCells';
import { ColumnSettings } from 'handsontable/settings';
import { useGetAnnotationById, useUpdateAnnotationById } from 'hooks';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useProjectExtractionAnnotationId } from 'pages/Projects/ProjectPage/ProjectStore';
import { useStudyAnalyses } from 'pages/Studies/StudyStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import AnnotationsHotTable from 'components/EditAnnotations/AnnotationsHotTable/AnnotationsHotTable';
import {
    AnnotationNoteValue,
    NoteKeyType,
    annotationNotesToHotData,
    createColumns,
    hotDataToAnnotationNotes,
    noteKeyArrToObj,
    noteKeyObjToArr,
} from 'components/EditAnnotations/helpers/utils';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import EditStudyComponentsStyles from 'components/EditStudyComponents/EditStudyComponents.styles';
import {
    useAnnotationNoteKeys,
    useSetAnnotationIsEdited,
    useUpdateAnnotationNotes,
} from 'stores/AnnotationStore.actions';
import { useAnnotationNotes } from 'stores/AnnotationStore.getters';

const hardCodedColumns = ['Analysis', 'Description'];

const EditStudyAnnotations: React.FC = (props) => {
    const { studyId } = useParams<{ studyId: string }>();
    const annotationId = useProjectExtractionAnnotationId();
    const analyses = useStudyAnalyses();
    const { data: annotation, isLoading, isError } = useGetAnnotationById(annotationId);
    const setAnnotationIsEdited = useSetAnnotationIsEdited();
    const updateAnnotationNotes = useUpdateAnnotationNotes();

    const notes = useAnnotationNotes();
    const noteKeys = useAnnotationNoteKeys();

    const [initialAnnotationHotState, setInitialAnnotationHotState] = useState<{
        hotDataToStudyMapping: Map<number, { studyId: string; analysisId: string }>;
        noteKeys: NoteKeyType[];
        hotData: AnnotationNoteValue[][];
        hotColumns: ColumnSettings[];
        mergeCells: MergeCellsSettings[];
        size: string;
    }>({
        hotDataToStudyMapping: new Map<number, { studyId: string; analysisId: string }>(),
        noteKeys: [],
        hotData: [],
        hotColumns: [],
        mergeCells: [],
        size: '300px',
    });

    useEffect(() => {
        if (annotation) {
            // const { notes, note_keys } = annotation;

            // const noteKeys = noteKeyObjToArr(note_keys);

            const studyNotes = ((notes as NoteCollectionReturn[]) || []).filter(
                (x) => x.study === studyId
            );

            const { hotData, hotDataToStudyMapping } = annotationNotesToHotData(
                noteKeys,
                studyNotes,
                (annotationNote) => {
                    const analysis = analyses.find((x) => x.id === annotationNote.analysis);
                    return [analysis?.name || '', analysis?.description || ''];
                }
            );

            setInitialAnnotationHotState({
                hotDataToStudyMapping,
                noteKeys,
                hotColumns: createColumns(noteKeys),
                hotData: hotData,
                mergeCells: [],
                size: `${(hotData.length + 1) * 25 > 400 ? 400 : (hotData.length + 1) * 25}px`,
            });
        }
    }, [studyId, analyses, annotation, notes, noteKeys]);

    const handleChange = useCallback(
        (hotData: AnnotationNoteValue[][], noteKeys: NoteKeyType[]) => {
            const convertedAnnotationNotes = hotDataToAnnotationNotes(
                hotData,
                initialAnnotationHotState.hotDataToStudyMapping,
                noteKeys
            );

            const updatedAnnotationNotes = (
                (annotation?.notes || []) as NoteCollectionReturn[]
            ).map((annotationNote) => {
                const annotationNoteWeEdited = convertedAnnotationNotes.find(
                    (x) => x.analysis === annotationNote.analysis
                );
                // if we have not found it (i.e. the annotation is not part of the study annotations we are editing) then we just return a copy of the original.
                // if we have found it, (i.e. the annotation is part of the study annotations we are editing) then we return the version we have edited
                if (!annotationNoteWeEdited) {
                    return { ...annotationNote };
                } else {
                    return { ...annotationNoteWeEdited };
                }
            });

            updateAnnotationNotes(updatedAnnotationNotes);
            setAnnotationIsEdited(true);
        },
        [
            annotation?.notes,
            initialAnnotationHotState.hotDataToStudyMapping,
            setAnnotationIsEdited,
            updateAnnotationNotes,
        ]
    );

    return (
        <NeurosynthAccordion
            elevation={0}
            expandIconColor="secondary.main"
            sx={[
                EditStudyComponentsStyles.accordion,
                { borderTop: '1px solid', borderColor: 'secondary.main' },
            ]}
            accordionSummarySx={EditStudyComponentsStyles.accordionSummary}
            TitleElement={
                <Typography sx={EditStudyComponentsStyles.accordionTitle}>
                    Study Annotations
                </Typography>
            }
        >
            <Box sx={{ height: initialAnnotationHotState.size, padding: '1rem 0' }}>
                <StateHandlerComponent isLoading={isLoading} isError={isError}>
                    <AnnotationsHotTable
                        {...initialAnnotationHotState}
                        hardCodedReadOnlyCols={hardCodedColumns}
                        allowAddColumn={false}
                        allowRemoveColumns={false}
                        onChange={handleChange}
                    />
                </StateHandlerComponent>
            </Box>
        </NeurosynthAccordion>
    );
};

export default EditStudyAnnotations;
