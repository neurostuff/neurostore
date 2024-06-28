import HotTable from '@handsontable/react';
import { Box, Typography } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { IMetadataRowModel, getType } from 'components/EditMetadata';
import AddMetadataRow from 'components/EditMetadata/EditMetadataRow/AddMetadataRow';
import {
    createColumns,
    hotDataToAnnotationNotes,
    hotSettings,
} from 'components/HotTables/EditAnnotationsHotTable/EditAnnotationsHotTable.helpers';
import AnnotationsHotTableStyles from 'components/HotTables/EditAnnotationsHotTable/EditAnnotationsHotTable.styles';
import useEditAnnotationsHotTable from 'components/HotTables/EditAnnotationsHotTable/useEditAnnotationsHotTable';
import { noteKeyArrToObj } from 'components/HotTables/HotTables.utils';
import { CellCoords } from 'handsontable';
import { CellChange } from 'handsontable/common';
import { registerAllModules } from 'handsontable/registry';
import { SelectionController } from 'handsontable/selection';
import { useGetWindowHeight, useUpdateAnnotationById } from 'hooks';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { useSnackbar } from 'notistack';
import { useProjectUser } from 'pages/Projects/ProjectPage/ProjectStore';
import React, { useEffect, useRef } from 'react';

registerAllModules();

const AnnotationsHotTable: React.FC<{ annotationId?: string }> = React.memo((props) => {
    const { enqueueSnackbar } = useSnackbar();
    const { mutate, isLoading: updateAnnotationIsLoading } = useUpdateAnnotationById(
        props.annotationId
    );
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const hotTableRef = useRef<HotTable>(null);
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
    } = useEditAnnotationsHotTable(props.annotationId, !canEdit);

    useEffect(() => {
        let timeout: any = setTimeout(() => {
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
                '30px', // TOP TOOLTIP
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

        const updatedAnnotationNotes = hotDataToAnnotationNotes(
            hotData,
            hotDataToStudyMapping,
            noteKeys
        );
        const updatedNoteKeyObj = noteKeyArrToObj(noteKeys);

        mutate(
            {
                argAnnotationId: props.annotationId,
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
                    setAnnotationsHotState((prev) => ({ ...prev, isEdited: false }));
                    enqueueSnackbar('annotation updated successfully', { variant: 'success' });
                },
            }
        );
    };

    const handleRemoveHotColumn = (colKey: string) => {
        const foundIndex = noteKeys.findIndex((x) => x.key === colKey && x.key !== 'included');
        if (foundIndex < 0) return;

        setAnnotationsHotState((prev) => {
            const updatedNoteKeys = [...prev.noteKeys];
            updatedNoteKeys.splice(foundIndex, 1);

            return {
                ...prev,
                isEdited: true,
                noteKeys: updatedNoteKeys,
                hotColumns: createColumns(updatedNoteKeys),
                hotData: [...prev.hotData].map((row) => {
                    const updatedRow = [...row];
                    updatedRow.splice(foundIndex + 2, 1);
                    return updatedRow;
                }),
            };
        });
    };

    const handleCellMouseUp = (
        event: MouseEvent,
        coords: CellCoords,
        TD: HTMLTableCellElement
    ): void => {
        const target = event.target as HTMLButtonElement;
        if (coords.row < 0 && (target.tagName === 'svg' || target.tagName === 'path')) {
            handleRemoveHotColumn(TD.innerText);
        }
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
    const handleCellMouseDown = (
        event: MouseEvent,
        coords: CellCoords,
        TD: HTMLTableCellElement,
        controller: SelectionController
    ): void => {
        const isRowHeader = coords.col === -1 || coords.col === 0;
        if (isRowHeader) {
            event.stopImmediatePropagation();
            return;
        }
    };

    const handleAddHotColumn = (row: IMetadataRowModel) => {
        const trimmedKey = row.metadataKey.trim();
        if (noteKeys.find((x) => x.key === trimmedKey)) return false;

        setAnnotationsHotState((prev) => {
            const updatedNoteKeys = [
                { key: trimmedKey, type: getType(row.metadataValue) },
                ...prev.noteKeys,
            ];

            return {
                ...prev,
                isEdited: true,
                noteKeys: updatedNoteKeys,
                hotColumns: createColumns(updatedNoteKeys),
                hotData: [...prev.hotData].map((row) => {
                    const updatedRow = [...row];
                    updatedRow.splice(2, 0, null);
                    return updatedRow;
                }),
            };
        });

        return true;
    };

    /**
     * On top of being triggered when a change occurs, this hook is also triggered during initial mergeCells and on initial update.
     */
    const handleChangeOccurred = (changes: CellChange[] | null, source: any) => {
        if (!changes) return;
        const isDoingMergeCellOperation = changes.some((x) => x[1] === 0);
        if (isDoingMergeCellOperation) return; // We don't want update to occur when handsontable is merging cells, only when a user update occurs

        setAnnotationsHotState((prev) => {
            const updatedHotData = [...prev.hotData];
            changes.forEach(([row, col, _valChangedFrom, valChangedTo]) => {
                updatedHotData[row] = [...updatedHotData[row]];
                updatedHotData[row][col as number] = valChangedTo;
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
                    className="neurosynth-annotation-component"
                    sx={[AnnotationsHotTableStyles.addMetadataRow]}
                >
                    <AddMetadataRow
                        keyPlaceholderText="New Annotation Key"
                        onAddMetadataRow={handleAddHotColumn}
                        showMetadataValueInput={false}
                        allowNumber={false}
                        allowNone={false}
                        errorMessage="can't add column (key already exists)"
                    />
                </Box>
            )}
            <Box className="hot-container" style={{ width: '100%', marginBottom: '1rem' }}>
                <div
                    id="tooltip"
                    style={{
                        height: '20px',
                        color: '#bfa73f',
                        background: '#fff',
                        fontSize: '1rem',
                        padding: '5px',
                    }}
                >
                    Hover over a Study to see the study name
                </div>
                {hotData.length > 0 ? (
                    <HotTable
                        {...hotSettings}
                        afterChange={handleChangeOccurred}
                        ref={hotTableRef}
                        mergeCells={mergeCells}
                        disableVisualSelection={!canEdit}
                        colHeaders={hotColumnHeaders}
                        colWidths={colWidths}
                        columns={hotColumns}
                        data={JSON.parse(JSON.stringify(hotData))}
                        afterOnCellMouseUp={handleCellMouseUp}
                        beforeOnCellMouseDown={handleCellMouseDown}
                        // afterOnCellMouseOver={(event, coords, TD) => {
                        afterOnCellMouseOver={(event, coords, TD) => {
                            if (coords.col === 0) {
                                const tooltip = document.querySelector(
                                    '#tooltip'
                                ) as HTMLDivElement;
                                if (!tooltip) return;
                                tooltip.innerText = `${TD.innerText}`;
                                tooltip.style.color = 'gray';

                                TD.title = TD.innerText;
                            }
                        }}
                    />
                ) : (
                    <Typography sx={{ color: 'warning.dark' }}>
                        There are no analyses to annotate. Get started by adding analyses to your
                        studies.
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
                    zIndex: 1000,
                }}
            >
                <LoadingButton
                    size="large"
                    text="save"
                    disabled={!isEdited || !canEdit}
                    isLoading={updateAnnotationIsLoading}
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
