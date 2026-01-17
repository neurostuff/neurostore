import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

    it('should render', () => {
        render(<TextExpansion text="some test text" />);

        const textExpansion = screen.getByText('some test text');
        expect(textExpansion).toBeInTheDocument();
    });

    it('should show the READ MORE button when the text is too long', () => {
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

        const readMoreButton = screen.getByRole('button', { name: 'Read More' });
        expect(readMoreButton).toBeInTheDocument();
    });

    it('should show the READ LESS button when the text is expanded', () => {
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

        const readMoreButton = screen.getByRole('button', { name: 'Read More' });

        userEvent.click(readMoreButton);
        const readLessButton = screen.getByRole('button', { name: 'Read Less' });
        expect(readLessButton).toBeInTheDocument();
    });
});
