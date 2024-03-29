import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DisplayImageTableRow, { IDisplayImageTableRow } from './DisplayImageTableRow';

jest.mock('components/Tables/NeurosynthTable/NeurosynthTable');

describe('DisplayImageTableRow Component', () => {
    const mockTableRow: IDisplayImageTableRow = {
        onRowSelect: jest.fn(),
        image: {
            add_date: '2016-01-21T17:22:27.397856+00:00',
            analysis: '4HcXc4CqPvcF',
            analysis_name: 'model001 task001 cope001 tstat1',
            created_at: '2021-10-25T10:37:20.237634+00:00',
            filename: 'model001_task001_cope001_tstat1.nii.gz',
            id: '5asPG5P4x7F9',
            metadata: {
                BMI: 'some-BMI-value',
                add_date: '2016-01-21T17:22:27.397856Z',
                age: 'some-age-value',
                analysis_level: 'group',
                bis11_score: 'some-score',
            },
            space: 'MNI',
            url: 'https://neurovault.org/media/images/415/model001_task001_cope001_tstat1.nii.gz',
            user: null,
            value_type: 'T',
        },
        active: false,
    };

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(<DisplayImageTableRow {...mockTableRow} />, {
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
        render(<DisplayImageTableRow {...mockTableRow} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const row = screen.getAllByRole('row')[0];
        userEvent.click(row);
        expect(mockTableRow.onRowSelect).toBeCalledWith(mockTableRow.image);
    });

    it('should expand the row when the button is clicked', () => {
        render(<DisplayImageTableRow {...mockTableRow} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        let titleText = screen.getByText('Image Metadata');
        expect(titleText).not.toBeVisible();

        const expansionButton = screen.getByRole('button');
        userEvent.click(expansionButton);

        titleText = screen.getByText('Image Metadata');

        expect(titleText).toBeVisible();
    });

    it('should render the correct data in the table', () => {
        render(<DisplayImageTableRow {...mockTableRow} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });

        const expansionButton = screen.getByRole('button');
        userEvent.click(expansionButton);

        Object.entries(mockTableRow.image.metadata || {}).forEach((kvp) => {
            const uniqueKey = screen.getByText(`${kvp[0]}`);
            const name = screen.getByText(`${kvp[0]}`);
            const value = screen.getByText(`${kvp[1]}`);
            expect(uniqueKey).toBeInTheDocument();
            expect(name).toBeInTheDocument();
            expect(value).toBeInTheDocument();
        });
    });
});
