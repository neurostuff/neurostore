import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { MockThemeProvider } from './testing/helpers';

test('renders learn react link', () => {
    render(
        <MockThemeProvider>
            <App />
        </MockThemeProvider>
    );
    const element = screen.getByText('welcome to neurosynth');
    expect(element).toBeInTheDocument();
});
