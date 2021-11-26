import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType, IMetadataRowModel } from '.';
import { EditMetadata } from '..';
import { MockThemeProvider } from '../../testing/helpers';
import { getType } from './EditMetadata';

describe('EditMetadata Component', () => {
    const handleMetadataRowEdit = jest.fn();
    const handleMetadataRowDelete = jest.fn();
    const handleMetadataRowAdd = jest.fn();

    const mockMetadata: IMetadataRowModel[] = [
        {
            metadataKey: 'key 1',
            metadataValue: 'value 1',
        },
        {
            metadataKey: 'key 2',
            metadataValue: false,
        },
        {
            metadataKey: 'key 3',
            metadataValue: 12345,
        },
        {
            metadataKey: 'key 4',
            metadataValue: null,
        },
    ];

    it('should render', () => {
        render(
            <MockThemeProvider>
                <EditMetadata
                    metadata={mockMetadata}
                    onMetadataRowDelete={handleMetadataRowDelete}
                    onMetadataRowAdd={handleMetadataRowAdd}
                    onMetadataRowEdit={handleMetadataRowEdit}
                />
            </MockThemeProvider>
        );

        const metadataInput = screen.getByPlaceholderText('New metadata key');
        expect(metadataInput).toBeInTheDocument();

        const separator = screen.getByRole('separator');
        expect(separator).toBeInTheDocument();

        const metadataRows = screen.getAllByRole('button', { name: 'DELETE' });
        expect(metadataRows.length).toEqual(mockMetadata.length);
    });

    it('should show message if no metadata is present', () => {
        render(
            <MockThemeProvider>
                <EditMetadata
                    metadata={[]}
                    onMetadataRowDelete={handleMetadataRowDelete}
                    onMetadataRowAdd={handleMetadataRowAdd}
                    onMetadataRowEdit={handleMetadataRowEdit}
                />
            </MockThemeProvider>
        );

        const noMetadataMessage = screen.getByText('No Metadata');
        expect(noMetadataMessage).toBeInTheDocument();
    });

    it('should get the correct type', () => {
        expect(getType('test')).toEqual(EPropertyType.STRING);
        expect(getType(12345)).toEqual(EPropertyType.NUMBER);
        expect(getType(true)).toEqual(EPropertyType.BOOLEAN);
        expect(getType(null)).toEqual(EPropertyType.NONE);
    });

    it('should delete the correct row and call the parent prop function', () => {
        render(
            <MockThemeProvider>
                <EditMetadata
                    metadata={mockMetadata}
                    onMetadataRowDelete={handleMetadataRowDelete}
                    onMetadataRowAdd={handleMetadataRowAdd}
                    onMetadataRowEdit={handleMetadataRowEdit}
                />
            </MockThemeProvider>
        );

        const deleteButton = screen.getAllByRole('button', { name: 'DELETE' })[1];
        userEvent.click(deleteButton);
        expect(handleMetadataRowDelete).toBeCalledWith({
            metadataKey: 'key 2',
            metadataValue: false,
        });
    });

    it('should add the row and call the parent prop function', () => {
        render(
            <MockThemeProvider>
                <EditMetadata
                    metadata={mockMetadata}
                    onMetadataRowDelete={handleMetadataRowDelete}
                    onMetadataRowAdd={handleMetadataRowAdd}
                    onMetadataRowEdit={handleMetadataRowEdit}
                />
            </MockThemeProvider>
        );

        const addRow = screen.getByPlaceholderText('New metadata key');
        const addRowButton = screen.getByRole('button', { name: 'ADD' });
        userEvent.type(addRow, 'test key');
        userEvent.click(addRowButton);

        expect(handleMetadataRowAdd).toBeCalledWith({
            metadataKey: 'test key',
            metadataValue: '',
        });
    });

    it('should edit the row and call the parent prop function', () => {
        render(
            <MockThemeProvider>
                <EditMetadata
                    metadata={mockMetadata}
                    onMetadataRowDelete={handleMetadataRowDelete}
                    onMetadataRowAdd={handleMetadataRowAdd}
                    onMetadataRowEdit={handleMetadataRowEdit}
                />
            </MockThemeProvider>
        );

        // targeting the first kvp textbox (first two textboxes are for the AddMetadataRow component)
        const input = screen.getAllByRole('textbox')[2];
        userEvent.type(input, 'A');

        expect(handleMetadataRowEdit).toBeCalledWith({
            metadataKey: 'key 1',
            metadataValue: 'value 1A',
        });
    });
});
