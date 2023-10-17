import { HotTable } from '@handsontable/react';
import { Box } from '@mui/material';
import { HotSettings } from 'components/HotTables/EditStudyAnnotationsHotTable/EditStudyAnnotationsHotTable.helpers';
import { CellChange, ChangeSource, RangeType } from 'handsontable/common';
import { useRef } from 'react';
import { useAnnotationNoteKeys, useUpdateAnnotationNotes } from 'stores/AnnotationStore.actions';
import { useAnnotationNotes } from 'stores/AnnotationStore.getters';
import { sanitizePaste } from '../helpers/utils';
import useEditStudyAnnotationsHotTable from './useEditStudyAnnotationsHotTable';

const EditStudyAnnotationsHotTable: React.FC = (props) => {
    const hotTableRef = useRef<HotTable>(null);
    const noteKeys = useAnnotationNoteKeys();
    const updateNotes = useUpdateAnnotationNotes();
    const { colWidths, colHeaders, columns, hiddenRows, data, height } =
        useEditStudyAnnotationsHotTable();

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

    return (
        <Box sx={{ width: '100%' }}>
            <HotTable
                {...HotSettings}
                afterChange={handleAfterChange}
                beforePaste={handleBeforePaste}
                height={`${height}px`}
                hiddenRows={{
                    rows: hiddenRows,
                    indicators: false,
                }}
                colWidths={colWidths}
                columns={columns}
                colHeaders={colHeaders}
                data={JSON.parse(JSON.stringify(data || []))}
                ref={hotTableRef}
            />
        </Box>
    );
};

export default EditStudyAnnotationsHotTable;
