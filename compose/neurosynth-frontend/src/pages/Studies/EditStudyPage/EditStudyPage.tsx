import { Box } from '@mui/material';
import { useParams } from 'react-router-dom';
import BackButton from 'components/Buttons/BackButton/BackButton';
import EditAnalyses from 'components/EditStudyComponents/EditAnalyses/EditAnalyses';
import EditStudyDetails from 'components/EditStudyComponents/EditStudyDetails/EditStudyDetails';
import EditStudyMetadata from 'components/EditStudyComponents/EditStudyMetadata/EditStudyMetadata';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudyById, useGuard } from 'hooks';
import EditStudyPageStyles from './EditStudyPage.styles';
import { useAuth0 } from '@auth0/auth0-react';
import { AnalysisReturn } from 'neurostore-typescript-sdk';

const EditStudyPage = () => {
    const params: { projectId: string; studyId: string } = useParams();
    const { user, isAuthenticated } = useAuth0();
    const { isLoading, data, isError } = useGetStudyById(params.studyId || '');

    const thisUserOwnsthisStudyset = (data?.user || undefined) === (user?.sub || null);

    useGuard(
        `/studies/${params.studyId}`,
        isAuthenticated ? 'you can only edit studies that you have cloned' : undefined,
        !isLoading && !thisUserOwnsthisStudyset
    );

    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            <Box sx={EditStudyPageStyles.stickyButtonContainer}>
                <BackButton
                    color="secondary"
                    variant="outlined"
                    sx={EditStudyPageStyles.button}
                    text="return to study view"
                    path={`/projects/${params.projectId}/extraction/studies/${params.studyId}`}
                />
            </Box>

            <Box sx={{ marginBottom: '15px', padding: '0 10px' }}>
                <EditStudyDetails
                    studyId={params.studyId}
                    name={data?.name || ''}
                    description={data?.description || ''}
                    authors={data?.authors || ''}
                    doi={data?.doi || ''}
                    publication={data?.publication || ''}
                />
            </Box>

            <Box sx={{ marginBottom: '15px', padding: '0 10px' }}>
                <EditStudyMetadata metadata={data?.metadata || {}} studyId={params.studyId} />
            </Box>

            <Box sx={{ marginBottom: '15px', padding: '0 10px', marginLeft: '15px' }}>
                <EditAnalyses
                    analyses={data?.analyses as AnalysisReturn[]}
                    studyId={params.studyId}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default EditStudyPage;
