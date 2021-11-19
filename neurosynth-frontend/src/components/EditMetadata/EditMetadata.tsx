import React, { useCallback, useState } from 'react';
import EditMetadataStyles from './EditMetadata.styles';
import EditMetadataRow from './EditMetadataRow/EditMetadataRow';
import AddMetadataRow from './EditMetadataRow/AddMetadataRow';
import { IMetadataRowModel, EPropertyType, IEditMetadataModel } from '.';
import { Box, Divider } from '@mui/material';

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

const EditMetadata: React.FC<IEditMetadataModel> = React.memo((props) => {
    const { metadata, onMetadataEditChange } = props;
    const [metadataArr, setMetadataArr] = useState<IMetadataRowModel[]>(metadata);

    /**
     * This function will update the local metadataArr state and also send an
     * update to the parent. The parent update will not cause an additional rerender
     * as we do not watch for prop changes
     */
    const handleMetadataRowEdit = useCallback(
        (updatedRow: IMetadataRowModel) => {
            setMetadataArr((prevState) => {
                const updatedMetadata = [...prevState];
                const valueToEditFound = updatedMetadata.find(
                    (x) => x.metadataKey === updatedRow.metadataKey
                );
                if (valueToEditFound) {
                    valueToEditFound.metadataValue = updatedRow.metadataValue;
                }
                onMetadataEditChange(updatedMetadata);

                return prevState;
            });
        },
        [onMetadataEditChange]
    );

    /**
     * This function will update the local metadataArr state and also send an
     * update to the parent. The parent update will not cause an additional rerender
     * as we do not watch for prop changes
     */
    const handleMetadataRowDelete = useCallback(
        (updatedRow: IMetadataRowModel) => {
            setMetadataArr((prevState) => {
                const updatedMetadata = prevState.filter(
                    (element) => element.metadataKey !== updatedRow.metadataKey
                );
                onMetadataEditChange(updatedMetadata);
                return updatedMetadata;
            });
        },
        [onMetadataEditChange]
    );

    /**
     * This function will update the local metadataArr state and also send an
     * update to the parent. The parent update will not cause an additional rerender
     * as we do not watch for prop changes
     */
    // return true if the metadata row was added successfully, and false otherwise
    const handleMetadataRowAdd = useCallback(
        (row: IMetadataRowModel): boolean => {
            const keyExists = !!metadataArr.find((item) => item.metadataKey === row.metadataKey);
            if (keyExists) {
                return false;
            } else {
                setMetadataArr((prevState) => {
                    const updatedState = [...prevState];
                    updatedState.unshift({ ...row });
                    onMetadataEditChange(updatedState);
                    return updatedState;
                });
                return true;
            }
        },
        [onMetadataEditChange, metadataArr]
    );

    return (
        <>
            <Box sx={{ ...EditMetadataStyles.table, marginTop: '7px' }}>
                <AddMetadataRow onAddMetadataRow={handleMetadataRowAdd} />
            </Box>
            <Divider sx={EditMetadataStyles.hr} />
            {metadataArr.length === 0 && (
                <Box component="div" sx={EditMetadataStyles.noMetadataMessage}>
                    No Metadata
                </Box>
            )}
            <Box sx={EditMetadataStyles.table}>
                {metadataArr.map((metadataRow) => (
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
});

export default EditMetadata;
