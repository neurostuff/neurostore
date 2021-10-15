import {
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

const DisplayImagesTable = () => {
    return (
        <TableContainer>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell />
                        <TableCell>Type</TableCell>
                        <TableCell>Space</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    <TableRow>
                        <TableCell>
                            <IconButton>
                                <KeyboardArrowDownIcon />
                            </IconButton>
                        </TableCell>
                        <TableCell>data</TableCell>
                        <TableCell>here</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>
                            <IconButton>
                                <KeyboardArrowDownIcon />
                            </IconButton>
                        </TableCell>
                        <TableCell>data</TableCell>
                        <TableCell>here</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>
                            <IconButton>
                                <KeyboardArrowDownIcon />
                            </IconButton>
                        </TableCell>
                        <TableCell>data</TableCell>
                        <TableCell>here</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default DisplayImagesTable;
