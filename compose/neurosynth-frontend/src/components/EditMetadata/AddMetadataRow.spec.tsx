import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType, IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import { MockThemeProvider } from 'testing/helpers';
import AddMetadataRow, { getStartValFromType } from './AddMetadataRow';

describe('AddMetadataRow Component', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        user = userEvent.setup();
    });

    const onAddMetadataRowMock = vi.fn();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should render', () => {
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
        await user.type(screen.getByPlaceholderText('New Column'), newColumnKey);
        await user.click(screen.getByText('ADD').closest('button') as HTMLElement);

        expect(onAddMetadataRowMock).toHaveBeenCalledWith({
            metadataKey: newColumnKey,
            metadataValue: false,
        });
    });

    it('should get the correct starting value from the getStartValFromType function', () => {
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

        await user.type(metadataKeyInput, 'some test key');
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

        await user.type(metadataKeyInput, 'test key');
        await user.type(metadataValueInput, 'test val');

        await user.click(addButton);
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
        await user.click(stringType);

        const booleanType = screen.getByText('BOOLEAN');
        await user.click(booleanType);

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');
        const metadataValueInput = screen.getByRole('checkbox');

        await user.type(metadataKeyInput, mockArg.metadataKey);
        await user.click(metadataValueInput);
        await user.click(addButton);

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
        await user.click(stringType);

        const booleanType = screen.getByText('NUMBER');
        await user.click(booleanType);

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');
        const metadataValueInput = screen.getByRole('spinbutton');

        await user.type(metadataKeyInput, mockArg.metadataKey);
        await user.type(metadataValueInput, '12345');
        await user.click(addButton);

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
        await user.click(stringType);

        const noneType = screen.getByText('NONE');
        await user.click(noneType);

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');

        await user.type(metadataKeyInput, mockArg.metadataKey);
        await user.click(addButton);

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

        await user.type(metadataKeyInput, 'some test key');
        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        await user.click(addButton);

        const errorMessage = screen.getByText('All keys must be unique');
        expect(errorMessage).toBeInTheDocument();
    });

    it('should set a new key placeholder text', () => {
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

    it('should set a new value placeholder text', () => {
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
