import { Box, Button, TextField, Typography } from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import EditMetadata from 'components/EditMetadata/EditMetadata';
import { IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import React, { useCallback } from 'react';
import {
    useAddOrUpdateMetadata,
    useDeleteMetadataRow,
    useStudyAuthors,
    useStudyDescription,
    useStudyDOI,
    useStudyMetadata,
    useStudyName,
    useStudyPMCID,
    useStudyPMID,
    useStudyPublication,
    useStudyYear,
    useUpdateStudyDetails,
} from 'stores/study/StudyStore';
import { StudyDetails } from 'stores/study/StudyStore.helpers';

const sectionTitleSx = {
    fontWeight: 600,
    color: 'secondary.main',
    mb: 1,
} as const;

const fieldSpacing = { width: '100%', marginBottom: '0.75rem' } as const;

const EditStudyDetailsDialogIBMA: React.FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    const name = useStudyName();
    const description = useStudyDescription();
    const authors = useStudyAuthors();
    const publication = useStudyPublication();
    const doi = useStudyDOI();
    const pmid = useStudyPMID();
    const pmcid = useStudyPMCID();
    const year = useStudyYear();
    const updateStudyDetails = useUpdateStudyDetails();

    const metadata = useStudyMetadata();
    const addOrUpdateMetadata = useAddOrUpdateMetadata();
    const deleteMetadataRow = useDeleteMetadataRow();

    const handleUpdate = (update: string, field: keyof StudyDetails) => {
        let value: string | number;
        if (field === 'year') {
            const updatedYear = parseInt(update, 10);
            if (Number.isNaN(updatedYear)) return;
            value = updatedYear;
        } else {
            value = update;
        }
        updateStudyDetails(field as keyof StudyDetails, value);
    };

    const handleMetadataRowEdit = useCallback(
        (updatedRow: IMetadataRowModel) => {
            addOrUpdateMetadata(updatedRow);
        },
        [addOrUpdateMetadata]
    );

    const handleMetadataRowDelete = useCallback(
        (updatedRow: IMetadataRowModel) => {
            deleteMetadataRow(updatedRow.metadataKey);
        },
        [deleteMetadataRow]
    );

    const handleMetadataRowAdd = useCallback(
        (row: IMetadataRowModel): boolean => {
            const foundIndex = metadata.findIndex((x) => x.metadataKey === row.metadataKey);
            if (foundIndex < 0) {
                addOrUpdateMetadata(row);
                return true;
            }
            return false;
        },
        [addOrUpdateMetadata, metadata]
    );

    return (
        <BaseDialog
            isOpen={isOpen}
            dialogTitle="Edit study details"
            onCloseDialog={onClose}
            fullWidth
            maxWidth="md"
            dialogContentSx={{ pt: 1, pb: 2, overflow: 'auto' }}
        >
            <Box data-testid="edit-study-ibma-details-dialog" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Box>
                    <Typography variant="subtitle2" sx={sectionTitleSx}>
                        Study details
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Changes apply to this study in the editor. Use Save in the toolbar to persist to the server.
                    </Typography>
                    <TextField
                        label="Title"
                        size="small"
                        sx={fieldSpacing}
                        value={name || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'name')}
                    />
                    <TextField
                        label="Authors"
                        size="small"
                        sx={fieldSpacing}
                        value={authors || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'authors')}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                        <TextField
                            label="Journal"
                            size="small"
                            sx={{ flex: '1 1 48%', minWidth: '12rem', marginBottom: '0.75rem' }}
                            value={publication || ''}
                            onChange={(event) => handleUpdate(event.target.value, 'publication')}
                        />
                        <TextField
                            label="DOI"
                            size="small"
                            sx={{ flex: '1 1 48%', minWidth: '12rem', marginBottom: '0.75rem' }}
                            value={doi || ''}
                            onChange={(event) => handleUpdate(event.target.value, 'doi')}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                        <TextField
                            label="PMID"
                            size="small"
                            sx={{ flex: '1 1 30%', minWidth: '8rem', marginBottom: '0.75rem' }}
                            value={pmid || ''}
                            onChange={(event) => handleUpdate(event.target.value, 'pmid')}
                        />
                        <TextField
                            label="PMCID"
                            size="small"
                            sx={{ flex: '1 1 30%', minWidth: '8rem', marginBottom: '0.75rem' }}
                            value={pmcid || ''}
                            onChange={(event) => handleUpdate(event.target.value, 'pmcid')}
                        />
                        <TextField
                            onWheel={(event) => {
                                event.preventDefault();
                            }}
                            label="Year"
                            size="small"
                            sx={{ flex: '1 1 30%', minWidth: '8rem', marginBottom: '0.75rem' }}
                            type="number"
                            value={year ?? ''}
                            onChange={(event) => handleUpdate(event.target.value, 'year')}
                        />
                    </Box>
                    <TextField
                        label="Description or abstract"
                        size="small"
                        sx={{ width: '100%' }}
                        value={description || ''}
                        multiline
                        minRows={3}
                        onChange={(event) => handleUpdate(event.target.value, 'description')}
                    />
                </Box>

                <Box>
                    <Typography variant="subtitle2" sx={sectionTitleSx}>
                        Metadata
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Custom key-value fields (for example sample size). Keys must be unique.
                    </Typography>
                    <EditMetadata
                        onMetadataRowAdd={handleMetadataRowAdd}
                        onMetadataRowEdit={handleMetadataRowEdit}
                        onMetadataRowDelete={handleMetadataRowDelete}
                        metadata={metadata}
                    />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
                    <Button variant="contained" color="primary" disableElevation onClick={onClose}>
                        Close
                    </Button>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default EditStudyDetailsDialogIBMA;
