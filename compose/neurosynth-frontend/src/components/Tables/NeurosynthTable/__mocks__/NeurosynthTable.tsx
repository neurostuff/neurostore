import { INeurosynthTable } from '../NeurosynthTable';

const mockNeurosynthTable: React.FC<INeurosynthTable> = (props: INeurosynthTable) => {
    return (
        <table data-testid="mock-table">
            <thead>
                <tr>
                    <th data-testid="mock-header">test-header-1</th>
                    <th data-testid="mock-header">test-header-2</th>
                </tr>
            </thead>
            <tbody>{props.rows}</tbody>
        </table>
    );
};

export default mockNeurosynthTable;
