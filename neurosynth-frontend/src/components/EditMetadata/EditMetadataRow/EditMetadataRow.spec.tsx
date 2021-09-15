import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
            <EditMetadataRow
                metadataValueType={PropertyType.STRING}
                metadataRow={mockMetadataRow}
                onMetadataRowDelete={onMetadataRowDeleteMock}
                onMetadataRowEdit={onMetadataRowEditMock}
            />
        );
    });

    it('should delete when the delete button is clicked', () => {
        render(
            <EditMetadataRow
                metadataValueType={PropertyType.STRING}
                metadataRow={mockMetadataRow}
                onMetadataRowDelete={onMetadataRowDeleteMock}
                onMetadataRowEdit={onMetadataRowEditMock}
            />
        );

        const deleteButton = screen.getByText('DELETE');
        userEvent.click(deleteButton);
        expect(onMetadataRowDeleteMock).toBeCalledWith(mockMetadataRow);
    });

    it('should edit the metadata when toggled', () => {
        render(
            <EditMetadataRow
                metadataValueType={PropertyType.STRING}
                metadataRow={mockMetadataRow}
                onMetadataRowDelete={onMetadataRowDeleteMock}
                onMetadataRowEdit={onMetadataRowEditMock}
            />
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
                <EditMetadataRow
                    metadataValueType={PropertyType.STRING}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
            );

            const stringEditor = screen.getByPlaceholderText('New metadata value');
            expect(stringEditor).toBeInTheDocument();
        });

        it('should be edited with the correct arguments', () => {
            mockMetadataRow.metadataValue = '';
            render(
                <EditMetadataRow
                    metadataValueType={PropertyType.STRING}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
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
                <EditMetadataRow
                    metadataValueType={PropertyType.NUMBER}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
            );

            const numberEditor = screen.getByRole('spinbutton');
            expect(numberEditor).toBeInTheDocument();
        });

        it('should be edited with the correct arguments', () => {
            mockMetadataRow.metadataValue = 0;
            render(
                <EditMetadataRow
                    metadataValueType={PropertyType.NUMBER}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
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
                <EditMetadataRow
                    metadataValueType={PropertyType.BOOLEAN}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
            );
            const booleanEditor = screen.getByRole('checkbox');
            expect(booleanEditor).toBeInTheDocument();
        });

        it('should be edited with the correct arguments', () => {
            mockMetadataRow.metadataValue = false;
            render(
                <EditMetadataRow
                    metadataValueType={PropertyType.BOOLEAN}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
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
                <EditMetadataRow
                    metadataValueType={PropertyType.NONE}
                    metadataRow={mockMetadataRow}
                    onMetadataRowDelete={onMetadataRowDeleteMock}
                    onMetadataRowEdit={onMetadataRowEditMock}
                />
            );
            const noneEditor = screen.getByText('null');
            expect(noneEditor).toBeInTheDocument();
        });
    });
});
