import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import SelectAnalysesComponentTable from 'pages/MetaAnalysis/components/SelectAnalysesComponentTable';
import { vi } from 'vitest';

vi.mock('hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('hooks')>();
    return {
        ...actual,
        useMeasure: () => ({ ref: { current: null }, width: 0, height: 56 }),
    };
});

const notes: NoteCollectionReturn[] = [
    {
        study: 's1',
        study_name: 'Alpha Study',
        analysis: 'a1',
        analysis_name: 'Motor',
        note: { included: true },
    },
    {
        study: 's1',
        study_name: 'Alpha Study',
        analysis: 'a2',
        analysis_name: 'Visual',
        note: { included: false },
    },
    {
        study: 's2',
        study_name: 'Beta Study',
        analysis: 'a3',
        analysis_name: 'Motor',
        note: { included: true },
    },
];

const selectedValue = {
    selectionKey: 'included',
    type: EPropertyType.BOOLEAN,
    selectionValue: true,
};

const renderTable = () =>
    render(<SelectAnalysesComponentTable allNotes={notes} selectedValue={selectedValue} />);

const expandInclusionSummary = async () => {
    await userEvent.click(screen.getByText('Inclusion Summary'));
};

describe('SelectAnalysesComponentTable', () => {
    it('renders study and analysis filter inputs', async () => {
        renderTable();
        await expandInclusionSummary();

        expect(screen.getByRole('textbox', { name: 'Filter studies' })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Filter analyses' })).toBeInTheDocument();
        expect(screen.getByText('Alpha Study')).toBeInTheDocument();
        expect(screen.getByText('Beta Study')).toBeInTheDocument();
        expect(screen.getAllByText('Motor')).toHaveLength(2);
        expect(screen.getByText('Visual')).toBeInTheDocument();
    });

    it('filters rows by study name', async () => {
        renderTable();
        await expandInclusionSummary();

        await userEvent.type(screen.getByRole('textbox', { name: 'Filter studies' }), 'alpha');

        await waitFor(() => {
            expect(screen.queryByText('Beta Study')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Alpha Study')).toBeInTheDocument();
        expect(screen.getByText('Visual')).toBeInTheDocument();
    });

    it('filters rows by analysis name', async () => {
        renderTable();
        await expandInclusionSummary();

        await userEvent.type(screen.getByRole('textbox', { name: 'Filter analyses' }), 'visual');

        await waitFor(() => {
            expect(screen.queryByText('Beta Study')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Alpha Study')).toBeInTheDocument();
        expect(screen.getByText('Visual')).toBeInTheDocument();
        expect(screen.queryByText('Motor')).not.toBeInTheDocument();
    });

    it('shows an empty filter message when nothing matches', async () => {
        renderTable();
        await expandInclusionSummary();

        await userEvent.type(screen.getByRole('textbox', { name: 'Filter studies' }), 'zzz');

        expect(await screen.findByText('No matching studies or analyses')).toBeInTheDocument();
    });
});
