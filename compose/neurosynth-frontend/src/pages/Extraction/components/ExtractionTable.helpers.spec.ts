import { describe, expect, it, beforeEach } from 'vitest';
import {
    saveExtractionTableState,
    clearExtractionTableState,
    retrieveExtractionTableState,
    updateExtractionTableState,
    updateExtractionTableStateStudySwapInStorage,
    type IExtractionTableState,
} from './ExtractionTable.helpers';

const DEFAULT_STATE: IExtractionTableState = {
    columnFilters: [],
    sorting: [],
    studies: [],
    pagination: { pageIndex: 0, pageSize: 25 },
};

const createState = (overrides: Partial<IExtractionTableState> = {}): IExtractionTableState => ({
    ...DEFAULT_STATE,
    ...overrides,
});

describe('ExtractionTable.helpers', () => {
    const projectId = 'project-123';

    beforeEach(() => {
        window.sessionStorage.clear();
    });

    describe('saveExtractionTableState', () => {
        it('saves state to sessionStorage when projectId is defined', () => {
            const state = createState({ studies: ['study-1'], pagination: { pageIndex: 1, pageSize: 50 } });
            saveExtractionTableState(projectId, state);

            const stored = window.sessionStorage.getItem(`${projectId}-extraction-table`);
            expect(stored).not.toBeNull();
            expect(JSON.parse(stored!)).toEqual(state);
        });

        it('does nothing when projectId is undefined', () => {
            const state = createState();
            saveExtractionTableState(undefined, state);

            expect(window.sessionStorage.length).toBe(0);
        });
    });

    describe('clearExtractionTableState', () => {
        it('removes extraction table state from sessionStorage when projectId is defined', () => {
            saveExtractionTableState(projectId, createState());
            expect(window.sessionStorage.getItem(`${projectId}-extraction-table`)).not.toBeNull();

            clearExtractionTableState(projectId);
            expect(window.sessionStorage.getItem(`${projectId}-extraction-table`)).toBeNull();
        });

        it('does nothing when projectId is undefined', () => {
            saveExtractionTableState(projectId, createState());
            clearExtractionTableState(undefined);

            expect(window.sessionStorage.getItem(`${projectId}-extraction-table`)).not.toBeNull();
        });
    });

    describe('retrieveExtractionTableState', () => {
        it('returns null when projectId is undefined', () => {
            expect(retrieveExtractionTableState(undefined)).toBeNull();
        });

        it('returns default state when no state is stored', () => {
            expect(retrieveExtractionTableState(projectId)).toEqual(DEFAULT_STATE);
        });

        it('returns default state when stored value is empty object', () => {
            window.sessionStorage.setItem(`${projectId}-extraction-table`, '{}');
            expect(retrieveExtractionTableState(projectId)).toEqual(DEFAULT_STATE);
        });

        it('returns default state when stored value is missing required fields', () => {
            window.sessionStorage.setItem(
                `${projectId}-extraction-table`,
                JSON.stringify({ columnFilters: [], sorting: [] })
            );
            expect(retrieveExtractionTableState(projectId)).toEqual(DEFAULT_STATE);
        });

        it('returns parsed state when all required fields are present', () => {
            const state = createState({
                columnFilters: [{ id: 'status', value: 'curated' }],
                sorting: [{ id: 'name', desc: false }],
                studies: ['study-1', 'study-2'],
                pagination: { pageIndex: 2, pageSize: 50 },
            });
            saveExtractionTableState(projectId, state);

            expect(retrieveExtractionTableState(projectId)).toEqual(state);
        });

        it('returns null when stored value is invalid JSON', () => {
            window.sessionStorage.setItem(`${projectId}-extraction-table`, 'not valid json');
            expect(retrieveExtractionTableState(projectId)).toBeNull();
        });
    });

    describe('updateExtractionTableState', () => {
        it('does nothing when projectId is undefined', () => {
            updateExtractionTableState(undefined, { pagination: { pageIndex: 1, pageSize: 25 } });
            expect(window.sessionStorage.length).toBe(0);
        });

        it('merges partial state with default state when no state was previously stored', () => {
            updateExtractionTableState(projectId, { pagination: { pageIndex: 1, pageSize: 25 } });
            expect(retrieveExtractionTableState(projectId)).toEqual({
                ...DEFAULT_STATE,
                pagination: { pageIndex: 1, pageSize: 25 },
            });
        });

        it('merges partial state with existing state and saves', () => {
            const existing = createState({
                studies: ['study-1'],
                pagination: { pageIndex: 0, pageSize: 25 },
            });
            saveExtractionTableState(projectId, existing);

            updateExtractionTableState(projectId, { pagination: { pageIndex: 3, pageSize: 50 } });

            const result = retrieveExtractionTableState(projectId);
            expect(result?.pagination).toEqual({ pageIndex: 3, pageSize: 50 });
            expect(result?.studies).toEqual(['study-1']);
        });
    });

    describe('updateExtractionTableStateStudySwapInStorage', () => {
        it('does nothing when projectId is undefined', () => {
            saveExtractionTableState(projectId, createState({ studies: ['study-1'] }));
            updateExtractionTableStateStudySwapInStorage(undefined, 'study-1', 'study-2');

            const result = retrieveExtractionTableState(projectId);
            expect(result?.studies).toEqual(['study-1']);
        });

        it('does nothing when no existing state is stored', () => {
            updateExtractionTableStateStudySwapInStorage(projectId, 'study-1', 'study-2');
            expect(window.sessionStorage.getItem(`${projectId}-extraction-table`)).toBeNull();
        });

        it('does nothing when studyId is not in studies array', () => {
            const state = createState({ studies: ['study-1', 'study-2'] });
            saveExtractionTableState(projectId, state);

            updateExtractionTableStateStudySwapInStorage(projectId, 'study-missing', 'study-new');

            const result = retrieveExtractionTableState(projectId);
            expect(result?.studies).toEqual(['study-1', 'study-2']);
        });

        it('replaces studyId with newStudyId in studies array and saves', () => {
            const state = createState({ studies: ['study-1', 'study-2', 'study-3'] });
            saveExtractionTableState(projectId, state);

            updateExtractionTableStateStudySwapInStorage(projectId, 'study-2', 'study-2-revised');

            const result = retrieveExtractionTableState(projectId);
            expect(result?.studies).toEqual(['study-1', 'study-2-revised', 'study-3']);
        });

        it('replaces study at first index', () => {
            const state = createState({ studies: ['study-1', 'study-2'] });
            saveExtractionTableState(projectId, state);

            updateExtractionTableStateStudySwapInStorage(projectId, 'study-1', 'study-1-new');

            const result = retrieveExtractionTableState(projectId);
            expect(result?.studies).toEqual(['study-1-new', 'study-2']);
        });
    });
});
