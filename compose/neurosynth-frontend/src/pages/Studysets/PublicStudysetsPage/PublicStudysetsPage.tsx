import { useAuth0 } from '@auth0/auth0-react';
import { Box, IconButton, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import NeurosynthLoader from 'components/NeurosynthLoader/NeurosynthLoader';
import StudysetsTable from '../../../components/Tables/StudysetsTable/StudysetsTable';
import useIsMounted from '../../../hooks/useIsMounted';
import API, { StudysetsApiResponse } from '../../../utils/api';
import useGetTour from 'hooks/useGetTour';
import HelpIcon from '@mui/icons-material/Help';

const PublicStudysetsPage: React.FC = (props) => {
    const { startTour } = useGetTour('PublicStudysetsPage');
    const { user } = useAuth0();
    const [studysets, setStudysets] = useState<StudysetsApiResponse[]>();
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
                undefined
            )
                .then((res) => {
                    if (isMountedRef.current && res?.data?.results) {
                        setStudysets(res.data.results);
                    }
                })
                .catch((err) => {
                    setStudysets([]);
                    console.error(err);
                });
        };

        getStudysets();
    }, [user?.sub, isMountedRef]);

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
                    Public Studysets
                    <IconButton color="primary" onClick={() => startTour()}>
                        <HelpIcon />
                    </IconButton>
                </Typography>
            </Box>

            <Box data-tour="StudysetsPage-1">
                <StudysetsTable studysets={studysets || []} />
            </Box>
        </NeurosynthLoader>
    );
};

export default PublicStudysetsPage;
