import {
    Typography,
    Box,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    TextField,
} from '@mui/material';
import React from 'react';
import {
    StudyDetails,
    useStudyAuthors,
    useStudyDescription,
    useStudyDOI,
    useStudyName,
    useStudyPMID,
    useStudyPublication,
    useStudyYear,
    useUpdateStudyDetails,
} from 'pages/Studies/StudyStore';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditAnalysesStyles from '../EditAnalyses/EditAnalyses.styles';

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
        <Accordion elevation={0}>
            <AccordionSummary
                sx={EditAnalysesStyles.accordionSummary}
                expandIcon={<ExpandMoreIcon sx={EditAnalysesStyles.accordionExpandIcon} />}
            >
                <Typography sx={{ fontWeight: 'bold', marginRight: '10px' }}>Details</Typography>
                <Typography>(name, authors, description, doi, pmid, etc)</Typography>
            </AccordionSummary>
            <AccordionDetails>
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
            </AccordionDetails>
        </Accordion>
    );
});

export default EditStudyDetails;
