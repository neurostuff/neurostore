import { render } from '@testing-library/react';
import DatasetsTable from './DatasetsTable';

describe('DatasetsTable', () => {
    it('should render', () => {
        render(<DatasetsTable datasets={[]} />);

        expect(true).toBeTruthy();
    });
});
