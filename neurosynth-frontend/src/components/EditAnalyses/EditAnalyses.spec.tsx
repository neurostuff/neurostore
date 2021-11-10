import { render } from '@testing-library/react';
import EditAnalyses from './EditAnalyses';

describe('DisplayMetadataTableRow Component', () => {
    it('should render', () => {
        render(<EditAnalyses />);
        expect(true).toBe(true);
    });
});
