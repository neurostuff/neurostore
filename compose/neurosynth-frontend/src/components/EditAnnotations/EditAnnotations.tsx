import { useProjectExtractionAnnotationId } from 'pages/Projects/ProjectPage/ProjectStore';
import { Box, Button } from '@mui/material';
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

const EditAnnotations: React.FC = (props) => {
    const annotationId = useProjectExtractionAnnotationId();
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
        hotData: (string | number | boolean | null)[][];
    }>({
        hotDataToStudyMapping: new Map<number, { studyId: string; analysisId: string }>(),
        noteKeys: [],
        hotData: [],
    });

    useEffect(() => {
        if (data) {
            const noteKeys = noteKeyObjToArr(data.note_keys);
            const { hotData, hotDataToStudyMapping } = annotationNotesToHotData(
                noteKeys,
                data.notes as NoteCollectionReturn[] | undefined
            );

            setInitialAnnotationHotState({
                noteKeys,
                hotData,
                hotDataToStudyMapping: hotDataToStudyMapping,
            });
        }
    }, [data]);

    const handleClickSave = () => {
        if (!annotationId) return;

        const { hotData, noteKeys } = hotTableDataUpdatesRef.current;

        const updatedAnnotationNotes = hotDataToAnnotationNotes(
            hotData,
            initialAnnotationHotState.hotDataToStudyMapping,
            noteKeys
        );
        const updatedNoteKeyObj = noteKeyArrToObj(noteKeys);

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
                hotData,
                noteKeys,
            };
        },
        []
    );

    return (
        <StateHandlerComponent isLoading={getAnnotationIsLoading} isError={isError}>
            <Box>
                <AnnotationsHotTable {...initialAnnotationHotState} onChange={handleChange} />
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
                    text="save"
                    disabled={!annotationIsEdited}
                    isLoading={updateAnnotationIsLoading}
                    loaderColor="secondary"
                    color="primary"
                    variant="contained"
                    sx={{ width: '200px' }}
                    onClick={handleClickSave}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default EditAnnotations;
