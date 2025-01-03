import { render } from '@testing-library/react';
import DisplayMetaAnalysisResults from './DisplayMetaAnalysisResults';
import { useGetMetaAnalysisResultById } from 'hooks';
import { Mock } from 'vitest';
import { INeurovault } from 'hooks/metaAnalyses/useGetNeurovaultImages';

vi.mock('hooks');
vi.mock('pages/MetaAnalysis/components/MetaAnalysisResultStatusAlert');
vi.mock('pages/MetaAnalysis/components/DisplayParsedNiMareFile');
vi.mock('components/Visualizer/NiiVueVisualizer');

const caseA: INeurovault[] = [];
const caseB: INeurovault[] = [];
const caseC: INeurovault[] = [];
const caseD: INeurovault[] = [];

describe('DisplayMetaAnalysisResults', () => {
    it('should render', () => {
        render(<DisplayMetaAnalysisResults metaAnalysis={undefined} />);
    });

    it('should show the correctly sorted list (1)', () => {
        (useGetMetaAnalysisResultById as Mock).mockReturnValue({
            data: caseA,
            isLoading: false,
            isError: false,
        });

        // Passing in a met-analysis is not important as we mock the hook that provides the important data
        render(<DisplayMetaAnalysisResults metaAnalysis={undefined} />);

        expect();
    });

    it('should show the correctly sorted list (2)', () => {});
});
