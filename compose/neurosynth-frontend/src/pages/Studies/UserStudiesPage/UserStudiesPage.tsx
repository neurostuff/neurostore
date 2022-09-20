import { useAuth0 } from '@auth0/auth0-react';
import { Typography, Box, IconButton, TableRow, TableCell } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import useGetTour from 'hooks/useGetTour';
import { useGetStudies } from 'hooks';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGuard from 'hooks/useGuard';
import NeurosynthTable from 'components/Tables/NeurosynthTable/NeurosynthTable';
import StudysetsPopupMenu from 'components/StudysetsPopupMenu/StudysetsPopupMenu';
import { useHistory } from 'react-router-dom';
import Delete from '@mui/icons-material/Delete';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import { useState } from 'react';
import useDeleteStudy from 'hooks/requests/useDeleteStudy';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';

const UserStudiesPage: React.FC = (props) => {
    const { user, isAuthenticated } = useAuth0();
    const { mutate, isLoading: deleteStudyIsLoading } = useDeleteStudy();
    const history = useHistory();
    useGuard('/studies');
    const { startTour } = useGetTour('UserStudiesPage');
    const [deleteModalState, setDeleteModalState] = useState<{
        isOpen: boolean;
        selectedRowId: undefined | string;
    }>({ isOpen: false, selectedRowId: undefined });
    const {
        data,
        isLoading: getStudiesIsLoading,
        isError,
    } = useGetStudies(!!user?.sub, {
        userId: user?.sub,
    });

    const handleDeleteStudy = (confirm: boolean | undefined) => {
        if (confirm && deleteModalState.selectedRowId) {
            mutate(deleteModalState.selectedRowId);
        }
        setDeleteModalState({
            isOpen: false,
            selectedRowId: undefined,
        });
    };

    return (
        <>
            <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
                <Typography data-tour="UserStudiesPage-1" variant="h4">
                    My Studies
                </Typography>
                <IconButton onClick={() => startTour()} color="primary">
                    <HelpIcon />
                </IconButton>
            </Box>
            <StateHandlerComponent isLoading={false} isError={isError}>
                <Box data-tour="UserStudiesPage-2" sx={{ marginBottom: '1rem' }}>
                    <NeurosynthTable
                        tableConfig={{
                            isLoading: getStudiesIsLoading || deleteStudyIsLoading,
                            loaderColor: 'secondary',
                            noDataDisplay: (
                                <Box sx={{ color: 'warning.dark', padding: '1rem' }}>
                                    No studies found
                                </Box>
                            ),
                        }}
                        headerCells={[
                            {
                                text: '',
                                key: 'addToStudysetCol',
                                styles: { display: isAuthenticated ? 'table-cell' : 'none' },
                            },
                            {
                                text: 'Title',
                                key: 'title',
                                styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                            },
                            {
                                text: 'Authors',
                                key: 'authors',
                                styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                            },
                            {
                                text: 'Journal',
                                key: 'journal',
                                styles: { color: 'primary.contrastText', fontWeight: 'bold' },
                            },
                            {
                                text: '',
                                key: 'deleteStudy',
                                styles: {},
                            },
                        ]}
                        rows={(data?.results || []).map((study, index) => (
                            <TableRow
                                data-tour={index === 0 ? 'PublicStudiesPage-4' : null}
                                sx={NeurosynthTableStyles.tableRow}
                                key={study.id || index}
                                onClick={() => history.push(`/studies/${study.id}`)}
                            >
                                <TableCell
                                    sx={{ display: isAuthenticated ? 'table-cell' : 'none' }}
                                >
                                    <StudysetsPopupMenu study={study} />
                                </TableCell>
                                <TableCell>
                                    {study?.name || (
                                        <Box sx={{ color: 'warning.dark' }}>No name</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {study?.authors || (
                                        <Box sx={{ color: 'warning.dark' }}>No author(s)</Box>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {study?.publication || (
                                        <Box sx={{ color: 'warning.dark' }}>No Journal</Box>
                                    )}
                                </TableCell>
                                <TableCell data-tour={index === 0 ? 'UserStudiesPage-3' : null}>
                                    <IconButton
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setDeleteModalState({
                                                isOpen: true,
                                                selectedRowId: study?.id,
                                            });
                                        }}
                                    >
                                        <Delete color="error" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    />
                    <ConfirmationDialog
                        isOpen={deleteModalState.isOpen}
                        dialogTitle="Are you sure you want to delete this study?"
                        dialogMessage="This action cannot be reversed"
                        onCloseDialog={handleDeleteStudy}
                        confirmText="Confirm"
                        rejectText="Cancel"
                    />
                </Box>
            </StateHandlerComponent>
        </>
    );
};

export default UserStudiesPage;
