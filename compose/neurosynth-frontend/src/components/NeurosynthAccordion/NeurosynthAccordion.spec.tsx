import { render, screen } from '@testing-library/react';
import NeurosynthAccordion from './NeurosynthAccordion';

describe('NeurosynthAccordion component', () => {
    it('should render', () => {
        render(<NeurosynthAccordion></NeurosynthAccordion>);
    });

    it('should render the title text', () => {
        render(<NeurosynthAccordion TitleElement={<>test-title</>}></NeurosynthAccordion>);

        expect(screen.getByText('test-title')).toBeInTheDocument();
    });

    it('should set the default expansion to closed and hide the children', () => {
        render(
            <NeurosynthAccordion defaultExpanded={false} TitleElement={<>test-title</>}>
                <>test-child</>
            </NeurosynthAccordion>
        );

        expect(screen.queryByText('test-child')).not.toBeVisible();
    });

    it('should set the default expansion to open and hide the children', () => {
        render(
            <NeurosynthAccordion defaultExpanded={true} TitleElement={<>test-title</>}>
                <>test-child</>
            </NeurosynthAccordion>
        );

        expect(screen.queryByText('test-child')).toBeVisible();
    });
});
