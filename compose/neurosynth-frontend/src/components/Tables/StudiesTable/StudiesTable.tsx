import { useAuth0 } from '@auth0/auth0-react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
} from '@mui/material';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { StudyApiResponse } from 'utils/api';
import StudysetsPopupMenu from 'components/StudysetsPopupMenu/StudysetsPopupMenu';
import StudiesTableStyles from './StudiesTable.styles';

interface StudiesTableModel {
    studies: StudyApiResponse[] | undefined;
    showStudyOptions?: boolean;
}

const StudiesTable: React.FC<StudiesTableModel> = (props) => {
    const { isAuthenticated, user } = useAuth0();
    const history = useHistory();

    const shouldShowStudyOptions = isAuthenticated && !!props.showStudyOptions;

    return (
        <TableContainer component={Paper} elevation={2} sx={StudiesTableStyles.root}>
            <Table>
                <TableHead>
                    <TableRow sx={{ backgroundColor: 'primary.main' }}>
                        {shouldShowStudyOptions && <TableCell></TableCell>}
                        <TableCell sx={StudiesTableStyles.headerCell}>Title</TableCell>
                        <TableCell sx={StudiesTableStyles.headerCell}>Authors</TableCell>
                        <TableCell sx={StudiesTableStyles.headerCell}>Journal</TableCell>
                        <TableCell sx={StudiesTableStyles.headerCell}>Owner</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {(props.studies || []).map((row, index) => (
                        <TableRow
                            data-tour={index === 0 ? 'PublicStudiesPage-4' : null}
                            sx={StudiesTableStyles.tableRow}
                            key={index}
                            onClick={() => history.push(`/studies/${row.id}`)}
                        >
                            {shouldShowStudyOptions && (
                                <TableCell>
                                    <StudysetsPopupMenu study={row} />
                                </TableCell>
                            )}
                            <TableCell>
                                <Box>{row.name}</Box>
                            </TableCell>
                            <TableCell>
                                {row.authors || (
                                    <Box component="span" sx={{ color: 'warning.dark' }}>
                                        No Authors Available
                                    </Box>
                                )}
                            </TableCell>
                            <TableCell>
                                <Box>
                                    {row.publication || (
                                        <Box component="span" sx={{ color: 'warning.dark' }}>
                                            No Publication Available
                                        </Box>
                                    )}
                                </Box>
                            </TableCell>
                            <TableCell>
                                <Box>
                                    {(row.user === user?.sub ? 'Me' : row.user) || (
                                        <span>Neurosynth</span>
                                    )}
                                </Box>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {(props.studies || []).length === 0 && (
                <Box sx={{ color: 'warning.dark', padding: '1rem' }}>No data</Box>
            )}
        </TableContainer>
    );
};

export default StudiesTable;
