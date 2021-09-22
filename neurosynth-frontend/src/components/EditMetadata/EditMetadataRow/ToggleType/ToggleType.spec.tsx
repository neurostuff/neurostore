import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToggleType, { PropertyType } from './ToggleType';

describe('ToggleType Component', () => {
    const mockOnToggle = jest.fn();

    it('should render a string', () => {
        render(<ToggleType onToggle={mockOnToggle} type={PropertyType.STRING} />);
        const stringOption = screen.getByText('STRING');
        expect(stringOption).toBeInTheDocument();
    });

    it('should render a boolean option', () => {
        render(<ToggleType onToggle={mockOnToggle} type={PropertyType.BOOLEAN} />);
        const booleanOption = screen.getByText('BOOLEAN');
        expect(booleanOption).toBeInTheDocument();
    });

    it('should render a number option', () => {
        render(<ToggleType onToggle={mockOnToggle} type={PropertyType.NUMBER} />);
        const numberOption = screen.getByText('NUMBER');
        expect(numberOption).toBeInTheDocument();
    });

    it('should render a none option', () => {
        render(<ToggleType onToggle={mockOnToggle} type={PropertyType.NONE} />);
        const noneOption = screen.getByText('NONE');
        expect(noneOption).toBeInTheDocument();
    });

    it('should toggle and emit the right value', () => {
        render(<ToggleType onToggle={mockOnToggle} type={PropertyType.STRING} />);
        let option = screen.getByRole('button', { name: 'STRING' });
        userEvent.click(option);

        const booleanOption = screen.getByText('BOOLEAN');
        userEvent.click(booleanOption);
        expect(mockOnToggle).toBeCalledWith(PropertyType.BOOLEAN);

        option = screen.getByRole('button', { name: 'BOOLEAN' });
        userEvent.click(option);

        const numberOption = screen.getByText('NUMBER');
        userEvent.click(numberOption);
        expect(mockOnToggle).toBeCalledWith(PropertyType.NUMBER);

        option = screen.getByRole('button', { name: 'NUMBER' });
        userEvent.click(option);

        const noneOption = screen.getByRole('option', { name: 'NONE' });
        userEvent.click(noneOption);
        expect(mockOnToggle).toBeCalledWith(PropertyType.NONE);

        option = screen.getByRole('button', { name: 'NONE' });
        userEvent.click(option);

        const stringOption = screen.getByRole('option', { name: 'STRING' });
        userEvent.click(stringOption);
        expect(mockOnToggle).toBeCalledWith(PropertyType.STRING);
    });
});
