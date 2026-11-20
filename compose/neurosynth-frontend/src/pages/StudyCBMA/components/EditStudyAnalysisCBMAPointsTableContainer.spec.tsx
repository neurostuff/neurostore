import { describe, vi, Mock } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import 'handsontable/styles/ht-theme-classic.min.css';
import type { HotInstance } from 'handsontable/core/types';
import { useStudyCBMAContext } from 'pages/StudyCBMA/context/StudyCBMAContext';
import { EditAnalysisPointsHotSnapshot } from 'pages/StudyCBMA/hooks/useEditAnalysisPointsHotTable';
import { useMarkStudyEdited, useReplaceAnalysisPoints, useSetAnalysisPointWarnings } from 'stores/study/StudyStore';
import { IStorePoint } from 'stores/study/StudyStore.helpers';
import EditStudyAnalysisCBMAPointsTableContainer from './EditStudyAnalysisCBMAPointsTableContainer';

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}

class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return [];
    }
}

global.ResizeObserver = ResizeObserverStub;
global.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
HTMLElement.prototype.scrollIntoView = () => {};

// Handsontable skips injecting its core CSS when this id exists. jsdom recomputes styles against those ~650 rules
// after every DOM change, which makes each test take seconds. No assertion here depends on that CSS.
const handsontableCoreStyles = document.createElement('style');
handsontableCoreStyles.id = 'handsontable-core-styles';
document.head.appendChild(handsontableCoreStyles);

vi.mock('stores/study/StudyStore');
vi.mock('pages/StudyCBMA/context/StudyCBMAContext');

const point = (overrides: Partial<IStorePoint>): IStorePoint =>
    ({
        id: 'point-id',
        isNew: false,
        x: undefined,
        y: undefined,
        z: undefined,
        value: undefined,
        cluster_size: undefined,
        subpeak: undefined,
        deactivation: undefined,
        ...overrides,
    }) as IStorePoint;

const snapshotFor = (points: IStorePoint[], hasNonMNICoordinates = false): EditAnalysisPointsHotSnapshot => {
    const isComplete = (row: IStorePoint) => row.x !== undefined && row.y !== undefined && row.z !== undefined;
    return {
        analysisId: 'analysis-1',
        seed: 0,
        points,
        height: 120,
        pointWarnings: {
            hasEmptyPoints: !points.every(isComplete),
            hasNonMNICoordinates,
            hasInvalidEntries: false,
        },
    };
};

const noWarnings = { hasEmptyPoints: false, hasNonMNICoordinates: false, hasInvalidEntries: false };

const getHot = () => {
    const wrappers = Array.from(document.querySelectorAll('.ht-root-wrapper'));
    const tableWrapper = wrappers.find((wrapper) => wrapper.querySelector('.ht_master'));
    const hot = (tableWrapper as (HTMLElement & { __hotInstance?: HotInstance }) | undefined)?.__hotInstance;
    if (!hot) throw new Error('coordinates table was not created');
    return hot;
};

const selectCells = (startRow: number, endRow: number) => {
    getHot().selectCell(startRow, 0, endRow, 2, false, false);
};

const insertFromContextMenu = (command: 'row_above' | 'row_below' | 'rows_above' | 'rows_below') => {
    act(() => {
        getHot().getPlugin('contextMenu').executeCommand(command);
    });
};

const openContextMenu = () => {
    act(() => {
        getHot().getPlugin('contextMenu').open({ top: 0, left: 0 });
    });
};

const closeContextMenu = () => {
    act(() => {
        getHot().getPlugin('contextMenu').close();
    });
};

