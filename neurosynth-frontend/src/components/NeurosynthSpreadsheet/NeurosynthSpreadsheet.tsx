import { textRenderer, numericRenderer, htmlRenderer } from 'handsontable/renderers';
import { useAuth0 } from '@auth0/auth0-react';
import HotTable from '@handsontable/react';
import { CellMeta, CellProperties, GridSettings } from 'handsontable/settings';
import DeleteIcon from '@mui/icons-material/Delete';
import { renderToString } from 'react-dom/server';
import CellCoords from 'handsontable/3rdparty/walkontable/src/cell/coords';
import styles from './NeurosynthSpreadsheet.module.css';
import { CellChange, CellValue } from 'handsontable/common';
import { numericValidator } from 'handsontable/validators';
import React, { memo, useEffect, useRef } from 'react';
import { EPropertyType, IMetadataRowModel } from '..';
import { Box } from '@mui/system';
import { useParams, NavLink } from 'react-router-dom';
import AddMetadataRow from '../EditMetadata/EditMetadataRow/AddMetadataRow';
import EditAnnotationsPageStyles from '../../pages/Annotations/EditAnnotationsPage/EditAnnotationsPage.styles';
import { getType } from '..';
import { AnnotationNote, ReadOnly } from '../../gen/api';
import EditStudyPageStyles from '../../pages/Studies/EditStudyPage/EditStudyPage.styles';
import { Button, Link } from '@mui/material';

export interface INeurosynthColumn {
    value: string;
    type: EPropertyType;
}

export const isSpreadsheetBoolType = (value: any): boolean => {
    return (
        value === 't' ||
        value === 'f' ||
        value === 'true' ||
        value === 'false' ||
        value === null ||
        value === true ||
        value === false ||
        value === ''
    );
};

export const getTypeForColumn = (columnKey: string, notes: AnnotationNote[]): EPropertyType => {
    for (let i = 0; i < notes.length; i++) {
        const currentNote = notes[i].note as { [key: string]: string | boolean | number | null };
        const value = currentNote[columnKey];
        if (value !== null) {
            // typescript complains here that string cannot be used to index type {} so we must cast it
            return getType(value);
        }
    }
    return EPropertyType.STRING;
};

const getValidator = (type: EPropertyType) => {
    switch (type) {
        case EPropertyType.NUMBER:
            return numericValidator;
        case EPropertyType.BOOLEAN:
            return (value: CellValue, callback: (valid: boolean) => void) => {
                const isValid = isSpreadsheetBoolType(value);
                return callback(isValid);
            };
        default:
            return undefined;
    }
};

