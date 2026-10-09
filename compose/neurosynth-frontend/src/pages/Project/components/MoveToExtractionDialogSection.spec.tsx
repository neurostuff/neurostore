import { render, screen } from '@testing-library/react';
import MoveToExtractionDialogSection from './MoveToExtractionDialogSection';

describe('MoveToExtractionDialogSection', () => {
    it('should render the section title and items', () => {
        render(
            <MoveToExtractionDialogSection
                title="Section title"
                items={[
                    { icon: <span data-testid="item-icon" />, title: 'Item title', description: 'Item description' },
                    { icon: <span />, title: 'Second item', description: 'Second description' },
                ]}
            />
        );

        expect(screen.getByText('Section title')).toBeInTheDocument();
        expect(screen.getByText('Item title')).toBeInTheDocument();
        expect(screen.getByText('Item description')).toBeInTheDocument();
        expect(screen.getByText('Second item')).toBeInTheDocument();
        expect(screen.getByTestId('item-icon')).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
});
