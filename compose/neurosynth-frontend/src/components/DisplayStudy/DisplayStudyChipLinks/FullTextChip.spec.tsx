import { render, screen } from '@testing-library/react';
import FullTextChip from './FullTextChip';
import { useStudyName } from 'pages/Studies/StudyStore';
import { useGetFullText } from 'hooks';

jest.mock('pages/Studies/StudyStore');
jest.mock('hooks');
describe('FullTextChip Component', () => {
    it('should render', () => {
        render(<FullTextChip />);
    });

    it('should show the chip with the link', async () => {
        (useStudyName as jest.Mock).mockReturnValue(undefined);
        useGetFullText().data = 'study-name';
        render(<FullTextChip name="study-name" />);
        const element = await screen.findByRole('link');
        expect(element).toBeInTheDocument();
        expect(element.getAttribute('href')).toEqual('study-name');
    });

    it('should not show the chip with the link', () => {
        (useStudyName as jest.Mock).mockReturnValue(undefined);
        useGetFullText().data = '';
        render(<FullTextChip name="study-name" />);
        const element = screen.queryByRole('link');
        expect(element).not.toBeInTheDocument();
    });
});
