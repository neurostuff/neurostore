import { render } from '@testing-library/react';
import { IEditAnalysisPoints } from '../..';
import EditAnalysisPoints from './EditAnalysisPoints';

describe('EditAnalysisPoints Component', () => {
    afterAll(() => {
        jest.clearAllMocks();
    });
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
