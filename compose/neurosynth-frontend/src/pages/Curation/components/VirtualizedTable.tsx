import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useVirtualizer, VirtualItem, Virtualizer } from '@tanstack/react-virtual';
import React, { forwardRef, useMemo, useRef } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

const inner = forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>((props, ref) => {
    const { children, ...rest } = props;

    return (
        <div {...rest} ref={ref}>
            <table style={{ top: 40, position: 'absolute', width: '100%' }}>
                <thead>
                    <tr>
                        <th>Id</th>
                        <th>Name</th>
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
});

const Row: React.FC<{
    row: { id: number; name: string };
    virtualRow: VirtualItem;
    rowVirtualizer: Virtualizer<HTMLDivElement, HTMLTableRowElement>;
}> = ({ row, virtualRow, rowVirtualizer }) => {
    const lngth = useMemo(() => {
        return Math.round(Math.random() * 100);
    }, []);

    return (
        <tr
            style={{
                display: 'grid',
                gridAutoFlow: 'column',
                gridTemplateColumns: '100px repeat(6, minmax(300px, 1fr))',
                position: 'absolute',
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
            }}
            data-index={virtualRow.index}
            ref={(node) => rowVirtualizer.measureElement(node)}
            key={row.id}
        >
            <td>{row.id} </td>
            <td>{row.name}</td>
            <td style={{ whiteSpace: 'wrap' }}>
                <Box sx={{ flexWrap: 'wrap', display: 'flex' }}>
                    {Array.from({ length: lngth }).map((_, i) => (
                        <span key={i}>a</span>
                    ))}
                </Box>
            </td>
            <td>2</td>
            <td>3</td>
            <td>4</td>
            <td>5</td>
        </tr>
    );
};

const generateData = () => {
    return Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Row ${i}` }));
};
const VirtualizedTable: React.FC = (props) => {
    const data = generateData();
    const ref = useRef<HTMLDivElement | null>(null);

    const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
        count: data.length,
        estimateSize: () => 50,
        getScrollElement: () => ref.current,
        measureElement:
            typeof window === 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
                ? (element) => element?.getBoundingClientRect().height
                : undefined,
        overscan: 5,
    });

    return (
        <>
            <TableContainer
                ref={ref}
                style={{ overflow: 'auto', position: 'relative', height: '400px', width: '100%' }}
            >
                <Table style={{ display: 'grid', width: '100%' }}>
                    <TableHead
                        style={{
                            display: 'grid',
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                            backgroundColor: 'white',
                        }}
                    >
                        <TableRow
                            style={{
                                display: 'grid',
                                width: '100%',
                                gridTemplateColumns: '100px repeat(6, minmax(300px, 1fr))',
                                gridAutoFlow: 'column',
                            }}
                        >
                            <TableCell>Id</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>col1</TableCell>
                            <TableCell>col2</TableCell>
                            <TableCell>col3</TableCell>
                            <TableCell>col4</TableCell>
                            <TableCell>col5</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody
                        style={{
                            display: 'grid',
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const row = data[virtualRow.index];
                            return (
                                <Row row={row} virtualRow={virtualRow} rowVirtualizer={rowVirtualizer} key={row.id} />
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
};

export default VirtualizedTable;
