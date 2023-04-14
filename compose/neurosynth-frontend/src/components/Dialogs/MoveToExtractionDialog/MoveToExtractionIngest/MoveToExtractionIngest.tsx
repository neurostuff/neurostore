import { Box, Typography } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import Ingestion from 'components/ExtractionComponents/Ingestion/Ingestion';
import { useProjectId } from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { useHistory } from 'react-router-dom';

const MoveToExtractionIngest: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onCloseDialog: () => void;
}> = (props) => {
    const [doIngestion, setDoIngestion] = useState(false);
    const projectId = useProjectId();
    const history = useHistory();

    const handleOnComplete = () => {
        props.onCloseDialog();
        history.push(`/projects/${projectId}/extraction`);
    };

    if (doIngestion) {
        return <Ingestion onComplete={handleOnComplete} />;
    }

    return (
        <Box>
            <Typography gutterBottom>
                Your annotation has been created - let's get started ingesting your studies.
            </Typography>
            <Typography gutterBottom>
                Neurosynth Compose will add the studies you included in the previous curation step
                to the database.
            </Typography>
            <Typography>
                If a matching study (or studies if there are multiple copies) already exists within
                the database, you will have the option of either <b>creating a brand new study</b>{' '}
                or <b>adding the existing neurostore study to your studyset</b>.
            </Typography>
            <Typography gutterBottom color="secondary">
                We recommend using the existing neurostore study as that will often have
                automatically extracted data available which may save you some time.
            </Typography>
            <Typography sx={{ marginBottom: '1rem' }} gutterBottom>
                To get started, click "START INGESTION" below
            </Typography>
            <NavigationButtons
                nextButtonText="start ingestion"
                prevButtonDisabled={true}
                nextButtonStyle="contained"
                onButtonClick={() => setDoIngestion(true)}
            />
        </Box>
    );
};

export default MoveToExtractionIngest;
