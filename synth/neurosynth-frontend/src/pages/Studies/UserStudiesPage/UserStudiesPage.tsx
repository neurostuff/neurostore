import { useAuth0 } from '@auth0/auth0-react';
import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useContext, useEffect, useState } from 'react';
import { NeurosynthLoader, StudiesTable } from '../../../components';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import API, { StudyApiResponse } from '../../../utils/api';
import useIsMounted from '../../../hooks/useIsMounted';

const UserStudiesPage: React.FC = (props) => {
    const { getAccessTokenSilently, user } = useAuth0();
    const { showSnackbar } = useContext(GlobalContext);
    const [studies, setStudies] = useState<StudyApiResponse[]>();
    const isMountedRef = useIsMounted();

    useEffect(() => {
        const getUserStudies = async () => {
            try {
                const token = await getAccessTokenSilently();
                API.UpdateServicesWithToken(token);
            } catch (exception) {
                showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }

            API.Services.StudiesService.studiesGet(
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
                .catch((err) => {
                    showSnackbar('there was an error', SnackbarType.ERROR);
                    setStudies([]);
                    console.error(err);
                });
        };

        if (user?.sub) {
            getUserStudies();
        }
    }, [user?.sub, getAccessTokenSilently, showSnackbar, isMountedRef]);

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
