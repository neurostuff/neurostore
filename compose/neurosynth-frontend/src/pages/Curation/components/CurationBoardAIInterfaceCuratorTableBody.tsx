import { Table as MuiTable, TableBody, TableCell, TableRow } from '@mui/material';
import { flexRender, Table } from '@tanstack/react-table';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import React, { forwardRef, useCallback, useRef } from 'react';
import { VariableSizeList } from 'react-window';
import CurationBoardAIInterfaceCuratorTableRow from './CurationBoardAIInterfaceCuratorTableRow';

const outer = forwardRef((props, ref) => {
    return <MuiTable ref={ref} {...props} />;
});

const inner = forwardRef((props, ref) => {
    return <TableBody ref={ref} {...props} />;
});

const CurationBoardAIInterfaceCuratorTableBody: React.FC<{
    table: Table<ICurationTableStudy>;
    onSelect: (id: string) => void;
}> = ({ table, onSelect }) => {
    // for virtualization
    const sizeMap = useRef<{ [key: number]: number }>({});

    const setSize = useCallback((index: number, size: number) => {
        sizeMap.current[index] = size;
    }, []);

    const getSize = useCallback((index: number) => {
        return sizeMap.current[index] || 100;
    }, []);

    const rows = table.getRowModel().rows;

    return (
        <VariableSizeList
            innerElementType={inner}
            outerElementType={outer}
            width="500"
            itemSize={getSize}
            height={400}
            itemCount={rows.length}
            itemData={rows}
        >
            {({ index, style }) => (
                <CurationBoardAIInterfaceCuratorTableRow index={index} setSize={setSize} data={rows[index]} />
            )}
        </VariableSizeList>
    );
};
// return (
//     <TableBody>

//         {table.getRowModel().rows.map((row) => (
//             <TableRow
//                 key={row.id}
//                 id={row.id}
//                 onClick={() => onSelect(row.original.id)}
//                 sx={{
//                     transition: 'ease-in 150ms',
//                     height: '1px', // https://stackoverflow.com/questions/3215553/make-a-div-fill-an-entire-table-cell
//                     '&:hover': {
//                         backgroundColor: '#f6f6f6',
//                         // backgroundColor: '#f9f9f9',
//                         cursor: 'pointer',
//                         transition: 'ease-in-out 150ms',
//                     },
//                 }}
//             >
//                 {row.getVisibleCells().map((cell) => (
//                     <TableCell
//                         key={cell.id}
//                         sx={{
//                             position: cell.column.id === 'select' ? 'sticky' : '',
//                             backgroundColor: cell.column.id === 'select' ? 'white' : '',
//                             zIndex: 9,
//                             left: 0,
//                             padding: '6px',
//                             height: 'inherit',
//                             lineHeight: 'normal',
//                             width: `${cell.column.getSize()}px`,
//                         }}
//                     >
//                         {flexRender(cell.column.columnDef.cell, cell.getContext())}
//                     </TableCell>
//                 ))}
//             </TableRow>
//         ))}
//     </TableBody>
// );

export default CurationBoardAIInterfaceCuratorTableBody;
