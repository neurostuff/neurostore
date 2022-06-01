import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router } from 'react-router-dom';
import BackButton from './BackButton';

describe('BackButton', () => {
    const historyMock = {
        push: jest.fn(),
        location: {},
        listen: jest.fn(),
    };

    it('should render', () => {
        render(
            <Router history={historyMock as any}>
                <BackButton text="test text" path="/some-path" />
            </Router>
        );
    });

    it('should should have the given text', () => {
        render(
            <Router history={historyMock as any}>
                <BackButton text="test text" path="/some-path" />
            </Router>
        );

        const testText = screen.getByText('test text');
        expect(testText).toBeInTheDocument();
    });

    it('should go to the given path when clicked', () => {
        render(
            <Router history={historyMock as any}>
                <BackButton text="test text" path="/some-path" />
            </Router>
        );

        const button = screen.getByRole('button');
        userEvent.click(button);
        expect(historyMock.push).toBeCalledWith('/some-path');
    });
});
