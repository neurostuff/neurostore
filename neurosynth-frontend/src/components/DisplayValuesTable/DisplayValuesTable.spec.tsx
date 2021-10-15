import { render, screen } from '@testing-library/react';
import { DisplayValuesTable } from '..';

describe('DisplayValuesTable Component', () => {
    it('should render', () => {
        render(<DisplayValuesTable columnHeaders={[]} rowData={[]} />);
        expect(true).toBeTruthy();
    });
});
