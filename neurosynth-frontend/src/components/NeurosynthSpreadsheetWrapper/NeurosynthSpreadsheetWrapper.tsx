import { Box } from '@mui/system';
import React, { useEffect, useState } from 'react';
import { INeurosynthSpreadsheetData } from '.';
import NeurosynthSpreadsheet from './NeurosynthSpreadsheet/NeurosynthSpreadsheet';

/**
 * This component is mainly used as a wrapper in order to improve performance and reduce re renders due to
 * changing state
 */
const NeurosynthSpreadsheetWrapper: React.FC<INeurosynthSpreadsheetData> = (props) => {
    const { data, onColumnDelete, onCellUpdates, columnHeaderValues, rowHeaderValues } = props;
    const [spreadsheetData, setSpreadsheetData] = useState(data);

    useEffect(() => {
        /* HotTable maintains local state management within itself.
         * In order to ensure that data updates do not cause unnecessary spreadsheet rerenders, we only update the spreadsheetData (spreadsheet data source)
         * when columns are added or removed. As HotTable maintains its own local state, this is the only time we would need to update HotTable
         * as the update is coming from outside.
         */
        if (data.length > 0 && spreadsheetData.length > 0) {
            const externalDataNoteColsNum = Object.keys(data[0]).length;
            const spreadsheetDataNoteColsNum = Object.keys(spreadsheetData[0]).length;

            if (externalDataNoteColsNum !== spreadsheetDataNoteColsNum) setSpreadsheetData(data);
        }
    }, [data, spreadsheetData]);

    return (
        <Box component="div">
            {columnHeaderValues.length === 0 && (
                <Box sx={{ color: 'warning.dark', height: '35px' }}>
                    There are no notes for this annotation yet
                </Box>
            )}

            <NeurosynthSpreadsheet
                rowHeaderValues={rowHeaderValues}
                columnHeaderValues={columnHeaderValues}
                onCellUpdates={onCellUpdates}
                onColumnDelete={onColumnDelete}
                data={spreadsheetData}
            />
        </Box>
    );
};

export default NeurosynthSpreadsheetWrapper;
