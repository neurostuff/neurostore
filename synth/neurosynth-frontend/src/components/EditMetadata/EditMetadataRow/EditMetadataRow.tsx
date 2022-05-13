import React from 'react';
import EditMetadataRowStyles from './EditMetadataRow.styles';
import { Button } from '@mui/material';
import { useCallback } from 'react';
import { getStartValFromType } from './AddMetadataRow';
import { EPropertyType, IEditMetadataRowModel, IMetadataRowModel } from '..';
import { Box } from '@mui/system';
import ToggleType from './ToggleType/ToggleType';
import EditMetadataValue from '../EditMetadataValue/EditMetadataValue';

const EditMetadataRow: React.FC<IEditMetadataRowModel> = React.memo((props) => {
    const { onMetadataRowEdit, onMetadataRowDelete, metadataRow } = props;

    const handleEditMetadataValue = useCallback(
        (event: string | boolean | number) => {
            const updatedState: IMetadataRowModel = {
                ...metadataRow,
                metadataValue: event,
            };
            onMetadataRowEdit(updatedState);
        },
        [onMetadataRowEdit, metadataRow]
    );

    const handleToggle = useCallback(
        (newType: EPropertyType) => {
            const newVal = getStartValFromType(newType);
            const updatedState: IMetadataRowModel = {
                ...metadataRow,
                metadataValue: newVal,
            };
            onMetadataRowEdit(updatedState);
        },
        [onMetadataRowEdit, metadataRow]
    );

    const handleDelete = (_event: React.MouseEvent) => {
        onMetadataRowDelete(metadataRow);
    };

    return (
        <>
            <Box sx={EditMetadataRowStyles.tableRow}>
                <ToggleType type={props.metadataValueType} onToggle={handleToggle} />
                <Box
                    sx={[
                        EditMetadataRowStyles.tableCell,
                        EditMetadataRowStyles.key,
                        { verticalAlign: 'middle !important' },
                    ]}
                >
                    <Box component="span">
                        <b>{metadataRow.metadataKey}</b>
                    </Box>
                </Box>
                <Box sx={[EditMetadataRowStyles.tableCell, { width: '100%' }]}>
                    <EditMetadataValue
                        onEditMetadataValue={handleEditMetadataValue}
                        value={props.metadataRow.metadataValue}
                        type={props.metadataValueType}
                    />
                </Box>
                <Box sx={EditMetadataRowStyles.tableCell}>
                    <Button
                        sx={EditMetadataRowStyles.updateButton}
                        color="error"
                        onClick={handleDelete}
                    >
                        DELETE
                    </Button>
                </Box>
            </Box>
            <Box sx={EditMetadataRowStyles.tableRow}>
                <Box sx={[EditMetadataRowStyles.tableCell, EditMetadataRowStyles.spacer]}></Box>
            </Box>
        </>
    );
});

export default EditMetadataRow;
