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
import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
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
    const { isAuthenticated, user } = useAuth0();
    const [datasets, setDatasets] = useState<DatasetsApiResponse[]>();
    const history = useHistory();
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

    const handleDatasetCreated = (createdDataset: DatasetsApiResponse) => {
        setDatasets((prevState) => {
            if (!prevState) return prevState;
            const newDatasets = [...prevState];
            newDatasets.push(createdDataset);
            return newDatasets;
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
                                        onDatasetCreated={handleDatasetCreated}
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
                <Box sx={{ color: 'warning.dark', padding: '1rem' }}>No results</Box>
            )}
        </TableContainer>
    );
};

export default StudiesTable;
