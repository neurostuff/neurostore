import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockThemeProvider } from '../../../../testing/helpers';
import DisplayValuesTableRow from './DisplayValuesTableRow';

describe('DisplayMetadataTableRow Component', () => {
    let mockOnSelectRow = jest.fn();

    const testColValues = [
        {
            value: 1234,
            colorByType: false,
            bold: false,
            center: false,
            shouldHighlightNoData: false,
        },
        {
            value: 6789,
            colorByType: true,
            bold: true,
            center: true,
            shouldHighlightNoData: false,
        },
        {
            value: 'test',
            colorByType: true,
            bold: true,
            center: false,
            shouldHighlightNoData: false,
        },
        {
            value: true,
            colorByType: true,
            bold: true,
            center: false,
            shouldHighlightNoData: false,
        },
        {
            value: undefined,
            colorByType: true,
            bold: true,
            center: false,
            shouldHighlightNoData: false,
        },
        {
            value: null,
            colorByType: true,
            bold: true,
            center: false,
            shouldHighlightNoData: false,
        },
        {
            value: 'test-highlight-value-1',
            colorByType: false,
            bold: false,
            center: false,
            shouldHighlightNoData: false,
        },
        {
            value: 'test-highlight-value-2',
            colorByType: false,
            bold: false,
            center: false,
            shouldHighlightNoData: true,
        },
    ];

    beforeEach(() => {
        mockOnSelectRow = jest.fn();
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(
            <DisplayValuesTableRow
                onSelectRow={mockOnSelectRow}
                canSelectRow={false}
                uniqueKey={'test12345'}
                columnValues={testColValues}
            />,
            {
                container: document.body.appendChild(document.createElement('tbody')),
            }
        );

        const cells = screen.getAllByRole('cell');
        expect(cells.length).toEqual(testColValues.length);
    });

    describe('Row Styling', () => {
        it('should render the cell with no styling', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const firstCell = screen.getByText(1234);
            const firstCellStyles = getComputedStyle(firstCell);
            expect(firstCellStyles.color).not.toBe('orange');
            expect(firstCellStyles.color).not.toBe('blue');
            expect(firstCellStyles.color).not.toBe('green');
            expect(firstCellStyles.color).not.toBe('gray');
            expect(firstCellStyles.fontWeight).toBe('normal');
        });

        it('should render the number cell with styling', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const secondCell = screen.getByText(6789);
            const cellStyles = getComputedStyle(secondCell);
            expect(cellStyles.color).toBe('blue');
        });

        it('should render the string cell with styling', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const thirdCell = screen.getByText('test');
            const cellStyles = getComputedStyle(thirdCell);
            expect(cellStyles.color).toBe('orange');
        });

        it('should render the boolean cell with styling', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const fourthCell = screen.getByText('true');
            const cellStyles = getComputedStyle(fourthCell);
            expect(cellStyles.color).toBe('green');
        });

        it('should render the undefined cell with styling', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const fifthCell = screen.getByText('none');
            const cellStyles = getComputedStyle(fifthCell);
            expect(cellStyles.color).toBe('gray');
        });

        it('should render the null cell with styling', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const sixthCell = screen.getByText('null');
            const cellStyles = getComputedStyle(sixthCell);
            expect(cellStyles.color).toBe('gray');
        });

        it('should render the cell with no bold styling', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const firstCell = screen.getByText(1234);
            const firstCellStyles = getComputedStyle(firstCell);
            expect(firstCellStyles.fontWeight).not.toBe('bold');
        });

        it('should render the cell with bold styling', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const secondCell = screen.getByText(6789);
            const secondCellStyles = getComputedStyle(secondCell);
            expect(secondCellStyles.fontWeight).toBe('bold');
        });

        it('should keep the text left aligned', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const firstCellWrapper = screen.getByRole('cell', { name: '1234' });
            const firstCellStyles = getComputedStyle(firstCellWrapper);
            expect(firstCellStyles.textAlign).toBe('left');
        });

        it('should keep the text center aligned', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const secondCellWrapper = screen.getByRole('cell', { name: '6789' });
            const secondCellStyles = getComputedStyle(secondCellWrapper);
            expect(secondCellStyles.textAlign).toBe('center');
        });

        it('should not highlight data', () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const row = screen.getByText('test-highlight-value-1');
            const rowStyles = getComputedStyle(row);
            expect(rowStyles.color).toBe('');
        });

        it('should highlight data', () => {
            render(
                <MockThemeProvider>
                    <DisplayValuesTableRow
                        onSelectRow={mockOnSelectRow}
                        canSelectRow={false}
                        uniqueKey={'test12345'}
                        columnValues={testColValues}
                    />
                </MockThemeProvider>,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const row = screen.getByText('test-highlight-value-2');
            const rowStyles = getComputedStyle(row);
            // replace warning.dark
            expect(rowStyles.color).toBe('rgb(178, 161, 76)');
        });
    });

    describe('Selection', () => {
        it('should call the handler when the canSelectRow flag is enabled and the row is clicked', async () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={true}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const row = screen.getByText('1234').closest('tr') as HTMLTableRowElement;
            userEvent.click(row);
            expect(mockOnSelectRow).toHaveBeenCalledWith('test12345');
        });

        it('should not call the handler when the canSelectRow flag is disabled and the row is clicked', async () => {
            render(
                <DisplayValuesTableRow
                    onSelectRow={mockOnSelectRow}
                    canSelectRow={false}
                    uniqueKey={'test12345'}
                    columnValues={testColValues}
                />,
                {
                    container: document.body.appendChild(document.createElement('tbody')),
                }
            );

            const row = screen.getByText('1234').closest('tr') as HTMLTableRowElement;
            userEvent.click(row);
            expect(mockOnSelectRow).not.toHaveBeenCalled();
        });
    });
});
