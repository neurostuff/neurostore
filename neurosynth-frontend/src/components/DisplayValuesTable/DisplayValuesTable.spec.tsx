import { render, screen } from '@testing-library/react';
import { DisplayValuesTable, DisplayValuesTableModel } from '..';

describe('DisplayValuesTable Component', () => {
    it('should render', () => {
        render(<DisplayValuesTable columnHeaders={[]} rowData={[]} />);
        const noDataMsg = screen.getByText('No data');
        expect(noDataMsg).toBeInTheDocument();
    });

    it('should render data with rows', () => {
        const mockTableData: DisplayValuesTableModel = {
            columnHeaders: ['testCol1', 'testCol2'],
            rowData: [
                {
                    uniqueKey: 'testUniqueKey1',
                    columnValues: [
                        {
                            value: 'some test value',
                            colorByType: false,
                            bold: false,
                        },
                        {
                            value: false,
                            colorByType: true,
                            bold: true,
                        },
                    ],
                },
                {
                    uniqueKey: 'testUniqueKey2',
                    columnValues: [
                        {
                            value: 1234,
                            colorByType: false,
                            bold: false,
                        },
                        {
                            value: 'another test value',
                            colorByType: true,
                            bold: true,
                        },
                    ],
                },
            ],
        };

        render(<DisplayValuesTable {...mockTableData} />);

        const rows = screen.getAllByRole('row');
        // add 1 to take into account the row header
        expect(rows.length).toBe(mockTableData.rowData.length + 1);
    });
});
