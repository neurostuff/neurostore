import { useAuth0 } from '@auth0/auth0-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { useProjectCurationColumns, useProjectExclusionTag, useUpdateExclusionTag } from 'stores/projects/ProjectStore';
import { ENeurosynthTagIds } from 'stores/projects/ProjectStore.consts';
import { Mock, vi } from 'vitest';
import { IGroupListItem } from './CurationBoardAIGroupsList';
import CurationBoardAIInterfaceExclude from './CurationBoardAIInterfaceExclude';

vi.mock('@auth0/auth0-react');
vi.mock('stores/projects/ProjectStore');
vi.mock('components/VirtualizedList/VirtualizedList');
vi.mock('./CurationEditableStubSummary');
vi.mock('./CurationStubListItemVirtualizedContainer');

const exclusionTag = { id: 'custom-exclusion', label: 'Wrong species', isExclusionTag: true, isAssignable: true };

const group = { id: exclusionTag.id, label: exclusionTag.label } as IGroupListItem;

// unsorted on purpose: the component sorts by title
const ratStub = { id: 'stub-rat', title: 'Rat study', exclusionTag: exclusionTag.id } as ICurationStubStudy;
const mouseStub = { id: 'stub-mouse', title: 'Mouse study', exclusionTag: exclusionTag.id } as ICurationStubStudy;
const monkeyStub = { id: 'stub-monkey', title: 'Monkey study', exclusionTag: exclusionTag.id } as ICurationStubStudy;
const otherExclusionStub = { id: 'stub-other', title: 'Another study', exclusionTag: 'other-exclusion' };
const includedStub = { id: 'stub-included', title: 'Included study', exclusionTag: null };

const listItems = () => screen.queryAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'));
const selectedListItem = () => screen.getByRole('button', { pressed: true });
const summary = () => screen.getByTestId('stub-summary');
const searchField = () => screen.getByPlaceholderText('Search excluded studies...');

const renderExclude = (columns = [{ stubStudies: [ratStub, otherExclusionStub, mouseStub] }]) => {
    (useProjectCurationColumns as Mock).mockReturnValue(columns);
    return render(<CurationBoardAIInterfaceExclude group={group} />);
};

