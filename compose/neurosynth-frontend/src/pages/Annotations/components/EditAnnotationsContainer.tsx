import { HotTableRef } from '@handsontable/react-wrapper';
import { Box, Button, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { EPropertyType, IMetadataRowModel, getType } from 'components/EditMetadata/EditMetadata.types';
import AddMetadataRow from 'components/EditMetadata/AddMetadataRow';
import useEditAnnotationsHotTable from 'pages/Annotations/hooks/useEditAnnotationsHotTable';
import { getDefaultForNoteKey, noteKeyArrToObj } from 'components/HotTables/HotTables.utils';
import { useGetWindowHeight, useUpdateAnnotationByAnnotationAndAnalysisIds, useUpdateAnnotationById } from 'hooks';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { useSnackbar } from 'notistack';
import { useProjectUser } from 'stores/projects/ProjectStore';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { hotDataToAnnotationNotes, reloadNoteColumns } from './EditAnnotationsHotTable.helpers';
import EditAnnotationsHotTable, { PendingAnnotationEdits } from './EditAnnotationsHotTable';
import { AnnotationNoteValue, NoteKeyType } from 'components/HotTables/HotTables.types';

/** Add column, save, and leave-page controls around the annotations table. */
const EditAnnotationsContainer = React.memo((props: { annotationId?: string }) => {
    const { enqueueSnackbar } = useSnackbar();
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);
    const [hasEdits, setHasEdits] = useState(false);
    const { mutate: updateAnnotation, isPending: updateAnnotationIsLoading } = useUpdateAnnotationById(
        props.annotationId
    );
    const { mutate: updateAnnotationNoNoteKeys, isPending: updateAnnotationNoNoteKeysIsLoading } =
        useUpdateAnnotationByAnnotationAndAnalysisIds(props.annotationId);
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const hotTableRef = useRef<HotTableRef>(null);
    const canEditRef = useRef<boolean>(canEdit);
    const pendingEditsRef = useRef<PendingAnnotationEdits>({
        noteKeys: [],
        dirtyRowIndexes: new Set(),
        noteKeysHaveChanged: false,
    });
    const windowSize = useGetWindowHeight();
    const { theUserOwnsThisAnnotation, snapshot } = useEditAnnotationsHotTable(props.annotationId);

    useEffect(() => {
        if (!snapshot) return;
        pendingEditsRef.current = {
            noteKeys: snapshot.noteKeys,
            dirtyRowIndexes: new Set(),
            noteKeysHaveChanged: false,
        };
        setHasEdits(false);
    }, [snapshot]);

    // the grid reads this when it mounts. Later changes go through updateSettings so the table keeps its data and column order
    canEditRef.current = canEdit;
    useEffect(() => {
        hotTableRef.current?.hotInstance?.updateSettings({
            readOnly: !canEdit,
            manualColumnMove: canEdit,
            disableVisualSelection: !canEdit,
        });
    }, [canEdit]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            if (!hotTableRef.current?.hotInstance) return;
            const sizes = [
                '64px', // NAV_HEIGHT
                '3rem', // MARGIN_SPACING
                '40px', // BREADCRUMBS
                '1rem', // ADD_METADATA_INPUT_MARGIN_TOP
                '40px', // ADD_METADATA_INPUT
                '25px', // ADD_METADATA_INPUT_MARGIN_BOTTOM
                '75px', // BOTTOM_BUTTON_CONTAINER
                '1rem', // EXTRA SPACE
            ];
            const sizeStr = sizes.reduce((acc, curr, index, list) => {
                if (index === 0) {
                    return `calc(${windowSize}px - ${curr} - `;
                } else if (index === list.length - 1) {
                    return `${acc}${curr})`;
                } else {
                    return `${acc}${curr} - `;
                }
            }, '');

            hotTableRef.current.hotInstance.updateSettings({
                height: sizeStr,
            });
        }, 400);

        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [windowSize]);

    const handleBackToProject = () => {
        if (hasEdits) {
            setConfirmationDialogIsOpen(true);
            return;
        }

        navigate(`/projects/${projectId}`);
    };

    const handleCloseConfirmationDialog = (ok: boolean | undefined) => {
        setConfirmationDialogIsOpen(false);
        if (!ok) return;

        navigate(`/projects/${projectId}`);
    };

    const handleClickSave = () => {
        if (!props.annotationId || !snapshot) return;
        if (!theUserOwnsThisAnnotation) {
            enqueueSnackbar('You do not have permission to edit this annotation', {
                variant: 'error',
            });
            return;
        }

        const pendingEdits = pendingEditsRef.current;
        const hotData = (hotTableRef.current?.hotInstance?.getData() ?? []) as AnnotationNoteValue[][];
        const updatedAnnotationNotes = hotDataToAnnotationNotes(
            hotData,
            snapshot.hotDataToStudyMapping,
            pendingEdits.noteKeys
        );
        const updatedNoteKeyObj = noteKeyArrToObj(pendingEdits.noteKeys);

        const handleSaveSuccess = () => {
            // reset state to reflect that no changes have been made
            pendingEdits.dirtyRowIndexes.clear();
            pendingEdits.noteKeysHaveChanged = false;
            setHasEdits(false);
            enqueueSnackbar('annotation updated successfully', { variant: 'success' });
        };

        if (pendingEdits.noteKeysHaveChanged) {
            updateAnnotation(
                {
                    argAnnotationId: props.annotationId,
                    annotation: {
                        notes: updatedAnnotationNotes.map((annotationNote) => ({
                            note: annotationNote.note,
                            analysis: annotationNote.analysis,
                            study: annotationNote.study,
                            annotation: props.annotationId,
                        })),
                        note_keys: updatedNoteKeyObj,
                    },
                },
                { onSuccess: handleSaveSuccess }
            );
        } else {
            updateAnnotationNoNoteKeys(
                updatedAnnotationNotes
                    .filter((_, index) => pendingEdits.dirtyRowIndexes.has(index))
                    .map((annotationNote) => ({
                        id: `${props.annotationId}_${annotationNote.analysis}`,
                        note: annotationNote.note,
                    })),
                { onSuccess: handleSaveSuccess }
            );
        }
    };

    const handleAddHotColumn = (row: IMetadataRowModel) => {
        const pendingEdits = pendingEditsRef.current;
        const trimmedKey = row.metadataKey.trim();
        if (pendingEdits.noteKeys.find((x) => x.key === trimmedKey)) return false;
        const columnType = getType(row.metadataValue);
        const defaultValue = getDefaultForNoteKey(trimmedKey, columnType);

        const updatedNoteKeys: NoteKeyType[] = [
            {
                key: trimmedKey,
                type: columnType,
                order: 0,
                default: defaultValue,
            },
            ...pendingEdits.noteKeys,
        ].map((noteKey, index) => ({ ...noteKey, order: index }));

        const hot = hotTableRef.current?.hotInstance;
        if (hot) {
            const updatedHotData = (hot.getData() as AnnotationNoteValue[][]).map((hotRow) => [
                ...hotRow.slice(0, 2),
                defaultValue,
                ...hotRow.slice(2),
            ]);
            reloadNoteColumns(hot, updatedHotData, updatedNoteKeys);
        }
        pendingEdits.noteKeys = updatedNoteKeys;
        pendingEdits.noteKeysHaveChanged = true;
        setHasEdits(true);

        return true;
    };

    return (
        <Box>
            {theUserOwnsThisAnnotation && canEdit && (
                <Box
                    sx={{
                        mb: 1,
                        width: {
                            xs: '100%',
                            md: '60%',
                            lg: '50%',
                        },
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: 4,
                        height: '70px',
                    }}
                >
                    <AddMetadataRow
                        keyPlaceholderText="New Annotation Key"
                        onAddMetadataRow={handleAddHotColumn}
                        defaultType={EPropertyType.BOOLEAN}
                        showMetadataValueInput={false}
                        allowNone={false}
                        errorMessage="can't add column (key already exists)"
                    />
                </Box>
            )}
            <Box className="hot-container" style={{ width: '100%', marginBottom: '1rem' }}>
                {snapshot && snapshot.hotData.length > 0 ? (
                    <EditAnnotationsHotTable
                        key={snapshot.annotationId}
                        initialState={snapshot}
                        hotTableRef={hotTableRef}
                        canEditRef={canEditRef}
                        pendingEditsRef={pendingEditsRef}
                        onHasEdits={setHasEdits}
                    />
                ) : (
                    <Typography sx={{ color: 'warning.dark' }}>
                        There are no analyses to annotate. Get started by adding analyses to your studies.
                    </Typography>
                )}
            </Box>
            <Box
                sx={{
                    bottom: 0,
                    padding: '1rem 0',
                    backgroundColor: 'white',
                    position: 'fixed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: {
                        xs: '90%',
                        md: '80%',
                    },
                    zIndex: 999,
                }}
            >
                <ConfirmationDialog
                    isOpen={confirmationDialogIsOpen}
                    dialogTitle="You have unsaved changes"
                    dialogMessage="Are you sure you want to continue? You'll lose your unsaved changes"
                    onCloseDialog={handleCloseConfirmationDialog}
                    rejectText="Cancel"
                    confirmText="Continue"
                />
                <Button
                    color="secondary"
                    disableElevation
                    size="medium"
                    variant="contained"
                    onClick={handleBackToProject}
                >
                    Back to project
                </Button>
                {canEdit && (
                    <LoadingButton
                        size="medium"
                        text="save"
                        disableElevation
                        disabled={!hasEdits || !canEdit}
                        isLoading={updateAnnotationIsLoading || updateAnnotationNoNoteKeysIsLoading}
                        loaderColor="secondary"
                        color="primary"
                        variant="contained"
                        sx={{ width: '150px' }}
                        onClick={handleClickSave}
                    />
                )}
            </Box>
        </Box>
    );
});

export default EditAnnotationsContainer;
