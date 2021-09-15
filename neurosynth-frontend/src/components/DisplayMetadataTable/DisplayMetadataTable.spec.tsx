import { render, screen } from '@testing-library/react';
import { DisplayMetadataTable } from '..';

describe('DisplayMetadataTable Component', () => {
    const mockMetadata = {
        testKey1: 'test val 1',
        testKey2: true,
        testKey3: null,
        testKey4: 12345,
    };

    it('should render', () => {
        render(<DisplayMetadataTable metadata={mockMetadata} />);
        const numItems = screen.getAllByRole('row');
        expect(numItems.length - 1).toEqual(Object.keys(mockMetadata).length);
    });
});
