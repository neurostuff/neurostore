import { IDisplayValuesTableRowModel } from '../..';

const MockDisplayValuesTableRow: React.FC<IDisplayValuesTableRowModel> = (props) => {
    return (
        <tr
            data-testid={'mock-row-' + props.uniqueKey}
            onClick={() => props.onSelectRow(props.uniqueKey)}
        >
            {props.columnValues.map((col, index) => {
                return (
                    <td data-testid={'mock-col-' + index} key={index}>
                        {col.isAction ? (
                            <button onClick={() => props.onSelectAction('some-selected-id')}>
                                <span>{col.value?.toString()}</span>
                            </button>
                        ) : (
                            <span>{col.value?.toString()}</span>
                        )}
                    </td>
                );
            })}
        </tr>
    );
};

export default MockDisplayValuesTableRow;
