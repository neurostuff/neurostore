import { render, screen } from '@testing-library/react';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';

jest.mock('./components/Navbar/Navbar');
jest.mock('./pages/BaseNavigation/BaseNavigation');
jest.mock('@auth0/auth0-react');

test('renders main app', async () => {
    await act(async () => {
        render(
            <BrowserRouter>
                <App />
            </BrowserRouter>
        );
    });
    const mockNavbar = screen.getByText('mock navbar');
    const mockNavigation = screen.getByText('mock base navigation');
    expect(mockNavbar).toBeInTheDocument();
    expect(mockNavigation).toBeInTheDocument();
});
