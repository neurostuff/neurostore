import { render, screen } from '@testing-library/react';
import { INeurosynthSpreadsheetData } from '.';
import { EPropertyType, NeurosynthSpreadsheetWrapper } from '..';

jest.mock('./NeurosynthSpreadsheet/NeurosynthSpreadsheet', () => {
    return (props: INeurosynthSpreadsheetData) => {
        return <div>placeholder</div>;
    };
});

describe('NeurosynthSpreadsheetWrapper Component', () => {
    const mockOnColumnDelete = jest.fn();
    const mockOnCellUpdates = jest.fn();

    const mockSpreadsheetData: INeurosynthSpreadsheetData = {
        onColumnDelete: mockOnColumnDelete,
        onCellUpdates: mockOnCellUpdates,
        rowHeaderValues: [],
        columnHeaderValues: [],
        data: [],
    };

    it('should render', () => {
        render(<NeurosynthSpreadsheetWrapper {...mockSpreadsheetData} />);
        const noDataMsg = screen.getByText('There are no notes for this annotation yet');
        expect(noDataMsg).toBeInTheDocument();
    });

    it('should not show an error message', () => {
        const mockColumnHeaderValues = [
            {
                value: 'some-value',
                type: EPropertyType.STRING,
            },
        ];
        render(
            <NeurosynthSpreadsheetWrapper
                {...mockSpreadsheetData}
                columnHeaderValues={mockColumnHeaderValues}
            />
        );
        const noDataMsg = screen.queryByText('There are no notes for this annotation yet');
        expect(noDataMsg).toBeFalsy();
    });
});
