import { useAuth0 } from '@auth0/auth0-react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
} from '@mui/material';
import { Box } from '@mui/system';
import React, { useState, useEffect, useContext } from 'react';
import { useHistory } from 'react-router-dom';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import useIsMounted from '../../../hooks/useIsMounted';
import API, { StudysetsApiResponse, StudyApiResponse } from '../../../utils/api';
import StudysetsPopupMenu from '../../StudysetsPopupMenu/StudysetsPopupMenu';
import StudiesTableStyles from './StudiesTable.styles';

interface StudiesTableModel {
    studies: StudyApiResponse[] | undefined;
    showStudyOptions?: boolean;
}

const StudiesTable: React.FC<StudiesTableModel> = (props) => {
    const { isAuthenticated, user, getAccessTokenSilently } = useAuth0();
    const [studysets, setStudysets] = useState<StudysetsApiResponse[]>();
    const history = useHistory();
    const { showSnackbar } = useContext(GlobalContext);
    const { current } = useIsMounted();

    const handleSelectTableRow = (row: StudyApiResponse) => {
        history.push(`/studies/${row.id}`);
    };

    const shouldShowStudyOptions = isAuthenticated && !!props.showStudyOptions;

    useEffect(() => {
        if (shouldShowStudyOptions) {
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
                    user?.sub || ''
                )
                    .then((res) => {
                        if (current && res?.data?.results) {
                            setStudysets(res.data.results);
                        }
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            };

            getStudysets();
        }
    }, [shouldShowStudyOptions, user?.sub, current]);

    const handleStudysetCreated = async (name: string, description: string) => {
        try {
            const token = await getAccessTokenSilently();
            API.UpdateServicesWithToken(token);
        } catch (exception) {
            showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }
        API.Services.StudySetsService.studysetsPost({
            name,
            description,
        })
            .then((res) => {
                showSnackbar('studyset created', SnackbarType.SUCCESS);
                if (current) {
                    const createdStudyset = res.data;
                    setStudysets((prevState) => {
                        if (!prevState) return prevState;
                        const newStudysets = [...prevState];
                        newStudysets.push(createdStudyset as any);
                        return newStudysets;
                    });
                }
            })
            .catch((err) => {
                console.error(err);
                showSnackbar('there was an error', SnackbarType.ERROR);
            });
    };

    const handleAddStudyToStudyset = async (
        study: StudyApiResponse,
        studyset: StudysetsApiResponse
    ) => {
        try {
            const token = await getAccessTokenSilently();
            API.UpdateServicesWithToken(token);
        } catch (exception) {
            showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        const selectedStudysetStudies = [...(studyset.studies || [])] as string[];
        selectedStudysetStudies.push(study.id as string);

        API.Services.StudySetsService.studysetsIdPut(studyset.id as string, {
            name: studyset.name,
            studies: selectedStudysetStudies as string[],
        })
            .then((res) => {
                // temporary fix. TODO: fix open-api spec
                const updatedStudyset = res.data as unknown as StudysetsApiResponse;

                showSnackbar(
                    `${study.name} added to ${studyset.name || studyset.id}`,
                    SnackbarType.SUCCESS
                );
                if (current) {
                    setStudysets((prevState) => {
                        if (!prevState) return prevState;
                        const newArr = [...prevState];
                        const modifiedStudysetIndex = newArr.findIndex(
                            (x) => x.id === updatedStudyset.id
                        );
                        newArr[modifiedStudysetIndex] = { ...updatedStudyset };
                        return newArr;
                    });
                }
            })
            .catch((err) => {
                console.error(err);
                showSnackbar('there was an error', SnackbarType.ERROR);
            });
    };

    return (
        <TableContainer component={Paper} elevation={2} sx={StudiesTableStyles.root}>
            <Table size="small">
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
                            sx={StudiesTableStyles.tableRow}
                            key={index}
                            onClick={() => handleSelectTableRow(row)}
                        >
                            {shouldShowStudyOptions && (
                                <TableCell>
                                    <StudysetsPopupMenu
                                        study={row}
                                        onStudyAddedToStudyset={handleAddStudyToStudyset}
                                        onCreateStudyset={handleStudysetCreated}
                                        studysets={studysets}
                                    />
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
                <Box sx={{ color: 'warning.dark', padding: '0.5rem 1rem' }}>No data</Box>
            )}
        </TableContainer>
    );
};

export default StudiesTable;
