import { IDisplayValuesTableRowModel } from '../..';

const mockDisplayValuesTableRow: React.FC<IDisplayValuesTableRowModel> = (props) => {
    return (
        <tr
            data-testid={'mock-row-' + props.uniqueKey}
            onClick={() => props.onSelectRow(props.uniqueKey)}
        >
            {props.columnValues.map((col, index) => {
                return (
                    <td data-testid={'mock-col-' + index} key={index}>
                        <span>{col.value?.toString()}</span>
                    </td>
                );
            })}
        </tr>
    );
};

export default mockDisplayValuesTableRow;
