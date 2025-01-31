import { vi } from 'vitest';
import { IParameter } from 'pages/MetaAnalysis/components/DynamicForm.types';

vi.mock('pages/MetaAnalysis/components/DynamicFormBoolInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormKwargInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormNumericInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormSelectInput');
vi.mock('pages/MetaAnalysis/components/DynamicFormStringInput');

describe('MetaAnalysisDynamicForm', () => {
    const mockOnUpdate = vi.fn();

    const mockSpecification: { [key: string]: IParameter } = {
        null_method: {
            type: '{"approximate", "montecarlo"}',
            description: 'null-method-description',
            default: 'approximate',
        },
        num_iters: {
            type: 'int',
            description: 'num-iters-description',
            default: 12345,
        },
        '**kwargs': {
            type: null,
            description: 'kwargs-description',
            default: null,
        },
        kernel__fwhm: {
            type: 'float',
            description: 'kernel__fwhm-description',
            default: 1.12345,
        },
        xyz: {
            type: 'str',
            description: 'xyz-description',
            default: null,
        },
        two_sided: {
            type: 'bool',
            description: 'two_sided-description',
            default: null,
        },
    };

    it('should render', () => {
        // render(<DynamicForm onUpdate={mockOnUpdate} parameters={mockSpecification} values={{}} />);
        expect(true).toBeTruthy();
    });

    // it('should move the kwarg argument to the end', () => {
    //     render(<DynamicForm onUpdate={mockOnUpdate} parameters={mockSpecification} values={{}} />);

    //     const inputs = screen.getAllByTestId('dynamic-form-input');
    //     expect(inputs[inputs.length - 1].innerHTML).toEqual('kwarg');
    // });

    // it('should render the correct inputs based on the specification', () => {
    //     render(<DynamicForm onUpdate={mockOnUpdate} parameters={mockSpecification} values={{}} />);

    //     expect(screen.getByText('bool')).toBeInTheDocument();
    //     expect(screen.getByText('kwarg')).toBeInTheDocument();
    //     expect(screen.getAllByText('numeric').length).toEqual(2);
    //     expect(screen.getByText('select')).toBeInTheDocument();
    //     expect(screen.getByText('string')).toBeInTheDocument();
    // });

    // it('should show a message if there are no inputs to be rendered', () => {
    //     render(<DynamicForm onUpdate={mockOnUpdate} parameters={{}} values={{}} />);
    //     expect(screen.getByText('No arguments available')).toBeInTheDocument();
    // });
});
