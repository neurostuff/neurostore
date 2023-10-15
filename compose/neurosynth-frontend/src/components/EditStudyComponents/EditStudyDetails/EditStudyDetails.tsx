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
import EditStudyComponentsStyles from 'components/EditStudyComponents/EditStudyComponents.styles';

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
            sx={[
                EditStudyComponentsStyles.accordion,
                { borderTop: '1px solid', borderColor: 'secondary.main' },
            ]}
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
                        label="pmid"
                        size="small"
                        sx={{ width: '49%', marginBottom: '0.75rem' }}
                        value={pmid || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'pmid')}
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
                        onWheel={(event) => {
                            event.preventDefault();
                        }}
                        label="year"
                        size="small"
                        sx={{ width: '49%', marginBottom: '0.75rem' }}
                        type="number"
                        value={year || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'year')}
                    />
                    <TextField
                        label="journal"
                        size="small"
                        sx={{ width: '49%', marginBottom: '0.75rem' }}
                        value={publication || ''}
                        onChange={(event) => handleUpdate(event.target.value, 'publication')}
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
