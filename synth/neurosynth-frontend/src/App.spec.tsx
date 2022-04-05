import { render, screen } from '@testing-library/react';
import App from './App';
import { BrowserRouter } from 'react-router-dom';

jest.mock('./components/Navbar/Navbar');
jest.mock('./pages/BaseNavigation/BaseNavigation');

test('renders main app', () => {
    render(
        <BrowserRouter>
            <App />
        </BrowserRouter>
    );
    const mockNavbar = screen.getByText('mock navbar');
    const mockNavigation = screen.getByText('mock base navigation');
    expect(mockNavbar).toBeInTheDocument();
    expect(mockNavigation).toBeInTheDocument();
});
