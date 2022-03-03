import { render } from '@testing-library/react';
import { IEditAnalysisPoints } from '../..';
import EditAnalysisPoints from './EditAnalysisPoints';

/**
 * Placeholder test
 */

describe('EditAnalysisPoints Component', () => {
    const mockAnalysisArg: IEditAnalysisPoints = {
        onAddPoint: jest.fn(),
        onRemovePoint: jest.fn(),
        onUpdatePoint: jest.fn(),
        points: undefined,
    };
    it('should render', () => {
        render(<EditAnalysisPoints {...mockAnalysisArg} />);
        expect(true).toBe(true);
    });
});
