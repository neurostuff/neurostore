import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import EditAnnotationsHotTable from 'components/HotTables/EditAnnotationsHotTable/EditAnnotationsHotTable';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useUpdateAnnotationById } from 'hooks';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';

const hardCodedColumns = ['Study', 'Analysis'];

const EditAnnotations: React.FC<{ annotationId: string }> = (props) => {
    const { enqueueSnackbar } = useSnackbar();
    const { mutate, isLoading: updateAnnotationIsLoading } = useUpdateAnnotationById(
        props.annotationId
    );
    // const {
    //     theUserOwnsThisAnnotation,
    //     hotDataToStudyMapping,
    //     noteKeys,
    //     hotData,
    //     hotColumns,
    //     mergeCells,
    //     getAnnotationIsError,
    //     getAnnotationIsLoading,
    // } = useEditAnnotations();
    // const [annotationIsEdited, setAnnotationIsEdited] = useState(false);

    // const handleClickSave = () => {
    //     if (!props.annotationId) return;
    //     if (!theUserOwnsThisAnnotation) {
    //         enqueueSnackbar('You do not have permission to edit this annotation', {
    //             variant: 'error',
    //         });
    //         return;
    //     }

    //     const updatedAnnotationNotes = hotDataToAnnotationNotes(
    //         hotData,
    //         hotDataToStudyMapping,
    //         noteKeys
    //     );
    //     const updatedNoteKeyObj = noteKeyArrToObj(noteKeys);

    //     mutate(
    //         {
    //             argAnnotationId: props.annotationId,
    //             annotation: {
    //                 notes: updatedAnnotationNotes.map((annotationNote) => ({
    //                     note: annotationNote.note,
    //                     analysis: annotationNote.analysis,
    //                     study: annotationNote.study,
    //                 })),
    //                 note_keys: updatedNoteKeyObj,
    //             },
    //         },
    //         {
    //             onSuccess: () => {
    //                 setAnnotationIsEdited(false);
    //             },
    //         }
    //     );
    // };

    // const handleChange = useCallback(
    //     (hotData: AnnotationNoteValue[][], noteKeys: NoteKeyType[]) => {
    //         setAnnotationIsEdited(true);
    //         hotTableDataUpdatesRef.current = {
    //             ...hotTableDataUpdatesRef.current,
    //             hotData,
    //             noteKeys,
    //         };
    //     },
    //     []
    // );

    return (
        <></>
        // <StateHandlerComponent isLoading={getAnnotationIsLoading} isError={getAnnotationIsError}>
        //     {/* <EditAnnotationsHotTable
        //         allowAddColumn={theUserOwnsThisAnnotation}
        //         hardCodedReadOnlyCols={hardCodedColumns}
        //         allowRemoveColumns={true}
        //         onChange={handleChange}
        //         size="fitToPage"
        //     /> */}
        //     <LoadingButton
        //         size="large"
        //         text="save"
        //         disabled={!annotationIsEdited}
        //         isLoading={updateAnnotationIsLoading}
        //         loaderColor="secondary"
        //         color="primary"
        //         variant="contained"
        //         sx={{ width: '300px' }}
        //         onClick={handleClickSave}
        //     />
        // </StateHandlerComponent>
    );
};

export default EditAnnotations;
