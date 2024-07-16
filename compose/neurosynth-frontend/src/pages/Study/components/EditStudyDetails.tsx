import { Box, TextField, Typography } from '@mui/material';
import EditStudyComponentsStyles from 'pages/Study/components/EditStudyComponents.styles';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import {
    useStudyAuthors,
    useStudyDOI,
    useStudyDescription,
    useStudyName,
    useStudyPMCID,
    useStudyPMID,
    useStudyPublication,
    useStudyYear,
    useUpdateStudyDetails,
} from 'pages/Study/store/StudyStore';
import { StudyDetails } from 'pages/Study/store/StudyStore.helpers';
import React from 'react';

const EditStudyDetails: React.FC = React.memo(() => {
    const name = useStudyName();
    const description = useStudyDescription();
    const authors = useStudyAuthors();
    const publication = useStudyPublication();
    const doi = useStudyDOI();
    const pmid = useStudyPMID();
    const pmcid = useStudyPMCID();
    const year = useStudyYear();
    const updateStudyDetails = useUpdateStudyDetails();

    const handleUpdate = (update: string, field: keyof StudyDetails) => {
        let value;
        if (field === 'year') {
            const updatedYear = parseInt(update);
            if (isNaN(updatedYear)) return;
            value = updatedYear;
        } else {
            value = update;
        }
        updateStudyDetails(field as keyof StudyDetails, value);
    };

    return (
        <NeurosynthAccordion
            elevation={0}
            expandIconColor="secondary.main"
            sx={[EditStudyComponentsStyles.accordion]}
            accordionSummarySx={EditStudyComponentsStyles.accordionSummary}
            TitleElement={
                <>
                    <Typography sx={EditStudyComponentsStyles.accordionTitle}>Details</Typography>
                    <Typography sx={{ color: 'secondary.main' }}>
                        (name, authors, description, doi, pmid, etc)
                    </Typography>
                </>
            }
        >
            <Box sx={EditStudyComponentsStyles.accordionContentContainer}>
                <TextField
                    label="name"
                    size="small"
                    sx={{ width: '100%', marginBottom: '0.75rem' }}
                    value={name || ''}
                    onChange={(event) => handleUpdate(event.target.value, 'name')}
                />
                <TextField
                    label="authors"
                    size="small"
                    sx={{ width: '100%', marginBottom: '0.75rem' }}
                    value={authors || ''}
                    onChange={(event) => handleUpdate(event.target.value, 'authors')}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <TextField
                        label="journal"
                        size="small"
                        sx={{ width: '49%', marginBottom: '0.75rem' }}
                        value={publication || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'publication')}
                    />
                    <TextField
                        label="doi"
                        size="small"
                        sx={{ width: '49%', marginBottom: '0.75rem' }}
                        value={doi || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'doi')}
                    />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <TextField
                        label="pmid"
                        size="small"
                        sx={{ width: '33%', marginBottom: '0.75rem' }}
                        value={pmid || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'pmid')}
                    />
                    <TextField
                        label="pmcid"
                        size="small"
                        sx={{ width: '33%', marginBottom: '0.75rem' }}
                        value={pmcid || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'pmcid')}
                    />
                    <TextField
                        onWheel={(event) => {
                            event.preventDefault();
                        }}
                        label="year"
                        size="small"
                        sx={{ width: '33%', marginBottom: '0.75rem' }}
                        type="number"
                        value={year || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'year')}
                    />
                </Box>
                <TextField
                    label="description or abstract"
                    size="small"
                    sx={{ width: '100%' }}
                    value={description || ''}
                    multiline
                    onChange={(event) => handleUpdate(event.target.value, 'description')}
                />
            </Box>
        </NeurosynthAccordion>
    );
});

export default EditStudyDetails;
