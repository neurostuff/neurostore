import { render } from '@testing-library/react';
import EditAnalysisPointsRow from './EditAnalysisPointsRow';

/**
 * Placeholder test
 */

describe('EditAnalysisPointsRow Component', () => {
    afterAll(() => {
        jest.clearAllMocks();
    });
    it('should render', () => {
        render(<EditAnalysisPointsRow />);
        expect(true).toBe(true);
    });
});
