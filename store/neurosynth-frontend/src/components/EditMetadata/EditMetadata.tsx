import React from 'react';
import EditMetadataStyles from './EditMetadata.styles';
import EditMetadataRow from './EditMetadataRow/EditMetadataRow';
import AddMetadataRow from './EditMetadataRow/AddMetadataRow';
import { EPropertyType, IEditMetadataModel } from '.';
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
    const { metadata, onMetadataRowEdit, onMetadataRowDelete, onMetadataRowAdd } = props;

    return (
        <>
            <Box sx={{ ...EditMetadataStyles.table, marginTop: '7px' }}>
                <AddMetadataRow onAddMetadataRow={onMetadataRowAdd} />
            </Box>
            <Divider sx={EditMetadataStyles.hr} />
            {metadata.length === 0 && (
                <Box component="div" sx={EditMetadataStyles.noMetadataMessage}>
                    No Metadata
                </Box>
            )}
            <Box sx={EditMetadataStyles.table}>
                {metadata.map((metadataRow) => (
                    <EditMetadataRow
                        key={metadataRow.metadataKey}
                        metadataValueType={getType(metadataRow.metadataValue)}
                        onMetadataRowEdit={onMetadataRowEdit}
                        onMetadataRowDelete={onMetadataRowDelete}
                        metadataRow={metadataRow}
                    />
                ))}
            </Box>
        </>
    );
});

export default EditMetadata;
