import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { NeurosynthLoader } from '../../../components';
import StudysetsTable from '../../../components/Tables/StudysetsTable/StudysetsTable';
import useIsMounted from '../../../hooks/useIsMounted';
import API, { StudysetsApiResponse } from '../../../utils/api';

const PublicStudysetsPage: React.FC = (props) => {
    const { user } = useAuth0();
    const [studysets, setStudysets] = useState<StudysetsApiResponse[]>();
    const isMountedRef = useIsMounted();

    useEffect(() => {
        const getStudysets = async () => {
            API.Services.StudySetsService.studysetsGet(
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
                    if (isMountedRef.current && res?.data?.results) setStudysets(res.data.results);
                })
                .catch((err) => {
                    setDatasets([]);
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
                <Typography variant="h4">Public Studysets</Typography>
            </Box>

            <StudysetsTable studysets={studysets || []} />
        </NeurosynthLoader>
    );
};

export default PublicStudysetsPage;
