import { Box, Typography } from '@mui/material';
import { useState } from 'react';
import { DisplayValuesTable, IDisplayValuesTableModel } from '../../..';
import { IMetadataRowModel } from '../../../EditMetadata';
import AddMetadataRow from '../../../EditMetadata/EditMetadataRow/AddMetadataRow';
import { IDynamicFormInput } from './DynamicForm';

const DynamicFormKwargInput: React.FC<IDynamicFormInput> = (props) => {
    const [kwargList, setKwargList] = useState<{ key: string; value: string }[]>([]);

    const handleActionSelected = (id: string) => {
        setKwargList((prevState) => {
            const newArr = [...prevState];
            const index = newArr.findIndex((x) => x.key === id);
            if (index < 0) return prevState;

            newArr.splice(index, 1);
            return newArr;
        });
    };

    const handleOnAddMetadataRow = (row: IMetadataRowModel) => {
        if (kwargList.findIndex((x) => x.key === row.metadataKey) >= 0) return false;

        setKwargList((prevState) => {
            const newArr = [...prevState];
            newArr.unshift({
                key: row.metadataKey,
                value: row.metadataValue,
            });
            return newArr;
        });
        return true;
    };

    const dataForKwargsTable: IDisplayValuesTableModel = {
        columnHeaders: [
            { value: 'Variable', bold: true },
            { value: 'Argument', bold: true },
            { value: '' },
        ],
        paper: true,
        rowData: kwargList.map((kwarg) => ({
            uniqueKey: kwarg.key,
            columnValues: [
                {
                    value: kwarg.key,
                },
                {
                    value: kwarg.value,
                },
                {
                    value: 'delete',
                    isAction: true,
                    actionStyling: 'error',
                },
            ],
        })),
        onActionSelected: handleActionSelected,
    };

    return (
        <Box sx={{ marginBottom: '2.5rem' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {props.parameterName}
            </Typography>
            <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                {props.value.description}
            </Typography>

            <Box
                sx={{
                    display: 'block',
                    width: '50%',
                    borderCollapse: 'separate',
                    borderSpacing: '5px 0',
                }}
            >
                <AddMetadataRow
                    keyPlaceholderText="new variable"
                    valuePlaceholderText="new argument"
                    errorMessage="all variables must be unique"
                    showToggleType={false}
                    onAddMetadataRow={handleOnAddMetadataRow}
                />
            </Box>

            <Box sx={{ width: '50%' }}>
                <DisplayValuesTable {...dataForKwargsTable} />
            </Box>
        </Box>
    );
};

export default DynamicFormKwargInput;
