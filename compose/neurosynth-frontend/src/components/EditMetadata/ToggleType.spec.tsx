import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import ToggleType from './ToggleType';

describe('ToggleType Component', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        user = userEvent.setup();
    });

    const mockOnToggle = vi.fn();

    afterAll(() => {
        vi.clearAllMocks();
    });

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

    it('should toggle and emit a boolean value', async () => {
        // initial render
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} />);

        // setup
        let input = screen.getByRole('combobox');
        await user.click(input);
        const booleanOption = screen.getByText('BOOLEAN');

        await user.click(booleanOption);

        // evaluate
        expect(mockOnToggle).toBeCalledWith(EPropertyType.BOOLEAN);
    });

    it('should toggle and emit a string value', async () => {
        // initial render
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.BOOLEAN} />);

        // setup
        let input = screen.getByRole('combobox');
        await user.click(input);
        const stringOption = screen.getByText('STRING');

        await user.click(stringOption);

        // evaluate
        expect(mockOnToggle).toBeCalledWith(EPropertyType.STRING);
    });

    it('should toggle and emit a number value', async () => {
        // initial render
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} />);

        // setup
        let input = screen.getByRole('combobox');
        await user.click(input);
        const numberOption = screen.getByText('NUMBER');

        await user.click(numberOption);

        // evaluate
        expect(mockOnToggle).toBeCalledWith(EPropertyType.NUMBER);
    });

    it('should toggle and emit a null value', async () => {
        // initial render
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} />);

        // setup
        let input = screen.getByRole('combobox');
        await user.click(input);
        const noneOption = screen.getByText('NONE');

        await user.click(noneOption);

        // evaluate
        expect(mockOnToggle).toBeCalledWith(EPropertyType.NONE);
    });

    it('should show all types by default', async () => {
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} />);
        let input = screen.getByRole('combobox');
        await user.click(input);

        expect(screen.queryByRole('option', { name: 'NONE' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'STRING' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'BOOLEAN' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'NUMBER' })).toBeTruthy();
    });

    it('should remove the none type', async () => {
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} allowNone={false} />);
        let input = screen.getByRole('combobox');
        await user.click(input);

        expect(screen.queryByRole('option', { name: 'NONE' })).toBeFalsy();
        expect(screen.queryByRole('option', { name: 'STRING' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'BOOLEAN' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'NUMBER' })).toBeTruthy();
    });

    it('should remove the string type', async () => {
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.NUMBER} allowString={false} />);
        let input = screen.getByRole('combobox');
        await user.click(input);

        expect(screen.queryByRole('option', { name: 'NONE' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'STRING' })).toBeFalsy();
        expect(screen.queryByRole('option', { name: 'BOOLEAN' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'NUMBER' })).toBeTruthy();
    });

    it('should remove the boolean type', async () => {
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} allowBoolean={false} />);
        let input = screen.getByRole('combobox');
        await user.click(input);

        expect(screen.queryByRole('option', { name: 'NONE' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'STRING' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'BOOLEAN' })).toBeFalsy();
        expect(screen.queryByRole('option', { name: 'NUMBER' })).toBeTruthy();
    });

    it('should remove the number type', async () => {
        render(<ToggleType onToggle={mockOnToggle} type={EPropertyType.STRING} allowNumber={false} />);
        let input = screen.getByRole('combobox');
        await user.click(input);

        expect(screen.queryByRole('option', { name: 'NONE' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'STRING' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'BOOLEAN' })).toBeTruthy();
        expect(screen.queryByRole('option', { name: 'NUMBER' })).toBeFalsy();
    });
});
