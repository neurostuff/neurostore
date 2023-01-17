import { Box, Typography } from '@mui/material';
import NavigationButtons from 'components/Buttons/NavigationButtons/NavigationButtons';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudysetById } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useParams } from 'react-router-dom';

const IngestionCompleteStep: React.FC<{ onComplete: () => void }> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const {
        data: project,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isError: getStudysetIsError,
    } = useGetStudysetById(project?.provenance?.extractionMetadata?.studysetId, false);
    return (
        <StateHandlerComponent
            isLoading={getProjectIsLoading || getStudysetIsLoading}
            isError={getProjectIsError || getStudysetIsError}
        >
            <Box>
                <Typography
                    sx={{ marginBottom: '1rem', textAlign: 'center', color: 'success.main' }}
                    gutterBottom
                    variant="h6"
                >
                    Successfully Ingested {studyset?.studies?.length || 0} studies
                </Typography>
                <NavigationButtons
                    prevButtonDisabled
                    nextButtonText="close window"
                    nextButtonStyle="contained"
                    onButtonClick={props.onComplete}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default IngestionCompleteStep;