describe('EditStudyAnalysisCBMAPointsTableContainer', { timeout: 20000 }, () => {
    const markStudyEdited = vi.fn();
    const replaceAnalysisPoints = vi.fn();
    const pointsTableRef: { current: { flushPoints: () => void } | null } = { current: null };
    const setAnalysisPointWarnings = vi.fn();
    const onAllPointsHaveCoordinates = vi.fn();

    const renderGrid = (points: IStorePoint[], hasNonMNICoordinates = false) => {
        return render(
            <EditStudyAnalysisCBMAPointsTableContainer
                analysisId="analysis-1"
                snapshot={snapshotFor(points, hasNonMNICoordinates)}
                onAllPointsHaveCoordinates={onAllPointsHaveCoordinates}
            />
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        pointsTableRef.current = null;
        (useMarkStudyEdited as Mock).mockReturnValue(markStudyEdited);
        (useReplaceAnalysisPoints as Mock).mockReturnValue(replaceAnalysisPoints);
        (useSetAnalysisPointWarnings as Mock).mockReturnValue(setAnalysisPointWarnings);
        (useStudyCBMAContext as Mock).mockReturnValue({
            pointsTableRef,
            pointsTableSeed: 0,
        });
    });

    it('writes the table point warnings to the store and removes them on unmount', () => {
        const { unmount } = renderGrid([point({ id: 'a', x: 200, y: 0, z: 0 })], true);
        expect(setAnalysisPointWarnings).toHaveBeenLastCalledWith('analysis-1', {
            ...noWarnings,
            hasNonMNICoordinates: true,
        });

        unmount();
        expect(setAnalysisPointWarnings).toHaveBeenLastCalledWith('analysis-1');
    });

    it('flushes the open grid into the study store', () => {
        renderGrid([
            point({ id: 'saved-a', x: 10, y: 20, z: 30 }),
            point({ id: 'saved-b', x: 1, y: 2, z: 3, value: null, cluster_size: '' as unknown as number }),
        ]);

        pointsTableRef.current?.flushPoints();

        expect(replaceAnalysisPoints).toHaveBeenCalledWith('analysis-1', [
            expect.objectContaining({ id: 'saved-a', isNew: false, x: 10, y: 20, z: 30 }),
            expect.objectContaining({
                id: 'saved-b',
                isNew: false,
                x: 1,
                y: 2,
                z: 3,
                value: undefined,
                cluster_size: undefined,
            }),
        ]);
    });

    it('deletes one selected row and keeps the other', () => {
        renderGrid([point({ id: 'a', x: 10, y: 20, z: 30 }), point({ id: 'b', x: 1, y: 2, z: 3 })]);
        selectCells(0, 0);

        fireEvent.click(screen.getByRole('button', { name: 'Delete row(s)' }));

        const hot = getHot();
        expect(hot.countRows()).toBe(1);
        expect(hot.getDataAtCell(0, 0)).toBe(1);
        expect(markStudyEdited).toHaveBeenCalled();
    });

    it('leaves one empty row when every row is deleted', () => {
        renderGrid([point({ id: 'a', x: 200, y: 0, z: 0 }), point({ id: 'b', x: 10, y: 20, z: 30 })], true);
        selectCells(0, 1);

        fireEvent.click(screen.getByRole('button', { name: 'Delete row(s)' }));

        const hot = getHot();
        expect(hot.countRows()).toBe(1);
        expect(hot.getSourceDataAtCell(0, hot.propToCol('x'))).toBeNull();
        expect(hot.getSourceDataAtCell(0, hot.propToCol('y'))).toBeNull();
        expect(hot.getSourceDataAtCell(0, hot.propToCol('z'))).toBeNull();
        expect(setAnalysisPointWarnings).toHaveBeenLastCalledWith('analysis-1', {
            ...noWarnings,
            hasEmptyPoints: true,
        });
        expect(onAllPointsHaveCoordinates).toHaveBeenCalledWith(false);
        expect(markStudyEdited).toHaveBeenCalled();

        pointsTableRef.current?.flushPoints();
        expect(replaceAnalysisPoints).toHaveBeenCalledWith('analysis-1', [
            expect.objectContaining({
                isNew: true,
                x: undefined,
                y: undefined,
                z: undefined,
            }),
        ]);
    });

    it('clears a coordinate with Delete and marks the blank cell invalid', async () => {
        renderGrid([point({ id: 'a', x: 200, y: 0, z: 0, value: 5 })], true);
        act(() => {
            const hot = getHot();
            hot.selectCell(0, 0);
            hot.listen();
        });

        fireEvent.keyDown(document.documentElement, { key: 'Delete' });

        await waitFor(() => {
            const hot = getHot();
            expect(hot.getDataAtCell(0, 0)).toBeNull();
            expect(hot.getCellMeta(0, 0).valid).toBe(false);
            expect(hot.getCell(0, 0)?.classList.contains('htInvalid')).toBe(true);
        });

        const hot = getHot();
        expect(hot.getDataAtCell(0, 1)).toBe(0);
        expect(hot.getCellMeta(0, 0).allowInvalid).toBe(true);
        expect(setAnalysisPointWarnings).toHaveBeenLastCalledWith('analysis-1', {
            ...noWarnings,
            hasEmptyPoints: true,
        });
        expect(onAllPointsHaveCoordinates).toHaveBeenCalledWith(false);
        expect(markStudyEdited).toHaveBeenCalled();
    });

    it('marks a non-numeric coordinate invalid and clears the warning for a number', async () => {
        renderGrid([point({ id: 'a', x: 10, y: 20, z: 30 })]);

        act(() => {
            getHot().setDataAtCell(0, 0, 'left');
        });

        await waitFor(() => {
            const hot = getHot();
            expect(hot.getDataAtCell(0, 0)).toBe('left');
            expect(hot.getCellMeta(0, 0).valid).toBe(false);
            expect(hot.getCell(0, 0)?.classList.contains('htInvalid')).toBe(true);
        });
        expect(setAnalysisPointWarnings).toHaveBeenLastCalledWith('analysis-1', {
            ...noWarnings,
            hasInvalidEntries: true,
        });

        act(() => {
            getHot().setDataAtCell(0, 0, 12);
        });

        await waitFor(() => {
            const hot = getHot();
            expect(hot.getDataAtCell(0, 0)).toBe(12);
            expect(hot.getCellMeta(0, 0).valid).toBe(true);
            expect(hot.getCell(0, 0)?.classList.contains('htInvalid')).toBe(false);
        });
        expect(setAnalysisPointWarnings).toHaveBeenLastCalledWith('analysis-1', noWarnings);
    });

    it('clears the invalid style when a valid coordinate is filled down', async () => {
        renderGrid([
            point({ id: 'a', x: 10, y: 20, z: 30 }),
            point({ id: 'b' }),
            point({ id: 'c' }),
        ]);

        await waitFor(() => {
            const hot = getHot();
            expect(hot.getCell(1, 0)?.classList.contains('htInvalid')).toBe(true);
            expect(hot.getCell(2, 0)?.classList.contains('htInvalid')).toBe(true);
        });

        act(() => {
            const hot = getHot();
            const autofill = hot.getPlugin('autofill');
            hot.selectCell(0, 0);
            autofill.addSelectionFromStartAreaToSpecificRowIndex([0, 0, 0, 0], 2);
            autofill.fillIn();
        });

        await waitFor(() => {
            const hot = getHot();
            expect(hot.getDataAtCell(1, 0)).toBe(10);
            expect(hot.getDataAtCell(2, 0)).toBe(10);
            expect(hot.getCellMeta(1, 0).valid).toBe(true);
            expect(hot.getCellMeta(2, 0).valid).toBe(true);
            expect(hot.getCell(1, 0)?.classList.contains('htInvalid')).toBe(false);
            expect(hot.getCell(2, 0)?.classList.contains('htInvalid')).toBe(false);
        });

        const hot = getHot();
        expect(hot.getCell(0, 0)?.classList.contains('htInvalid')).toBe(false);
        expect(hot.getDataAtCell(1, 1)).toBeUndefined();
        expect(hot.getCell(1, 1)?.classList.contains('htInvalid')).toBe(true);
    });

    it('reports an out-of-bounds coordinate as non MNI', async () => {
        renderGrid([point({ id: 'a', x: 10, y: 20, z: 30 })]);

        act(() => {
            getHot().setDataAtCell(0, 0, 200);
        });

        await waitFor(() => {
            expect(setAnalysisPointWarnings).toHaveBeenLastCalledWith('analysis-1', {
                ...noWarnings,
                hasNonMNICoordinates: true,
            });
        });
    });

    it('marks new coordinate cells with the warning fill as soon as a row is added', async () => {
        renderGrid([point({ id: 'a', x: 10, y: 20, z: 30 })]);

        fireEvent.click(screen.getByRole('button', { name: 'Add row' }));

        await waitFor(() => {
            const hot = getHot();
            expect(hot.getCellMeta(1, 0).valid).toBe(false);
            expect(hot.getCellMeta(1, 1).valid).toBe(false);
            expect(hot.getCellMeta(1, 2).valid).toBe(false);
            expect(hot.getCell(1, 0)?.classList.contains('htInvalid')).toBe(true);
        });
        expect(setAnalysisPointWarnings).toHaveBeenLastCalledWith('analysis-1', {
            ...noWarnings,
            hasEmptyPoints: true,
        });
        expect(onAllPointsHaveCoordinates).toHaveBeenCalledWith(false);

        const hot = getHot();
        expect(hot.getCellMeta(0, 0).valid).not.toBe(false);
        expect(hot.getCellMeta(1, hot.propToCol('subpeak')).valid).not.toBe(false);
        const styles = Array.from(document.querySelectorAll('style'), (style) => style.textContent ?? '').join('\n');
        // No ThemeProvider in this spec, so warning and error are MUI defaults. The app theme supplies yellow and red.
        expect(styles).toContain('--ht-cell-error-background-color:rgba(237, 108, 2, 0.45)');
        expect(styles).toContain('.handsontable td.htInvalid{color:#d32f2f!important;}');
    });

    it('inserts one row below the bottom of the selection', () => {
        renderGrid([
            point({ id: 'a', x: 10, y: 20, z: 30 }),
            point({ id: 'b', x: 1, y: 2, z: 3 }),
            point({ id: 'c', x: 4, y: 5, z: 6 }),
            point({ id: 'd', x: 7, y: 8, z: 9 }),
            point({ id: 'e', x: 11, y: 12, z: 13 }),
        ]);
        selectCells(1, 3);

        insertFromContextMenu('row_below');

        expect(screen.queryByText('Enter number of rows to insert')).not.toBeInTheDocument();
        const hot = getHot();
        expect(hot.countRows()).toBe(6);
        expect(hot.getDataAtCell(3, 0)).toBe(7);
        expect(hot.getDataAtCell(4, 0)).toBeNull();
        expect(hot.getDataAtCell(5, 0)).toBe(11);
    });

    it('inserts one row above the top of the selection when the drag started lower', () => {
        renderGrid([
            point({ id: 'a', x: 10, y: 20, z: 30 }),
            point({ id: 'b', x: 1, y: 2, z: 3 }),
            point({ id: 'c', x: 4, y: 5, z: 6 }),
        ]);
        selectCells(2, 0);

        insertFromContextMenu('row_above');

        expect(screen.queryByText('Enter number of rows to insert')).not.toBeInTheDocument();
        const hot = getHot();
        expect(hot.countRows()).toBe(4);
        expect(hot.getDataAtCell(0, 0)).toBeNull();
        expect(hot.getDataAtCell(1, 0)).toBe(10);
        expect(hot.getDataAtCell(3, 0)).toBe(4);
    });

    it('inserts below the last selected cell from the toolbar dialog', () => {
        renderGrid([
            point({ id: 'a', x: 10, y: 20, z: 30 }),
            point({ id: 'b', x: 1, y: 2, z: 3 }),
            point({ id: 'c', x: 4, y: 5, z: 6 }),
        ]);
        selectCells(0, 1);

        fireEvent.click(screen.getByRole('button', { name: 'Add rows', hidden: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        const hot = getHot();
        expect(hot.countRows()).toBe(7);
        expect(hot.getDataAtCell(0, 0)).toBe(10);
        expect(hot.getDataAtCell(1, 0)).toBe(1);
        expect(hot.getDataAtCell(2, 0)).toBeNull();
        expect(hot.getDataAtCell(5, 0)).toBeNull();
        expect(hot.getDataAtCell(6, 0)).toBe(4);
    });

    it('inserts below the last selected cell when the drag started lower', () => {
        renderGrid([
            point({ id: 'a', x: 10, y: 20, z: 30 }),
            point({ id: 'b', x: 1, y: 2, z: 3 }),
            point({ id: 'c', x: 4, y: 5, z: 6 }),
        ]);
        selectCells(1, 0);

        fireEvent.click(screen.getByRole('button', { name: 'Add rows', hidden: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        const hot = getHot();
        expect(hot.countRows()).toBe(7);
        expect(hot.getDataAtCell(0, 0)).toBe(10);
        expect(hot.getDataAtCell(1, 0)).toBeNull();
        expect(hot.getDataAtCell(4, 0)).toBeNull();
        expect(hot.getDataAtCell(5, 0)).toBe(1);
        expect(hot.getDataAtCell(6, 0)).toBe(4);
    });

    it('offers to insert one row per selected row from the context menu', () => {
        renderGrid([
            point({ id: 'a', x: 10, y: 20, z: 30 }),
            point({ id: 'b', x: 1, y: 2, z: 3 }),
            point({ id: 'c', x: 4, y: 5, z: 6 }),
            point({ id: 'd', x: 7, y: 8, z: 9 }),
        ]);
        selectCells(0, 0);
        openContextMenu();
        expect(screen.getByText('Add row above')).toBeInTheDocument();
        expect(screen.queryByText('Add 1 row above')).not.toBeInTheDocument();
        expect(screen.queryByText('Add 1 row below')).not.toBeInTheDocument();
        closeContextMenu();

        selectCells(1, 3);
        openContextMenu();
        expect(screen.getByText('Add 3 rows above')).toBeInTheDocument();
        expect(screen.getByText('Add 3 rows below')).toBeInTheDocument();
        expect(screen.getByText('Add row above')).toBeInTheDocument();
        closeContextMenu();
    });

    it('inserts the selected row count below the bottom of the selection', () => {
        renderGrid([
            point({ id: 'a', x: 10, y: 20, z: 30 }),
            point({ id: 'b', x: 1, y: 2, z: 3 }),
            point({ id: 'c', x: 4, y: 5, z: 6 }),
            point({ id: 'd', x: 7, y: 8, z: 9 }),
            point({ id: 'e', x: 11, y: 12, z: 13 }),
        ]);
        selectCells(1, 3);

        insertFromContextMenu('rows_below');

        const hot = getHot();
        expect(hot.countRows()).toBe(8);
        expect(hot.getDataAtCell(3, 0)).toBe(7);
        expect(hot.getDataAtCell(4, 0)).toBeNull();
        expect(hot.getDataAtCell(6, 0)).toBeNull();
        expect(hot.getDataAtCell(7, 0)).toBe(11);
    });

    it('inserts the selected row count above the top of the selection when the drag started lower', () => {
        renderGrid([
            point({ id: 'a', x: 10, y: 20, z: 30 }),
            point({ id: 'b', x: 1, y: 2, z: 3 }),
            point({ id: 'c', x: 4, y: 5, z: 6 }),
        ]);
        selectCells(2, 0);

        insertFromContextMenu('rows_above');

        const hot = getHot();
        expect(hot.countRows()).toBe(6);
        expect(hot.getDataAtCell(0, 0)).toBeNull();
        expect(hot.getDataAtCell(2, 0)).toBeNull();
        expect(hot.getDataAtCell(3, 0)).toBe(10);
        expect(hot.getDataAtCell(5, 0)).toBe(4);
    });
});
