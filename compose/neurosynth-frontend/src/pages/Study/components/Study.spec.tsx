import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Study from 'pages/Study/components/Study';

vi.mock('pages/Study/components/StudyAnalyses');
vi.mock('pages/Study/components/StudyAnalysesIBMA');
vi.mock('components/DisplayStudyLink/DisplayStudyLinkFullText');

const baseProps = {
    id: 'version-1',
    name: 'Example study',
    authors: 'Author A',
    publication: 'Journal',
    analyses: [
        {
            id: 'analysis-1',
            name: 'Contrast',
            description: '',
            order: 1,
            isNew: false,
            conditions: [],
            points: [],
            images: [],
            pointSpace: undefined,
            pointStatistic: undefined,
        },
    ],
};

describe('Study', () => {
    it('shows type then version chips and does not render a CBMA/IBMA toggle', () => {
        render(<Study {...baseProps} has_coordinates has_images={false} />);

        expect(screen.getByTestId('study-type-chip')).toHaveTextContent('Coordinates');
        expect(screen.getByTestId('study-version-chip')).toHaveTextContent('Version: version-1');
        expect(screen.queryByRole('group', { name: 'Analysis view type' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'CBMA' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'IBMA' })).not.toBeInTheDocument();
    });

    it('renders CBMA analyses for coordinate versions', () => {
        render(<Study {...baseProps} has_coordinates has_images={false} />);
        expect(screen.getByTestId('study-analyses-cbma')).toBeInTheDocument();
        expect(screen.queryByTestId('study-analyses-ibma')).not.toBeInTheDocument();
    });

    it('renders IBMA analyses and Images chip for image versions', () => {
        render(<Study {...baseProps} has_images has_coordinates={false} />);
        expect(screen.getByTestId('study-type-chip')).toHaveTextContent('Images');
        expect(screen.getByTestId('study-analyses-ibma')).toBeInTheDocument();
        expect(screen.queryByTestId('study-analyses-cbma')).not.toBeInTheDocument();
    });
});
