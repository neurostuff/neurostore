import type { UncategorizedImagesColumnProps } from 'pages/StudyIBMA/components/UncategorizedImagesColumn';

const MockUncategorizedImagesColumn: React.FC<UncategorizedImagesColumnProps> = ({
    collapsed,
    uncategorized,
}) => (
    <div
        data-testid="mock-uncategorized-images-column"
        data-collapsed={String(collapsed)}
        data-count={uncategorized.length}
    />
);

export default MockUncategorizedImagesColumn;
