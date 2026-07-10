import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockThemeProvider } from 'testing/helpers';
import { ECurationBoardAIInterface } from './CurationBoardAi';
import CurationBoardAIGroupsListItem from './CurationBoardAIGroupsListItem';
import { IGroupListItem } from './CurationBoardAIGroupsList';

const baseListItem = (overrides: Partial<IGroupListItem> = {}): IGroupListItem => ({
    type: 'LISTITEM',
    id: 'group-1',
    label: 'Parent group',
    count: 10,
    excludedCount: null,
    UI: ECurationBoardAIInterface.CURATOR,
    ...overrides,
});

const renderListItem = (props: Partial<ComponentProps<typeof CurationBoardAIGroupsListItem>> = {}) => {
    const group = props.group ?? baseListItem();
    return render(
        <MockThemeProvider>
            <CurationBoardAIGroupsListItem
                selectedGroupId={props.selectedGroupId}
                group={group}
                handleSelectGroup={props.handleSelectGroup ?? vi.fn()}
            />
        </MockThemeProvider>
    );
};

describe('CurationBoardAIGroupsListItem', () => {
    it('shows excluded count text when excludedCount is set on a leaf group', () => {
        renderListItem({
            group: baseListItem({
                id: 'leaf',
                label: 'Included',
                count: 5,
                excludedCount: 2,
                children: undefined,
            }),
        });

        expect(screen.getByText('2 excluded')).toBeInTheDocument();
    });

    it('does not show excluded count text when excludedCount is null', () => {
        renderListItem({
            group: baseListItem({
                excludedCount: null,
                children: undefined,
            }),
        });

        expect(screen.queryByText(/excluded/)).not.toBeInTheDocument();
    });

    it('shows excluded count on the parent row when the group has children and is collapsed', () => {
        renderListItem({
            group: baseListItem({
                id: 'parent',
                label: 'Needs review',
                count: 8,
                excludedCount: 3,
                children: [
                    {
                        type: 'LISTITEM',
                        id: 'child-1',
                        label: 'Child A',
                        count: 4,
                        excludedCount: 1,
                        UI: null,
                    },
                ],
            }),
        });

        const parentButton = screen.getByRole('button', { name: /Needs review/i });
        expect(within(parentButton).getByText('3 excluded')).toBeInTheDocument();
    });

    it('hides parent count and excluded summary while the expandable group is expanded', () => {
        renderListItem({
            group: baseListItem({
                id: 'parent',
                label: 'Needs review',
                count: 8,
                excludedCount: 3,
                children: [
                    {
                        type: 'LISTITEM',
                        id: 'child-1',
                        label: 'Child A',
                        count: 4,
                        excludedCount: 1,
                        UI: null,
                    },
                ],
            }),
        });

        const parentButton = screen.getByRole('button', { name: /Needs review/i });
        userEvent.click(parentButton);

        expect(within(parentButton).queryByText('3 excluded')).not.toBeInTheDocument();
        expect(within(parentButton).queryByText('8')).not.toBeInTheDocument();
    });

    it('shows excluded count on child rows when the parent is expanded', () => {
        renderListItem({
            group: baseListItem({
                id: 'parent',
                label: 'Needs review',
                count: 8,
                excludedCount: 3,
                children: [
                    {
                        type: 'LISTITEM',
                        id: 'child-1',
                        label: 'Child A',
                        count: 4,
                        excludedCount: 2,
                        UI: null,
                    },
                ],
            }),
        });

        userEvent.click(screen.getByRole('button', { name: /Needs review/i }));

        const childButton = screen.getByRole('button', { name: /Child A/i });
        expect(within(childButton).getByText('2 excluded')).toBeInTheDocument();
    });

    it('does not render excluded text on a child when excludedCount is null', () => {
        renderListItem({
            group: baseListItem({
                label: 'Parent',
                children: [
                    {
                        type: 'LISTITEM',
                        id: 'child-1',
                        label: 'Child A',
                        count: 4,
                        excludedCount: null,
                        UI: null,
                    },
                ],
            }),
        });

        userEvent.click(screen.getByRole('button', { name: /Parent/i }));

        const childButton = screen.getByRole('button', { name: /Child A/i });
        expect(within(childButton).queryByText(/excluded/)).not.toBeInTheDocument();
    });
});
