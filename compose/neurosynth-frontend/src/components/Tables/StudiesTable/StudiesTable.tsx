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
import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useIsMounted } from 'hooks';
import API, { StudysetsApiResponse, StudyApiResponse } from 'utils/api';
import StudysetsPopupMenu from 'components/StudysetsPopupMenu/StudysetsPopupMenu';
import StudiesTableStyles from './StudiesTable.styles';
import { useSnackbar } from 'notistack';

interface StudiesTableModel {
    studies: StudyApiResponse[] | undefined;
    showStudyOptions?: boolean;
}

const StudiesTable: React.FC<StudiesTableModel> = (props) => {
    const { isAuthenticated, user } = useAuth0();
    const [studysets, setStudysets] = useState<StudysetsApiResponse[]>();
    const history = useHistory();
    const { current } = useIsMounted();
    const { enqueueSnackbar } = useSnackbar();

    const handleSelectTableRow = (row: StudyApiResponse) => {
        history.push(`/studies/${row.id}`);
    };

    const shouldShowStudyOptions = isAuthenticated && !!props.showStudyOptions;

    useEffect(() => {
        if (shouldShowStudyOptions) {
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
        API.NeurostoreServices.StudySetsService.studysetsPost({
            name,
            description,
        })
            .then((res) => {
                enqueueSnackbar('studyset created successfully', { variant: 'success' });
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
                enqueueSnackbar('there was an error creating the studyset', { variant: 'error' });
            });
    };

    const handleAddStudyToStudyset = async (
        study: StudyApiResponse,
        studyset: StudysetsApiResponse
    ) => {
        const selectedStudysetStudies = [...(studyset.studies || [])] as string[];
        selectedStudysetStudies.push(study.id as string);

        API.NeurostoreServices.StudySetsService.studysetsIdPut(studyset.id as string, {
            name: studyset.name,
            studies: selectedStudysetStudies as string[],
        })
            .then((res) => {
                enqueueSnackbar(`${study.name} added to ${studyset.name || studyset.id}`, {
                    variant: 'success',
                });
                if (current) {
                    setStudysets((prevState) => {
                        if (!prevState) return prevState;
                        const newArr = [...prevState];
                        const modifiedStudysetIndex = newArr.findIndex((x) => x.id === res.data.id);
                        newArr[modifiedStudysetIndex] = { ...res.data };
                        return newArr;
                    });
                }
            })
            .catch((err) => {
                console.error(err);
                enqueueSnackbar('there was an error adding the study to the studyset', {
                    variant: 'error',
                });
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
                <Box sx={{ color: 'warning.dark', padding: '1rem' }}>No data</Box>
            )}
        </TableContainer>
    );
};

export default StudiesTable;
