import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockThemeProvider } from '../../../testing/helpers';
import { DisplayMetadataTableRowModel } from '../../DisplayMetadataTable/DisplayMetadataTableRow/DisplayMetadataTableRow';
import EditMetadataRow from './EditMetadataRow';
import { PropertyType } from './ToggleType/ToggleType';

describe('EditMetadataRow Component', () => {
    const onMetadataRowDeleteMock = jest.fn();
    const onMetadataRowEditMock = jest.fn();

    let mockMetadataRow: DisplayMetadataTableRowModel;

    beforeEach(() => {
        mockMetadataRow = {
            metadataKey: 'test key',
            metadataValue: 'test val',
        };
    });

    it('should render', () => {
        render(
            <MockThemeProvider>
                <EditMetadataRow
                    metadataValueType={PropertyType.STRING}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
            </MockThemeProvider>
        );
    });

    it('should delete when the delete button is clicked', () => {
        render(
            <MockThemeProvider>
                <EditMetadataRow
                    metadataValueType={PropertyType.STRING}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
            </MockThemeProvider>
        );

        const deleteButton = screen.getByText('DELETE');
        userEvent.click(deleteButton);
        expect(onMetadataRowDeleteMock).toBeCalledWith(mockMetadataRow);
    });

    it('should edit the metadata when toggled', () => {
        render(
            <MockThemeProvider>
                <EditMetadataRow
                    metadataValueType={PropertyType.STRING}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
            </MockThemeProvider>
        );

        const toggleButton = screen.getByText('STRING');
        userEvent.click(toggleButton);

        const noneButton = screen.getByText('NONE');
        userEvent.click(noneButton);
        mockMetadataRow.metadataValue = null;
        expect(onMetadataRowEditMock).toBeCalledWith(mockMetadataRow);
    });

    describe('EditMetadataRow String Case', () => {
        it('should render the string editor', () => {
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={PropertyType.STRING}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );

            const stringEditor = screen.getByPlaceholderText('New metadata value');
            expect(stringEditor).toBeInTheDocument();
        });

        it('should be edited with the correct arguments', () => {
            mockMetadataRow.metadataValue = '';
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={PropertyType.STRING}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );

            const stringEditor = screen.getByRole('textbox');
            userEvent.type(stringEditor, 'abc');

            mockMetadataRow.metadataValue = 'abc';

            expect(onMetadataRowEditMock).toBeCalledWith(mockMetadataRow);
        });
    });

    describe('EditMetadataRow Number Case', () => {
        it('should render the number editor', () => {
            mockMetadataRow.metadataValue = 123;
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={PropertyType.NUMBER}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );

            const numberEditor = screen.getByRole('spinbutton');
            expect(numberEditor).toBeInTheDocument();
        });

        it('should be edited with the correct arguments', () => {
            mockMetadataRow.metadataValue = 0;
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={PropertyType.NUMBER}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );
            mockMetadataRow.metadataValue = 12345;

            const numberEditor = screen.getByRole('spinbutton');
            userEvent.type(numberEditor, '12345');

            expect(onMetadataRowEditMock).toBeCalledWith(mockMetadataRow);
        });
    });

    describe('EditMetadataRow Boolean Case', () => {
        it('should render', () => {
            mockMetadataRow.metadataValue = false;
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={PropertyType.BOOLEAN}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );
            const booleanEditor = screen.getByRole('checkbox');
            expect(booleanEditor).toBeInTheDocument();
        });

        it('should be edited with the correct arguments', () => {
            mockMetadataRow.metadataValue = false;
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={PropertyType.BOOLEAN}
                        metadataRow={mockMetadataRow}
                        onMetadataRowDelete={onMetadataRowDeleteMock}
                        onMetadataRowEdit={onMetadataRowEditMock}
                    />
                </MockThemeProvider>
            );

            const booleanEditor = screen.getByRole('checkbox');
            mockMetadataRow.metadataValue = true;
            userEvent.click(booleanEditor);

            expect(onMetadataRowEditMock).toBeCalledWith(mockMetadataRow);
        });
    });

    describe('EditMetadataRow None Case', () => {
        it('should render', () => {
            mockMetadataRow.metadataValue = null;
            render(
                <MockThemeProvider>
                    <EditMetadataRow
                        metadataValueType={PropertyType.NONE}
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
