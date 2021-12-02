import { render } from '@testing-library/react';
import CreateDatasetDialog from './CreateDatasetDialog';

describe('CreateDatasetDialog', () => {
    it('should render', () => {
        render(<CreateDatasetDialog />);
        expect(true).toBeTruthy();
    });
});
