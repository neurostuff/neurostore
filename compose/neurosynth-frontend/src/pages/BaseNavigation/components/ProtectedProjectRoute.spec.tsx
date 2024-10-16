import { render } from '@testing-library/react';
import ProtectedProjectRoute from './ProtectedProjectRoute';

describe('ProtectedProjectRoute Component', () => {
    it('should render', () => {
        render(<ProtectedProjectRoute />);
        expect(true).toBeFalsy(); // TODO finish these tests
    });
});
