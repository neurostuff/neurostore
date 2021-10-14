import { render, screen } from '@testing-library/react';
import DisplayAnalysis from './DisplayAnalysis';

describe('DisplayMetadataTableRow Component', () => {
    it('should render', () => {
        render(<DisplayAnalysis />);

        expect(true).toBeTruthy();
    });
});
