import React from 'react';
import { DisplayMetadataTableRowModel } from '../../DisplayMetadataTable/DisplayMetadataTableRow/DisplayMetadataTableRow';
import ToggleType, { PropertyType } from './ToggleType/ToggleType';
import EditMetadataRowStyles from './EditMetadataRowStyles';
import EditMetadataBoolean from './EditMetadataValue/EditMetadataBoolean';
import EditMetadataNumber from './EditMetadataValue/EditMetadataNumber';
import EditMetadataString from './EditMetadataValue/EditMetadataString';
import { useState } from 'react';
import { Button } from '@material-ui/core';
import { useCallback } from 'react';
import { getStartValFromType } from './AddMetadataRow';

export interface EditMetadataRowModel {
    metadataValueType: PropertyType;
    metadataRow: DisplayMetadataTableRowModel;
    onMetadataRowEdit: (metadataRow: DisplayMetadataTableRowModel) => void;
    onMetadataRowDelete: (metadataRow: DisplayMetadataTableRowModel) => void;
}

export interface IEditMetadataField {
    onEdit: (newValue: string | number | boolean) => void;
    value: string | number | boolean;
}

const propsAreEqual = (prevProp: EditMetadataRowModel, nextProp: EditMetadataRowModel): boolean => {
    return (
        prevProp.metadataRow.metadataKey === nextProp.metadataRow.metadataKey &&
        prevProp.metadataRow.metadataValue === nextProp.metadataRow.metadataValue &&
        prevProp.metadataValueType === nextProp.metadataValueType
    );
};

const EditMetadataRow: React.FC<EditMetadataRowModel> = React.memo((props) => {
    const classes = EditMetadataRowStyles();
    const [metadataRow, setMetadataRow] = useState(props.metadataRow);

    const handleToggle = useCallback(
        (newType: PropertyType) => {
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
        case PropertyType.BOOLEAN:
            component = (
                <EditMetadataBoolean
                    onEdit={handleEditMetadataValue}
                    value={metadataRow.metadataValue}
                />
            );
            break;
        case PropertyType.STRING:
            component = (
                <EditMetadataString
                    onEdit={handleEditMetadataValue}
                    value={metadataRow.metadataValue}
                />
            );
            break;
        case PropertyType.NUMBER:
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
                        className={`${classes.updateButton} ${classes.error}`}
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
