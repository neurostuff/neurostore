import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType, IMetadataRowModel } from 'components/EditMetadata';
import { MockThemeProvider } from 'testing/helpers';
import AddMetadataRow, { getStartValFromType } from './AddMetadataRow';

describe('AddMetadataRow Component', () => {
    const onAddMetadataRowMock = jest.fn();

    afterEach(() => {
        jest.clearAllMocks();
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

    it('should be disabled when metadata key input is empty', () => {
        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');
        userEvent.type(metadataKeyInput, '');

        const addButton = screen.getByText('ADD').closest('button');
        expect(addButton).toBeDisabled();

        userEvent.type(metadataKeyInput, 'some test key');
        expect(addButton).not.toBeDisabled();
    });

    it('should add the correct string type', () => {
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

        userEvent.type(metadataKeyInput, 'test key');
        userEvent.type(metadataValueInput, 'test val');

        userEvent.click(addButton);
        expect(onAddMetadataRowMock).toBeCalledWith(mockArg);
    });

    it('should add the correct boolean type', () => {
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
        userEvent.click(stringType);

        const noneType = screen.getByText('NONE');
        userEvent.click(noneType);

        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');

        userEvent.type(metadataKeyInput, mockArg.metadataKey);
        userEvent.click(addButton);

        expect(onAddMetadataRowMock).toBeCalledWith(mockArg);
    });

    it('should show an error message if the key is invalid', () => {
        const onAddMetadataRowMock = jest.fn();
        onAddMetadataRowMock.mockReturnValue(false);

        render(
            <MockThemeProvider>
                <AddMetadataRow onAddMetadataRow={onAddMetadataRowMock} />
            </MockThemeProvider>
        );

        const metadataKeyInput = screen.getByPlaceholderText('New metadata key');

        userEvent.type(metadataKeyInput, 'some test key');
        const addButton = screen.getByText('ADD').closest('button') as HTMLElement;
        userEvent.click(addButton);

        const errorMessage = screen.getByText('All keys must be unique');
        expect(errorMessage).toBeInTheDocument();
    });

    it('should set a new key placeholder text', () => {
        const onAddMetadataRowMock = jest.fn();
        onAddMetadataRowMock.mockReturnValue(false);

        render(
            <MockThemeProvider>
                <AddMetadataRow
                    onAddMetadataRow={onAddMetadataRowMock}
                    keyPlaceholderText="some-new-key-placeholder"
                />
            </MockThemeProvider>
        );

        const placeholderText = screen.getByPlaceholderText('some-new-key-placeholder');
        expect(placeholderText).toBeInTheDocument();
    });

    it('should set a new value placeholder text', () => {
        const onAddMetadataRowMock = jest.fn();
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
