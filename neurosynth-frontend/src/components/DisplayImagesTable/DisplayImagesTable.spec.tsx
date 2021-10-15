import { render } from '@testing-library/react';
import DisplayImagesTable from './DisplayImagesTable';

describe('DisplayImagesTable Component', () => {
    it('should render', () => {
        render(<DisplayImagesTable />);
        expect(true).toBeTruthy();
    });
});
