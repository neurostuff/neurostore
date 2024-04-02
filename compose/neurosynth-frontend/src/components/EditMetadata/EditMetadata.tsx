import React from 'react';
import EditMetadataStyles from './EditMetadata.styles';
import EditMetadataRow from './EditMetadataRow/EditMetadataRow';
import AddMetadataRow from './EditMetadataRow/AddMetadataRow';
import { IEditMetadataModel, getType } from '.';
import { Box, Divider } from '@mui/material';

const EditMetadata: React.FC<IEditMetadataModel> = React.memo((props) => {
    const {
        keyPlaceholderText,
        valuePlaceholderText,
        metadata,
        onMetadataRowEdit,
        onMetadataRowDelete,
        onMetadataRowAdd,
        disabled = false,
    } = props;

    return (
        <>
            <Box sx={[EditMetadataStyles.table, { height: '70px' }]}>
                <AddMetadataRow
                    disabled={disabled}
                    keyPlaceholderText={keyPlaceholderText}
                    valuePlaceholderText={valuePlaceholderText}
                    onAddMetadataRow={onMetadataRowAdd}
                />
            </Box>
            <Divider sx={EditMetadataStyles.hr} />
            {metadata.length === 0 && (
                <Box component="div" sx={EditMetadataStyles.noMetadataMessage}>
                    No Metadata
                </Box>
            )}
            <Box sx={[EditMetadataStyles.table, EditMetadataStyles.tableOverflow]}>
                {metadata.map((metadataRow) => (
                    <EditMetadataRow
                        key={metadataRow.metadataKey}
                        metadataValueType={getType(metadataRow.metadataValue)}
                        onMetadataRowEdit={onMetadataRowEdit}
                        onMetadataRowDelete={onMetadataRowDelete}
                        metadataRow={metadataRow}
                        disabled={disabled}
                    />
                ))}
            </Box>
        </>
    );
});

export default EditMetadata;
