import { render } from '@testing-library/react';
import { IEditAnalysisDetails } from '../..';
import EditAnalysisDetails from './EditAnalysisDetails';

/**
 * Placeholder test
 */

describe('EditAnalysisDetails Component', () => {
    let mockAnalysisDetails: IEditAnalysisDetails;

    beforeEach(() => {
        mockAnalysisDetails = {
            analysisId: 'test-analysis-id',
            name: 'test-name',
            description: 'test-description',
            onEditAnalysisDetails: jest.fn(),
            onDeleteAnalysis: jest.fn(),
        };
    });

    it('should render', () => {
        render(<EditAnalysisDetails {...mockAnalysisDetails} />);
        expect(true).toBe(true);
    });
});
