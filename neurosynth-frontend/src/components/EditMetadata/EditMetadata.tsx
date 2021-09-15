import { useEffect, useState } from 'react';
import EditMetadataStyles from './EditMetadataStyles';
import { DisplayMetadataTableRowModel } from '../DisplayMetadataTable/DisplayMetadataTableRow/DisplayMetadataTableRow';
import EditMetadataRow from './EditMetadataRow/EditMetadataRow';
import { PropertyType } from './EditMetadataRow/ToggleType/ToggleType';
import AddMetadataRow from './EditMetadataRow/AddMetadataRow';

interface EditMetadataModel {
    metadata: DisplayMetadataTableRowModel[];
    onMetadataEditChange: (metadata: DisplayMetadataTableRowModel[]) => void;
}

export const getType = (value: any): PropertyType => {
    switch (typeof value) {
        case PropertyType.BOOLEAN:
            return PropertyType.BOOLEAN;
        case PropertyType.STRING:
            return PropertyType.STRING;
        case PropertyType.NUMBER:
            return PropertyType.NUMBER;
        default:
            return PropertyType.NONE;
    }
};

const EditMetadata: React.FC<EditMetadataModel> = (props) => {
    const classes = EditMetadataStyles();

    // this props.metadata value is only used on the first render so useState is required below for subsequent props changes
    const [metadata, setMetadata] = useState<DisplayMetadataTableRowModel[]>(props.metadata);

    useEffect(() => {
        setMetadata(props.metadata);
    }, [props.metadata]);

    const handleMetadataRowEdit = (updatedRow: DisplayMetadataTableRowModel) => {
        setMetadata((prevState) => {
            const updatedMetadata = [...prevState];
            const valueToEditFound = updatedMetadata.find(
                (x) => x.metadataKey === updatedRow.metadataKey
            );
            if (valueToEditFound) {
                valueToEditFound.metadataValue = updatedRow.metadataValue;
            }
            props.onMetadataEditChange(updatedMetadata);

            return prevState;
        });
    };

    const handleMetadataRowDelete = (updatedRow: DisplayMetadataTableRowModel) => {
        setMetadata((prevState) => {
            const updatedMetadata = prevState.filter(
                (element) => element.metadataKey !== updatedRow.metadataKey
            );
            props.onMetadataEditChange(updatedMetadata);
            return updatedMetadata;
        });
    };

    const handleAddMetadataRow = (row: DisplayMetadataTableRowModel): boolean => {
        const keyExists = !!metadata.find((item) => item.metadataKey === row.metadataKey);
        if (keyExists) {
            return false;
        } else {
            setMetadata((prevState) => {
                const updatedState = [...prevState];
                updatedState.unshift({ ...row });
                props.onMetadataEditChange(updatedState);
                return updatedState;
            });
            return true;
        }
    };

    return (
        <>
            <div className={classes.table}>
                <AddMetadataRow onAddMetadataRow={handleAddMetadataRow} />
            </div>
            <hr className={classes.hr} />
            {metadata.length === 0 && <span className={classes.noContent}>No Metadata</span>}
            <div className={classes.table}>
                {metadata.map((metadataRow) => (
                    <EditMetadataRow
                        key={metadataRow.metadataKey}
                        metadataValueType={getType(metadataRow.metadataValue)}
                        onMetadataRowEdit={handleMetadataRowEdit}
                        onMetadataRowDelete={handleMetadataRowDelete}
                        metadataRow={metadataRow}
                    />
                ))}
            </div>
        </>
    );
};

export default EditMetadata;
