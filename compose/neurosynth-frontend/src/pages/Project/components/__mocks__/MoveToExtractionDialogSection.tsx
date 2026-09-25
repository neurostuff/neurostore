import type { MoveToExtractionDialogSectionItem } from 'pages/Project/components/MoveToExtractionDialogSection';
import type { ReactNode } from 'react';

const MoveToExtractionDialogSection = ({
    title,
    items,
}: {
    title: ReactNode;
    items: MoveToExtractionDialogSectionItem[];
}) => (
    <div data-testid="move-to-extraction-dialog-section">
        <div>{title}</div>
        {items.map((item, index) => (
            <div key={index} data-testid="move-to-extraction-dialog-section-item">
                <div>{item.title}</div>
                <div>{item.description}</div>
            </div>
        ))}
    </div>
);

export default MoveToExtractionDialogSection;
