import { useEffect, useState } from 'react';
import EditMetadataStyles from './EditMetadataStyles';
import { DisplayMetadataTableRowModel } from '../DisplayMetadataTable/DisplayMetadataTableRow/DisplayMetadataTableRow';
import EditMetadataRow from './EditMetadataRow/EditMetadataRow';
import { PropertyType } from './EditMetadataRow/ToggleType/ToggleType';
import AddMetadataRow from './EditMetadataRow/AddMetadataRow';

interface EditMetadataModel {
    metadata: DisplayMetadataTableRowModel[];
    onMetadataEditChange: (metadata: { [key: string]: any }) => void;
}

const arrayToMetadata = (arr: DisplayMetadataTableRowModel[]): { [key: string]: any } => {
    const tempObj: { [key: string]: any } = {};
    arr.forEach((element) => (tempObj[element.metadataKey] = element.metadataValue));
    return tempObj;
};

const getType = (value: string): PropertyType => {
    switch (typeof value) {
        case PropertyType.BOOLEAN:
            return PropertyType.BOOLEAN;
        case PropertyType.STRING:
            return PropertyType.STRING;
        case PropertyType.NUMBER:
            return PropertyType.NUMBER;
        default:
            return PropertyType.OTHER;
    }
};

const EditMetadata: React.FC<EditMetadataModel> = (props) => {
    const classes = EditMetadataStyles();
    const [metadata, setMetadata] = useState<DisplayMetadataTableRowModel[]>(props.metadata);

    // useEffect(() => {
    //     console.log(props.metadata);

    //     setMetadata(props.metadata);
    // }, [props.metadata]);

    const handleMetadataRowEdit = (index: number, updatedRow: DisplayMetadataTableRowModel) => {
        const updatedMetadata = [...metadata];
        updatedMetadata[index] = updatedRow;
        props.onMetadataEditChange(arrayToMetadata(updatedMetadata));
    };

    const handleMetadataRowDelete = (index: number) => {
        setMetadata((prevState) => {
            const updatedState = prevState.filter((_, elemIndex) => elemIndex !== index);
            props.onMetadataEditChange(arrayToMetadata(updatedState));
            return updatedState;
        });
    };

    const handleAddMetadataRow = (row: DisplayMetadataTableRowModel): boolean => {
        const keyExists = !!metadata.find((item) => item.metadataKey === row.metadataKey);
        if (keyExists) {
            return false;
        } else {
            setMetadata((prevState) => {
                const updatedMetadata = [...prevState];
                updatedMetadata.unshift(row);
                props.onMetadataEditChange(arrayToMetadata(updatedMetadata));
                return updatedMetadata;
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
            <div className={classes.table}>
                {metadata.map((metadataRow, index) => (
                    <EditMetadataRow
                        index={index}
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
