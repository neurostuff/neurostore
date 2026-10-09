import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MetaAnalysisDynamicFormALE from './MetaAnalysisDynamicFormALE';
import { IDynamicFormInput } from 'pages/MetaAnalysis/components/DynamicForm.types';
import useStudiesWithMissingSampleSizeALE from 'pages/MetaAnalysis/hooks/useALEMissingSampleSize';
import { MemoryRouter } from 'react-router-dom';

vi.mock('pages/MetaAnalysis/components/DynamicFormBoolInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormKwargInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormKwargToggleVisibility');
vi.mock('pages/MetaAnalysis/components/DynamicFormNumericInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormSelectInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormStringInput');
vi.mock('pages/MetaAnalysis/hooks/useALEMissingSampleSize');
vi.mock('stores/projects/ProjectStore');

describe('MetaAnalysisDynamicFormALE', () => {
    const mockOnUpdate = vi.fn();

    const buildParameters = (
        kernelValues: { fwhm?: number | null; sampleSize?: number | null } = { fwhm: 8, sampleSize: null }
    ): IDynamicFormInput[] => [
        {
            parameterName: 'null_method',
            parameter: { type: '{"approximate", "montecarlo"}', description: 'null-method', default: 'approximate' },
            value: 'approximate',
            onUpdate: mockOnUpdate,
        },
        {
            parameterName: 'n_iters',
            parameter: { type: 'int', description: 'n-iters', default: 5000 },
            value: 5000,
            onUpdate: mockOnUpdate,
        },
        {
            parameterName: 'kernel__fwhm',
            parameter: { type: 'float', description: 'fwhm', default: 8 },
            value: kernelValues.fwhm,
            onUpdate: mockOnUpdate,
        },
        {
            parameterName: 'kernel__sample_size',
            parameter: { type: 'int', description: 'sample-size', default: null },
            value: kernelValues.sampleSize,
            onUpdate: mockOnUpdate,
        },
        {
            parameterName: '**kwargs',
            parameter: { type: null, description: 'kwargs', default: null },
            value: {},
            onUpdate: mockOnUpdate,
        },
    ];

    const renderALE = (parametersAsInputList: IDynamicFormInput[] = buildParameters()) =>
        render(
            <MemoryRouter>
                <MetaAnalysisDynamicFormALE
                    parametersAsInputList={parametersAsInputList}
                    onUpdate={mockOnUpdate}
                    correctorOrEstimatorLabel="ALE"
                />
            </MemoryRouter>
        );

    beforeEach(() => {
        vi.mocked(useStudiesWithMissingSampleSizeALE).mockReturnValue([]);
    });

    it('should always show the sample size checkbox and hide other inputs until advanced settings are shown', () => {
        renderALE();

        expect(screen.getByText('Use Study/Analysis Specific Sample Sizes')).toBeVisible();
        expect(screen.getByRole('button', { name: 'show advanced settings' })).toBeVisible();
        expect(screen.queryByRole('button', { name: /^show advanced$/ })).not.toBeInTheDocument();

        const hiddenInputs = screen.getAllByTestId('dynamic-form-input');
        hiddenInputs.forEach((input) => {
            expect(input).not.toBeVisible();
        });
    });

    it('should show parameter inputs when advanced settings are expanded', async () => {
        renderALE();

        await userEvent.click(screen.getByRole('button', { name: 'show advanced settings' }));

        const visibleInputs = screen.getAllByTestId('dynamic-form-input');
        visibleInputs.forEach((input) => {
            expect(input).toBeVisible();
        });
        expect(screen.getByRole('button', { name: 'hide advanced settings' })).toBeVisible();
        expect(screen.queryByRole('button', { name: /^show advanced$/ })).not.toBeInTheDocument();
        expect(screen.queryByTestId('dynamic-form-kwarg-toggle')).not.toBeInTheDocument();
    });

    it('should show kernel parameter titles and hide their inputs when using study sample sizes', async () => {
        renderALE(buildParameters({ fwhm: null, sampleSize: null }));

        await userEvent.click(screen.getByRole('button', { name: 'show advanced settings' }));
        expect(screen.getByText('numeric', { selector: '[data-parameter-name="kernel__fwhm"]' })).toBeVisible();
        expect(screen.getByText('numeric', { selector: '[data-parameter-name="kernel__sample_size"]' })).toBeVisible();

        await userEvent.click(screen.getByRole('checkbox'));

        expect(mockOnUpdate).toHaveBeenCalledWith({
            kernel__sample_size: null,
            kernel__fwhm: null,
        });
        expect(
            screen.queryByText('numeric', { selector: '[data-parameter-name="kernel__fwhm"]' })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('numeric', { selector: '[data-parameter-name="kernel__sample_size"]' })
        ).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'kernel__fwhm' })).toBeVisible();
        expect(screen.getByRole('heading', { name: 'kernel__sample_size' })).toBeVisible();
        expect(
            screen.getAllByText(
                'This input can only be used when Use Study/Analysis Specific Sample Sizes is not selected'
            )
        ).toHaveLength(2);
    });

    it('should replace kernel__sample_size with an alert when kernel__fwhm has a value', async () => {
        renderALE();

        await userEvent.click(screen.getByRole('button', { name: 'show advanced settings' }));

        expect(screen.getByText('numeric', { selector: '[data-parameter-name="kernel__fwhm"]' })).toBeVisible();
        expect(
            screen.queryByText('numeric', { selector: '[data-parameter-name="kernel__sample_size"]' })
        ).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'kernel__sample_size' })).toBeVisible();
        expect(
            screen.getByText(
                'This input is mutually exclusive with fwhm and cannot be used when fwhm is set. Remove the value from fwhm to set this input'
            )
        ).toBeVisible();
    });

    it('should replace kernel__fwhm with an alert when kernel__sample_size has a value', async () => {
        renderALE(buildParameters({ fwhm: null, sampleSize: 20 }));

        await userEvent.click(screen.getByRole('button', { name: 'show advanced settings' }));

        expect(screen.getByText('numeric', { selector: '[data-parameter-name="kernel__sample_size"]' })).toBeVisible();
        expect(
            screen.queryByText('numeric', { selector: '[data-parameter-name="kernel__fwhm"]' })
        ).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'kernel__fwhm' })).toBeVisible();
        expect(
            screen.getByText(
                'This input is mutually exclusive with sample_size and cannot be used when sample_size is set. Remove the value from sample_size to set this input'
            )
        ).toBeVisible();
    });
});
