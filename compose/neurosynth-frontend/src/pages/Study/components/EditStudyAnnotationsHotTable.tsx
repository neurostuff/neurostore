import { HotTable } from '@handsontable/react';
import { Box } from '@mui/material';
import AddMetadataRow from 'components/EditMetadata/AddMetadataRow';
import { getType, IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import { sanitizePaste } from 'components/HotTables/HotTables.utils';
import { CellChange } from 'handsontable/common';
import { useUserCanEdit } from 'hooks';
import { useProjectUser } from 'pages/Project/store/ProjectStore';
import { HotSettings } from 'pages/Study/components/EditStudyAnnotationsHotTable.helpers';
import useEditStudyAnnotationsHotTable from 'pages/Study/hooks/useEditStudyAnnotationsHotTable';
import { useMemo, useRef } from 'react';
import {
    useAnnotationNoteKeys,
    useCreateAnnotationColumn,
    useUpdateAnnotationNotes,
} from 'stores/AnnotationStore.actions';

const EditStudyAnnotationsHotTable: React.FC<{ readonly?: boolean }> = ({ readonly = false }) => {
    const hotTableRef = useRef<HotTable>(null);
    const noteKeys = useAnnotationNoteKeys();
    const updateNotes = useUpdateAnnotationNotes();
    const createAnnotationColumn = useCreateAnnotationColumn();
    const { colWidths, colHeaders, columns, hiddenRows, data } = useEditStudyAnnotationsHotTable(readonly);
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const handleAfterChange = (changes: CellChange[] | null) => {
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

    const handleBeforePaste = (pastedData: unknown[][]) => {
        if (!data) return false;
        sanitizePaste(pastedData);
        return true;
    };

    const handleAddHotColumn = (row: IMetadataRowModel) => {
        if (!noteKeys) return false;
        const trimmedKey = row.metadataKey.trim();
        if (noteKeys.find((x) => x.key === trimmedKey)) return false;

        createAnnotationColumn({
            key: trimmedKey,
            type: getType(row.metadataValue),
        });

        return true;
    };

    const memoizedData = useMemo(() => {
        return JSON.parse(JSON.stringify(data || []));
    }, [data]);

    return (
        <Box>
            {canEdit && !readonly && (
                <Box
                    sx={{
                        mb: 3,
                        width: {
                            xs: '100%',
                            md: '80%',
                            lg: '70%',
                        },
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: 4,
                    }}
                >
                    <AddMetadataRow
                        keyPlaceholderText="New Column"
                        onAddMetadataRow={handleAddHotColumn}
                        showMetadataValueInput={false}
                        allowNumber={false}
                        allowNone={false}
                        errorMessage="can't add column (key already exists)"
                    />
                </Box>
            )}
            <Box sx={{ width: '100%', height: '100%' }}>
                <HotTable
                    {...HotSettings}
                    afterChange={handleAfterChange}
                    beforePaste={handleBeforePaste}
                    width="100%"
                    height="auto"
                    stretchH="all"
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
        </Box>
    );
};

export default EditStudyAnnotationsHotTable;
