import { useAuth0 } from '@auth0/auth0-react';
import { Typography, Box } from '@mui/material';
import { useEffect, useState } from 'react';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import StudiesTable from 'components/Tables/StudiesTable/StudiesTable';
import API, { StudyApiResponse } from 'utils/api';
import useIsMounted from 'hooks/useIsMounted';
import { useSnackbar } from 'notistack';

const UserStudiesPage: React.FC = (props) => {
    const { user } = useAuth0();
    const { enqueueSnackbar } = useSnackbar();
    const [studies, setStudies] = useState<StudyApiResponse[]>();
    const isMountedRef = useIsMounted();

    useEffect(() => {
        const getUserStudies = async () => {
            API.NeurostoreServices.StudiesService.studiesGet(
                undefined,
                undefined,
                undefined,
                undefined,
                99,
                false,
                undefined,
                undefined,
                undefined,
                false,
                undefined,
                undefined,
                user?.sub
            )
                .then((res) => {
                    if (isMountedRef.current && res?.data?.results) setStudies(res.data.results);
                })
                .catch((_err) => {
                    setStudies([]);
                    enqueueSnackbar('there was an error getting studies', { variant: 'error' });
                });
        };

        if (user?.sub) {
            getUserStudies();
        }
    }, [user?.sub, isMountedRef, enqueueSnackbar]);

    return (
        <>
            <Typography sx={{ marginBottom: '1rem' }} variant="h4">
                My Studies
            </Typography>
            <NeurosynthLoader loaded={!!studies}>
                <Box sx={{ marginBottom: '1rem' }}>
                    <StudiesTable showStudyOptions={true} studies={studies as StudyApiResponse[]} />
                </Box>
            </NeurosynthLoader>
        </>
    );
};

export default UserStudiesPage;
