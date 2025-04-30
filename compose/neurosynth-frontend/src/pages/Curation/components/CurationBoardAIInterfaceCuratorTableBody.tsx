import { TableBody, TableCell, TableRow } from '@mui/material';
import { flexRender, Table } from '@tanstack/react-table';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';

const CurationBoardAIInterfaceCuratorTableBody: React.FC<{
    table: Table<ICurationTableStudy>;
    onSelect: (id: string) => void;
}> = ({ table, onSelect }) => {
    return (
        <TableBody>
            {table.getRowModel().rows.map((row) => (
                <TableRow
                    key={row.id}
                    id={row.id}
                    onClick={() => onSelect(row.original.id)}
                    sx={{
                        transition: 'ease-in 150ms',
                        height: '1px', // https://stackoverflow.com/questions/3215553/make-a-div-fill-an-entire-table-cell
                        '&:hover': {
                            backgroundColor: '#f6f6f6',
                            // backgroundColor: '#f9f9f9',
                            cursor: 'pointer',
                            transition: 'ease-in-out 150ms',
                        },
                    }}
                >
                    {row.getVisibleCells().map((cell) => (
                        <TableCell
                            key={cell.id}
                            sx={{
                                position: cell.column.id === 'select' ? 'sticky' : '',
                                backgroundColor: cell.column.id === 'select' ? 'white' : '',
                                zIndex: 9,
                                left: 0,
                                padding: '6px',
                                height: 'inherit',
                                lineHeight: 'normal',
                                width: `${cell.column.getSize()}px`,
                            }}
                        >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </TableBody>
    );
};

export default CurationBoardAIInterfaceCuratorTableBody;
