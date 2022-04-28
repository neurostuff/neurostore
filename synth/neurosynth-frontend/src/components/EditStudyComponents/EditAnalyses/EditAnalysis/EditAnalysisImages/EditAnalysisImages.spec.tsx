import { render } from '@testing-library/react';
import EditAnalysisImages from './EditAnalysisImages';

/**
 * Placeholder test
 */

describe('EditAnalysisImages Component', () => {
    afterAll(() => {
        jest.clearAllMocks();
    });
    it('should render', () => {
        render(<EditAnalysisImages />);
        expect(true).toBe(true);
    });
});
