import { render } from '@testing-library/react';
import EditStudyDetails from './EditStudyDetails';

describe('EditStudyDetails Component', () => {
    it('should render', () => {
        render(<EditStudyDetails />);
        expect(true).toBe(true);
    });
});
