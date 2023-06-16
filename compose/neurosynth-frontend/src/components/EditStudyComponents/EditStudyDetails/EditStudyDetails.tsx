import { Typography, Box, TextField } from '@mui/material';
import React from 'react';
import {
    useStudyAuthors,
    useStudyDescription,
    useStudyDOI,
    useStudyName,
    useStudyPMID,
    useStudyPublication,
    useStudyYear,
    useUpdateStudyDetails,
} from 'pages/Studies/StudyStore';
import { StudyDetails } from 'pages/Studies/StudyStore.helpers';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';

const EditStudyDetails: React.FC = React.memo((props) => {
    const name = useStudyName();
    const description = useStudyDescription();
    const authors = useStudyAuthors();
    const publication = useStudyPublication();
    const doi = useStudyDOI();
    const pmid = useStudyPMID();
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
            sx={{
                border: '1px solid',
                borderColor: 'secondary.main',
                borderRadius: '0 !important',
            }}
            accordionSummarySx={{
                ':hover': {
                    backgroundColor: '#f2f2f2',
                },
            }}
            TitleElement={
                <>
                    <Typography
                        sx={{ fontWeight: 'bold', marginRight: '10px', color: 'secondary.main' }}
                    >
                        Details
                    </Typography>
                    <Typography sx={{ color: 'secondary.main' }}>
                        (name, authors, description, doi, pmid, etc)
                    </Typography>
                </>
            }
        >
            <Box sx={{ margin: '1rem 0 0.5rem 0' }}>
                <TextField
                    label="name"
                    sx={{ width: '100%', marginBottom: '1rem' }}
                    value={name || ''}
                    onChange={(event) => handleUpdate(event.target.value, 'name')}
                />
                <TextField
                    label="authors"
                    sx={{ width: '100%', marginBottom: '1rem' }}
                    value={authors || ''}
                    onChange={(event) => handleUpdate(event.target.value, 'authors')}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <TextField
                        label="pmid"
                        sx={{ width: '49%', marginBottom: '1rem' }}
                        value={pmid || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'pmid')}
                    />
                    <TextField
                        label="doi"
                        sx={{ width: '49%' }}
                        value={doi || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'doi')}
                    />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <TextField
                        onWheel={(event) => {
                            event.preventDefault();
                        }}
                        label="year"
                        sx={{ width: '49%', marginBottom: '1rem' }}
                        type="number"
                        value={year || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'year')}
                    />
                    <TextField
                        label="journal"
                        sx={{ width: '49%' }}
                        value={publication || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'publication')}
                    />
                </Box>
                <TextField
                    label="description or abstract"
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
