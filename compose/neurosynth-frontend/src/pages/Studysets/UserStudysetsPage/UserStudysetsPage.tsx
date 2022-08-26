import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography, IconButton } from '@mui/material';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import StudysetsTable from 'components/Tables/StudysetsTable/StudysetsTable';
import HelpIcon from '@mui/icons-material/Help';
import AddIcon from '@mui/icons-material/Add';
import useGetTour from 'hooks/useGetTour';
import { useCreateStudyset, useGetStudysets, useGuard } from 'hooks';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { useState } from 'react';
import { useIsFetching } from 'react-query';

const UserStudysetsPage: React.FC = (props) => {
    const { user } = useAuth0();
    useGuard('/studysets');
    const { startTour } = useGetTour('UserStudysetsPage');
    const isFetching = useIsFetching('studysets');
    const {
        data,
        isLoading: getStudysetIsLoading,
        isError,
    } = useGetStudysets({
        userId: user?.sub,
        nested: false,
    });
    const { mutate, isLoading: createStudysetIsLoading } = useCreateStudyset();
    const [createStudysetDialogIsOpen, setCreateStudysetDialogIsOpen] = useState(false);

    const handleCreateStudyset = (name: string, description: string) => {
        mutate({
            name,
            description,
        });
    };

    return (
        <StateHandlerComponent isLoading={getStudysetIsLoading} isError={isError}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                }}
            >
                <Typography variant="h4">
                    My Studysets
                    <IconButton color="primary" onClick={() => startTour()}>
                        <HelpIcon />
                    </IconButton>
                </Typography>

                <Box data-tour="UserStudysetsPage-1">
                    <LoadingButton
                        sx={{ minWidth: '165px' }}
                        loaderColor="secondary"
                        isLoading={createStudysetIsLoading}
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateStudysetDialogIsOpen(true)}
                        text="New studyset"
                    />
                </Box>
            </Box>

            <CreateDetailsDialog
                titleText="Create new Studyset"
                onCloseDialog={() => setCreateStudysetDialogIsOpen(false)}
                onCreate={handleCreateStudyset}
                isOpen={createStudysetDialogIsOpen}
            />
            <Box>
                <StudysetsTable
                    isLoading={getStudysetIsLoading || isFetching > 0}
                    studysets={data || []}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default UserStudysetsPage;