const NeurosynthSpreadsheet: React.FC<{
    annotationNotes: (AnnotationNote & ReadOnly)[] | undefined;
    onSaveAnnotation: (args: AnnotationNote[]) => void;
}> = memo((props) => {
    console.log('rerendered neurosynth spreadsheet');

    const { isAuthenticated } = useAuth0();
    const params: {
        annotationId: string;
        datasetId: string;
    } = useParams();
    const hotTableRef = useRef<HotTable>(null);
    const ROW_HEIGHTS = 25;
    const ROW_HEADER_WIDTH = 200;

    // these arrays represent GLOBAL CONSTANT spreadsheet state of columns
    const studyTitleRows: {
        studyDetails: {
            publication: string;
            name: string;
            authors: string;
            year: number | undefined;
        };
        index: number;
    }[] = [];
    const columnObjects: INeurosynthColumn[] = [];

    // helper methods

    const getVisibleStudyTitleWidth = () => {
        const screenWidth = window.innerWidth;
        const parentPadding = 20;
        const scrollbarAdjustment = 20;

        // all page content is 80% of parent
        return Math.floor(
            screenWidth * 0.8 - parentPadding - ROW_HEADER_WIDTH - scrollbarAdjustment
        );
    };

    const rowIsStudyTitle = (row: number): boolean => {
        return studyTitleRows.some((r) => r.index === row);
    };

    const buildStudyDisplayText = (
        studyName: string,
        studyYear: number | undefined,
        authors: string,
        journalName: string,
        isHTML: boolean
    ): string => {
        let authorText = '';
        authorText = authors.split(', ')[0];
        if (authors.split(', ').length > 1) authorText += ' et al.,';
        const studyNameText = studyYear ? `(${studyYear}) ${studyName}` : studyName;
        const visibleWidth = getVisibleStudyTitleWidth();
        return isHTML
            ? `<div style="width: ${visibleWidth}px; display: flex; position: absolute !important; z-index: 9">` +
                  `<span class="${styles.authors} ${styles['study-details-text']}">${authorText}</span>` +
                  `<span class="${styles['study-name']} ${styles['study-details-text']}">${studyNameText}</span>` +
                  `<span class="${styles.publication} ${styles['study-details-text']}">${journalName}</span>` +
                  `</div>`
            : `${authorText} | ${studyNameText} | ${journalName}`;
    };

    const buildDescriptionForStudyRow = (studyRowIndex: number, isHTML: boolean): string => {
        const studyRowDetails = studyTitleRows.find((row) => row.index === studyRowIndex);
        if (!studyRowDetails) return '';

        return buildStudyDisplayText(
            studyRowDetails.studyDetails.name,
            studyRowDetails.studyDetails.year,
            studyRowDetails.studyDetails.authors,
            studyRowDetails.studyDetails.publication,
            isHTML
        );
    };

    const updateSpreadsheet = (additionalUpdates?: { [key: string]: any }) => {
        const hotTable = hotTableRef.current?.hotInstance;
        if (!hotTable) return;

        hotTable.updateSettings({
            columns: columnObjects.map((col) => {
                return {
                    copyable: true,
                    readOnly: !isAuthenticated,
                    type: col.type === EPropertyType.NUMBER ? 'numeric' : 'text',
                    className: styles[col.type],
                    allowInvalid: false,
                    validator: getValidator(col.type),
                    renderer: col.type === EPropertyType.NUMBER ? numericRenderer : textRenderer,
                };
            }),
            colHeaders: columnObjects.map((col) => {
                const deleteIconStr = renderToString(
                    <DeleteIcon className={styles['delete-icon']} />
                );
                return `
                        <div class="${styles['column-header']}">
                            <span class="${styles[col.type]}"><b>${col.value}</b></span>
                            ${isAuthenticated ? deleteIconStr : ''}
                        </div>`;
            }),
            ...additionalUpdates,
        });
        const noColumnsMessage = document.querySelector('#no-columns-message');
        columnObjects.length > 0
            ? noColumnsMessage?.setAttribute('class', styles.hide)
            : noColumnsMessage?.setAttribute('class', styles.show);
    };

    const handleOnHeaderClick = (
        event: MouseEvent,
        coords: CellCoords,
        TD: HTMLTableCellElement
    ) => {
        const target = event.target as HTMLButtonElement;
        if (target.tagName === 'svg' || (target.tagName === 'path' && coords.row < 0)) {
            removeColumnAt(coords.col);
        }
    };

    const convertToAnnotationObject = (
        data: (string | boolean | number | null)[][]
    ): AnnotationNote[] => {
        const annotationNotes = props.annotationNotes || [];
        const pureData = data.filter((row, index) => !rowIsStudyTitle(index));

        return annotationNotes.map((annotationNote, index) => {
            const newNote: { [key: string]: string | number | boolean | null } = {};
            const row = pureData[index];
            row.forEach((value, colIndex) => {
                const colValue = columnObjects[colIndex].value;
                newNote[colValue] = value;
            });

            return {
                ...annotationNote,
                note: newNote,
            };
        });
    };

    // helper methods end

    const baseHotSettings: GridSettings = {
        data: [[]],
        mergeCells: [],
        stretchH: 'all',
        rowHeaderWidth: ROW_HEADER_WIDTH,
        rowHeights: ROW_HEIGHTS,
        height: '70px',
        fillHandle: false,
        contextMenu: false,
        licenseKey: 'non-commercial-and-evaluation',
        viewportColumnRenderingOffset: 9,
        viewportRowRenderingOffset: 15,
        renderAllRows: false,
        afterGetColHeader: (column: number, TH: HTMLElement) => {
            const isBoolType = TH.querySelector(`.${styles['boolean']}`);

            if (TH && isBoolType) {
                TH.setAttribute(
                    'title',
                    'valid boolean entries include "t" or "true" for true and "f" or "false" for false.'
                );
            }
        },
        afterGetRowHeader: function (row, TH: HTMLElement) {
            /**
             * style the row header if it is a study title row
             */
            if (rowIsStudyTitle(row)) {
                TH.setAttribute(
                    'style',
                    'background-color: #ccc; color: black; border-left-color: #ccc; border-right-color: #ccc;'
                );
            }
        },
        afterRefreshDimensions: (p, c, s) => {
            const hotTable = hotTableRef.current?.hotInstance;
            const data: (string | boolean | number)[][] | undefined = hotTable?.getData();
            if (!studyTitleRows || !data) return;

            data?.forEach((row, index) => {
                if (rowIsStudyTitle(index)) {
                    data[index][0] = buildDescriptionForStudyRow(index, true);
                }
            });
            hotTable?.updateSettings({
                data: data,
            });
        },
        cells: function (
            this: CellProperties,
            row: number,
            column: number,
            prop: string | number
        ): CellMeta {
            const cellProperties: any = {};
            if (rowIsStudyTitle(row)) {
                cellProperties.readOnly = true;
                cellProperties.renderer = htmlRenderer;
                cellProperties.className = styles['study-details-row'];
            }
            return cellProperties;
        },
        beforeOnCellMouseDown: function (event: MouseEvent, coords: CellCoords, TH: HTMLElement) {
            /**
             * Prevent study name from being selectable and copyable
             */
            if (rowIsStudyTitle(coords.row)) {
                event.stopImmediatePropagation();
            }
        },
        afterChange: function (changes: CellChange[] | null, source) {
            if (columnObjects.length <= 0 || !changes) return;
            const requiredChanges: [number, number, string | number | boolean | null][] = [];
            changes.forEach((change, index) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [rowValue, colValue, _, newValue] = change;
                const col = columnObjects.find((col, index) => index === colValue);
                if (col === undefined || rowIsStudyTitle(rowValue)) {
                    changes[index] = null as any;
                    return;
                }
                const isValidSpreadsheetBooleanValueAndRequiresChange =
                    col.type === EPropertyType.BOOLEAN &&
                    newValue !== true &&
                    newValue !== false &&
                    newValue !== null;
                if (isValidSpreadsheetBooleanValueAndRequiresChange) {
                    let transformedValue = null;
                    switch (newValue) {
                        case '':
                        case null:
                            transformedValue = null;
                            break;
                        case 't':
                        case 'true':
                            transformedValue = true;
                            break;
                        default:
                            transformedValue = false;
                            break;
                    }
                    requiredChanges.push([rowValue, colValue as number, transformedValue]);
                }
            });

            hotTableRef.current?.hotInstance?.setDataAtCell(requiredChanges);
        },
        afterOnCellMouseUp: handleOnHeaderClick,
    };

    // init spreadsheet and parse data

    useEffect(() => {
        if (!params.annotationId || !hotTableRef.current?.hotInstance || !props.annotationNotes)
            return;
        const getAnnotation = () => {
            // sort notes by study id. This is necessary to visually group them by study in the spreadsheet
            const notes = (props.annotationNotes as (AnnotationNote & ReadOnly)[]).sort((a, b) => {
                const firstStudyId = a.study as string;
                const secondStudyId = b.study as string;
                return firstStudyId.localeCompare(secondStudyId);
            });

            if (!notes || notes.length === 0) {
                const noDataMessage = document.querySelector('#no-data-message');
                const spreadsheet = document.querySelector('#spreadsheet-container');
                noDataMessage?.setAttribute('class', styles.show);
                spreadsheet?.setAttribute('class', styles.hide);
                return;
            }

            /**
             * Extract the keys from the first note obj. We can do this
             * because we assume that all notes in the db have the same keys
             *
             * if notes.length is not 0, then the note object should not be undefined
             */
            const noteKeys: string[] = Object.keys(notes[0].note as object);

            noteKeys.forEach((noteKey) => {
                columnObjects.push({
                    value: noteKey,
                    type: getTypeForColumn(noteKey, notes),
                });
            });

            const rowHeaders: string[] = [];
            const spreadsheetData: (string | boolean | number)[][] = [];

            let index = 0;
            let prevStudy = null;

            while (index < notes.length) {
                const currNote = notes[index];
                const currStudy = currNote.study;
                const currStudyBlurb = buildStudyDisplayText(
                    currNote.study_name || '',
                    currNote.study_year || undefined,
                    currNote.authors || '',
                    currNote.publication || '',
                    columnObjects.length !== 0
                );

                if (prevStudy !== currStudy) {
                    // check if we are at a new study. We then want to push a study title row to the spreadsheet

                    if (noteKeys.length > 0) {
                        // check if columns exist. If so, we add a studyTitleRow. This row will be merged later.
                        const spreadsheetRow = new Array(noteKeys.length);
                        spreadsheetRow.fill(null);
                        spreadsheetRow[0] = currStudyBlurb;
                        spreadsheetData.push(spreadsheetRow);
                        rowHeaders.push('');
                    } else {
                        // if no columns exist, we set the studyBlurb as the row header
                        spreadsheetData.push([]);
                        rowHeaders.push(currStudyBlurb);
                    }
                    prevStudy = currStudy;
                    studyTitleRows.push({
                        index: rowHeaders.length - 1,
                        studyDetails: {
                            name: currNote.study_name || '',
                            year: currNote.study_year || undefined,
                            authors: currNote.authors || '',
                            publication: currNote.publication || '',
                        },
                    });
                } else {
                    // we are dealing with an analysis that is part of the same study. We create a regular spreadsheet data row

                    const spreadsheetRow = [];
                    for (let i = 0; i < noteKeys.length; i++) {
                        const tempNoteObj = currNote.note as {
                            [key: string]: boolean | number | string;
                        };
                        spreadsheetRow.push(tempNoteObj[noteKeys[i]]);
                    }
                    spreadsheetData.push(spreadsheetRow);
                    rowHeaders.push(currNote.analysis_name || '');
                    index++;
                }
            }

            // add one to take account of the header and extra padding to account for border
            const totalHeightInPixels = (rowHeaders.length + 1) * ROW_HEIGHTS + 5;

            updateSpreadsheet({
                data: spreadsheetData,
                height: totalHeightInPixels > 600 ? '600px' : totalHeightInPixels + 'px',
                rowHeaders: rowHeaders,
            });
        };
        getAnnotation();
    }, [isAuthenticated, params.annotationId, props.annotationNotes]);

    const addColumnHeader = (column: IMetadataRowModel) => {
        const hotTable = hotTableRef.current?.hotInstance;
        const keyExists = columnObjects.some((col) => col.value === column.metadataKey);
        if (keyExists || !hotTable) return false;

        const updatedData: (string | boolean | number | null)[][] = hotTable.getData();
        const updatedRowHeaders = hotTable.getRowHeader();

        for (let i = 0; i < updatedData.length; i++) {
            const row = updatedData[i];
            if (rowIsStudyTitle(i)) {
                if (columnObjects.length === 0) {
                    // we must remove the study title description from the row header and put it in the actual spreadsheet
                    // if updatedData is empty, handsontable will automatically give it a single column of null values
                    updatedRowHeaders[i] = '';
                    const newStudyDescription = buildDescriptionForStudyRow(i, true);
                    row[0] = newStudyDescription;
                } else {
                    const studyDetailString = row[0];
                    row[0] = null;
                    row.unshift(studyDetailString);
                }
            } else {
                row.unshift(column.metadataValue);
            }
        }

        columnObjects.unshift({
            value: column.metadataKey,
            type: getType(column.metadataValue),
        });

        updateSpreadsheet({
            data: updatedData,
            rowHeaders: updatedRowHeaders,
        });

        return true;
    };

    const removeColumnAt = (indexToDelete: number) => {
        const hotTable = hotTableRef.current?.hotInstance;
        if (!hotTable) return;

        const updatedData = hotTable.getData();
        const updatedRowHeaders = hotTable.getRowHeader();
        updatedData.forEach((row, index) => {
            if (rowIsStudyTitle(index)) {
                if (columnObjects.length === 1) {
                    // we are deleting the only column in the spreadsheet
                    updatedRowHeaders[index] = buildDescriptionForStudyRow(index, false);
                    row.splice(0, 1);
                } else if (indexToDelete === 0) {
                    // there is more than one column in spreadsheet and we are deleting the first item
                    const studyDetailString = row[0] as string;
                    row.splice(0, 1);
                    row[0] = studyDetailString;
                } else {
                    row.splice(indexToDelete, 1);
                }
            }
        });
        columnObjects.splice(indexToDelete, 1);

        updateSpreadsheet({
            data: updatedData,
            rowHeaders: updatedRowHeaders,
        });
    };

    const handleOnSaveAnnotationChangeClick = (event: React.MouseEvent) => {
        const hotTable = hotTableRef.current?.hotInstance;
        if (!hotTable) return;
        const data = hotTable.getData() as (string | boolean | number | null)[][];
        console.log(props.annotationNotes);
        const convertedAnnotation = convertToAnnotationObject(data);
        console.log(convertedAnnotation);

        props.onSaveAnnotation(convertedAnnotation);
    };

    return (
        <>
            <Box id="spreadsheet-container" component="div" className={styles.show}>
                <Box
                    sx={EditAnnotationsPageStyles.addColumnContainer}
                    className={isAuthenticated ? styles.show : styles.hide}
                >
                    <AddMetadataRow
                        allowNoneOption={false}
                        keyPlaceholderText="Column Key"
                        valuePlaceholderText="Default Value"
                        errorMessage="All column keys must be unique"
                        onAddMetadataRow={addColumnHeader}
                    />
                </Box>

                <Box id="no-columns-message">
                    <Box component="div" color="warning.dark" sx={{ margin: '0 0 1rem 0' }}>
                        No annotations have been added yet. Start by{' '}
                        {isAuthenticated
                            ? 'adding columns using the controls above'
                            : 'logging in to edit'}
                    </Box>
                </Box>

                <Box component="div" style={{ overflow: 'hidden' }}>
                    <Box
                        sx={{
                            '& .rowHeader': {
                                whiteSpace: 'normal',
                            },
                            '.htNumeric': {
                                textAlign: 'left',
                            },
                        }}
                        ref={hotTableRef}
                        component={HotTable}
                        settings={baseHotSettings}
                    />
                </Box>
                <Box component="div" sx={{ width: '100%', display: 'flex', justifyContent: 'end' }}>
                    <Button
                        color="primary"
                        variant="contained"
                        disabled={!isAuthenticated}
                        onClick={handleOnSaveAnnotationChangeClick}
                        sx={{
                            ...EditStudyPageStyles.button,
                            marginTop: '0.5rem',
                        }}
                    >
                        Save Annotation Changes
                    </Button>
                </Box>
            </Box>

            <Box
                id="no-data-message"
                style={{ padding: '1rem 0' }}
                className={styles.hide}
                component="div"
            >
                There are no analyses to annotate yet. Start by{' '}
                <Link color="primary" exact component={NavLink} to="/studies">
                    adding studies to this dataset
                </Link>
            </Box>
        </>
    );
});

export default NeurosynthSpreadsheet;
