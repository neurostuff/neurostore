import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType, IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import { MockThemeProvider } from 'testing/helpers';
import EditMetadataRow from './EditMetadataRow';

describe('EditMetadataRow Component', () => {
    const onMetadataRowDeleteMock = vi.fn();
    const onMetadataRowEditMock = vi.fn();

    let mockMetadataRow: IMetadataRowModel;

    afterAll(() => {
        vi.clearAllMocks();
    });

    beforeEach(() => {
        mockMetadataRow = {
            metadataKey: 'test key',
            metadataValue: 'test val',
        };
    });

    it('should render', async () => {
        render(
            <MockThemeProvider>
                <EditMetadataRow
                    metadataValueType={EPropertyType.STRING}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
            </MockThemeProvider>
        );
    });

    it('should delete when the delete button is clicked', async () => {
        render(
            <MockThemeProvider>
                <EditMetadataRow
                    metadataValueType={EPropertyType.STRING}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
            </MockThemeProvider>
        );

        const deleteButton = screen.getByText('DELETE');
        await userEvent.click(deleteButton);
        expect(onMetadataRowDeleteMock).toBeCalledWith(mockMetadataRow);
    });

    it('should edit the metadata when toggled', async () => {
        render(
            <MockThemeProvider>
                <EditMetadataRow
                    metadataValueType={EPropertyType.STRING}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
            </MockThemeProvider>
        );

        const toggleButton = screen.getByText('STRING');
        await userEvent.click(toggleButton);

        const noneButton = screen.getByText('NONE');
        await userEvent.click(noneButton);
        mockMetadataRow.metadataValue = null;
        expect(onMetadataRowEditMock).toBeCalledWith(mockMetadataRow);
    });

    describe('EditMetadataRow String Case', () => {
        it('should render the string editor', async () => {
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={EPropertyType.STRING}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );

            const stringEditor = screen.getByPlaceholderText('New metadata value');
            expect(stringEditor).toBeInTheDocument();
        });

        it('should be edited with the correct arguments', async () => {
            mockMetadataRow.metadataValue = '';
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={EPropertyType.STRING}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );

            const stringEditor = screen.getByRole('textbox');
            await userEvent.type(stringEditor, 'a');

            mockMetadataRow.metadataValue = 'a';

            expect(onMetadataRowEditMock).toBeCalledWith(mockMetadataRow);
        });
    });

    describe('EditMetadataRow Number Case', () => {
        it('should render the number editor', async () => {
            mockMetadataRow.metadataValue = 1;
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={EPropertyType.NUMBER}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );

            const numberEditor = screen.getByRole('spinbutton');
            expect(numberEditor).toBeInTheDocument();
        });

        it('should be edited with the correct arguments', async () => {
            mockMetadataRow.metadataValue = 0;
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={EPropertyType.NUMBER}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );
            mockMetadataRow.metadataValue = 1;

            const numberEditor = screen.getByRole('spinbutton');
            await userEvent.type(numberEditor, '1');

            expect(onMetadataRowEditMock).toBeCalledWith(mockMetadataRow);
        });
    });

    describe('EditMetadataRow Boolean Case', () => {
        it('should render', async () => {
            mockMetadataRow.metadataValue = false;
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={EPropertyType.BOOLEAN}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );
            const booleanEditor = screen.getByRole('checkbox');
            expect(booleanEditor).toBeInTheDocument();
        });

        it('should be edited with the correct arguments', async () => {
            mockMetadataRow.metadataValue = false;
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={EPropertyType.BOOLEAN}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );

            const booleanEditor = screen.getByRole('checkbox');
            mockMetadataRow.metadataValue = true;
            await userEvent.click(booleanEditor);

            expect(onMetadataRowEditMock).toBeCalledWith(mockMetadataRow);
        });
    });

    describe('EditMetadataRow None Case', () => {
        it('should render', async () => {
            mockMetadataRow.metadataValue = null;
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={EPropertyType.NONE}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );
            const noneEditor = screen.getByText('null');
            expect(noneEditor).toBeInTheDocument();
        });
    });
});
