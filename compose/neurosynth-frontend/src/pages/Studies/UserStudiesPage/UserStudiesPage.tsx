import { useAuth0 } from '@auth0/auth0-react';
import { Typography, Box, IconButton } from '@mui/material';
import StudiesTable from 'components/Tables/StudiesTable/StudiesTable';
import HelpIcon from '@mui/icons-material/Help';
import useGetTour from 'hooks/useGetTour';
import { useGetStudies } from 'hooks';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGuard from 'hooks/useGuard';

const UserStudiesPage: React.FC = (props) => {
    const { user, isAuthenticated } = useAuth0();
    useGuard('/studies');
    const { startTour } = useGetTour('UserStudiesPage');
    const { data, isLoading, isError } = useGetStudies({
        userId: user?.sub,
    });

    return (
        <>
            <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
                <Typography data-tour="UserStudiesPage-1" variant="h4">
                    My Studies
                </Typography>
                <IconButton onClick={() => startTour()} color="primary">
                    <HelpIcon />
                </IconButton>
            </Box>
            <StateHandlerComponent isLoading={isLoading} isError={isError}>
                <Box data-tour="UserStudiesPage-2" sx={{ marginBottom: '1rem' }}>
                    <StudiesTable
                        studysetEditMode={isAuthenticated ? 'add' : undefined}
                        studies={data}
                    />
                </Box>
            </StateHandlerComponent>
        </>
    );
};

export default UserStudiesPage;
