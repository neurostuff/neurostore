import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType, IMetadataRowModel } from '.';
import { EditMetadata } from '..';
import { MockThemeProvider } from '../../testing/helpers';
import { getType } from './EditMetadata';

describe('EditMetadata Component', () => {
    const onMetadataEditChangeMock = jest.fn();

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
                    onMetadataEditChange={onMetadataEditChangeMock}
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
                    onMetadataEditChange={onMetadataEditChangeMock}
                />
            </MockThemeProvider>
        );

        const deleteButton = screen.getAllByRole('button', { name: 'DELETE' })[1];
        userEvent.click(deleteButton);
        expect(onMetadataEditChangeMock).toBeCalledWith([
            {
                metadataKey: 'key 1',
                metadataValue: 'value 1',
            },
            {
                metadataKey: 'key 3',
                metadataValue: 12345,
            },
            {
                metadataKey: 'key 4',
                metadataValue: null,
            },
        ]);
    });

    it('should add the row and call the parent prop function', () => {
        render(
            <MockThemeProvider>
                <EditMetadata
                    metadata={mockMetadata}
                    onMetadataEditChange={onMetadataEditChangeMock}
                />
            </MockThemeProvider>
        );

        const addRow = screen.getByPlaceholderText('New metadata key');
        const addRowButton = screen.getByRole('button', { name: 'ADD' });
        userEvent.type(addRow, 'new metadata key');
        userEvent.click(addRowButton);

        expect(onMetadataEditChangeMock).toBeCalledWith([
            {
                metadataKey: 'new metadata key',
                metadataValue: '',
            },
            ...mockMetadata,
        ]);
    });

    it('should edit the row and call the parent prop function', () => {
        render(
            <MockThemeProvider>
                <EditMetadata
                    metadata={mockMetadata}
                    onMetadataEditChange={onMetadataEditChangeMock}
                />
            </MockThemeProvider>
        );

        const input = screen.getAllByRole('textbox')[2];
        userEvent.type(input, '2345');

        expect(onMetadataEditChangeMock).toBeCalledWith([
            {
                metadataKey: 'key 1',
                metadataValue: 'value 12345',
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
        ]);
    });
});
