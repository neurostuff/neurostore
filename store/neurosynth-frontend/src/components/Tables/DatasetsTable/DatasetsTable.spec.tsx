import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';
import { DatasetsApiResponse } from '../../../utils/api';
import DatasetsTable from './DatasetsTable';

describe('DatasetsTable', () => {
    const mockDatasets: DatasetsApiResponse[] = [
        {
            created_at: '2021-12-14T05:05:45.722157+00:00',
            description: null,
            doi: null,
            id: 'test-id-1',
            name: 'test-name-1',
            pmid: null,
            publication: null,
            studies: [],
            user: 'test-user',
        },
        {
            created_at: '2021-12-14T05:05:45.722157+00:00',
            description: null,
            doi: null,
            id: 'test-id-2',
            name: 'test-name-2',
            pmid: null,
            publication: null,
            studies: [],
            user: 'test-user',
        },
    ];

    const mockDatasetsNoInfo: DatasetsApiResponse[] = [
        {
            created_at: '2021-12-14T05:05:45.722157+00:00',
            description: null,
            doi: null,
            id: 'test-id-1',
            name: null,
            pmid: null,
            publication: null,
            studies: [],
            user: 'test-user',
        },
    ];

    const historyMock = {
        push: jest.fn(),
        location: {},
        listen: jest.fn(),
    };

    it('should render', () => {
        render(
            <Router history={historyMock as any}>
                <DatasetsTable datasets={mockDatasets} />
            </Router>
        );
        const rows = screen.getAllByRole('row');
        // add one to take the header into account
        expect(rows.length).toEqual(mockDatasets.length + 1);
    });

    it('should show no name message when there is no name', () => {
        render(
            <Router history={historyMock as any}>
                <DatasetsTable datasets={mockDatasetsNoInfo} />
            </Router>
        );
        const noNameMessage = screen.getByText('No name');
        expect(noNameMessage).toBeInTheDocument();
    });

    it('should show no description message when there is no name', () => {
        render(
            <Router history={historyMock as any}>
                <DatasetsTable datasets={mockDatasetsNoInfo} />
            </Router>
        );
        const noDescriptionMessage = screen.getByText('No description');
        expect(noDescriptionMessage).toBeInTheDocument();
    });

    it('should handle the selection on row select', () => {
        render(
            <Router history={historyMock as any}>
                <DatasetsTable datasets={mockDatasets} />
            </Router>
        );

        const row = screen.getByText(mockDatasets[0].name as string);
        userEvent.click(row);

        expect(historyMock.push).toBeCalledWith('/datasets/' + mockDatasets[0].id);
    });
});
