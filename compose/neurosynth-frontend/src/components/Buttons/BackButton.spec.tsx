import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import BackButton from './BackButton';

vi.mock('react-router-dom');
describe('BackButton', () => {
    it('should render', () => {
        render(<BackButton text="test text" path="/some-path" />);
    });

    it('should should have the given text', () => {
        render(<BackButton text="test text" path="/some-path" />);

        const testText = screen.getByText('test text');
        expect(testText).toBeInTheDocument();
    });

    it('should go to the given path when clicked', () => {
        render(<BackButton text="test text" path="/some-path" />);

        const button = screen.getByRole('button');
        userEvent.click(button);
        expect(useNavigate()).toBeCalledWith('/some-path');
    });
});
