import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDisplayValuesTableModel, IDisplayValuesTableRowModel } from '../..';
import DisplayValuesTable from './DisplayValuesTable';

jest.mock('@mui/material/TableContainer', () => {
    return (props: any) => {
        const type = props.component === 'div' ? 'div' : 'paper';
        return <div data-testid={'mui-table-container-' + type}>{props.children}</div>;
    };
});

jest.mock('@mui/material/Table', () => {
    return (props: any) => {
        return <table data-testid="mui-table">{props.children}</table>;
    };
});

jest.mock('@mui/material/TableHead', () => {
    return (props: any) => {
        return <thead data-testid="mui-table-head">{props.children}</thead>;
    };
});

jest.mock('@mui/material/TableBody', () => {
    return (props: any) => {
        return <tbody data-testid="mui-table-body">{props.children}</tbody>;
    };
});

jest.mock('@mui/material/TableRow', () => {
    return (props: any) => {
        return (
            <tr style={props.sx} data-testid="mui-table-row">
                {props.children}
            </tr>
        );
    };
});

jest.mock('@mui/material/TableCell', () => {
    return (props: any) => {
        return (
            <td style={props.sx} data-testid="mui-table-cell">
                {props.children}
            </td>
        );
    };
});

jest.mock('./DisplayValuesTableRow/DisplayValuesTableRow', () => {
    return {
        __esModule: true,
        default: (props: IDisplayValuesTableRowModel) => {
            const clickHandler = () => {
                props.onSelectRow('id-of-row-selected');
            };

            return (
                <tr>
                    <td onClick={clickHandler}>mock-row</td>
                </tr>
            );
        },
    };
});

describe('DisplayValuesTable Component', () => {
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
            const rows = screen.getAllByText('mock-row');
            expect(rows.length).toBe(mockTableData.rowData.length);
        });

        it('should render data with correct columns', () => {
            // override and set rowData as empty arr a we are just testing columns
            render(<DisplayValuesTable {...mockTableData} rowData={[]} />);
            const rows = screen.getAllByRole('cell');
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
            render(<DisplayValuesTable columnHeaders={[]} paper={false} rowData={[]} />);
            const table = screen.queryByTestId('mui-table-container-div');
            expect(table).toBeTruthy();
        });

        it('should render with the paper component', () => {
            render(<DisplayValuesTable columnHeaders={[]} paper={true} rowData={[]} />);
            const table = screen.queryByTestId('mui-table-container-paper');
            expect(table).toBeTruthy();
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
            expect(textStyles.fontWeight).toBe('bold');
        });

        it('should render the column header without bold styling', () => {
            render(<DisplayValuesTable {...mockTableData} />);
            const noneBoldedText = screen.getByText('testCol2');
            const textStyles = getComputedStyle(noneBoldedText);
            expect(textStyles.fontWeight).not.toBe('bold');
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
                    ],
                },
            ],
        };
        let mockOnValueSelected = jest.fn();

        beforeEach(() => {
            mockOnValueSelected = jest.fn();
        });

        it('should throw an error if selectable but no handler defined', () => {
            // prevent jest from logging error to console
            jest.spyOn(console, 'error').mockImplementation(() => {});
            expect(() =>
                render(<DisplayValuesTable {...mockTableData} selectable={true} />)
            ).toThrow('table is selectable but handler is not defined');
        });

        it('should call the handleRowSelect handler when the row is clicked', () => {
            render(
                <DisplayValuesTable
                    {...mockTableData}
                    onValueSelected={mockOnValueSelected}
                    selectable={true}
                />
            );
            const row = screen.getByText('mock-row');
            userEvent.click(row);
            expect(mockOnValueSelected).toHaveBeenCalledWith('id-of-row-selected');
        });

        it('should not call the handleRowSelect handler if selectable is false', () => {
            render(
                <DisplayValuesTable
                    {...mockTableData}
                    onValueSelected={mockOnValueSelected}
                    selectable={false}
                />
            );

            const row = screen.getByText('mock-row');
            userEvent.click(row);
            expect(mockOnValueSelected).not.toHaveBeenCalled();
        });
    });
});
