import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ICurationTableStudy } from 'pages/Curation/hooks/useCuratorTableState.types';
import { vi } from 'vitest';
import CurationStubAITableSummary from './CurationStubAITableSummary';

vi.mock('@tanstack/react-query');

const tableStudy = {
    id: 'stub-1',
    title: 'Title',
    TaskExtractor: { Modality: [], StudyObjective: '', fMRITasks: [] },
    ParticipantDemographicsExtractor: { groups: [] },
} as unknown as ICurationTableStudy;

const expandedState = (name: RegExp) => screen.getByRole('button', { name }).getAttribute('aria-expanded');

describe('CurationStubAITableSummary', () => {
    it('shows each extraction table as expanded or collapsed from expandedState', () => {
        render(
            <CurationStubAITableSummary stub={tableStudy} expandedState={[true, false]} onSetExpandedState={vi.fn()} />
        );

        expect(expandedState(/experimental details/i)).toBe('true');
        expect(expandedState(/participant demographics/i)).toBe('false');
    });

    it('toggles only the clicked extraction table', async () => {
        const user = userEvent.setup();
        const onSetExpandedState = vi.fn();
        render(
            <CurationStubAITableSummary
                stub={tableStudy}
                expandedState={[true, true]}
                onSetExpandedState={onSetExpandedState}
            />
        );

        await user.click(screen.getByRole('button', { name: /experimental details/i }));
        expect(onSetExpandedState).toHaveBeenLastCalledWith([false, true]);

        await user.click(screen.getByRole('button', { name: /participant demographics/i }));
        expect(onSetExpandedState).toHaveBeenLastCalledWith([true, false]);
    });
});
