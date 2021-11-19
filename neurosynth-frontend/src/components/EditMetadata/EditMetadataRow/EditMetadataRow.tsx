import React from 'react';
import EditMetadataRowStyles from './EditMetadataRowStyles';
import EditMetadataBoolean from './EditMetadataValue/EditMetadataBoolean';
import EditMetadataNumber from './EditMetadataValue/EditMetadataNumber';
import EditMetadataString from './EditMetadataValue/EditMetadataString';
import { useState } from 'react';
import { Button } from '@mui/material';
import { useCallback } from 'react';
import { getStartValFromType } from './AddMetadataRow';
import { EPropertyType, IEditMetadataRowModel } from '..';
import { Box } from '@mui/system';
import ToggleType from './ToggleType/ToggleType';

const propsAreEqual = (
    prevProp: IEditMetadataRowModel,
    nextProp: IEditMetadataRowModel
): boolean => {
    return (
        prevProp.metadataRow.metadataKey === nextProp.metadataRow.metadataKey &&
        prevProp.metadataRow.metadataValue === nextProp.metadataRow.metadataValue &&
        prevProp.metadataValueType === nextProp.metadataValueType
    );
};

const EditMetadataRow: React.FC<IEditMetadataRowModel> = React.memo((props) => {
    const [metadataRow, setMetadataRow] = useState(props.metadataRow);

    const handleToggle = useCallback(
        (newType: EPropertyType) => {
            setMetadataRow((prevState) => {
                const updatedItem = { ...prevState };

                updatedItem.metadataValue = getStartValFromType(newType);

                props.onMetadataRowEdit(updatedItem);
                return updatedItem;
            });
        },
        [props]
    );

    const handleEditMetadataValue = useCallback(
        (event: string | boolean | number) => {
            const updatedState = { ...metadataRow };
            updatedState.metadataValue = event;
            props.onMetadataRowEdit(updatedState);
        },
        [props, metadataRow]
    );

    const handleDelete = (event: React.MouseEvent) => {
        props.onMetadataRowDelete(metadataRow);
    };

    let component: JSX.Element;
    switch (props.metadataValueType) {
        case EPropertyType.BOOLEAN:
            component = (
                <EditMetadataBoolean
                    onEdit={handleEditMetadataValue}
                    value={metadataRow.metadataValue}
                />
            );
            break;
        case EPropertyType.STRING:
            component = (
                <EditMetadataString
                    onEdit={handleEditMetadataValue}
                    value={metadataRow.metadataValue}
                />
            );
            break;
        case EPropertyType.NUMBER:
            component = (
                <EditMetadataNumber
                    onEdit={handleEditMetadataValue}
                    value={metadataRow.metadataValue}
                />
            );
            break;
        default:
            component = (
                <Box component="span" sx={{ color: 'warning.dark' }}>
                    null
                </Box>
            );
            break;
    }

    return (
        <>
            <Box sx={EditMetadataRowStyles.tableRow}>
                <ToggleType type={props.metadataValueType} onToggle={handleToggle} />
                <Box
                    sx={{
                        ...EditMetadataRowStyles.tableCell,
                        ...EditMetadataRowStyles.key,
                    }}
                >
                    <Box component="span">
                        <b>{metadataRow.metadataKey}</b>
                    </Box>
                </Box>
                <Box sx={{ ...EditMetadataRowStyles.tableCell, width: '100%' }}>{component}</Box>
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
                <Box
                    sx={{ ...EditMetadataRowStyles.tableCell, ...EditMetadataRowStyles.spacer }}
                ></Box>
            </Box>
        </>
    );
}, propsAreEqual);

export default EditMetadataRow;
