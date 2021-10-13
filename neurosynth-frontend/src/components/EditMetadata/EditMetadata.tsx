import { useEffect, useState } from 'react';
import EditMetadataStyles from './EditMetadataStyles';
import EditMetadataRow from './EditMetadataRow/EditMetadataRow';
import AddMetadataRow from './EditMetadataRow/AddMetadataRow';
import { DisplayMetadataTableRowModel } from '..';
import { EPropertyType, IEditMetadataModel } from '.';
import { Box } from '@mui/system';

export const getType = (value: any): EPropertyType => {
    switch (typeof value) {
        case EPropertyType.BOOLEAN:
            return EPropertyType.BOOLEAN;
        case EPropertyType.STRING:
            return EPropertyType.STRING;
        case EPropertyType.NUMBER:
            return EPropertyType.NUMBER;
        default:
            return EPropertyType.NONE;
    }
};

const EditMetadata: React.FC<IEditMetadataModel> = (props) => {
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

    const handleMetadataRowAdd = (row: DisplayMetadataTableRowModel): boolean => {
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
            <Box sx={EditMetadataStyles.table}>
                <AddMetadataRow onAddMetadataRow={handleMetadataRowAdd} />
            </Box>
            <Box component="hr" sx={EditMetadataStyles.hr} />
            {metadata.length === 0 && (
                <Box component="span" sx={{ color: 'warning.dark' }}>
                    No Metadata
                </Box>
            )}
            <Box sx={EditMetadataStyles.table}>
                {metadata.map((metadataRow) => (
                    <EditMetadataRow
                        key={metadataRow.metadataKey}
                        metadataValueType={getType(metadataRow.metadataValue)}
                        onMetadataRowEdit={handleMetadataRowEdit}
                        onMetadataRowDelete={handleMetadataRowDelete}
                        metadataRow={metadataRow}
                    />
                ))}
            </Box>
        </>
    );
};

export default EditMetadata;
