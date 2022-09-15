import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Annotation, AnnotationReturn, ReadOnly } from 'neurostore-typescript-sdk';
import { Router } from 'react-router-dom';
import AnnotationsTable from './AnnotationsTable';

jest.mock('@auth0/auth0-react');
jest.mock('../DisplayValuesTable/DisplayValuesTable');

describe('AnnotationsTable component', () => {
    const mockAnnotationApiResponse: AnnotationReturn[] = [
        {
            studyset: 'test-studyset-id',
            notes: [],
            id: 'unique-id-1',
            created_at: 'some-created-at-date',
            user: 'github|user-1',
            name: 'annotation-name-1',
            description: 'some-description-1',
            metadata: {},
        },
        {
            studyset: 'test-studyset-id',
            notes: [],
            id: 'unique-id-2',
            created_at: 'some-created-at-date',
            user: 'github|user-2',
            name: 'annotation-name-2',
            description: 'some-description-2',
            metadata: {},
        },
    ];

    const mockAnnotationApiResponseNoData: AnnotationReturn[] = [
        {
            studyset: 'test-studyset-id',
            notes: [],
            id: 'unique-id-1',
            created_at: 'some-created-at-date',
            user: 'some-github-user',
            name: undefined,
            description: undefined,
            metadata: {},
        },
    ];

    const studysetId = 'test-studyset-id';

    const historyMock = {
        push: jest.fn(),
        location: {},
        listen: jest.fn(),
    };

    afterAll(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        render(
            <Router history={historyMock as any}>
                <AnnotationsTable annotations={mockAnnotationApiResponse} studysetId={studysetId} />
            </Router>
        );
        const row = screen.getByText('mock table');
        expect(row).toBeInTheDocument();
    });

    it('should handle row selection', () => {
        render(
            <Router history={historyMock as any}>
                <AnnotationsTable annotations={mockAnnotationApiResponse} studysetId={studysetId} />
            </Router>
        );

        const button = screen.getByTestId('simulate-row-click');
        userEvent.click(button);
        expect(historyMock.push).toBeCalledWith('/annotations/some-selected-id');
    });

    it('should format the data correctly', () => {
        render(
            <Router history={historyMock as any}>
                <AnnotationsTable annotations={mockAnnotationApiResponse} studysetId={studysetId} />
            </Router>
        );

        mockAnnotationApiResponse.forEach((res: Annotation & ReadOnly) => {
            const uniqueKey = screen.getByText(`unique key: ${res.id}`);
            const name = screen.getByText(`Name: ${res.name}`);
            const description = screen.getByText(`Description: ${res.description}`);
            const user = screen.getByText(`Owner: ${res.user}`);
            expect(uniqueKey).toBeInTheDocument();
            expect(name).toBeInTheDocument();
            expect(description).toBeInTheDocument();
            expect(user).toBeInTheDocument();
        });
    });

    it('should show No name', () => {
        render(
            <Router history={historyMock as any}>
                <AnnotationsTable
                    annotations={mockAnnotationApiResponseNoData}
                    studysetId={studysetId}
                />
            </Router>
        );

        const noName = screen.getByText('Name: No name');
        expect(noName).toBeInTheDocument();
    });

    it('should show No description', () => {
        render(
            <Router history={historyMock as any}>
                <AnnotationsTable
                    annotations={mockAnnotationApiResponseNoData}
                    studysetId={studysetId}
                />
            </Router>
        );

        const noDescription = screen.getByText('Description: No description');
        expect(noDescription).toBeInTheDocument();
    });

    it('should show Me if the user is the current user', () => {
        render(
            <Router history={historyMock as any}>
                <AnnotationsTable
                    annotations={mockAnnotationApiResponseNoData}
                    studysetId={studysetId}
                />
            </Router>
        );

        const meText = screen.getByText('Owner: Me');
        expect(meText).toBeInTheDocument();
    });
});
