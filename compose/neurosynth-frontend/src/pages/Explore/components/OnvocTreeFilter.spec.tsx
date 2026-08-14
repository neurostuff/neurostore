import { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MockThemeProvider } from 'testing/helpers';
import { OnvocTreeNode } from 'pages/Explore/Explore.mockData';
import OnvocTreeFilter from './OnvocTreeFilter';

const DISORDER_NODES: OnvocTreeNode[] = [
    {
        id: 'medical-disorders',
        label: 'Medical Disorders',
        children: [
            { id: 'anemia', label: 'Anemia' },
            { id: 'asthma', label: 'Asthma' },
        ],
    },
];

const renderFilter = (props?: Partial<ComponentProps<typeof OnvocTreeFilter>>) => {
    const onSelectedLeafIdsChange = props?.onSelectedLeafIdsChange ?? vi.fn();
    render(
        <MockThemeProvider>
            <OnvocTreeFilter
                title="Disorders"
                nodes={DISORDER_NODES}
                selectedLeafIds={[]}
                onSelectedLeafIdsChange={onSelectedLeafIdsChange}
                {...props}
            />
        </MockThemeProvider>
    );
    return { onSelectedLeafIdsChange };
};

describe('OnvocTreeFilter', () => {
    it('renders the category title and leaf terms', () => {
        renderFilter();

        expect(screen.getByText('Disorders')).toBeInTheDocument();
        expect(screen.getByText('Medical Disorders')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Medical Disorders'));

        expect(screen.getByLabelText('Anemia')).toBeInTheDocument();
        expect(screen.getByLabelText('Asthma')).toBeInTheDocument();
    });

    it('clears only selected leaves that belong to this tree', () => {
        const { onSelectedLeafIdsChange } = renderFilter({
            selectedLeafIds: ['anemia', 'other-id'],
        });

        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

        expect(onSelectedLeafIdsChange).toHaveBeenCalledWith(['other-id']);
    });
});
