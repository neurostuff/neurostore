import { render, screen } from '@testing-library/react';
import { IDisplayValuesTableModel } from '../..';
import DisplayValuesTable from './DisplayValuesTable';

describe('DisplayValuesTable Component', () => {
    it('should render', () => {
        render(<DisplayValuesTable columnHeaders={[]} rowData={[]} />);
        const noDataMsg = screen.getByText('No data');
        expect(noDataMsg).toBeInTheDocument();
    });

    it('should render data with rows', () => {
        const mockTableData: IDisplayValuesTableModel = {
            columnHeaders: [
                {
                    value: 'testCol1',
                    center: false,
                    bold: false,
                },
                {
                    value: 'testCol2',
                    center: false,
                    bold: false,
                },
            ],
            rowData: [
                {
                    uniqueKey: 'testUniqueKey1',
                    columnValues: [
                        {
                            value: 'some test value',
                            colorByType: false,
                            bold: false,
                            center: false,
                        },
                        {
                            value: false,
                            colorByType: true,
                            bold: true,
                            center: false,
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
                            center: false,
                        },
                        {
                            value: 'another test value',
                            colorByType: true,
                            bold: true,
                            center: false,
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
