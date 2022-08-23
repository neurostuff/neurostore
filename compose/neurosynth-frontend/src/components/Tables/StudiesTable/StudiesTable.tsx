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
    IconButton,
    LinearProgress,
} from '@mui/material';
import React from 'react';
import { useHistory } from 'react-router-dom';
import StudysetsPopupMenu from 'components/StudysetsPopupMenu/StudysetsPopupMenu';
import StudiesTableStyles from './StudiesTable.styles';
import Delete from '@mui/icons-material/Delete';
import { StudyReturn } from 'neurostore-typescript-sdk';

interface StudiesTableModel {
    studies: StudyReturn[] | undefined;
    studysetEditMode?: 'add' | 'delete' | undefined;
    onRemoveStudyFromStudyset?: (studyId: string) => void;
    isLoading?: boolean;
}

const StudiesTable: React.FC<StudiesTableModel> = (props) => {
    const { user } = useAuth0();
    const history = useHistory();

    return (
        <TableContainer component={Paper} elevation={2} sx={StudiesTableStyles.root}>
            <Table>
                <TableHead>
                    <TableRow sx={{ backgroundColor: 'primary.main' }}>
                        {props.studysetEditMode && <TableCell></TableCell>}
                        <TableCell sx={StudiesTableStyles.headerCell}>Title</TableCell>
                        <TableCell sx={StudiesTableStyles.headerCell}>Authors</TableCell>
                        <TableCell sx={StudiesTableStyles.headerCell}>Journal</TableCell>
                        <TableCell sx={StudiesTableStyles.headerCell}>Owner</TableCell>
                    </TableRow>
                    <TableRow>
                        {props.isLoading ? (
                            <TableCell sx={{ padding: 0 }} colSpan={props.studysetEditMode ? 5 : 4}>
                                <Box
                                    sx={{
                                        width: '100%',
                                        paddingBottom:
                                            (props.studies || []).length > 0 ? '0' : '2rem',
                                    }}
                                >
                                    <LinearProgress color="primary" />
                                </Box>
                            </TableCell>
                        ) : (
                            <></>
                        )}
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
                            {props.studysetEditMode && (
                                <TableCell>
                                    {props.studysetEditMode === 'add' ? (
                                        <StudysetsPopupMenu study={row} />
                                    ) : (
                                        <IconButton
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                if (props.onRemoveStudyFromStudyset) {
                                                    props.onRemoveStudyFromStudyset(row.id || '');
                                                }
                                            }}
                                        >
                                            <Delete color="error" />
                                        </IconButton>
                                    )}
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
