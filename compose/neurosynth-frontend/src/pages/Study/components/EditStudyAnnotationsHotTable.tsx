import { HotTable } from '@handsontable/react';
import { Box } from '@mui/material';
import { CellChange, ChangeSource, RangeType } from 'handsontable/common';
import { useMemo, useRef } from 'react';
import { useAnnotationNoteKeys, useUpdateAnnotationNotes } from 'stores/AnnotationStore.actions';
import { sanitizePaste } from 'components/HotTables/HotTables.utils';
import useEditStudyAnnotationsHotTable from 'pages/Study/components/useEditStudyAnnotationsHotTable';
import { HotSettings } from 'pages/Study/components/EditStudyAnnotationsHotTable.helpers';

const EditStudyAnnotationsHotTable: React.FC<{ readonly?: boolean }> = ({ readonly = false }) => {
    const hotTableRef = useRef<HotTable>(null);
    const noteKeys = useAnnotationNoteKeys();
    const updateNotes = useUpdateAnnotationNotes();
    const { colWidths, colHeaders, columns, hiddenRows, data } = useEditStudyAnnotationsHotTable(hotTableRef, readonly);

    const handleAfterChange = (changes: CellChange[] | null, source: ChangeSource) => {
        if (!data || !noteKeys || !changes) return;

        const updatedNotes = [...data];
        changes.forEach((change) => {
            if (!change) return;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [row, colName, _prev, next] = change;
            let newVal = next;
            if (newVal === null || newVal === '') {
                newVal = undefined;
            }
            updatedNotes[row] = {
                ...updatedNotes[row],
                note: {
                    ...updatedNotes[row].note,
                    [(colName as string).split('.')[1]]: newVal, // col names are given to us in the form "note.key"
                },
            };
            delete updatedNotes[row].analysisDescription;
        });
        updateNotes(updatedNotes);
    };

    const handleBeforePaste = (pastedData: any[][], coords: RangeType[]) => {
        if (!data) return false;
        sanitizePaste(pastedData);
        return true;
    };

    const memoizedData = useMemo(() => {
        return JSON.parse(JSON.stringify(data || []));
    }, [data]);

    return (
        <Box sx={{ width: '100%', height: '100%' }}>
            <HotTable
                {...HotSettings}
                afterChange={handleAfterChange}
                beforePaste={handleBeforePaste}
                width="100%"
                height="auto"
                hiddenRows={{
                    rows: hiddenRows,
                    indicators: false,
                }}
                colWidths={colWidths}
                columns={columns}
                colHeaders={colHeaders}
                data={memoizedData}
                ref={hotTableRef}
            />
        </Box>
    );
};

export default EditStudyAnnotationsHotTable;
