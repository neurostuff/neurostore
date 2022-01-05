import { render, screen } from '@testing-library/react';
import DisplayValuesTableRow from './DisplayValuesTableRow';

describe('DisplayMetadataTableRow Component', () => {
    const testColValues = [
        {
            value: 1234,
            colorByType: false,
            bold: false,
            center: false,
        },
        {
            value: 6789,
            colorByType: true,
            bold: true,
            center: false,
        },
        {
            value: 'test',
            colorByType: true,
            bold: true,
            center: false,
        },
        {
            value: true,
            colorByType: true,
            bold: true,
            center: false,
        },
        {
            value: undefined,
            colorByType: true,
            bold: true,
            center: false,
        },
        {
            value: null,
            colorByType: true,
            bold: true,
            center: false,
        },
    ];

    it('should render', () => {
        render(<DisplayValuesTableRow uniqueKey={'test12345'} columnValues={testColValues} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const cells = screen.getAllByRole('cell');
        expect(cells.length).toEqual(testColValues.length);
    });

    it('should render the cell with no styling', () => {
        render(<DisplayValuesTableRow uniqueKey={'test12345'} columnValues={testColValues} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const firstCell = screen.getByText(1234);
        const firstCellStyles = getComputedStyle(firstCell);
        expect(firstCellStyles.color).not.toBe('orange');
        expect(firstCellStyles.color).not.toBe('blue');
        expect(firstCellStyles.color).not.toBe('green');
        expect(firstCellStyles.color).not.toBe('gray');
        expect(firstCellStyles.fontWeight).toBe('normal');
    });

    it('should render the number cell with styling', () => {
        render(<DisplayValuesTableRow uniqueKey={'test12345'} columnValues={testColValues} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const secondCell = screen.getByText(6789);
        const cellStyles = getComputedStyle(secondCell);
        expect(cellStyles.color).toBe('blue');
        expect(cellStyles.fontWeight).toBe('bold');
    });

    it('should render the string cell with styling', () => {
        render(<DisplayValuesTableRow uniqueKey={'test12345'} columnValues={testColValues} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const thirdCell = screen.getByText('test');
        const cellStyles = getComputedStyle(thirdCell);
        expect(cellStyles.color).toBe('orange');
        expect(cellStyles.fontWeight).toBe('bold');
    });

    it('should render the boolean cell with styling', () => {
        render(<DisplayValuesTableRow uniqueKey={'test12345'} columnValues={testColValues} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const fourthCell = screen.getByText('true');
        const cellStyles = getComputedStyle(fourthCell);
        expect(cellStyles.color).toBe('green');
        expect(cellStyles.fontWeight).toBe('bold');
    });

    it('should render the undefined cell with styling', () => {
        render(<DisplayValuesTableRow uniqueKey={'test12345'} columnValues={testColValues} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const fifthCell = screen.getByText('none');
        const cellStyles = getComputedStyle(fifthCell);
        expect(cellStyles.color).toBe('gray');
        expect(cellStyles.fontWeight).toBe('bold');
    });

    it('should render the null cell with styling', () => {
        render(<DisplayValuesTableRow uniqueKey={'test12345'} columnValues={testColValues} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const sixthCell = screen.getByText('null');
        const cellStyles = getComputedStyle(sixthCell);
        expect(cellStyles.color).toBe('gray');
        expect(cellStyles.fontWeight).toBe('bold');
    });

    it('should be selectable when the canSelectRow flag is enabled', () => {

    })

    it('should call the handler when the row is clicked', () => {
        
    })
});
