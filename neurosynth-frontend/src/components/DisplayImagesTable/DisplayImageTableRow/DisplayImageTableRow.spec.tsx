import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisplayImagesTableRowModel } from '..';
import DisplayImagesTableRow from './DisplayImagesTableRow';

describe('DisplayImagesTableRow Component', () => {
    const mockTableRow: DisplayImagesTableRowModel = {
        onRowSelect: jest.fn(),
        image: {
            add_date: '2016-01-21T17:22:27.397856+00:00',
            analysis: '4HcXc4CqPvcF',
            analysis_name: 'model001 task001 cope001 tstat1',
            created_at: '2021-10-25T10:37:20.237634+00:00',
            filename: 'model001_task001_cope001_tstat1.nii.gz',
            id: '5asPG5P4x7F9',
            metadata: {
                BMI: null,
                add_date: '2016-01-21T17:22:27.397856Z',
                age: null,
                analysis_level: 'group',
                bis11_score: null,
            },
            space: 'MNI',
            url: 'https://neurovault.org/media/images/415/model001_task001_cope001_tstat1.nii.gz',
            user: null,
            value_type: 'T',
        },
        active: false,
    };

    it('should render', () => {
        render(<DisplayImagesTableRow {...mockTableRow} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });
        const rows = screen.getAllByRole('row');
        const spaceCell = screen.getByText('MNI');
        const valueTypeCell = screen.getByText('T');

        // original row plus hidden/collapsed row
        expect(rows.length).toBe(2);
        expect(spaceCell).toBeInTheDocument();
        expect(valueTypeCell).toBeInTheDocument();
    });

    it('should call the select method when row is clicked', () => {
        render(<DisplayImagesTableRow {...mockTableRow} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const row = screen.getAllByRole('row')[0];
        userEvent.click(row);
        expect(mockTableRow.onRowSelect).toBeCalled();
    });

    it('should expand the row when the button is clicked', () => {
        render(<DisplayImagesTableRow {...mockTableRow} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const expansionButton = screen.getByRole('button');
        userEvent.click(expansionButton);

        const expandedRows = screen.getAllByRole('row');
        const titleText = screen.getByText('Image Metadata');

        // 1 row per kvp in metadata plus 2 original rows, and 1 more for the header of the expanded table
        const numRows = Object.keys(mockTableRow.image.metadata || {}).length + 3;

        expect(titleText).toBeVisible();
        expect(expandedRows.length).toBe(numRows);
    });
});
