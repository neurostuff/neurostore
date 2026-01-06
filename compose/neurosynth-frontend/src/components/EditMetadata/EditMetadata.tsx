import React from 'react';
import EditMetadataStyles from './EditMetadata.styles';
import EditMetadataRow from './EditMetadataRow';
import AddMetadataRow from './AddMetadataRow';
import { IEditMetadataModel, getType } from './EditMetadata.types';
import { Box, Divider, Typography } from '@mui/material';

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
        <Box sx={EditMetadataStyles.grid}>
            <AddMetadataRow
                disabled={disabled}
                keyPlaceholderText={keyPlaceholderText}
                valuePlaceholderText={valuePlaceholderText}
                onAddMetadataRow={onMetadataRowAdd}
            />
            <Divider sx={EditMetadataStyles.hr} />
            {metadata.length === 0 && (
                <Box>
                    <Typography gutterBottom color="warning.dark">
                        No Metadata
                    </Typography>
                </Box>
            )}
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
    );
});

export default EditMetadata;
