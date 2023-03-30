import { HotTable, HotTableProps } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import styles from './EditAnnotations.module.css';
import { useProjectExtractionAnnotationId } from 'pages/Projects/ProjectPage/ProjectStore';
import { Box, Button, IconButton } from '@mui/material';
import {
    useAnnotationHasBeenEdited,
    useAnnotationNoteKeys,
    useHotData,
    useHotMapping,
    useInitAnnotationStore,
    useUpdateAnnotationAddColumn,
    useUpdateAnnotationIsEdited,
    useUpdateAnnotationRemoveColumn,
} from './AnnotationStore';
import { useEffect, useRef, useState } from 'react';
import { ColumnSettings } from 'handsontable/settings';
import { EPropertyType, IMetadataRowModel } from 'components/EditMetadata';
import { numericValidator } from 'handsontable/validators';
import { CellChange, CellValue, ChangeSource } from 'handsontable/common';
import AddMetadataRow from 'components/EditMetadata/EditMetadataRow/AddMetadataRow';
import { DetailedSettings as MergeCellsSettings } from 'handsontable/plugins/mergeCells';
import Cancel from '@mui/icons-material/Cancel';
import { renderToString } from 'react-dom/server';

registerAllModules();

const booleanValidator = (value: CellValue, callback: (isValid: boolean) => void) => {
    const isValid = value === 'true' || value === 'false' || value === null || value === '';
    callback(isValid);
};

const hotSettings: HotTableProps = {
    fillHandle: false,
    licenseKey: 'non-commercial-and-evaluation',
    contextMenu: false,
    viewportColumnRenderingOffset: 4,
    viewportRowRenderingOffset: 2,
    renderAllRows: false,
    width: '100%',
    height: '70vh',
    fixedColumnsStart: 2,
};

const EditAnnotations: React.FC = (props) => {
    const ref = useRef<HotTable>(null);
    const annotationId = useProjectExtractionAnnotationId();
    const annotationIsEdited = useAnnotationHasBeenEdited();
    const noteKeys = useAnnotationNoteKeys();
    const initStore = useInitAnnotationStore();
    const updateAnnotationIsEdited = useUpdateAnnotationIsEdited();
    const addHotColumn = useUpdateAnnotationAddColumn();
    const removeHotColumn = useUpdateAnnotationRemoveColumn();

    const hotData = useHotData();
    const mapping = useHotMapping();

    const [hotColumns, setHotColumns] = useState<ColumnSettings[]>([]);
    const [hotColumnHeaders, setHotColumnHeaders] = useState<string[]>([]);
    const [mergeCells, setMergeCells] = useState<MergeCellsSettings[]>([]);

    const handleRemoveHotColumn = (key: string) => {};

    const handleAddHotColumn = (col: IMetadataRowModel) => {
        return addHotColumn(col);
    };

    useEffect(() => {
        if (annotationId) {
            initStore(annotationId);
        }
    }, [initStore, annotationId]);

    console.log(' re render');

    const hotTableNumCols = hotData[0]?.length;
    useEffect(() => {
        setHotColumns([
            {
                className: `${styles['study-col']} ${styles['read-only-col']}`,
                readOnly: true,
                width: '250',
            },
            {
                className: styles['read-only-col'],
                readOnly: true,
                width: '250',
            },
            ...noteKeys.map((x) => {
                return {
                    readOnly: false,
                    className: styles[x.type],
                    allowInvalid: false,
                    validator:
                        x.type === EPropertyType.NUMBER
                            ? numericValidator
                            : x.type === EPropertyType.BOOLEAN
                            ? booleanValidator
                            : undefined,
                } as ColumnSettings;
            }),
        ]);
        setHotColumnHeaders([
            'Study',
            'Analysis',
            ...noteKeys.map((col) => {
                return (
                    `<div style="display: flex; align-items: center;">` +
                    `<div class=${styles[col.type]} style="width: 75%;">${col.key}</div>` +
                    `<div style="width: 25%;">${renderToString(<Cancel color="error" />)}</div>` +
                    `</div>`
                );
            }),
        ]);
        setMergeCells((state) => {
            const mergeCells: MergeCellsSettings[] = [];

            let studyId: string;
            let mergeCellObj: MergeCellsSettings = {
                row: 0,
                col: 0,
                rowspan: 1,
                colspan: 1,
            };
            mapping.forEach((value, key) => {
                if (value.studyId === studyId) {
                    mergeCellObj.rowspan++;
                    if (key === mapping.size - 1 && mergeCellObj.rowspan > 1) {
                        mergeCells.push(mergeCellObj);
                    }
                } else {
                    if (mergeCellObj.rowspan > 1) mergeCells.push(mergeCellObj);
                    studyId = value.studyId;
                    mergeCellObj = {
                        row: key,
                        col: 0,
                        rowspan: 1,
                        colspan: 1,
                    };
                }
            });

            return mergeCells;
        });
    }, [hotTableNumCols, noteKeys, mapping]);

    const handleClickSave = () => {
        console.log(ref.current?.hotInstance?.getData());
    };

    const handleAfterChange = (_changes: CellChange[] | null, _source: ChangeSource) => {
        if (_changes === null) return;
        const isEditingReadOnlyCols = _changes.some((x) => x[1] === 0);
        if (isEditingReadOnlyCols) return;

        updateAnnotationIsEdited(true);
    };

    return (
        <Box style={{ width: '100%', height: '100%' }}>
            <Box
                sx={{
                    display: 'table',
                    height: '100%',
                    borderCollapse: 'separate',
                    borderSpacing: '12px 0px',
                    margin: '1rem 0 30px 0',
                }}
            >
                <AddMetadataRow
                    keyPlaceholderText="New Annotation Key Name"
                    onAddMetadataRow={handleAddHotColumn}
                    showMetadataValueInput={false}
                    allowNoneOption={false}
                />
            </Box>
            <Box sx={{ marginBottom: '4.5rem', overflow: 'hidden' }}>
                <HotTable
                    {...hotSettings}
                    mergeCells={mergeCells}
                    colHeaders={hotColumnHeaders}
                    afterChange={handleAfterChange}
                    columns={hotColumns}
                    data={hotData}
                />
            </Box>
            <Box
                sx={{
                    position: 'fixed',
                    bottom: 0,
                    width: {
                        xs: '90%',
                        md: '80%',
                    },
                    padding: '1rem 0',
                    backgroundColor: 'white',
                    textAlign: 'end',
                }}
            >
                <Button
                    disabled={!annotationIsEdited}
                    color="primary"
                    variant="contained"
                    sx={{ width: '200px' }}
                    onClick={handleClickSave}
                >
                    save
                </Button>
            </Box>
        </Box>
    );
};

export default EditAnnotations;
