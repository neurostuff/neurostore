import React from 'react';
import EditMetadataRowStyles from './EditMetadataRowStyles';
import EditMetadataBoolean from './EditMetadataValue/EditMetadataBoolean';
import EditMetadataNumber from './EditMetadataValue/EditMetadataNumber';
import EditMetadataString from './EditMetadataValue/EditMetadataString';
import { useState } from 'react';
import { Button } from '@mui/material';
import { useCallback } from 'react';
import { getStartValFromType } from './AddMetadataRow';
import { IEditMetadataRowModel, EPropertyType } from '..';
import { ToggleType } from '../..';

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
    const classes = EditMetadataRowStyles();
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
            component = <span className={classes.nullContent}>null</span>;
            break;
    }

    return (
        <>
            <div className={classes.tableRow}>
                <ToggleType type={props.metadataValueType} onToggle={handleToggle} />
                <div className={`${classes.tableCell} ${classes.key}`}>
                    <span>
                        <b>{metadataRow.metadataKey}</b>
                    </span>
                </div>
                <div className={classes.tableCell} style={{ width: '100%' }}>
                    <div>{component}</div>
                </div>
                <div className={classes.tableCell}>
                    <Button
                        className={`${classes.updateButton}`}
                        color="error"
                        onClick={handleDelete}
                    >
                        DELETE
                    </Button>
                </div>
            </div>
            <div className={classes.tableRow}>
                <div className={`${classes.tableCell} ${classes.spacer}`}></div>
            </div>
        </>
    );
}, propsAreEqual);

export default EditMetadataRow;
