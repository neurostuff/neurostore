import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { NeurosynthLoader } from '../../../components';
import DatasetsTable from '../../../components/Tables/DatasetsTable/DatasetsTable';
import API, { DatasetsApiResponse } from '../../../utils/api';

const PublicDatasetsPage: React.FC = (props) => {
    const { user } = useAuth0();
    const [datasets, setDatasets] = useState<DatasetsApiResponse[]>();

    useEffect(() => {
        const getDatasets = async () => {
            API.Services.DataSetsService.datasetsGet(
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                true,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined
            )
                .then((res) => {
                    if (res?.data?.results) {
                        setDatasets(res.data.results);
                    }
                })
                .catch((err) => {
                    console.error(err);
                });
        };

        getDatasets();
    }, [user?.sub]);

    return (
        <NeurosynthLoader loaded={!!datasets}>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                }}
            >
                <Typography variant="h4">Public Datasets</Typography>
            </Box>

            <DatasetsTable datasets={datasets || []} />
        </NeurosynthLoader>
    );
};

export default PublicDatasetsPage;