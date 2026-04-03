import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditStudyAnalysesCBMAList from './EditStudyAnalysesCBMAList';
import { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import userEvent from '@testing-library/user-event';

vi.mock('pages/Study/components/StudyAnalysesListItem.tsx');

describe('EditStudyAnalysesCBMAList Component', () => {
    it('should render', () => {
        render(<EditStudyAnalysesCBMAList onSelectAnalysis={() => {}} selectedAnalysisId="" analyses={[]} />);
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
        render(<EditStudyAnalysesCBMAList onSelectAnalysis={() => {}} selectedAnalysisId="" analyses={mockAnalyses} />);

        mockAnalyses.forEach((mockAnalysis) => {
            expect(screen.getByText(mockAnalysis.name as string)).toBeInTheDocument();
            expect(screen.getByText(mockAnalysis.description as string)).toBeInTheDocument();
        });
    });

    it('should call the onSelectAnalysis function when analysis is selected', () => {
        const handleOnSelectAnalysisMock = vi.fn();
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
            <EditStudyAnalysesCBMAList
                onSelectAnalysis={handleOnSelectAnalysisMock}
                selectedAnalysisId=""
                analyses={mockAnalyses}
            />
        );

        userEvent.click(screen.getByTestId('test-trigger-select-analysis'));
        expect(handleOnSelectAnalysisMock).toHaveBeenCalledWith(mockAnalyses[0].id);
    });
});
