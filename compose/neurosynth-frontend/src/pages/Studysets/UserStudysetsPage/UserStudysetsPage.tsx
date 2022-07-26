import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import StudysetsTable from 'components/Tables/StudysetsTable/StudysetsTable';
import useIsMounted from 'hooks/useIsMounted';
import API, { StudysetsApiResponse } from 'utils/api';
import { useSnackbar } from 'notistack';

const UserStudysetsPage: React.FC = (props) => {
    const { user } = useAuth0();
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
                    if (isMountedRef.current && res?.data?.results) setStudysets(res.data.results);
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
                    enqueueSnackbar('created studyset successfully', { variant: 'success' });
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
                <Typography variant="h4">My Studysets</Typography>

                <Button variant="contained" onClick={() => setCreateStudysetDialogIsOpen(true)}>
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

            <StudysetsTable studysets={studysets || []} />
        </NeurosynthLoader>
    );
};

export default UserStudysetsPage;
