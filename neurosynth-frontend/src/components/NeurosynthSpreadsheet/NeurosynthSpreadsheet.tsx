import Spreadsheet, { CellBase, Matrix } from 'react-spreadsheet';
import { Box } from '@mui/system';
import { EPropertyType, NeurosynthPopper, TextEdit } from '..';
import { Paper, IconButton, Button, MenuList, MenuItem } from '@mui/material';
import { MoreHoriz } from '@mui/icons-material';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import EditIcon from '@mui/icons-material/Edit';
import { useRef, useState } from 'react';

export interface INeurosynthSpreadsheetData {
    data: Matrix<CellBase<any>> | undefined;
    columnLabelValues: {
        value: string;
        type: EPropertyType;
    }[];
    rowLabelValues: string[];
}

const NeurosynthColumnHeader: React.FC<{ column: number; label?: React.ReactNode | null }> = (
    props
) => {
    const [open, setOpen] = useState<boolean>(false);
    const anchorElement = useRef(null);

    return (
        <>
            <th className="Spreadsheet__header" style={{ padding: '10px' }}>
                {props.label || String(props.column)}
                <br />
                <IconButton onClick={() => setOpen(true)} ref={anchorElement}>
                    <MoreHoriz />
                </IconButton>
            </th>
            <NeurosynthPopper
                placement="left-end"
                open={open}
                onClickAway={(e) => setOpen(false)}
                anchorElement={anchorElement.current}
            >
                <MenuList>
                    <MenuItem sx={{ color: 'secondary.main' }}>EDIT</MenuItem>
                    <MenuItem sx={{ color: 'error.main' }}>DELETE</MenuItem>
                </MenuList>
            </NeurosynthPopper>
        </>
    );
};

const NeurosynthSpreadsheet: React.FC<INeurosynthSpreadsheetData> = (props) => {
    const { data, rowLabelValues, columnLabelValues } = props;

    const handleOnSpreadsheetChange = (newData: Matrix<CellBase<any>>) => {
        console.log(newData);
    };

    const columnLabels = columnLabelValues.map((col) => col.value);

    return (
        <>
            {data && (
                <Box
                    component={Paper}
                    elevation={2}
                    sx={{ padding: '20px', display: 'flex', overflowX: 'scroll' }}
                >
                    <Box
                        component={Spreadsheet}
                        rowLabels={rowLabelValues}
                        columnLabels={columnLabels}
                        onChange={handleOnSpreadsheetChange}
                        data={data}
                        ColumnIndicator={NeurosynthColumnHeader}
                    />
                </Box>
            )}
        </>
    );
};

export default NeurosynthSpreadsheet;