describe('CurationBoardAIInterfaceExclude', () => {
    beforeEach(() => {
        Element.prototype.scrollTo = vi.fn();
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                disconnect() {}
            }
        );
        (useProjectExclusionTag as Mock).mockReturnValue(exclusionTag);
        (useAuth0 as Mock).mockReturnValue({ isAuthenticated: true, user: { sub: 'user-id' } });
    });

    it('shows the exclusion label and reason', () => {
        renderExclude();

        expect(screen.getByRole('heading', { name: 'Wrong species' })).toBeInTheDocument();
        expect(
            screen.getByText('These studies have been excluded due to the following reason: Wrong species')
        ).toBeInTheDocument();
    });

    it('shows an empty message and no search when no studies have this exclusion', () => {
        renderExclude([{ stubStudies: [otherExclusionStub, includedStub] }] as never);

        expect(screen.getByText('No studies have been marked as Wrong species.')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search excluded studies...')).not.toBeInTheDocument();
        expect(screen.queryByTestId('stub-summary')).not.toBeInTheDocument();
    });

    it('lists only studies with this exclusion from every column, sorted by title', () => {
        renderExclude([
            { stubStudies: [ratStub, otherExclusionStub] },
            { stubStudies: [includedStub, mouseStub] },
            { stubStudies: [monkeyStub] },
        ] as never);

        expect(listItems().map((item) => item.textContent)).toEqual(['stub-monkey', 'stub-mouse', 'stub-rat']);
    });

    it('selects the first study on load and passes the column it lives in to the summary', () => {
        renderExclude([{ stubStudies: [ratStub] }, { stubStudies: [monkeyStub] }] as never);

        expect(selectedListItem()).toHaveTextContent('stub-monkey');
        expect(summary()).toHaveAttribute('data-stub-id', 'stub-monkey');
        expect(summary()).toHaveAttribute('data-column-index', '1');
    });

    it('selects a study when it is clicked in the list', async () => {
        const user = userEvent.setup();
        renderExclude();

        await user.click(screen.getByRole('button', { name: 'stub-rat' }));

        expect(selectedListItem()).toHaveTextContent('stub-rat');
        expect(summary()).toHaveAttribute('data-stub-id', 'stub-rat');
    });

    describe('search', () => {
        it('filters the list and moves the selection into the filtered results', async () => {
            const user = userEvent.setup();
            renderExclude();
            expect(summary()).toHaveAttribute('data-stub-id', 'stub-mouse');

            await user.type(searchField(), 'rat');

            expect(listItems().map((item) => item.textContent)).toEqual(['stub-rat']);
            expect(summary()).toHaveAttribute('data-stub-id', 'stub-rat');
        });

        it('keeps the selection when the selected study still matches', async () => {
            const user = userEvent.setup();
            renderExclude([{ stubStudies: [ratStub, mouseStub, monkeyStub] }] as never);
            await user.click(screen.getByRole('button', { name: 'stub-mouse' }));

            await user.type(searchField(), 'mo');

            expect(listItems().map((item) => item.textContent)).toEqual(['stub-monkey', 'stub-mouse']);
            expect(summary()).toHaveAttribute('data-stub-id', 'stub-mouse');
        });

        it('keeps the search field when nothing matches so the search can be cleared', async () => {
            const user = userEvent.setup();
            renderExclude();

            await user.type(searchField(), 'no match');

            expect(screen.getByText('No excluded studies match your search.')).toBeInTheDocument();
            expect(listItems()).toHaveLength(0);
            expect(screen.queryByTestId('stub-summary')).not.toBeInTheDocument();

            await user.clear(searchField());

            expect(listItems().map((item) => item.textContent)).toEqual(['stub-mouse', 'stub-rat']);
            expect(summary()).toBeInTheDocument();
        });

        it('clears the search when a different exclusion group is shown', async () => {
            const user = userEvent.setup();
            const { rerender } = renderExclude();
            await user.type(searchField(), 'rat');

            rerender(<CurationBoardAIInterfaceExclude group={{ ...group, id: 'another-group' }} />);

            expect(searchField()).toHaveValue('');
        });
    });

    describe('move to next study', () => {
        it('selects the next study in the list', async () => {
            const user = userEvent.setup();
            renderExclude([{ stubStudies: [ratStub, mouseStub, monkeyStub] }] as never);

            await user.click(screen.getByRole('button', { name: 'move to next stub' }));
            expect(summary()).toHaveAttribute('data-stub-id', 'stub-mouse');

            await user.click(screen.getByRole('button', { name: 'move to next stub' }));
            expect(summary()).toHaveAttribute('data-stub-id', 'stub-rat');
        });

        it('stays on the last study', async () => {
            const user = userEvent.setup();
            renderExclude();
            await user.click(screen.getByRole('button', { name: 'stub-rat' }));

            await user.click(screen.getByRole('button', { name: 'move to next stub' }));

            expect(summary()).toHaveAttribute('data-stub-id', 'stub-rat');
        });

        it('skips studies hidden by the search', async () => {
            const user = userEvent.setup();
            const ratStudyTwo = { ...ratStub, id: 'stub-rat-2', title: 'Rat study two' };
            renderExclude([{ stubStudies: [ratStub, mouseStub, ratStudyTwo] }] as never);
            await user.type(searchField(), 'rat');
            expect(summary()).toHaveAttribute('data-stub-id', 'stub-rat');

            await user.click(screen.getByRole('button', { name: 'move to next stub' }));

            expect(summary()).toHaveAttribute('data-stub-id', 'stub-rat-2');
        });
    });

    describe('update exclusion label', () => {
        it('saves the new label for this exclusion', async () => {
            const user = userEvent.setup();
            const updateExclusionTag = vi.fn();
            (useUpdateExclusionTag as Mock).mockReturnValue(updateExclusionTag);
            const { rerender } = renderExclude([{ stubStudies: [ratStub, mouseStub, monkeyStub] }] as never);

            await user.click(screen.getByTestId('EditIcon'));
            const labelField = screen.getByLabelText('Group Label');
            await user.clear(labelField);
            await user.type(labelField, 'Non-human study');
            await user.click(screen.getByRole('button', { name: 'Save' }));

            expect(updateExclusionTag).toHaveBeenCalledWith('custom-exclusion', 'Non-human study');

            // the store renames the tag in place, so every study still points to it by id
            (useProjectExclusionTag as Mock).mockReturnValue({ ...exclusionTag, label: 'Non-human study' });
            rerender(<CurationBoardAIInterfaceExclude group={{ ...group, label: 'Non-human study' }} />);

            expect(screen.getByRole('heading', { name: 'Non-human study' })).toBeInTheDocument();
            expect(
                screen.getByText('These studies have been excluded due to the following reason: Non-human study')
            ).toBeInTheDocument();
            expect(listItems().map((item) => item.textContent)).toEqual(['stub-monkey', 'stub-mouse', 'stub-rat']);
        });

        it('hides the edit button for a default exclusion', () => {
            (useProjectExclusionTag as Mock).mockReturnValue({
                ...exclusionTag,
                id: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID,
                label: 'Duplicate',
            });
            renderExclude([
                { stubStudies: [{ ...ratStub, exclusionTag: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID }] },
            ] as never);

            expect(screen.getByTestId('EditIcon').closest('button')).not.toBeVisible();
        });

        it('hides the edit button when the user cannot edit the project', () => {
            (useAuth0 as Mock).mockReturnValue({ isAuthenticated: true, user: { sub: 'someone-else' } });
            renderExclude();

            expect(screen.getByTestId('EditIcon').closest('button')).not.toBeVisible();
        });
    });
});
