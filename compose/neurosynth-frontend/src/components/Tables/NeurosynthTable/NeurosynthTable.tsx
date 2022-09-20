import {
    Table,
    TableContainer,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    Paper,
    LinearProgress,
    Box,
    Typography,
} from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import { ColorOptions } from 'index';

export interface INeurosynthTable {
    tableConfig: {
        tableHeaderBackgroundColor?: string;
        tableElevation?: number;
        isLoading?: boolean;
        loaderColor?: ColorOptions;
        noDataDisplay?: JSX.Element;
    };
    headerCells: {
        text: string;
        key: number | string;
        styles: SystemStyleObject | SystemStyleObject[];
    }[];
    rows: JSX.Element[];
}

const NeurosynthTable: React.FC<INeurosynthTable> = (props) => {
    const { tableConfig, headerCells = [], rows = [] } = props;
    const {
        tableHeaderBackgroundColor = 'primary.main',
        tableElevation = 2,
        isLoading = false,
        loaderColor = 'primary',
        noDataDisplay = (
            <Box sx={{ padding: '1rem' }}>
                <Typography color="warning.dark">No data</Typography>
            </Box>
        ),
    } = tableConfig;

    return (
        <TableContainer component={Paper} elevation={tableElevation}>
            <Table>
                <TableHead>
                    <TableRow sx={{ backgroundColor: tableHeaderBackgroundColor }}>
                        {headerCells.map((headerCell) => (
                            <TableCell key={headerCell.key} sx={headerCell.styles}>
                                {headerCell.text}
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow sx={{ display: isLoading ? 'table-row' : 'none' }}>
                        <TableCell sx={{ padding: 0 }} colSpan={headerCells.length}>
                            <Box>
                                <LinearProgress color={loaderColor} />
                            </Box>
                        </TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>{rows}</TableBody>
            </Table>
            {rows.length === 0 && noDataDisplay}
        </TableContainer>
    );
};

export default NeurosynthTable;

/**
 *                         <TableRow
                            data-tour={index === 0 ? 'PublicStudiesPage-4' : null}
                            sx={StudiesTableStyles.tableRow}
                            key={index}
                            onClick={() => history.push(`/studies/${row.id}`)}
                        >
                            {props.studysetEditMode && (
                                <TableCell>
                                    {props.studysetEditMode === 'add' ? (
                                        <div data-tour={index === 0 ? 'PublicStudiesPage-3' : ''}>
                                            <StudysetsPopupMenu study={row} />
                                        </div>
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
 */
