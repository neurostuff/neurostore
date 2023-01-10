import { Box, TextField, Typography } from '@mui/material';
import NavigationButtons from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useCreateStudyset } from 'hooks';
import { useState } from 'react';

const MoveToExtractionCreateStudysetStep: React.FC = (props) => {
    const [studysetDetails, setStudysetDetails] = useState({
        name: '',
        description: '',
    });
    const { mutateAsync } = useCreateStudyset();

    const handleCreateStudyset = () => {
        mutateAsync({
            ...studysetDetails,
        })
            .then(() => {})
            .catch(() => {});
    };

    return (
        <Box>
            <Typography gutterBottom sx={{ color: 'muted.main' }}>
                This is the start of the next phase: <b>extraction</b>.
            </Typography>
            <Typography gutterBottom sx={{ color: 'muted.main' }}>
                <b>
                    You have completed your study curation, and the right most column is populated
                    full of studies that you would like to include in your meta-analysis
                </b>
            </Typography>
            <Typography gutterBottom sx={{ color: 'muted.main' }}>
                In the extraction step, you will add necessary study data to the studies in your
                studyset (like coordinates and metadata) as well as analysis annotations that will
                be used to help filter analyses (or contrasts) within your studies
            </Typography>
            <Typography gutterBottom sx={{ color: 'muted.main' }}>
                In order to create the studyset, the studies included in the curation step need to
                be ingested into the database.
            </Typography>
            <Typography gutterBottom sx={{ color: 'muted.main', marginBottom: '2rem' }}>
                <b>
                    To get started, enter the new studyset name and description and then click
                    "START INGESTION"
                </b>
            </Typography>
            <TextField
                onChange={(event) =>
                    setStudysetDetails((prev) => ({ ...prev, name: event.target.value }))
                }
                sx={{ width: '100%', marginBottom: '1rem' }}
                label="studyset name"
            />
            <TextField
                onChange={(event) =>
                    setStudysetDetails((prev) => ({ ...prev, description: event.target.value }))
                }
                sx={{ width: '100%', marginBottom: '2rem' }}
                multiline
                rows={2}
                label="studyset description"
            />

            <NavigationButtons
                prevButtonDisabled
                nextButtonDisabled={studysetDetails.name.length === 0}
                nextButtonStyle="contained"
                nextButtonText="Start ingestion"
                onButtonClick={() => handleCreateStudyset()}
            />
        </Box>
    );
};

export default MoveToExtractionCreateStudysetStep;
