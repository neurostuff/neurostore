import { Box, TableBody, TableCell, TableRow } from '@mui/material';
import { flexRender, Table } from '@tanstack/react-table';
import { ICurationStubStudy } from '../Curation.types';

const CurationBoardAIInterfaceCuratorTableBody: React.FC<{
    table: Table<ICurationStubStudy>;
    onSelect: (id: string) => void;
}> = ({ table, onSelect }) => {
    return (
        <TableBody>
            {/* <VariableSizeList height={windowHeigh} ></VariableSizeList> */}
            {table.getRowModel().rows.map((row) => (
                <TableRow
                    key={row.id}
                    onClick={() => onSelect(row.original.id)}
                    sx={{
                        transition: 'ease-in 150ms',
                        '&:hover': {
                            backgroundColor: '#ebebeb',
                            cursor: 'pointer',
                            transition: 'ease-in-out 150ms',
                        },
                    }}
                >
                    {row.getVisibleCells().map((cell) => (
                        <TableCell
                            key={cell.id}
                            sx={{
                                padding: cell.column.id === 'select' ? '0px' : '4px 8px',
                                lineHeight: 'normal',
                                width: `${cell.column.getSize()}px`,
                            }}
                        >
                            <Box>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Box>
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </TableBody>
    );
};

export default CurationBoardAIInterfaceCuratorTableBody;
