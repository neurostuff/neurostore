import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockThemeProvider } from '../../../testing/helpers';
import { DisplayMetadataTableRowModel } from '../../DisplayMetadataTable/DisplayMetadataTableRow/DisplayMetadataTableRow';
import AddMetadataRow, { getStartValFromType } from './AddMetadataRow';
import { PropertyType } from './ToggleType/ToggleType';

describe('AddMetadataRow Component', () => {
    const onAddMetadataRowMock = jest.fn();

    beforeEach(() => {
        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should render', () => {
        const addButton = screen.getByText('ADD');
        expect(addButton).toBeInTheDocument();
    });

    it('should get the correct starting value from the getStartValFromType function', () => {
        expect(getStartValFromType(PropertyType.BOOLEAN)).toEqual(false);
        expect(getStartValFromType(PropertyType.NUMBER)).toEqual(0);
        expect(getStartValFromType(PropertyType.STRING)).toEqual('');
        expect(getStartValFromType(PropertyType.NONE)).toEqual(null);
    });

    it('should be disabled when metadata key input is empty', () => {
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');
        userEvent.type(metadataKeyInput, '');

        const addButton = screen.getByText('ADD').closest('button');
        expect(addButton).toBeDisabled();

        userEvent.type(metadataKeyInput, 'some test key');
        expect(addButton).not.toBeDisabled();
    });

    it('should add the correct string type', () => {
        const mockArg: DisplayMetadataTableRowModel = {
            metadataKey: 'test key',
            metadataValue: 'test val',
        };

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;

        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');
        const metadataValueInput = screen.getByPlaceholderText('New metadata value');

        userEvent.type(metadataKeyInput, 'test key');
        userEvent.type(metadataValueInput, 'test val');

        userEvent.click(addButton);
        expect(onAddMetadataRowMock).toBeCalledWith(mockArg);
    });

    it('should add the correct boolean type', () => {
        const mockArg: DisplayMetadataTableRowModel = {
            metadataKey: 'test key',
            metadataValue: true,
        };

        const stringType = screen.getByText('STRING');
        userEvent.click(stringType);

        const booleanType = screen.getByText('BOOLEAN');
        userEvent.click(booleanType);

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');
        const metadataValueInput = screen.getByRole('checkbox');

        userEvent.type(metadataKeyInput, mockArg.metadataKey);
        userEvent.click(metadataValueInput);
        userEvent.click(addButton);

        expect(onAddMetadataRowMock).toBeCalledWith(mockArg);
    });

    it('should add the correct number type', () => {
        const mockArg: DisplayMetadataTableRowModel = {
            metadataKey: 'test key',
            metadataValue: 12345,
        };

        const stringType = screen.getByText('STRING');
        userEvent.click(stringType);

        const booleanType = screen.getByText('NUMBER');
        userEvent.click(booleanType);

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');
        const metadataValueInput = screen.getByRole('spinbutton');

        userEvent.type(metadataKeyInput, mockArg.metadataKey);
        userEvent.type(metadataValueInput, '12345');
        userEvent.click(addButton);

        expect(onAddMetadataRowMock).toBeCalledWith(mockArg);
    });

    it('should add the correct none type', () => {
        const mockArg: DisplayMetadataTableRowModel = {
            metadataKey: 'test key',
            metadataValue: null,
        };

        const stringType = screen.getByText('STRING');
        userEvent.click(stringType);

        const noneType = screen.getByText('NONE');
        userEvent.click(noneType);

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');

        userEvent.type(metadataKeyInput, mockArg.metadataKey);
        userEvent.click(addButton);

        expect(onAddMetadataRowMock).toBeCalledWith(mockArg);
    });
});
