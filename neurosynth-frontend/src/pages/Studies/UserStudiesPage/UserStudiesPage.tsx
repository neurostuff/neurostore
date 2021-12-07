import { useAuth0 } from '@auth0/auth0-react';
import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useContext, useEffect, useState } from 'react';
import { NeurosynthLoader, StudiesTable } from '../../../components';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import API, { StudyApiResponse } from '../../../utils/api';

const UserStudiesPage: React.FC = (props) => {
    const { getAccessTokenSilently, user } = useAuth0();
    const context = useContext(GlobalContext);
    const [studies, setStudies] = useState<StudyApiResponse[]>();

    useEffect(() => {
        const getUserStudies = async () => {
            try {
                const token = await getAccessTokenSilently();
                context.handleToken(token);
            } catch (exception) {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
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
                    if (res?.data?.results) {
                        setStudies(res.data.results);
                    }
                })
                .catch((err) => {
                    context.showSnackbar('there was an error', SnackbarType.ERROR);
                    console.error(err);
                });
        };

        if (user?.sub) {
            getUserStudies();
        }

        return () => {
            setStudies(undefined);
        };
    }, [user?.sub, context, getAccessTokenSilently]);

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
