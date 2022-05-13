import { IDisplayValuesTableModel } from '..';

const MockDisplayValuesTable: React.FC<IDisplayValuesTableModel> = (props) => {
    const handleRowClick = () => {
        if (props.onValueSelected) props.onValueSelected('some-selected-id');
    };

    const handleTriggerAction = () => {
        if (props.onActionSelected) props.onActionSelected('some-selected-id');
    };

    return (
        <>
            <div data-testid="mock-table">mock table</div>
            {props.rowData.map((row) => (
                <div key={row.uniqueKey}>
                    <span>{`unique key: ${row.uniqueKey}`}</span>
                    {props.columnHeaders.map((col, index) => (
                        <span
                            key={col.value}
                        >{`${col.value}: ${row.columnValues[index].value}`}</span>
                    ))}
                </div>
            ))}
            <button data-testid="simulate-trigger-action" onClick={handleTriggerAction}>
                simulate trigger action
            </button>
            <button data-testid="simulate-row-click" onClick={handleRowClick}>
                simulate row click
            </button>
        </>
    );
};

export default MockDisplayValuesTable;
