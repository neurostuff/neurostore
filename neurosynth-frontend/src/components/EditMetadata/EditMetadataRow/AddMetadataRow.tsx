import { Button, TextField } from '@mui/material';
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
    const classes = EditMetadataRowStyles();
    const [currType, setCurrType] = useState(EPropertyType.STRING);
    const [editValueComponent, setEditValueComponent] = useState(
        <span className={classes.nullContent}>null</span>
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
                component = <span className={classes.nullContent}>null</span>;
                break;
        }
        setEditValueComponent(component);
    }, [classes, currType, metadataRow.metadataValue]);

    return (
        <div className={classes.tableRow}>
            <div style={{ display: 'flex' }}>
                <ToggleType type={currType} onToggle={handleToggle} />
            </div>
            <div className={`${classes.tableCell} ${classes.key}`}>
                <TextField
                    className={classes.addMetadataTextfield}
                    onChange={handleMetadataKeyChange}
                    variant="outlined"
                    placeholder="New metadata key"
                    fullWidth
                    helperText={!isValid ? 'All metadata keys must be unique' : ''}
                    error={!isValid}
                    value={metadataRow.metadataKey}
                />
                {isValid && <div style={{ height: '22px' }}></div>}
            </div>
            <div className={classes.tableCell} style={{ width: ' 100%' }}>
                <div>{editValueComponent}</div>
                <div style={{ height: '22px' }}></div>
            </div>
            <div className={classes.tableCell}>
                <Button
                    className={classes.updateButton}
                    disabled={!(metadataRow.metadataKey.length > 0)}
                    onClick={handleAdd}
                    color="primary"
                >
                    ADD
                </Button>
                <div style={{ height: '22px' }}></div>
            </div>
        </div>
    );
};

export default AddMetadataRow;
