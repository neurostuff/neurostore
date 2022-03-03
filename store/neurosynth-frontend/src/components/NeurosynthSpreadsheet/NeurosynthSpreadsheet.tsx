import { useAuth0 } from '@auth0/auth0-react';
import HotTable from '@handsontable/react';
import DeleteIcon from '@mui/icons-material/Delete';
import styles from './NeurosynthSpreadsheet.module.css';
import React, { memo, useEffect, useRef } from 'react';
import { EPropertyType, IMetadataRowModel } from '..';
import { NavLink } from 'react-router-dom';
import AddMetadataRow from '../EditMetadata/EditMetadataRow/AddMetadataRow';
import EditAnnotationsPageStyles from '../../pages/Annotations/EditAnnotationsPage/EditAnnotationsPage.styles';
import { AnnotationNote, ReadOnly } from '../../gen/api';
import EditStudyPageStyles from '../../pages/Studies/EditStudyPage/EditStudyPage.styles';
import { Button, Link, Box } from '@mui/material';
import HotSettingsBuilder from './HotSettingsBuilder';
import NeurosynthSpreadsheetState from './NeurosynthSpreadsheetState';
import NeurosynthSpreadsheetHelper from './NeurosynthSpreadsheetHelper';

export interface INeurosynthColumn {
    value: string;
    type: EPropertyType;
}

const NeurosynthSpreadsheet: React.FC<{
    annotationNotes: (AnnotationNote & ReadOnly)[] | undefined;
    annotationNoteKeyTypes: object | undefined;
    onSaveAnnotation: (
        annotationNotes: AnnotationNote[],
        noteKeyTypes: { [key: string]: EPropertyType }
    ) => void;
}> = memo((props) => {
    const hotTableRef = useRef<HotTable>(null);
    const { isAuthenticated } = useAuth0();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const STATE = new NeurosynthSpreadsheetState(
        hotTableRef,
        <DeleteIcon className={styles['delete-icon']} />,
        isAuthenticated
    );
    const hotSettings = new HotSettingsBuilder(STATE).getBaseHotSettings();

    useEffect(() => {
        if (!STATE.ref || !props.annotationNotes || !props.annotationNoteKeyTypes) return;
        const getAnnotation = () => {
            // sort notes by study id. This is necessary to visually group them by study in the spreadsheet
            const notes = (props.annotationNotes as (AnnotationNote & ReadOnly)[]).sort((a, b) => {
                const firstStudyId = a.study as string;
                const secondStudyId = b.study as string;
                return firstStudyId.localeCompare(secondStudyId);
            });

            const noteKeyTypes = props.annotationNoteKeyTypes as { [key: string]: EPropertyType };

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
            const noteKeyList: string[] = Object.keys(noteKeyTypes);

            noteKeyList.forEach((noteKey) => {
                STATE.addToColumnObjectList({
                    value: noteKey,
                    type: noteKeyTypes[noteKey],
                });
            });

            // build row headers and spreadsheet data cells
            const rowHeaders: string[] = [];
            const spreadsheetData: (string | boolean | number | null)[][] = [];

            let index = 0;
            let prevStudy = null;

            while (index < notes.length) {
                const currNote = notes[index];
                const currStudy = currNote.study;
                const currStudyBlurb = NeurosynthSpreadsheetHelper.BuildStudyDisplayText(
                    currNote.study_name || '',
                    currNote.study_year || undefined,
                    currNote.authors || '',
                    currNote.publication || '',
                    STATE.numColumns !== 0
                );

                if (prevStudy !== currStudy) {
                    // check if we are at a new study. We then want to push a study title row to the spreadsheet

                    if (noteKeyList.length > 0) {
                        // check if columns exist. If so, we add a studyTitleRow and an accompanying empty row header
                        const spreadsheetRow = new Array(noteKeyList.length).fill(null);
                        spreadsheetRow[0] = currStudyBlurb;
                        spreadsheetData.push(spreadsheetRow);
                        rowHeaders.push('');
                    } else {
                        // if no columns exist, we set the studyBlurb as the row header
                        spreadsheetData.push([]);
                        rowHeaders.push(currStudyBlurb);
                    }
                    prevStudy = currStudy;
                    STATE.addToStudyTitleRowMap(rowHeaders.length - 1, {
                        name: currNote.study_name || '',
                        year: currNote.study_year || undefined,
                        authors: currNote.authors || '',
                        publication: currNote.publication || '',
                    });
                } else {
                    // we are dealing with an analysis that is part of the same study. We create a regular spreadsheet data row
                    const spreadsheetRow: (string | boolean | number | null)[] = [];
                    noteKeyList.forEach((noteKey, index) => {
                        const tempNoteObj = currNote.note as {
                            [key: string]: boolean | number | string | null;
                        };
                        spreadsheetRow.push(tempNoteObj[noteKey]);
                    });
                    spreadsheetData.push(spreadsheetRow);
                    rowHeaders.push(currNote.analysis_name || '');
                    index++;
                }
            }

            // add one to take account of the header and extra padding to account for border
            const totalHeightInPixels =
                (rowHeaders.length + 1) * NeurosynthSpreadsheetHelper.ROW_HEIGHTS + 5;

            STATE.updateSpreadsheet({
                data: spreadsheetData,
                height: totalHeightInPixels > 600 ? '600px' : totalHeightInPixels + 'px',
                rowHeaders: rowHeaders,
            });

            if (STATE.numColumns === 0) {
                const noColumnsMessage = document.querySelector('#no-columns-message');
                noColumnsMessage?.setAttribute('class', styles.show);
            }
        };
        getAnnotation();
    }, [isAuthenticated, props.annotationNotes, STATE, props.annotationNoteKeyTypes]);

    const addColumnHeader = (column: IMetadataRowModel): boolean => {
        const keyExists = STATE.columnValueExists(column.metadataKey);
        if (keyExists) return false;

        STATE.addColumnToSpreadsheet(column);

        const noColumnsMessage = document.querySelector('#no-columns-message');
        noColumnsMessage?.setAttribute('class', styles.hide);
        return true;
    };

    const handleOnSaveAnnotationChangeClick = (event: React.MouseEvent) => {
        if (!STATE.ref || !props.annotationNotes) return;
        const data = STATE.ref.getData() as (string | boolean | number | null)[][];
        const { annotationNotes, noteKeyTypes } = STATE.convertToAnnotationObject(
            props.annotationNotes,
            data
        );
        props.onSaveAnnotation(annotationNotes, noteKeyTypes);
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

                <Box id="no-columns-message" className={styles.hide}>
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
                            '& .relative': {
                                height: 'calc(100% - 4px)', // 4px comes from handsontable padding
                            },
                            '& .colHeader': {
                                display: 'block !important',
                                height: '100%',
                            },
                            '& .rowHeader': {
                                whiteSpace: 'normal',
                            },
                            '.htNumeric': {
                                textAlign: 'left',
                            },
                        }}
                        ref={hotTableRef}
                        component={HotTable}
                        settings={hotSettings}
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
