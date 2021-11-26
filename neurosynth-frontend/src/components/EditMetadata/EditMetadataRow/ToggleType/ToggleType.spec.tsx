import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType } from '../..';
import ToggleType from './ToggleType';

describe('ToggleType Component', () => {
    const mockOnToggle = jest.fn();

    it('should render a string', () => {
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} />);
        const stringOption = screen.getByText('STRING');
        expect(stringOption).toBeInTheDocument();
    });

    it('should render a boolean option', () => {
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.BOOLEAN} />);
        const booleanOption = screen.getByText('BOOLEAN');
        expect(booleanOption).toBeInTheDocument();
    });

    it('should render a number option', () => {
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.NUMBER} />);
        const numberOption = screen.getByText('NUMBER');
        expect(numberOption).toBeInTheDocument();
    });

    it('should render a none option', () => {
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.NONE} />);
        const noneOption = screen.getByText('NONE');
        expect(noneOption).toBeInTheDocument();
    });

    it('should toggle and emit a boolean value', () => {
        // initial render
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} />);

        // setup
        let option = screen.getByRole('button', { name: 'STRING' });
        userEvent.click(option);
        const booleanOption = screen.getByText('BOOLEAN');

        userEvent.click(booleanOption);

        // evaluate
        expect(mockOnToggle).toBeCalledWith(EPropertyType.BOOLEAN);
    });

    it('should toggle and emit a string value', () => {
        // initial render
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.BOOLEAN} />);

        // setup
        let option = screen.getByRole('button', { name: 'BOOLEAN' });
        userEvent.click(option);
        const stringOption = screen.getByText('STRING');

        userEvent.click(stringOption);

        // evaluate
        expect(mockOnToggle).toBeCalledWith(EPropertyType.STRING);
    });

    it('should toggle and emit a number value', () => {
        // initial render
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} />);

        // setup
        let option = screen.getByRole('button', { name: 'STRING' });
        userEvent.click(option);
        const numberOption = screen.getByText('NUMBER');

        userEvent.click(numberOption);

        // evaluate
        expect(mockOnToggle).toBeCalledWith(EPropertyType.NUMBER);
    });

    it('should toggle and emit a null value', () => {
        // initial render
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} />);

        // setup
        let option = screen.getByRole('button', { name: 'STRING' });
        userEvent.click(option);
        const noneOption = screen.getByText('NONE');

        userEvent.click(noneOption);

        // evaluate
        expect(mockOnToggle).toBeCalledWith(EPropertyType.NONE);
    });
});
