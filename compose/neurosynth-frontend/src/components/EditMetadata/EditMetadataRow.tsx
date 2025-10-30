import React from 'react';
import { Button, Box } from '@mui/material';
import { useCallback } from 'react';
import { getStartValFromType } from './AddMetadataRow';
import { EPropertyType, IEditMetadataRowModel, IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import ToggleType from './ToggleType';
import EditMetadataValue from './EditMetadataValue';

const EditMetadataRow: React.FC<IEditMetadataRowModel> = React.memo((props) => {
    const { onMetadataRowEdit, onMetadataRowDelete, metadataRow, disabled = false } = props;

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

    const handleDelete = () => {
        onMetadataRowDelete(metadataRow);
    };

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ToggleType disabled={disabled} type={props.metadataValueType} onToggle={handleToggle} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <b>{metadataRow.metadataKey}</b>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <EditMetadataValue
                    onEditMetadataValue={handleEditMetadataValue}
                    value={props.metadataRow.metadataValue}
                    type={props.metadataValueType}
                    disabled={disabled}
                />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Button color="error" size="small" onClick={handleDelete} disabled={disabled}>
                    DELETE
                </Button>
            </Box>
        </>
    );
});

export default EditMetadataRow;
