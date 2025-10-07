import { TableCell, TableRow } from '@mui/material';
import { flexRender, Row } from '@tanstack/react-table';
import { VirtualItem, Virtualizer } from '@tanstack/react-virtual';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import { getGridTemplateColumns } from '../hooks/useCuratorTableState.helpers';

const CurationBoardAIInterfaceCuratorTableRow: React.FC<{
    data: Row<ICurationTableStudy>;
    virtualRow: VirtualItem;
    virtualizer: Virtualizer<HTMLDivElement, HTMLTableRowElement>;
    onSelect: (id: string) => void;
}> = ({ data, virtualRow, virtualizer, onSelect }) => {
    const tableCells = data.getVisibleCells();

    return (
        <TableRow
            key={data.id}
            id={data.id}
            onClick={() => onSelect(data.original.id)}
            style={{
                display: 'grid',
                gridAutoFlow: 'column',
                gridTemplateColumns: getGridTemplateColumns(tableCells),
                position: 'absolute',
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
            }}
            data-index={virtualRow.index}
            ref={(node) => virtualizer.measureElement(node)}
            sx={{
                '&:hover': {
                    backgroundColor: '#f6f6f6',
                    cursor: 'pointer',
                },
            }}
        >
            {tableCells.map((cell) => (
                <TableCell
                    key={cell.id}
                    onClick={(e) => {
                        if (cell.column.id === 'select') {
                            e.stopPropagation();
                            e.preventDefault();
                            return;
                        }
                    }}
                    sx={{
                        position: cell.column.id === 'select' ? 'sticky' : undefined,
                        backgroundColor: cell.column.id === 'select' ? 'white' : undefined,
                        left: 0,
                        zIndex: cell.column.id === 'select' ? 9 : undefined,
                        padding: '7px',
                        lineHeight: 'normal',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
            ))}
        </TableRow>
    );
};

export default CurationBoardAIInterfaceCuratorTableRow;
