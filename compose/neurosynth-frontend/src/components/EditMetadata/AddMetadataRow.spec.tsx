import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType, IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import { MockThemeProvider } from 'testing/helpers';
import AddMetadataRow, { getStartValFromType } from './AddMetadataRow';

describe('AddMetadataRow Component', () => {
    const onAddMetadataRowMock = vi.fn();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should render', async () => {
        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );
        const addButton = screen.getByText('ADD');
        expect(addButton).toBeInTheDocument();
    });

    it('defaults to boolean for study annotations add column (hidden value input)', async () => {
        onAddMetadataRowMock.mockReturnValue(true);
        render(
            <MockThemeProvider>
                <AddMetadataRow
                    onAddMetadataRow={onAddMetadataRowMock}
                    keyPlaceholderText="New Column"
                    defaultType={EPropertyType.BOOLEAN}
                    showMetadataValueInput={false}
                    allowNone={false}
                    errorMessage="can't add column (key already exists)"
                />
            </MockThemeProvider>
        );

        expect(screen.getByRole('combobox')).toHaveTextContent('BOOLEAN');

        const newColumnKey = 'new_bool_col';
        await userEvent.type(screen.getByPlaceholderText('New Column'), newColumnKey);
        await userEvent.click(screen.getByText('ADD').closest('button') as HTMLElement);

        expect(onAddMetadataRowMock).toHaveBeenCalledWith({
            metadataKey: newColumnKey,
            metadataValue: false,
        });
    });

    it('should get the correct starting value from the getStartValFromType function', async () => {
        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );
        expect(getStartValFromType(EPropertyType.BOOLEAN)).toEqual(false);
        expect(getStartValFromType(EPropertyType.NUMBER)).toEqual(0);
        expect(getStartValFromType(EPropertyType.STRING)).toEqual('');
        expect(getStartValFromType(EPropertyType.NONE)).toEqual(null);
    });

    it('should be disabled when metadata key input is empty', async () => {
        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');

        const addButton = screen.getByText('ADD').closest('button');
        expect(addButton).toBeDisabled();

        await userEvent.type(metadataKeyInput, 'some test key');
        expect(addButton).not.toBeDisabled();
    });

    it('should add the correct string type', async () => {
        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );
        const mockArg: IMetadataRowModel = {
            metadataKey: 'test key',
            metadataValue: 'test val',
        };

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;

        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');
        const metadataValueInput = screen.getByPlaceholderText('New metadata value');

        await userEvent.type(metadataKeyInput, 'test key');
        await userEvent.type(metadataValueInput, 'test val');

        await userEvent.click(addButton);
        expect(onAddMetadataRowMock).toBeCalledWith(mockArg);
    });

    it('should add the correct boolean type', async () => {
        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );
        const mockArg: IMetadataRowModel = {
            metadataKey: 'test key',
            metadataValue: true,
        };

        const stringType = screen.getByText('STRING');
        await userEvent.click(stringType);

        const booleanType = screen.getByText('BOOLEAN');
        await userEvent.click(booleanType);

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');
        const metadataValueInput = screen.getByRole('checkbox');

        await userEvent.type(metadataKeyInput, mockArg.metadataKey);
        await userEvent.click(metadataValueInput);
        await userEvent.click(addButton);

        expect(onAddMetadataRowMock).toBeCalledWith(mockArg);
    });

    it('should add the correct number type', async () => {
        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );
        const mockArg: IMetadataRowModel = {
            metadataKey: 'test key',
            metadataValue: 12345,
        };

        const stringType = screen.getByText('STRING');
        await userEvent.click(stringType);

        const booleanType = screen.getByText('NUMBER');
        await userEvent.click(booleanType);

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');
        const metadataValueInput = screen.getByRole('spinbutton');

        await userEvent.type(metadataKeyInput, mockArg.metadataKey);
        await userEvent.type(metadataValueInput, '12345');
        await userEvent.click(addButton);

        expect(onAddMetadataRowMock).toBeCalledWith(mockArg);
    });

    it('should add the correct none type', async () => {
        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );
        const mockArg: IMetadataRowModel = {
            metadataKey: 'test key',
            metadataValue: null,
        };

        const stringType = screen.getByText('STRING');
        await userEvent.click(stringType);

        const noneType = screen.getByText('NONE');
        await userEvent.click(noneType);

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');

        await userEvent.type(metadataKeyInput, mockArg.metadataKey);
        await userEvent.click(addButton);

        expect(onAddMetadataRowMock).toBeCalledWith(mockArg);
    });

    it('should show an error message if the key is invalid', async () => {
        const onAddMetadataRowMock = vi.fn();
        onAddMetadataRowMock.mockReturnValue(false);

        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );

        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');

        await userEvent.type(metadataKeyInput, 'some test key');
        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        await userEvent.click(addButton);

        const errorMessage = screen.getByText('All keys must be unique');
        expect(errorMessage).toBeInTheDocument();
    });

    it('should set a new key placeholder text', async () => {
        const onAddMetadataRowMock = vi.fn();
        onAddMetadataRowMock.mockReturnValue(false);

        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} keyPlaceholderText="some-new-key-placeholder" />
            </MockThemeProvider>
        );

        const placeholderText = screen.getByPlaceholderText('some-new-key-placeholder');
        expect(placeholderText).toBeInTheDocument();
    });

    it('should set a new value placeholder text', async () => {
        const onAddMetadataRowMock = vi.fn();
        onAddMetadataRowMock.mockReturnValue(false);

        render(
            <MockThemeProvider>
                <AddMetadataRow
                    onAddMetadataRow={onAddMetadataRowMock}
                    valuePlaceholderText="some-new-value-placeholder"
                />
            </MockThemeProvider>
        );

        const placeholderText = screen.getByPlaceholderText('some-new-value-placeholder');
        expect(placeholderText).toBeInTheDocument();
    });
});
