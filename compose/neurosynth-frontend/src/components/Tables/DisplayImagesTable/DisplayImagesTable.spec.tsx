import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageReturn } from 'neurostore-typescript-sdk';
import { DisplayImagesTableModel } from '.';
import DisplayImagesTable from './DisplayImagesTable';

describe('DisplayImagesTable Component', () => {
    const mockData: DisplayImagesTableModel = {
        onSelectImage: jest.fn(),
        initialSelectedImage: {
            add_date: '2017-05-20T16:23:11.397231+00:00',
            analysis: 'uniqueAnalysisID2',
            analysis_name: 'test name 2',
            created_at: '2021-10-25T10:37:20.237634+00:00',
            filename: 'some_file_name_2.nii.gz',
            id: 'someID2',
            metadata: {
                BMI: null,
                add_date: '2016-01-21T17:22:27.397856Z',
                age: null,
                analysis_level: 'group',
                bis11_score: null,
            },
            space: 'MNI',
            url: 'https://neurovault.org/media/images/415/some_file_name_2.nii.gz',
            user: null,
            value_type: 'T',
        },
        images: [
            {
                add_date: '2016-01-21T17:22:27.397856+00:00',
                analysis: 'uniqueAnalysisID1',
                analysis_name: 'test name 2',
                created_at: '2021-10-25T10:37:20.237634+00:00',
                filename: 'some_file_name_1.nii.gz',
                id: 'someID1',
                metadata: {
                    BMI: null,
                    add_date: '2016-01-21T17:22:27.397856Z',
                    age: null,
                    analysis_level: 'group',
                    bis11_score: null,
                },
                space: 'MNI',
                url: 'https://neurovault.org/media/images/415/some_file_name_1.nii.gz',
                user: null,
                value_type: 'T',
            },
            {
                add_date: '2017-05-20T16:23:11.397231+00:00',
                analysis: 'uniqueAnalysisID2',
                analysis_name: 'test name 2',
                created_at: '2021-10-25T10:37:20.237634+00:00',
                filename: 'some_file_name_2.nii.gz',
                id: 'someID2',
                metadata: {
                    BMI: null,
                    add_date: '2016-01-21T17:22:27.397856Z',
                    age: null,
                    analysis_level: 'group',
                    bis11_score: null,
                },
                space: 'MNI',
                url: 'https://neurovault.org/media/images/415/some_file_name_2.nii.gz',
                user: null,
                value_type: 'T',
            },
        ],
    };

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const mockData: DisplayImagesTableModel = {
            onSelectImage: jest.fn(),
            initialSelectedImage: undefined,
            images: [],
        };

        render(<DisplayImagesTable {...mockData} />);
        const noData = screen.getByText('No images');
        expect(noData).toBeInTheDocument();
    });

    it('should render rows', () => {
        render(<DisplayImagesTable {...mockData} />);

        const rows = screen.getAllByRole('row');
        // 1 header row, 1 data row, 1 hidden row, and then the second data row = 4th element
        const secondDataRowStyle = getComputedStyle(rows[3]);

        // 1 header row, 2 data rows and then 2 hidden rows
        expect(rows.length).toBe(5);
        // there is an issue with react testing library, jest, and the ability to compute
        // accurate colors. Because of this, we test that the background color exists. For non-selected
        // rows, the background color will be falsy
        expect(secondDataRowStyle.backgroundColor).toBeTruthy();
    });

    it('should fire the row select event when clicked', () => {
        render(<DisplayImagesTable {...mockData} />);

        const rows = screen.getAllByRole('row');
        let firstDataRowStyle = getComputedStyle(rows[1]);
        let secondDataRowStyle = getComputedStyle(rows[3]);

        expect(firstDataRowStyle.backgroundColor).toBeFalsy();
        expect(secondDataRowStyle.backgroundColor).toBeTruthy();

        userEvent.click(rows[1]);

        expect(mockData.onSelectImage).toBeCalledWith((mockData.images as ImageReturn[])[0]);

        firstDataRowStyle = getComputedStyle(rows[1]);
        secondDataRowStyle = getComputedStyle(rows[3]);

        expect(firstDataRowStyle.backgroundColor).toBeTruthy();
        expect(secondDataRowStyle.backgroundColor).toBeFalsy();
    });
});
