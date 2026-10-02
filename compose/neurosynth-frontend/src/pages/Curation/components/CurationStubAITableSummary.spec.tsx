import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { ICurationTableStudy } from 'pages/Curation/hooks/useCuratorTableState.types';
import { useProjectCurationColumns } from 'stores/projects/ProjectStore';
import { Mock, vi } from 'vitest';
import CurationEditableStubSummary from './CurationEditableStubSummary';
import CurationStubAITableSummary from './CurationStubAITableSummary';

vi.mock('@auth0/auth0-react');
vi.mock('stores/projects/ProjectStore');
vi.mock('./CurationPopupExclusionSelector');
vi.mock('@tanstack/react-query');
vi.mock('react-router-dom');

const study = {
    id: 'stub-1',
    doi: '',
    pmid: '',
    pmcid: '',
    title: 'Title',
    authors: '',
    journal: '',
    keywords: '',
    abstractText: 'Abstract',
    exclusionTag: null,
    articleLink: '',
} as ICurationStubStudy;

const tableStudy = {
    ...study,
    TaskExtractor: { Modality: [], StudyObjective: '', fMRITasks: [] },
    ParticipantDemographicsExtractor: { groups: [] },
} as unknown as ICurationTableStudy;

const expandedState = (name: RegExp) => screen.getByRole('button', { name }).getAttribute('aria-expanded');

describe('CurationStubAITableSummary', () => {
    beforeEach(() => {
        localStorage.clear();
        (useProjectCurationColumns as Mock).mockReturnValue([{}]);
    });

    it('shrinks both extraction tables on e and expands them on the next e', async () => {
        const user = userEvent.setup();
        render(
            <CurationEditableStubSummary stub={study} columnIndex={0} onMoveToNextStub={vi.fn()}>
                <CurationStubAITableSummary stub={tableStudy} />
            </CurationEditableStubSummary>
        );

        expect(expandedState(/experimental details/i)).toBe('true');
        expect(expandedState(/participant demographics/i)).toBe('true');

        await user.keyboard('e');

        expect(expandedState(/experimental details/i)).toBe('false');
        expect(expandedState(/participant demographics/i)).toBe('false');

        await user.keyboard('e');

        expect(expandedState(/experimental details/i)).toBe('true');
        expect(expandedState(/participant demographics/i)).toBe('true');
    });
});
