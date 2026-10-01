import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TextExpansion from './TextExpansion';

describe('TextExpansion Component', () => {
    // save original scrollwidth
    const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');

    // save original offsetWidth
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');

    afterAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'scrollwidth', originalScrollWidth as PropertyDescriptor);
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth as PropertyDescriptor);

        vi.clearAllMocks();
    });

    it('should render', async () => {
        render(<TextExpansion text="some test text" />);

        const textExpansion = screen.getByText('some test text');
        expect(textExpansion).toBeInTheDocument();
    });

    it('should show the Read More link when the text is too long', async () => {
        const longTestText =
            'Consectetur officia aute quis qui ex cillum pariatur. Officia sunt et cupidatat officia laborum sit minim est nulla exercitation ipsum cupidatat tempor esse. Cillum voluptate amet nisi ad mollit amet amet eu aute duis aute anim officia. Consectetur tempor consequat aliqua dolor sint. Consectetur ullamco sit reprehenderit irure ex culpa nulla ullamco anim pariatur aliquip magna reprehenderit ex. Nostrud ea consequat incididunt officia id tempor eiusmod. Voluptate quis dolor Lorem in velit cillum. Eiusmod aute ut minim deserunt ad. Consectetur qui enim commodo nostrud sunt culpa exercitation aute. Anim exercitation do do do dolore adipisicing enim deserunt mollit. Nulla ex Lorem cupidatat magna dolore. Consequat do sint do est ullamco fugiat.';

        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            value: 500,
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            value: 400,
        });

        render(
            <div style={{ width: '100px' }}>
                <TextExpansion text={longTestText} />
            </div>
        );

        const readMoreLink = screen.getByRole('button', { name: 'Read more' });
        expect(readMoreLink).toBeInTheDocument();
    });

    it('should show the Read Less link when the text is expanded', async () => {
        const longTestText =
            'Consectetur officia aute quis qui ex cillum pariatur. Officia sunt et cupidatat officia laborum sit minim est nulla exercitation ipsum cupidatat tempor esse. Cillum voluptate amet nisi ad mollit amet amet eu aute duis aute anim officia. Consectetur tempor consequat aliqua dolor sint. Consectetur ullamco sit reprehenderit irure ex culpa nulla ullamco anim pariatur aliquip magna reprehenderit ex. Nostrud ea consequat incididunt officia id tempor eiusmod. Voluptate quis dolor Lorem in velit cillum. Eiusmod aute ut minim deserunt ad. Consectetur qui enim commodo nostrud sunt culpa exercitation aute. Anim exercitation do do do dolore adipisicing enim deserunt mollit. Nulla ex Lorem cupidatat magna dolore. Consequat do sint do est ullamco fugiat.';

        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            value: 500,
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            value: 400,
        });

        render(
            <div style={{ width: '100px' }}>
                <TextExpansion text={longTestText} />
            </div>
        );

        const readMoreLink = screen.getByRole('button', { name: 'Read more' });

        await userEvent.click(readMoreLink);
        const readLessLink = screen.getByRole('button', { name: 'Read less' });
        expect(readLessLink).toBeInTheDocument();
    });

    it('should start expanded when defaultExpanded is set', async () => {
        const longTestText =
            'Consectetur officia aute quis qui ex cillum pariatur. Officia sunt et cupidatat officia laborum sit minim est nulla exercitation ipsum cupidatat tempor esse. Cillum voluptate amet nisi ad mollit amet amet eu aute duis aute anim officia. Consectetur tempor consequat aliqua dolor sint. Consectetur ullamco sit reprehenderit irure ex culpa nulla ullamco anim pariatur aliquip magna reprehenderit ex. Nostrud ea consequat incididunt officia id tempor eiusmod. Voluptate quis dolor Lorem in velit cillum. Eiusmod aute ut minim deserunt ad. Consectetur qui enim commodo nostrud sunt culpa exercitation aute. Anim exercitation do do do dolore adipisicing enim deserunt mollit. Nulla ex Lorem cupidatat magna dolore. Consequat do sint do est ullamco fugiat.';

        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            value: 500,
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            value: 400,
        });

        render(
            <div style={{ width: '100px' }}>
                <TextExpansion text={longTestText} defaultExpanded />
            </div>
        );

        expect(screen.getByRole('button', { name: 'Read less' })).toBeInTheDocument();
    });

    it('uses isExpanded when it is passed', async () => {
        const longTestText =
            'Consectetur officia aute quis qui ex cillum pariatur. Officia sunt et cupidatat officia laborum sit minim est nulla exercitation ipsum cupidatat tempor esse. Cillum voluptate amet nisi ad mollit amet amet eu aute duis aute anim officia. Consectetur tempor consequat aliqua dolor sint. Consectetur ullamco sit reprehenderit irure ex culpa nulla ullamco anim pariatur aliquip magna reprehenderit ex. Nostrud ea consequat incididunt officia id tempor eiusmod. Voluptate quis dolor Lorem in velit cillum. Eiusmod aute ut minim deserunt ad. Consectetur qui enim commodo nostrud sunt culpa exercitation aute. Anim exercitation do do do dolore adipisicing enim deserunt mollit. Nulla ex Lorem cupidatat magna dolore. Consequat do sint do est ullamco fugiat.';

        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            value: 500,
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            value: 400,
        });

        const setIsExpanded = vi.fn();
        const { rerender } = render(
            <TextExpansion text={longTestText} isExpanded={false} setIsExpanded={setIsExpanded} />
        );
        expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Read more' }));
        expect(setIsExpanded).toHaveBeenCalledWith(true);

        rerender(<TextExpansion text={longTestText} isExpanded={true} setIsExpanded={setIsExpanded} />);
        expect(screen.getByRole('button', { name: 'Read less' })).toBeInTheDocument();
    });
});
