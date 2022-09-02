import { Box, IconButton, Typography } from '@mui/material';
import React from 'react';
import StudysetsTable from 'components/Tables/StudysetsTable/StudysetsTable';
import useGetTour from 'hooks/useGetTour';
import HelpIcon from '@mui/icons-material/Help';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudysets } from 'hooks';

const PublicStudysetsPage: React.FC = (props) => {
    const { startTour } = useGetTour('PublicStudysetsPage');
    const { data: studysets, isError, isLoading } = useGetStudysets({ nested: false });

    return (
        <StateHandlerComponent isLoading={false} isError={isError}>
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
                <StudysetsTable studysets={studysets || []} isLoading={isLoading} />
            </Box>
        </StateHandlerComponent>
    );
};

export default PublicStudysetsPage;
