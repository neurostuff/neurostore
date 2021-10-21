import { render, screen } from '@testing-library/react';
import Visualizer from './Visualizer';

describe('Visualizer Component', () => {
    it('should render', () => {
        render(<Visualizer />);

        expect(true).toBeTruthy();
    });
});
