import { render, screen } from '@testing-library/react';
import DisplayValuesTableRow from './DisplayValuesTableRow';

describe('DisplayMetadataTableRow Component', () => {
    it('should render', () => {
        render(<DisplayValuesTableRow uniqueKey={'1'} columnValues={[]} />, {
            container: document.body.appendChild(document.createElement('tbody')),
        });
        expect(true).toBeTruthy();
    });
});
