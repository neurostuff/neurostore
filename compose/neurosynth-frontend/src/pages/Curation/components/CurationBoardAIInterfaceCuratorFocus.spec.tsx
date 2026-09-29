import { Table } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ICurationTableStudy } from 'pages/Curation/hooks/useCuratorTableState.types';
import { vi } from 'vitest';
import CurationBoardAIInterfaceCuratorFocus from './CurationBoardAIInterfaceCuratorFocus';

vi.mock('components/VirtualizedList/VirtualizedList');
vi.mock('./CurationEditableStubSummary');
vi.mock('./CurationStubAITableSummary');
vi.mock('./CurationStubListItemVirtualizedContainer');

const stubs = [
    { id: 'stub-1', title: 'First' },
    { id: 'stub-2', title: 'Second' },
    { id: 'stub-3', title: 'Third' },
] as ICurationTableStudy[];

const table = {
    getRowModel: () => ({
        rows: stubs.map((stub) => ({ original: stub })),
    }),
} as unknown as Table<ICurationTableStudy>;

const renderFocus = (selectedStub: ICurationTableStudy | undefined, onSetSelectedStub = vi.fn()) => {
    render(
        <CurationBoardAIInterfaceCuratorFocus
            selectedStub={selectedStub}
            table={table}
            columnIndex={0}
            onSetSelectedStub={onSetSelectedStub}
        />
    );
    return onSetSelectedStub;
};

describe('CurationBoardAIInterfaceCuratorFocus', () => {
    beforeEach(() => {
        Element.prototype.scrollTo = vi.fn();
    });

    it('selects the stub below when ArrowDown is pressed', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[0]);

        await user.keyboard('{ArrowDown}');

        expect(onSetSelectedStub).toHaveBeenCalledWith('stub-2');
    });

    it('selects the stub above when ArrowUp is pressed', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[1]);

        await user.keyboard('{ArrowUp}');

        expect(onSetSelectedStub).toHaveBeenCalledWith('stub-1');
    });

    it('stays on the first stub when ArrowUp is pressed', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[0]);

        await user.keyboard('{ArrowUp}');

        expect(onSetSelectedStub).not.toHaveBeenCalled();
    });

    it('stays on the last stub when ArrowDown is pressed', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[2]);

        await user.keyboard('{ArrowDown}');

        expect(onSetSelectedStub).not.toHaveBeenCalled();
    });

    it('does not change the selected stub when an input is focused', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[0]);
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        await user.keyboard('{ArrowDown}');

        expect(onSetSelectedStub).not.toHaveBeenCalled();
        input.remove();
    });
});
