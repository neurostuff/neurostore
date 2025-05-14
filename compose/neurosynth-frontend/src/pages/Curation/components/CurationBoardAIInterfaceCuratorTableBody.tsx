import { TableBody } from '@mui/material';
import { Table } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { RefObject, useEffect } from 'react';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import CurationBoardAIInterfaceCuratorTableRow from './CurationBoardAIInterfaceCuratorTableRow';

const isNotBrowserOrIsFirefox = typeof window === 'undefined' || navigator.userAgent.includes('Firefox');

const CurationBoardAIInterfaceCuratorTableBody: React.FC<{
    table: Table<ICurationTableStudy>;
    onSelect: (id: string) => void;
    tableContainerRef: RefObject<HTMLDivElement | null>;
    selectedStub: ICurationTableStudy | undefined;
}> = ({ table, onSelect, tableContainerRef, selectedStub }) => {
    const rows = table.getRowModel().rows;
    const virtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
        count: rows.length,
        estimateSize: () => 100,
        getScrollElement: () => tableContainerRef.current,
        measureElement: isNotBrowserOrIsFirefox ? undefined : (e) => e?.getBoundingClientRect()?.height,
        overscan: 5,
    });

    useEffect(() => {
        if (!selectedStub) return;
        setTimeout(() => {
            const rowIndex = rows.findIndex((r) => r.original.id === selectedStub.id);
            virtualizer.scrollToIndex(rowIndex, { align: 'start' });
        }, 0);
    }, [rows, selectedStub, virtualizer]);

    return (
        <TableBody style={{ display: 'grid', height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                    <CurationBoardAIInterfaceCuratorTableRow
                        onSelect={onSelect}
                        key={row.id}
                        virtualRow={virtualRow}
                        virtualizer={virtualizer}
                        data={row}
                    />
                );
            })}
        </TableBody>
    );
};

export default CurationBoardAIInterfaceCuratorTableBody;
