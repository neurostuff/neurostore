import { TableBody, TableCell, TableRow } from '@mui/material';
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
                    id={row.id}
                    onClick={() => onSelect(row.original.id)}
                    sx={{
                        transition: 'ease-in 150ms',
                        height: '1px', // https://stackoverflow.com/questions/3215553/make-a-div-fill-an-entire-table-cell
                        '&:hover': {
                            backgroundColor: '#f6f6f6',
                            cursor: 'pointer',
                            transition: 'ease-in-out 150ms',
                        },
                    }}
                >
                    {row.getVisibleCells().map((cell) => (
                        <TableCell
                            key={cell.id}
                            sx={{
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
