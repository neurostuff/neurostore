import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography, IconButton, TableRow, TableCell } from '@mui/material';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import HelpIcon from '@mui/icons-material/Help';
import AddIcon from '@mui/icons-material/Add';
import useGetTour from 'hooks/useGetTour';
import { useCreateStudyset, useGetStudysets, useGuard } from 'hooks';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { useState } from 'react';
import { useIsFetching } from 'react-query';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import { useHistory } from 'react-router-dom';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { getNumStudiesString } from 'pages/helpers/utils';

const UserStudysetsPage: React.FC = (props) => {
    const { user, isAuthenticated } = useAuth0();
    useGuard('/studysets');
    const { startTour } = useGetTour('UserStudysetsPage');
    const history = useHistory();
    const isFetching = useIsFetching('studysets');
    const {
        data,
        isLoading: getStudysetIsLoading,
        isError,
    } = useGetStudysets(
        {
            userId: user?.sub,
            isNested: false,
        },
        !!user && isAuthenticated
    );
    const { mutate, isLoading: createStudysetIsLoading } = useCreateStudyset();
    const [createStudysetDialogIsOpen, setCreateStudysetDialogIsOpen] = useState(false);

    const handleCreateStudyset = (name: string, description: string) => {
        mutate({
            name,
            description,
        });
    };

    const studysets = data?.results || [];

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
                    My Studysets
                    <IconButton color="primary" onClick={() => startTour()}>
                        <HelpIcon />
                    </IconButton>
                </Typography>

                <Box data-tour="UserStudysetsPage-1">
                    <LoadingButton
                        sx={{ minWidth: '165px' }}
                        loaderColor="secondary"
                        isLoading={createStudysetIsLoading}
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateStudysetDialogIsOpen(true)}
                        text="New studyset"
                    />
                </Box>
            </Box>

            <CreateDetailsDialog
                titleText="Create new Studyset"
                onCloseDialog={() => setCreateStudysetDialogIsOpen(false)}
                onCreate={handleCreateStudyset}
                isOpen={createStudysetDialogIsOpen}
            />
            <Box>
                <NeurosynthTable
                    tableConfig={{
                        isLoading: getStudysetIsLoading || isFetching > 0,
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
                    ]}
                    rows={studysets.map((studyset, index) => (
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
                        </TableRow>
                    ))}
                />
            </Box>
        </StateHandlerComponent>
    );
};

export default UserStudysetsPage;
