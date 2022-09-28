import { Box, IconButton, TableCell, TableRow, Typography } from '@mui/material';
import React from 'react';
import useGetTour from 'hooks/useGetTour';
import HelpIcon from '@mui/icons-material/Help';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudysets } from 'hooks';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import { useAuth0 } from '@auth0/auth0-react';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { useHistory } from 'react-router-dom';
import { useQueryClient } from 'react-query';

export const getNumStudiesString = (studies: any[] | undefined): string => {
    if (!studies) {
        return '0 studies';
    } else if (studies.length === 1) {
        return '1 study';
    } else {
        return `${studies.length} studies`;
    }
};

const PublicStudysetsPage: React.FC = (props) => {
    const queryClient = useQueryClient();
    const { startTour } = useGetTour('PublicStudysetsPage');
    const { user } = useAuth0();
    const history = useHistory();
    const { data: studysets, isError, isLoading } = useGetStudysets({ nested: false });
    console.log(queryClient.getQueryCache());

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
                <NeurosynthTable
                    tableConfig={{
                        isLoading: isLoading,
                        tableHeaderBackgroundColor: '#42ab55',
                        loaderColor: 'secondary',
                    }}
                    headerCells={[
                        {
                            text: 'Name',
                            key: 'name',
                            styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                        },
                        {
                            text: 'Number of Studies',
                            key: 'numberStudies',
                            styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                        },
                        {
                            text: 'Description',
                            key: 'description',
                            styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                        },
                        {
                            text: 'User',
                            key: 'user',
                            styles: { fontWeight: 'bold', color: 'primary.contrastText' },
                        },
                    ]}
                    rows={(studysets || []).map((studyset, index) => (
                        <TableRow
                            key={studyset?.id || index}
                            onClick={() => history.push(`studysets/${studyset?.id}`)}
                            sx={NeurosynthTableStyles.tableRow}
                        >
                            <TableCell>
                                {studyset?.name || (
                                    <Box sx={{ color: 'warning.dark' }}>No name</Box>
                                )}
                            </TableCell>
                            <TableCell
                                sx={{
                                    color:
                                        (studyset.studies || []).length === 0
                                            ? 'warning.dark'
                                            : 'black',
                                }}
                            >
                                {getNumStudiesString(studyset.studies)}
                            </TableCell>
                            <TableCell>
                                {studyset?.description || (
                                    <Box sx={{ color: 'warning.dark' }}>No description</Box>
                                )}
                            </TableCell>
                            <TableCell>
                                {(studyset?.user === user?.sub ? 'Me' : studyset?.user) ||
                                    'Neurosynth-Compose'}
                            </TableCell>
                        </TableRow>
                    ))}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default PublicStudysetsPage;
