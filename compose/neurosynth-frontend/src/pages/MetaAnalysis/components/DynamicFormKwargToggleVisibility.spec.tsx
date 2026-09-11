import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DynamicFormKwargToggleVisibility from './DynamicFormKwargToggleVisibility';

vi.mock('pages/MetaAnalysis/components/DynamicFormKwargInput');

describe('DynamicFormKwargToggleVisibility Component', () => {
    const mockOnUpdate = vi.fn();

    const renderToggle = () =>
        render(
            <DynamicFormKwargToggleVisibility
                parameterName="**kwargs"
                parameter={{
                    type: null,
                    description: 'test-description',
                    default: null,
                }}
                value={{
                    some_arg: 'abc',
                }}
                onUpdate={mockOnUpdate}
            />
        );

    it('should hide the kwarg input initially', () => {
        renderToggle();

        expect(screen.getByRole('button', { name: 'show advanced' })).toBeVisible();
        expect(screen.getByTestId('dynamic-form-input')).not.toBeVisible();
    });

    it('should show the kwarg input when advanced is clicked', async () => {
        renderToggle();

        await userEvent.click(screen.getByRole('button', { name: 'show advanced' }));
        expect(screen.getByTestId('dynamic-form-input')).toBeVisible();
        expect(screen.getByRole('button', { name: 'hide advanced' })).toBeVisible();
    });
});
