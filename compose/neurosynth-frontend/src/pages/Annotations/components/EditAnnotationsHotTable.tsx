import HotTable from '@handsontable/react';
import { Box, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import { IMetadataRowModel, getType } from 'components/EditMetadata/EditMetadata.types';
import AddMetadataRow from 'components/EditMetadata/AddMetadataRow';
import useEditAnnotationsHotTable from 'pages/Annotations/hooks/useEditAnnotationsHotTable';
import { getDefaultForNoteKey, noteKeyArrToObj } from 'components/HotTables/HotTables.utils';
import { CellCoords } from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import { useGetWindowHeight, useUpdateAnnotationById } from 'hooks';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { useSnackbar } from 'notistack';
import { useProjectUser } from 'pages/Project/store/ProjectStore';
import React, { useEffect, useRef } from 'react';
import { createColumns, hotDataToAnnotationNotes, hotSettings } from './EditAnnotationsHotTable.helpers';
import useUpdateAnnotationByAnnotationAndAnalysisId from 'hooks/annotations/useUpdateAnnotationByAnnotationAndAnalysisId';
import { CellChange } from 'handsontable/common';
import { NoteKeyType } from 'components/HotTables/HotTables.types';

registerAllModules();

const AnnotationsHotTable: React.FC<{ annotationId?: string }> = React.memo((props) => {
    const { enqueueSnackbar } = useSnackbar();
    const { mutate: updateAnnotation, isLoading: updateAnnotationIsLoading } = useUpdateAnnotationById(
        props.annotationId
    );
    const { mutate: updateAnnotationNoNoteKeys, isLoading: updateAnnotationNoNoteKeysIsLoading } =
        useUpdateAnnotationByAnnotationAndAnalysisId(props.annotationId);
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const hotTableRef = useRef<HotTable>(null);
    const isColumnDraggingRef = useRef<boolean>(false);
    const windowSize = useGetWindowHeight();
    const {
        hotColumnHeaders,
        theUserOwnsThisAnnotation,
        setAnnotationsHotState,
        hotData,
        mergeCells,
        colWidths,
        hotColumns,
        noteKeys,
        hotDataToStudyMapping,
        isEdited,
        isReordered,
        rowHeights,
    } = useEditAnnotationsHotTable(props.annotationId, !canEdit);

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

    const handleClickSave = () => {
        if (!props.annotationId) return;
        if (!theUserOwnsThisAnnotation) {
            enqueueSnackbar('You do not have permission to edit this annotation', {
                variant: 'error',
            });
            return;
        }

        const hasNewNoteKey = noteKeys.some((x) => !!x.isNew);
        const updatedAnnotationNotes = hotDataToAnnotationNotes(hotData, hotDataToStudyMapping, noteKeys);
        const updatedNoteKeyObj = noteKeyArrToObj(noteKeys);

        if (hasNewNoteKey || isReordered) {
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
                {
                    onSuccess: () => {
                        setAnnotationsHotState((prev) => ({ ...prev, isEdited: false }));
                        enqueueSnackbar('annotation updated successfully', { variant: 'success' });
                    },
                }
            );
        } else {
            updateAnnotationNoNoteKeys(
                updatedAnnotationNotes
                    .filter((_, index) => {
                        const studyMapping = hotDataToStudyMapping.get(index);
                        return studyMapping?.isEdited;
                    })
                    .map((annotationNote) => ({
                        id: `${props.annotationId}_${annotationNote.analysis}`,
                        note: annotationNote.note,
                    })),
                {
                    onSuccess: () => {
                        setAnnotationsHotState((prev) => {
                            const newMapping = new Map(prev.hotDataToStudyMapping);
                            for (const [index, studyMapping] of newMapping.entries()) {
                                if (studyMapping.isEdited) {
                                    newMapping.set(index, { ...studyMapping, isEdited: false });
                                }
                            }
                            return {
                                // reset state to reflect that no changes have been made
                                ...prev,
                                hotDataToStudyMapping: newMapping,
                                isEdited: false,
                                noteKeys: prev.noteKeys.map((noteKey) => ({ ...noteKey, isNew: false })),
                                isReordered: false,
                            };
                        });
                        enqueueSnackbar('annotation updated successfully', { variant: 'success' });
                    },
                }
            );
        }
    };

    const handleRemoveHotColumn = (colKey: string) => {
        if (!canEdit) return;
        const foundIndex = noteKeys.findIndex((x) => x.key === colKey && x.key !== 'included');
        if (foundIndex < 0) return;

        setAnnotationsHotState((prev) => {
            const updatedNoteKeys = [...prev.noteKeys];
            updatedNoteKeys.splice(foundIndex, 1);
            const reindexedNoteKeys = updatedNoteKeys.map((noteKey, index) => ({
                ...noteKey,
                order: index,
            }));

            return {
                ...prev,
                isEdited: true,
                noteKeys: reindexedNoteKeys,
                hotColumns: createColumns(reindexedNoteKeys, !canEdit),
                hotData: [...prev.hotData].map((row) => {
                    const updatedRow = [...row];
                    updatedRow.splice(foundIndex + 2, 1);
                    return updatedRow;
                }),
            };
        });
    };

    /**
     * NOTE: there is a bug where fixed, mergedCells (such as the cells showing our studies) get messed up when you scroll to the right. I think that this is
     * due to virtualization - as we scroll to the right, the original heights of the cells are no longer in the DOM and so the calculated row heights are lost and
     * they revert to the default.
     *
     * What ended up fixing this issue was adding row headers...I think this is because their heights are calculated and maintained regardless of virtualization.
     * In conclusion, implementing the following solved this issue:
     * 1. adding autoRowSize: true
     * 2. implementing afterGetRowHeaderRenderers to remove the top and bottom borders for stylistic reasons as they dont look good next to the merged cells
     *      the row headers themselves are not merged
     * 3. add handleCellMouseDown to prevent the user from selecting an entire row - for stylistic reasons but also theres no reason for them to select a row
     */
    const handleCellMouseDown = (event: MouseEvent, coords: CellCoords): void => {
        const isRowHeader = coords.col < 2;
        if (isRowHeader) {
            event.stopImmediatePropagation();
            return;
        }

        const target = event.target as HTMLElement;

        // Track when user starts dragging a column header (but not when clicking the X button)
        const isClickingDeleteButton = target.tagName === 'svg' || target.tagName === 'path';
        if (!isClickingDeleteButton) {
            // User is pressing down on a moveable column header (not the X button)
            isColumnDraggingRef.current = true;
        }
    };

    const handleCellMouseUp = (event: MouseEvent, coords: CellCoords, TD: HTMLTableCellElement): void => {
        // Don't delete if we're in the middle of a column drag operation
        if (isColumnDraggingRef.current) {
            isColumnDraggingRef.current = false;
            return;
        }

        const target = event.target as HTMLButtonElement;
        if (coords.row < 0 && (target.tagName === 'svg' || target.tagName === 'path')) {
            handleRemoveHotColumn(TD.innerText);
        }
    };

    const reorderArray = <T,>(arr: T[], from: number, to: number) => {
        if (from === to) return [...arr];
        const updated = [...arr];
        const [removed] = updated.splice(from, 1);
        updated.splice(to, 0, removed);
        return updated;
    };

    const handleBeforeColumnMove = (movedColumns: number[], finalIndex: number) => {
        if (!canEdit) return false;
        if (!movedColumns.length) return false;
        if (movedColumns.length > 1) return false;

        const fromVisualIndex = movedColumns[0];
        const toVisualIndex = finalIndex;

        // Prevent moving locked columns (first two columns are study name and analysis name)
        if (fromVisualIndex < 2 || toVisualIndex < 2) {
            return false;
        }

        // Calculate logical indices (subtract 2 for the fixed metadata columns)
        const from = fromVisualIndex - 2;
        let to = toVisualIndex - 2;

        // Update React state with the new column order
        // Returning false will prevent Handsontable from doing its own move,
        // and React will re-render with the correct order
        setAnnotationsHotState((prev) => {
            if (from >= prev.noteKeys.length || from < 0) return prev;
            if (to < 0) to = 0;
            // Allow to === noteKeys.length for appending to the end
            if (to > prev.noteKeys.length) to = prev.noteKeys.length;

            // Don't do anything if moving to the same position
            if (from === to) return prev;

            const updatedNoteKeys = reorderArray(prev.noteKeys, from, to).map((noteKey, index) => ({
                ...noteKey,
                order: index,
            }));

            const updatedHotData = prev.hotData.map((row) => {
                const metadataCols = row.slice(0, 2);
                const noteCols = reorderArray(row.slice(2), from, to);
                return [...metadataCols, ...noteCols];
            });

            return {
                ...prev,
                isEdited: true,
                isReordered: true,
                noteKeys: updatedNoteKeys,
                hotColumns: createColumns(updatedNoteKeys, !canEdit),
                hotData: updatedHotData,
            };
        });

        // This should technically be handled by handleCellMouseUp, but we'll add it here for safety
        setTimeout(() => {
            isColumnDraggingRef.current = false;
        }, 100);

        // Return false to prevent Handsontable from performing its own column move - React will handle the re-render with the updated data
        return false;
    };

    const handleAddHotColumn = (row: IMetadataRowModel) => {
        const trimmedKey = row.metadataKey.trim();
        if (noteKeys.find((x) => x.key === trimmedKey)) return false;
        const columnType = getType(row.metadataValue);
        const defaultValue = getDefaultForNoteKey(trimmedKey, columnType);

        setAnnotationsHotState((prev) => {
            const updatedNoteKeys: NoteKeyType[] = [
                {
                    key: trimmedKey,
                    type: columnType,
                    order: 0,
                    isNew: true,
                    default: defaultValue ?? null,
                },
                ...prev.noteKeys,
            ].map((noteKey, index) => ({ ...noteKey, order: index }));

            return {
                ...prev,
                isEdited: true,
                noteKeys: updatedNoteKeys,
                hotColumns: createColumns(updatedNoteKeys, !canEdit),
                hotData: [...prev.hotData].map((row) => {
                    const updatedRow = [...row];
                    updatedRow.splice(2, 0, defaultValue ?? null);
                    return updatedRow;
                }),
            };
        });

        return true;
    };

    /**
     * On top of being triggered when a change occurs, this hook is also triggered during initial mergeCells and on initial update.
     */
    const handleAfterChange = (changes: CellChange[] | null) => {
        if (!changes) return;
        const isDoingMergeCellOperation = changes.some((x) => x[1] === 0);
        if (isDoingMergeCellOperation) return; // We don't want update to occur when handsontable is merging cells, only when a user update occurs

        setAnnotationsHotState((prev) => {
            const updatedHotData = [...prev.hotData];
            changes.forEach(([row, col, , valChangedTo]) => {
                updatedHotData[row] = [...updatedHotData[row]];
                updatedHotData[row][col as number] = valChangedTo;

                const studyMapping = prev.hotDataToStudyMapping.get(row);
                if (!studyMapping) return prev;
                hotDataToStudyMapping.set(row, {
                    ...studyMapping,
                    isEdited: true,
                });
            });

            return {
                ...prev,
                hotData: updatedHotData,
                isEdited: true,
            };
        });
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
                        showMetadataValueInput={false}
                        allowNone={false}
                        errorMessage="can't add column (key already exists)"
                    />
                </Box>
            )}
            <Box className="hot-container" style={{ width: '100%', marginBottom: '1rem' }}>
                {hotData.length > 0 ? (
                    <HotTable
                        {...hotSettings}
                        afterChange={handleAfterChange}
                        ref={hotTableRef}
                        mergeCells={mergeCells}
                        disableVisualSelection={!canEdit}
                        colHeaders={hotColumnHeaders}
                        manualColumnMove={canEdit}
                        colWidths={colWidths}
                        rowHeights={rowHeights}
                        columns={hotColumns}
                        data={JSON.parse(JSON.stringify(hotData))}
                        afterOnCellMouseUp={handleCellMouseUp}
                        beforeOnCellMouseDown={handleCellMouseDown}
                        beforeColumnMove={handleBeforeColumnMove}
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
                    display: !canEdit ? 'none' : 'flex',
                    justifyContent: 'flex-end',
                    width: {
                        xs: '90%',
                        md: '80%',
                    },
                    zIndex: 999,
                }}
            >
                <LoadingButton
                    size="large"
                    text="save"
                    disabled={!isEdited || !canEdit}
                    isLoading={updateAnnotationIsLoading || updateAnnotationNoNoteKeysIsLoading}
                    loaderColor="secondary"
                    color="primary"
                    variant="contained"
                    sx={{ width: '300px' }}
                    onClick={handleClickSave}
                />
            </Box>
        </Box>
    );
});

export default AnnotationsHotTable;
