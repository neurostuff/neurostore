import { IDisplayImageTableRow } from '../DisplayImageTableRow';

const mockDisplayImageTableRow: React.FC<IDisplayImageTableRow> = (props) => {
    return (
        <tr data-testid="mock-table-row">
            <td data-testid="mock-table-cell"></td>
            <td data-testid="mock-table-cell"></td>
        </tr>
    );
};

export default mockDisplayImageTableRow;
