import { Table } from '@tanstack/react-table';
import { render } from '@testing-library/react';
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
        Element.prototype.scrollBy = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
            configurable: true,
            value: 500,
        });
    });

    it('selects the next stub when ArrowRight is pressed', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[0]);

        await user.keyboard('{ArrowRight}');

        expect(onSetSelectedStub).toHaveBeenCalledWith('stub-2');
    });

    it('selects the previous stub when ArrowLeft is pressed', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[1]);

        await user.keyboard('{ArrowLeft}');

        expect(onSetSelectedStub).toHaveBeenCalledWith('stub-1');
    });

    it('stays on the first stub when ArrowLeft is pressed', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[0]);

        await user.keyboard('{ArrowLeft}');

        expect(onSetSelectedStub).not.toHaveBeenCalled();
    });

    it('stays on the last stub when ArrowRight is pressed', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[2]);

        await user.keyboard('{ArrowRight}');

        expect(onSetSelectedStub).not.toHaveBeenCalled();
    });

    it('scrolls the detail pane without changing the selected stub', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[0]);

        await user.keyboard('{ArrowDown}');
        await user.keyboard('{ArrowUp}');

        expect(onSetSelectedStub).not.toHaveBeenCalled();
        expect(Element.prototype.scrollBy).toHaveBeenNthCalledWith(1, { top: 400, behavior: 'smooth' });
        expect(Element.prototype.scrollBy).toHaveBeenNthCalledWith(2, { top: -400, behavior: 'smooth' });
    });

    it('does not change the selected stub when an input is focused', async () => {
        const user = userEvent.setup();
        const onSetSelectedStub = renderFocus(stubs[0]);
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        await user.keyboard('{ArrowRight}');

        expect(onSetSelectedStub).not.toHaveBeenCalled();
        input.remove();
    });
});
