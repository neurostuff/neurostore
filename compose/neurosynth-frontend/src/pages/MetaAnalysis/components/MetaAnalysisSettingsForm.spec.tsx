import { Mock, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useGetMetaAnalysisById, useUserCanEdit } from 'hooks';
import MetaAnalysisSettingsForm from './MetaAnalysisSettingsForm';

const mutate = vi.hoisted(() => vi.fn());

vi.mock('hooks');
vi.mock('stores/projects/ProjectStore');
vi.mock('hooks/metaAnalyses/useUpdateMetaAnalysis', () => ({
    default: () => ({ mutate, isPending: false }),
}));

const renderForm = () =>
    render(
        <MemoryRouter initialEntries={['/projects/project-1/meta-analyses/meta-1']}>
            <Routes>
                <Route
                    path="/projects/:projectId/meta-analyses/:metaAnalysisId"
                    element={<MetaAnalysisSettingsForm />}
                />
            </Routes>
        </MemoryRouter>
    );

describe('MetaAnalysisSettingsForm', () => {
    beforeEach(() => {
        mutate.mockReset();
        (useUserCanEdit as Mock).mockReturnValue(true);
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: {
                id: 'meta-1',
                name: 'Attention meta-analysis',
                description: 'A demo description',
                public: true,
                user: 'owner',
                project: 'project-1',
                tags: ['attention'],
            },
        });
    });

    it('loads access, name, description, and tags', () => {
        renderForm();

        expect(screen.getByText('Access')).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toHaveValue('Attention meta-analysis');
        expect(screen.getByLabelText('Description')).toHaveValue('A demo description');
        expect(screen.getByRole('button', { name: 'Public' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('attention')).toBeInTheDocument();
    });

    it('saves name, description, privacy, and tags', async () => {
        const user = userEvent.setup();
        renderForm();

        await user.clear(screen.getByLabelText('Name'));
        await user.type(screen.getByLabelText('Name'), 'Updated name');
        await user.click(screen.getByRole('button', { name: 'Private' }));
        await user.type(screen.getByLabelText('Tags'), 'working-memory{enter}');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(mutate).toHaveBeenCalledWith({
            metaAnalysisId: 'meta-1',
            metaAnalysis: {
                name: 'Updated name',
                description: 'A demo description',
                public: false,
                tags: ['attention', 'working-memory'],
            },
        });
    });
});
