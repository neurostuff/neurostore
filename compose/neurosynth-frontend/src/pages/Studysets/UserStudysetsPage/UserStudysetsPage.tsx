import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography, Button, IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import StudysetsTable from 'components/Tables/StudysetsTable/StudysetsTable';
import useIsMounted from 'hooks/useIsMounted';
import API, { StudysetsApiResponse } from 'utils/api';
import { useSnackbar } from 'notistack';
import HelpIcon from '@mui/icons-material/Help';
import AddIcon from '@mui/icons-material/Add';
import useGetTour from 'hooks/useGetTour';

const UserStudysetsPage: React.FC = (props) => {
    const { user } = useAuth0();
    const { startTour } = useGetTour('UserStudysetsPage');
    const [studysets, setStudysets] = useState<StudysetsApiResponse[]>();
    const { enqueueSnackbar } = useSnackbar();
    const [createStudysetDialogIsOpen, setCreateStudysetDialogIsOpen] = useState(false);
    const isMountedRef = useIsMounted();

    useEffect(() => {
        const getStudysets = async () => {
            API.NeurostoreServices.StudySetsService.studysetsGet(
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                user?.sub
            )
                .then((res) => {
                    if (isMountedRef.current && res?.data?.results) {
                        setStudysets(res.data.results);
                    }
                })
                .catch((err) => {
                    setStudysets([]);
                    enqueueSnackbar('there was an error getting the studysets', {
                        variant: 'error',
                    });
                });
        };

        getStudysets();
    }, [user?.sub, isMountedRef, enqueueSnackbar]);

    const handleCreateStudyset = async (name: string, description: string) => {
        API.NeurostoreServices.StudySetsService.studysetsPost({
            name,
            description,
        })
            .then((res) => {
                const newStudyset = res.data;
                setCreateStudysetDialogIsOpen(false);

                if (isMountedRef.current) {
                    enqueueSnackbar('studyset created successfully', { variant: 'success' });
                    setStudysets((prevState) => {
                        if (!prevState) return prevState;
                        const newState = [...prevState];
                        newState.push(newStudyset);
                        return newState;
                    });
                }
            })
            .catch((err) => {
                enqueueSnackbar('there was an error creating the studyset', { variant: 'error' });
            });
    };

    return (
        <NeurosynthLoader loaded={!!studysets}>
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

                <Button
                    data-tour="UserStudysetsPage-1"
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateStudysetDialogIsOpen(true)}
                >
                    New studyset
                </Button>
            </Box>

            <CreateDetailsDialog
                titleText="Create new Studyset"
                onCloseDialog={() => {
                    setCreateStudysetDialogIsOpen(false);
                }}
                onCreate={handleCreateStudyset}
                isOpen={createStudysetDialogIsOpen}
            />
            <Box>
                <StudysetsTable studysets={studysets || []} />
            </Box>
        </NeurosynthLoader>
    );
};

export default UserStudysetsPage;
