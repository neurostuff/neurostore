import { render, screen } from '@testing-library/react';
import EditAnalysesList from './EditAnalysesList';
import { IStoreAnalysis } from 'pages/Studies/StudyStore.helpers';
import userEvent from '@testing-library/user-event';

jest.mock('components/EditStudyComponents/EditAnalyses/EditAnalysesList/EditAnalysesListItem.tsx');

describe('EditAnalysesList Component', () => {
    it('should render', () => {
        render(
            <EditAnalysesList onSelectAnalysis={() => {}} selectedAnalysisId="" analyses={[]} />
        );
    });

    it('should show two analyses in the list', () => {
        const mockAnalyses: IStoreAnalysis[] = [
            {
                id: 'test-id-1',
                name: 'test-name-1',
                description: 'test-description-1',
                isNew: false,
                conditions: [],
                points: [],
                pointSpace: {
                    value: '',
                    label: '',
                },
                pointStatistic: {
                    value: '',
                    label: '',
                },
            },
            {
                id: 'test-id-2',
                name: 'test-name-2',
                description: 'test-description-2',
                isNew: false,
                conditions: [],
                points: [],
                pointSpace: {
                    value: '',
                    label: '',
                },
                pointStatistic: {
                    value: '',
                    label: '',
                },
            },
        ];
        render(
            <EditAnalysesList
                onSelectAnalysis={() => {}}
                selectedAnalysisId=""
                analyses={mockAnalyses}
            />
        );

        mockAnalyses.forEach((mockAnalysis) => {
            expect(screen.getByText(mockAnalysis.name as string)).toBeInTheDocument();
            expect(screen.getByText(mockAnalysis.description as string)).toBeInTheDocument();
        });
    });

    it('should call the onSelectAnalysis function when analysis is selected', () => {
        const handleOnSelectAnalysisMock = jest.fn();
        const mockAnalyses: IStoreAnalysis[] = [
            {
                id: 'test-id-1',
                name: 'test-name-1',
                description: 'test-description-1',
                isNew: false,
                conditions: [],
                points: [],
                pointSpace: {
                    value: '',
                    label: '',
                },
                pointStatistic: {
                    value: '',
                    label: '',
                },
            },
        ];
        render(
            <EditAnalysesList
                onSelectAnalysis={handleOnSelectAnalysisMock}
                selectedAnalysisId=""
                analyses={mockAnalyses}
            />
        );

        userEvent.click(screen.getByTestId('test-trigger-select-analysis'));
        expect(handleOnSelectAnalysisMock).toHaveBeenCalledWith(mockAnalyses[0].id);
    });
});
