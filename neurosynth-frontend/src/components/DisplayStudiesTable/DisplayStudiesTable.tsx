import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@material-ui/core';
import { useHistory } from 'react-router-dom';
import { ReadOnly, Study } from '../../gen/api';
import { StudyApiResponse } from '../../utils/api';
import DisplayStudiesTableStyles from './DisplayStudiesTableStyles';

interface DisplayStudiesTableModel {
    studies: StudyApiResponse[];
}

enum Owner {
    badge_neurosynth = 'badge_neuroscience',
    badge_user = 'badge_iser',
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
                        <TableRow key={index} className={classes.tableRow} onClick={() => handleSelectTableRow(row)}>
                            <TableCell className={`${classes.name}`}>
                                <div className={classes.tableCellTextContainer}>{row.name}</div>
                            </TableCell>
                            <TableCell>
                                <div className={classes.tableCellTextContainer}>
                                    {(row.metadata as any)?.authors || (
                                        <span className={classes.noContent}>No Author(s)</span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className={classes.tableCellTextContainer}>
                                    {(row.metadata as any)?.journal_name || (
                                        <span className={classes.noContent}>No Journal</span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className={classes.tableCellTextContainer}>
                                    {(row as any).user || 'Neurosynth'}
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
