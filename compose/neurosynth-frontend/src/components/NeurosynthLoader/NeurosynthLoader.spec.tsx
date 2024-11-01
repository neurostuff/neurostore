import { render, screen } from '@testing-library/react';
import NeurosynthLoader from './NeurosynthLoader';

describe('Neurosynth Loader', () => {
    afterAll(() => {
        vi.clearAllMocks();
    });
    it('should render', () => {
        render(<NeurosynthLoader loaded={false} loadingText="test-loading-text" />);
        const loadingText = screen.getByText('test-loading-text');
        expect(loadingText).toBeInTheDocument();
    });

    it('should show the children when loaded', () => {
        render(
            <NeurosynthLoader loaded={true}>
                <span>test-children</span>
            </NeurosynthLoader>
        );

        const children = screen.getByText('test-children');
        expect(children).toBeInTheDocument();
    });

    it('should not show the children when not loaded', () => {
        render(
            <NeurosynthLoader loaded={false}>
                <span>test-children</span>
            </NeurosynthLoader>
        );

        const children = screen.queryByText('test-children');
        expect(children).not.toBeInTheDocument();
    });
});
