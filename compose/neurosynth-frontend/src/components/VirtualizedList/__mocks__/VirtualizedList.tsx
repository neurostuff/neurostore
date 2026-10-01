import type { VirtualizedListProps } from 'components/VirtualizedList/VirtualizedList';

function MockVirtualizedList<T>({ rows, renderRow, getItemKey }: VirtualizedListProps<T>) {
    return (
        <div>
            {rows.map((row, index) => (
                <div key={getItemKey(row, index)}>{renderRow(row, {}, index)}</div>
            ))}
        </div>
    );
}

export default MockVirtualizedList;
