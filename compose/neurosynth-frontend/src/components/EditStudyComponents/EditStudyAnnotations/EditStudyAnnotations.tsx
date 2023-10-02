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

const hardCodedColumns = ['Analysis', 'Description'];

const EditStudyAnnotations: React.FC = (props) => {
    const { studyId } = useParams<{ studyId: string }>();
    const annotationId = useProjectExtractionAnnotationId();
    const analyses = useStudyAnalyses();

    const { mutate, isLoading: updateAnnotationIsLoading } = useUpdateAnnotationById(annotationId);
    const { data, isLoading: getAnnotationIsLoading, isError } = useGetAnnotationById(annotationId);
    // tracks the changes made to hot table
    const hotTableDataUpdatesRef = useRef<{
        hotData: (string | number | boolean | null)[][];
        noteKeys: NoteKeyType[];
    }>({
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
        if (data) {
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
                    return { ...annotationNote };
                } else {
                    return { ...foundAnnotationNote };
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
            <StateHandlerComponent isLoading={getAnnotationIsLoading} isError={isError}>
                <Box>
                    <AnnotationsHotTable
                        {...initialAnnotationHotState}
                        hardCodedReadOnlyCols={hardCodedColumns}
                        allowAddColumn={false}
                        allowRemoveColumns={false}
                        onChange={handleChange}
                        size="9.5rem"
                    />
                </Box>
                <LoadingButton
                    size="large"
                    text="save"
                    disabled={!annotationIsEdited}
                    isLoading={updateAnnotationIsLoading}
                    loaderColor="secondary"
                    color="primary"
                    variant="contained"
                    sx={{ width: '300px', marginTop: '1rem' }}
                    onClick={handleClickSave}
                />
            </StateHandlerComponent>
        </NeurosynthAccordion>
    );
};

export default EditStudyAnnotations;
