import { useAuth0 } from '@auth0/auth0-react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Box } from '@mui/system';
import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { ReadOnly, Study } from '../../../gen/api';
import API, { DatasetsApiResponse, StudyApiResponse } from '../../../utils/api';
import DatasetsPopupMenu from '../../DatasetsPopupMenu/DatasetsPopupMenu';
import StudiesTableStyles from './StudiesTable.styles';

interface StudiesTableModel {
    studies: StudyApiResponse[];
}

const StudiesTable: React.FC<StudiesTableModel> = (props) => {
    const { isAuthenticated, user } = useAuth0();
    const [datasets, setDatasets] = useState<DatasetsApiResponse[]>();

    const history = useHistory();

    const handleSelectTableRow = (row: Study & ReadOnly) => {
        history.push(`/studies/${row.id}`);
    };

    useEffect(() => {
        if (isAuthenticated) {
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
                    user?.sub || ''
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
        }
    }, [isAuthenticated, user?.sub]);

    const handleDatasetCreated = (createdDataset: DatasetsApiResponse) => {
        setDatasets((prevState) => {
            if (!prevState) return prevState;
            const newDatasets = [...prevState];
            newDatasets.push(createdDataset);
            return newDatasets;
        });
    };

    return (
        <TableContainer sx={StudiesTableStyles.root}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {isAuthenticated && <TableCell></TableCell>}
                        <TableCell>Title</TableCell>
                        <TableCell>Authors</TableCell>
                        <TableCell>Journal</TableCell>
                        <TableCell>Owner</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {props.studies.map((row, index) => (
                        <TableRow
                            sx={StudiesTableStyles.tableRow}
                            hover
                            key={index}
                            onClick={() => handleSelectTableRow(row)}
                        >
                            {isAuthenticated && (
                                <TableCell>
                                    <DatasetsPopupMenu
                                        study={row}
                                        onDatasetCreated={handleDatasetCreated}
                                        datasets={datasets || []}
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
                                <Box>{row.user || <span>Neurosynth</span>}</Box>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {props.studies.length === 0 && (
                <Box sx={{ color: 'warning.dark' }}>
                    <br />
                    No results
                </Box>
            )}
        </TableContainer>
    );
};

export default StudiesTable;
