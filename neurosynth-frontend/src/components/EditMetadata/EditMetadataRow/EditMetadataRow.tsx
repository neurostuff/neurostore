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

export interface EditMetadataRowModel {
    metadataValueType: PropertyType;
    metadataRow: DisplayMetadataTableRowModel;
    index: number;
    onMetadataRowEdit: (index: number, metadataRow: DisplayMetadataTableRowModel) => void;
    onMetadataRowDelete: (index: number) => void;
}

export interface IEditMetadataField {
    onEdit: (newValue: string | number | boolean) => void;
    value: string | number | boolean;
}

const propsAreEqual = (prevProp: EditMetadataRowModel, nextProp: EditMetadataRowModel): boolean => {
    return (
        prevProp.index === nextProp.index &&
        prevProp.metadataRow.metadataKey === nextProp.metadataRow.metadataKey &&
        prevProp.metadataRow.metadataValue === nextProp.metadataRow.metadataValue &&
        prevProp.metadataValueType === nextProp.metadataValueType
    );
};

const EditMetadataRow: React.FC<EditMetadataRowModel> = React.memo((props) => {
    console.log('editmetadatarow render');

    const classes = EditMetadataRowStyles();
    const [metadataRow, setMetadataRow] = useState(props.metadataRow);

    const handleToggle = useCallback(
        (newType: PropertyType) => {
            setMetadataRow((prevState) => {
                const updatedItem = { ...prevState };

                switch (newType) {
                    case PropertyType.BOOLEAN:
                        updatedItem.metadataValue = false;
                        break;
                    case PropertyType.NUMBER:
                        updatedItem.metadataValue = 0;
                        break;
                    case PropertyType.STRING:
                        updatedItem.metadataValue = '';
                        break;
                    default:
                        updatedItem.metadataValue = null;
                        break;
                }

                props.onMetadataRowEdit(props.index, updatedItem);
                return updatedItem;
            });
        },
        [props]
    );

    const handleEditMetadataValue = useCallback(
        (event: string | boolean | number) => {
            const updatedState = { ...metadataRow };
            updatedState.metadataValue = event;
            props.onMetadataRowEdit(props.index, updatedState);
        },
        [props, metadataRow]
    );

    const handleDelete = (event: React.MouseEvent) => {
        props.onMetadataRowDelete(props.index);
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
                        Delete
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
