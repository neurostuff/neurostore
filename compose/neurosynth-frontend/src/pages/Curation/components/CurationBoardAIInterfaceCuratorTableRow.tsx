import { TableCell, TableRow } from '@mui/material';
import { flexRender, Row } from '@tanstack/react-table';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import { useEffect, useRef } from 'react';

const CurationBoardAIInterfaceCuratorTableRow: React.FC<{
    setSize: (index: number, size: number) => void;
    data: Row<ICurationTableStudy>;
    index: number;
}> = ({ setSize, data, index }) => {
    const rowRef = useRef<HTMLTableRowElement>(null);

    useEffect(() => {
        if (!rowRef.current) return;
        setSize(index, rowRef.current.getBoundingClientRect().height);
    }, [index, setSize]);

    return (
        <TableRow
            key={data.id}
            ref={rowRef}
            id={data.id}
            // onClick={() => onSelect(data.original.id)}
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
            {data.getVisibleCells().map((cell) => (
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
    );
};

export default CurationBoardAIInterfaceCuratorTableRow;
