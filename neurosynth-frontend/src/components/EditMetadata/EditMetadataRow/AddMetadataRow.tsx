import { Box, Button, TextField } from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useEffect } from 'react';
import { IAddMetadataRowModel, EPropertyType } from '..';
import { DisplayMetadataTableRowModel, ToggleType } from '../..';
import EditMetadataRowStyles from './EditMetadataRowStyles';
import EditMetadataBoolean from './EditMetadataValue/EditMetadataBoolean';
import EditMetadataNumber from './EditMetadataValue/EditMetadataNumber';
import EditMetadataString from './EditMetadataValue/EditMetadataString';

export const getStartValFromType = (type: EPropertyType): boolean | number | string | null => {
    switch (type) {
        case EPropertyType.BOOLEAN:
            return false;
        case EPropertyType.NUMBER:
            return 0;
        case EPropertyType.STRING:
            return '';
        default:
            return null;
    }
};

const AddMetadataRow: React.FC<IAddMetadataRowModel> = (props) => {
    const [currType, setCurrType] = useState(EPropertyType.STRING);
    const [editValueComponent, setEditValueComponent] = useState(
        <Box component="span" sx={EditMetadataRowStyles.nullContent}>
            null
        </Box>
    );
    const [isValid, setIsValid] = useState(true);
    const [metadataRow, setMetadataRow] = useState<DisplayMetadataTableRowModel>({
        metadataKey: '',
        metadataValue: '',
    });

    const handleToggle = useCallback((newType: EPropertyType) => {
        setMetadataRow((prevRow) => {
            return {
                metadataKey: prevRow.metadataKey,
                metadataValue: getStartValFromType(newType),
            };
        });
        setCurrType(newType);
    }, []);

    const handleAdd = (event: React.MouseEvent) => {
        if (metadataRow.metadataKey.length > 0) {
            const wasAdded = props.onAddMetadataRow(metadataRow);

            if (wasAdded) {
                setMetadataRow({
                    metadataKey: '',
                    metadataValue: getStartValFromType(currType),
                });
            } else {
                setIsValid(false);
            }
        }
    };

    const handleMetadataKeyChange = (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setIsValid(true);
        setMetadataRow((prevVal) => {
            return {
                ...prevVal,
                metadataKey: event.target.value,
            };
        });
    };

    const handleMetadataValueChange = (newVal: boolean | string | number) => {
        setMetadataRow((prevVal) => {
            return {
                ...prevVal,
                metadataValue: newVal,
            };
        });
    };

    useEffect(() => {
        let component: JSX.Element;
        switch (currType) {
            case EPropertyType.BOOLEAN:
                component = (
                    <EditMetadataBoolean
                        onEdit={handleMetadataValueChange}
                        value={metadataRow.metadataValue}
                    />
                );
                break;
            case EPropertyType.STRING:
                component = (
                    <EditMetadataString
                        onEdit={handleMetadataValueChange}
                        value={metadataRow.metadataValue}
                    />
                );
                break;
            case EPropertyType.NUMBER:
                component = (
                    <EditMetadataNumber
                        onEdit={handleMetadataValueChange}
                        value={metadataRow.metadataValue}
                    />
                );
                break;
            default:
                component = <Box sx={EditMetadataRowStyles.nullContent}>null</Box>;
                break;
        }
        setEditValueComponent(component);
    }, [currType, metadataRow.metadataValue]);

    return (
        <Box sx={EditMetadataRowStyles.tableRow}>
            <Box sx={{ display: 'flex' }}>
                <ToggleType type={currType} onToggle={handleToggle} />
            </Box>
            <Box sx={{ ...EditMetadataRowStyles.tableCell, ...EditMetadataRowStyles.key }}>
                <TextField
                    sx={EditMetadataRowStyles.addMetadataTextfield}
                    onChange={handleMetadataKeyChange}
                    variant="outlined"
                    placeholder="New metadata key"
                    fullWidth
                    helperText={!isValid ? 'All metadata keys must be unique' : ''}
                    error={!isValid}
                    value={metadataRow.metadataKey}
                />
                {/* This component is added so that the error message doesn't mess up the row alignment */}
                {isValid && <Box sx={{ height: '22px' }}></Box>}
            </Box>
            <Box sx={{ ...EditMetadataRowStyles.tableCell, width: '100%' }}>
                {editValueComponent}
                {/* This component is added so that the error message doesn't mess up the row alignment */}
                <Box sx={{ height: '22px' }}></Box>
            </Box>
            <Box sx={EditMetadataRowStyles.tableCell}>
                <Button
                    sx={EditMetadataRowStyles.updateButton}
                    disabled={!(metadataRow.metadataKey.length > 0)}
                    onClick={handleAdd}
                    color="primary"
                >
                    ADD
                </Button>
                {/* This component is added so that the error message doesn't mess up the row alignment */}
                <Box sx={{ height: '22px' }}></Box>
            </Box>
        </Box>
    );
};

export default AddMetadataRow;
