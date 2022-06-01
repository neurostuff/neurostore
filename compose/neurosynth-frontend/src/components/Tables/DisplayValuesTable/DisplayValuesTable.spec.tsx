import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDisplayValuesTableModel } from '../..';
import DisplayValuesTable from './DisplayValuesTable';

jest.mock('./DisplayValuesTableRow/DisplayValuesTableRow');

describe('DisplayValuesTable Component', () => {
    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(<DisplayValuesTable columnHeaders={[]} rowData={[]} />);
        const noDataMsg = screen.getByText('No data');
        expect(noDataMsg).toBeInTheDocument();
    });

    describe('rendering', () => {
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
                            shouldHighlightNoData: false,
                        },
                        {
                            value: false,
                            colorByType: true,
                            bold: true,
                            center: false,
                            shouldHighlightNoData: false,
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
                            shouldHighlightNoData: false,
                        },
                        {
                            value: 'another test value',
                            colorByType: true,
                            bold: true,
                            center: false,
                            shouldHighlightNoData: false,
                        },
                    ],
                },
            ],
        };
        it('should render data with correct rows', () => {
            render(<DisplayValuesTable {...mockTableData} />);
            const rows = screen.getAllByTestId(/mock-row/);
            expect(rows.length).toBe(mockTableData.rowData.length);
        });

        it('should render data with correct columns', () => {
            // override and set rowData as empty arr as we are just testing columns
            render(<DisplayValuesTable {...mockTableData} />);
            const rows = screen.getAllByRole('columnheader');
            expect(rows.length).toBe(mockTableData.columnHeaders.length);
        });
    });

    describe('styling', () => {
        const mockTableData: IDisplayValuesTableModel = {
            columnHeaders: [
                {
                    value: 'testCol1',
                    center: true,
                    bold: true,
                },
                {
                    value: 'testCol2',
                    center: false,
                    bold: false,
                },
            ],
            rowData: [],
        };
        it('should render with a div component', () => {
            const { container } = render(
                <DisplayValuesTable columnHeaders={[]} paper={false} rowData={[]} />
            );
            expect(container.getElementsByClassName('MuiPaper-root').length).toBe(0);
        });

        it('should render with the paper component', () => {
            const { container } = render(
                <DisplayValuesTable columnHeaders={[]} paper={true} rowData={[]} />
            );
            expect(container.getElementsByClassName('MuiPaper-root').length).toBe(1);
        });

        it('should render with an applied table head color', () => {
            render(
                <DisplayValuesTable
                    columnHeaders={[]}
                    tableHeadRowColor="blue"
                    paper={true}
                    rowData={[]}
                />
            );
            const tableHeadRow = screen.getByRole('row');
            const tableHeadRowStyles = getComputedStyle(tableHeadRow);
            expect(tableHeadRowStyles.backgroundColor).toBe('blue');
        });

        it('should render the column header with bold styling', () => {
            render(<DisplayValuesTable {...mockTableData} />);
            const boldedText = screen.getByText('testCol1');
            const textStyles = getComputedStyle(boldedText);
            expect(textStyles.fontWeight).toBe('700');
        });

        it('should render the column header without bold styling', () => {
            render(<DisplayValuesTable {...mockTableData} />);
            const noneBoldedText = screen.getByText('testCol2');
            const textStyles = getComputedStyle(noneBoldedText);
            expect(textStyles.fontWeight).toBe('normal');
        });

        it('should render the column header center aligned', () => {
            render(<DisplayValuesTable {...mockTableData} />);
            const centerAlignedText = screen.getByText('testCol1');
            const textStyles = getComputedStyle(centerAlignedText);
            expect(textStyles.textAlign).toBe('center');
        });

        it('should render the column header left aligned', () => {
            render(<DisplayValuesTable {...mockTableData} />);
            const leftAlignedText = screen.getByText('testCol2');
            const textStyles = getComputedStyle(leftAlignedText);
            expect(textStyles.textAlign).toBe('left');
        });

        it('should render with the contrasting text', () => {
            render(<DisplayValuesTable {...mockTableData} tableHeadRowTextContrastColor="white" />);
            const row = screen.getByText('testCol1');
            const rowStyles = getComputedStyle(row);
            expect(rowStyles.color).toBe('white');
        });
    });

    describe('selecting', () => {
        const mockTableData: IDisplayValuesTableModel = {
            columnHeaders: [
                {
                    value: 'testCol1',
                    center: false,
                    bold: false,
                },
                {
                    value: '',
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
                            shouldHighlightNoData: false,
                        },
                        {
                            isAction: true,
                            value: 'my-action',
                        },
                    ],
                },
            ],
        };
        let mockOnValueSelected = jest.fn();
        let mockOnActionSelected = jest.fn();

        beforeEach(() => {
            mockOnValueSelected = jest.fn();
            mockOnActionSelected = jest.fn();
        });

        it('should call the handleRowSelect handler when the row is clicked', () => {
            render(
                <DisplayValuesTable
                    {...mockTableData}
                    onValueSelected={mockOnValueSelected}
                    selectable={true}
                />
            );
            const row = screen.getByTestId('mock-row-testUniqueKey1');
            userEvent.click(row);
            expect(mockOnValueSelected).toHaveBeenCalledWith('testUniqueKey1');
        });

        it('should not call the handleRowSelect handler if selectable is false', () => {
            render(
                <DisplayValuesTable
                    {...mockTableData}
                    onValueSelected={mockOnValueSelected}
                    selectable={false}
                />
            );

            const row = screen.getByTestId('mock-row-testUniqueKey1');
            userEvent.click(row);
            expect(mockOnValueSelected).not.toHaveBeenCalled();
        });

        it('should run the action', () => {
            render(
                <DisplayValuesTable
                    {...mockTableData}
                    onValueSelected={mockOnValueSelected}
                    onActionSelected={mockOnActionSelected}
                    selectable={false}
                />
            );

            userEvent.click(screen.getByText('my-action'));

            expect(mockOnActionSelected).toHaveBeenCalledWith('some-selected-id');
        });
    });
});
