import { render, screen } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import App from './App';

jest.mock('./components/Navbar/Navbar');
jest.mock('./pages/BaseNavigation/BaseNavigation');
jest.mock('@auth0/auth0-react');

test('renders main app', async () => {
    await act(async () => {
        render(<App />);
    });
    const mockNavbar = screen.getByText('mock navbar');
    const mockNavigation = screen.getByText('mock base navigation');
    expect(mockNavbar).toBeInTheDocument();
    expect(mockNavigation).toBeInTheDocument();
});
