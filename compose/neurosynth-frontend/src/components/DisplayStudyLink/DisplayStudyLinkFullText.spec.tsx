import { vi, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import DisplayStudyLinkFullText from 'components/DisplayStudyLink/DisplayStudyLinkFullText';
import { useStudyName } from 'pages/Study/store/StudyStore';
import { useGetFullText } from 'hooks';

vi.mock('pages/Study/store/StudyStore');
vi.mock('hooks');
describe('DisplayStudyLinkFullText Component', () => {
    it('should render', () => {
        render(<DisplayStudyLinkFullText studyName="" />);
    });

    it('should show the chip with the link', async () => {
        (useStudyName as Mock).mockReturnValue(undefined);
        useGetFullText().data = 'study-name';
        render(<DisplayStudyLinkFullText studyName="study-name" />);
        const element = await screen.findByRole('link');
        expect(element).toBeInTheDocument();
        expect(element.getAttribute('href')).toEqual('study-name');
    });

    it('should not show the chip with the link', () => {
        (useStudyName as Mock).mockReturnValue(undefined);
        useGetFullText().data = '';
        render(<DisplayStudyLinkFullText studyName="study-name" />);
        const element = screen.queryByRole('link');
        expect(element).not.toBeInTheDocument();
    });
});
