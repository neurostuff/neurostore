import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useHistory } from 'react-router-dom';
import { ReadOnly, Study } from '../../gen/api';
import { StudyApiResponse } from '../../utils/api';
import DisplayStudiesTableStyles from './DisplayStudiesTableStyles';

interface DisplayStudiesTableModel {
    studies: StudyApiResponse[];
}

const DisplayStudiesTable: React.FC<DisplayStudiesTableModel> = (props) => {
    const history = useHistory();
    const classes = DisplayStudiesTableStyles();

    const handleSelectTableRow = (row: Study & ReadOnly) => {
        history.push(`/studies/${row.id}`);
    };

    return (
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>Authors</TableCell>
                        <TableCell>Journal</TableCell>
                        <TableCell>Owner</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {props.studies.map((row, index) => (
                        <TableRow
                            key={index}
                            className={classes.tableRow}
                            onClick={() => handleSelectTableRow(row)}
                        >
                            <TableCell className={`${classes.name}`}>
                                <div className={classes.tableCellTextContainer}>{row.name}</div>
                            </TableCell>
                            <TableCell>
                                {row.authors || (
                                    <span className={classes.noContent}>No Authors Available</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className={classes.tableCellTextContainer}>
                                    {row.publication || (
                                        <span className={classes.noContent}>
                                            No Publication Available
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className={classes.tableCellTextContainer}>
                                    {row.user || <span>Neurosynth</span>}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {props.studies.length === 0 && (
                <div className={classes.noContent}>
                    <br />
                    No results
                </div>
            )}
        </TableContainer>
    );
};

export default DisplayStudiesTable;
