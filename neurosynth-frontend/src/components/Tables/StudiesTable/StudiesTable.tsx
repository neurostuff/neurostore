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
import { ReadOnly, Study } from '../../../gen/api';
import useIsMounted from '../../../hooks/useIsMounted';
import API, { DatasetsApiResponse, StudyApiResponse } from '../../../utils/api';
import DatasetsPopupMenu from '../../DatasetsPopupMenu/DatasetsPopupMenu';
import StudiesTableStyles from './StudiesTable.styles';

interface StudiesTableModel {
    studies: StudyApiResponse[];
    showStudyOptions?: boolean;
}

const StudiesTable: React.FC<StudiesTableModel> = (props) => {
    const { isAuthenticated, user, getAccessTokenSilently } = useAuth0();
    const [datasets, setDatasets] = useState<DatasetsApiResponse[]>();
    const history = useHistory();
    const { handleToken, showSnackbar } = useContext(GlobalContext);
    const { current } = useIsMounted();

    const handleSelectTableRow = (row: Study & ReadOnly) => {
        history.push(`/studies/${row.id}`);
    };

    const shouldShowStudyOptions = isAuthenticated && !!props.showStudyOptions;

    useEffect(() => {
        if (shouldShowStudyOptions) {
            const getDatasets = async () => {
                API.Services.DataSetsService.datasetsGet(
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
                            setDatasets(res.data.results);
                        }
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            };

            getDatasets();
        }
    }, [shouldShowStudyOptions, user?.sub, current]);

    const handleDatasetCreated = async (name: string, description: string) => {
        try {
            const token = await getAccessTokenSilently();
            handleToken(token);
        } catch (exception) {
            showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }
        API.Services.DataSetsService.datasetsPost({
            name,
            description,
        })
            .then((res) => {
                showSnackbar('dataset created', SnackbarType.SUCCESS);
                if (current) {
                    const createdDataset = res.data;
                    setDatasets((prevState) => {
                        if (!prevState) return prevState;
                        const newDatasets = [...prevState];
                        console.log(createdDataset);

                        newDatasets.push(createdDataset as any);
                        return newDatasets;
                    });
                }
            })
            .catch((err) => {
                console.error(err);
                showSnackbar('there was an error', SnackbarType.ERROR);
            });
    };

    const handleAddStudyToDataset = async (
        study: StudyApiResponse,
        dataset: DatasetsApiResponse
    ) => {
        try {
            const token = await getAccessTokenSilently();
            handleToken(token);
        } catch (exception) {
            showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        const selectedDatasetStudies = [...(dataset.studies || [])] as string[];
        selectedDatasetStudies.push(study.id as string);

        API.Services.DataSetsService.datasetsIdPut(dataset.id as string, {
            name: dataset.name,
            studies: selectedDatasetStudies as string[],
        })
            .then((res) => {
                // temporary fix. TODO: fix open-api spec
                const updatedDataset = res.data as unknown as DatasetsApiResponse;

                showSnackbar(`study added to ${dataset.name || dataset.id}`, SnackbarType.SUCCESS);
                if (current) {
                    setDatasets((prevState) => {
                        if (!prevState) return prevState;
                        const newArr = [...prevState];
                        const modifiedDatasetIndex = newArr.findIndex(
                            (x) => x.id === updatedDataset.id
                        );
                        newArr[modifiedDatasetIndex] = { ...updatedDataset };
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
                    {props.studies.map((row, index) => (
                        <TableRow
                            sx={StudiesTableStyles.tableRow}
                            key={index}
                            onClick={() => handleSelectTableRow(row)}
                        >
                            {shouldShowStudyOptions && (
                                <TableCell>
                                    <DatasetsPopupMenu
                                        study={row}
                                        onStudyAddedToDataset={handleAddStudyToDataset}
                                        onCreateDataset={handleDatasetCreated}
                                        datasets={datasets}
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
            {props.studies.length === 0 && (
                <Box sx={{ color: 'warning.dark', padding: '1rem' }}>No data</Box>
            )}
        </TableContainer>
    );
};

export default StudiesTable;
