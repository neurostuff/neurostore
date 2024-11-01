import { vi, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import FullTextChip from 'components/DisplayStudyChipLinks/DisplayStudyChipLinksFullText';
import { useStudyName } from 'pages/Study/store/StudyStore';
import { useGetFullText } from 'hooks';

vi.mock('pages/Study/store/StudyStore');
vi.mock('hooks');
describe('FullTextChip Component', () => {
    it('should render', () => {
        render(<FullTextChip />);
    });

    it('should show the chip with the link', async () => {
        (useStudyName as Mock).mockReturnValue(undefined);
        useGetFullText().data = 'study-name';
        render(<FullTextChip name="study-name" />);
        const element = await screen.findByRole('link');
        expect(element).toBeInTheDocument();
        expect(element.getAttribute('href')).toEqual('study-name');
    });

    it('should not show the chip with the link', () => {
        (useStudyName as Mock).mockReturnValue(undefined);
        useGetFullText().data = '';
        render(<FullTextChip name="study-name" />);
        const element = screen.queryByRole('link');
        expect(element).not.toBeInTheDocument();
    });
});
