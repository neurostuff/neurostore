import { act, renderHook } from '@testing-library/react';
import { useCreateAnnotation, useCreateStudyset, useIngest, useUpdateStudyset } from 'hooks';
import { useSnackbar } from 'notistack';
import { EExtractionStatus } from 'pages/Extraction/Extraction.types';
import {
    useProjectCurationColumn,
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useUpdateExtractionMetadata,
} from 'stores/projects/ProjectStore';
import { Mock, vi } from 'vitest';
import useInitExtraction from './useInitExtraction';

vi.mock('hooks');
vi.mock('stores/projects/ProjectStore');
vi.mock('notistack');

const mutateAsync = (hook: Mock) => hook.mock.results[0].value.mutateAsync as Mock;

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

const stubStudy = {
    id: 'stub-1',
    title: 'Study A',
    doi: '10.1/test',
    pmid: '123',
    pmcid: 'PMC1',
    articleYear: '2020',
    abstractText: 'abstract',
    journal: 'Journal',
    authors: 'Author',
};

const ingestedBaseStudy = {
    versions: [{ id: 'study-version-1', has_coordinates: true, updated_at: '2020-01-02' }],
};

describe('useInitExtraction', () => {
    const mockUpdateExtractionMetadata = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        (useUpdateExtractionMetadata as Mock).mockReturnValue(mockUpdateExtractionMetadata);
        (useProjectCurationColumn as Mock).mockReturnValue({ stubStudies: [stubStudy] });
        (useProjectExtractionStudysetId as Mock).mockReturnValue(undefined);
        (useProjectExtractionAnnotationId as Mock).mockReturnValue(undefined);

        (useCreateStudyset as Mock).mockReturnValue({
            mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'new-studyset' } }),
        });
        (useCreateAnnotation as Mock).mockReturnValue({
            mutateAsync: vi.fn().mockResolvedValue({ id: 'new-annotation' }),
        });
        (useIngest as Mock).mockReturnValue({
            mutateAsync: vi.fn().mockResolvedValue({ data: [ingestedBaseStudy] }),
        });
        (useUpdateStudyset as Mock).mockReturnValue({
            mutateAsync: vi.fn().mockResolvedValue({}),
        });
    });

    it('reports idle progress before init starts', () => {
        const { result } = renderHook(() => useInitExtraction());

        expect(result.current.progress).toBe(0);
        expect(result.current.progressText).toBe('creating studyset...');
        expect(result.current.isError).toBe(false);
    });

    it('updates progress text after each initialization step', async () => {
        const createStudysetDeferred = deferred<{ data: { id: string } }>();
        const createAnnotationDeferred = deferred<{ id: string }>();
        const ingestDeferred = deferred<{ data: (typeof ingestedBaseStudy)[] }>();
        const updateStudysetDeferred = deferred<Record<string, never>>();

        (useCreateStudyset as Mock).mockReturnValue({
            mutateAsync: vi.fn().mockReturnValue(createStudysetDeferred.promise),
        });
        (useCreateAnnotation as Mock).mockReturnValue({
            mutateAsync: vi.fn().mockReturnValue(createAnnotationDeferred.promise),
        });
        (useIngest as Mock).mockReturnValue({
            mutateAsync: vi.fn().mockReturnValue(ingestDeferred.promise),
        });
        (useUpdateStudyset as Mock).mockReturnValue({
            mutateAsync: vi.fn().mockReturnValue(updateStudysetDeferred.promise),
        });

        const { result } = renderHook(() => useInitExtraction());
        let initPromise!: Promise<boolean>;

        act(() => {
            initPromise = result.current.doExtraction(false);
        });
        expect(result.current.progressText).toBe('creating studyset...');
        expect(result.current.progress).toBe(0);

        await act(async () => {
            createStudysetDeferred.resolve({ data: { id: 'new-studyset' } });
            await createStudysetDeferred.promise;
        });
        expect(result.current.progressText).toBe('creating annotations...');
        expect(result.current.progress).toBeCloseTo(100 / 3);

        await act(async () => {
            createAnnotationDeferred.resolve({ id: 'new-annotation' });
            await createAnnotationDeferred.promise;
        });
        expect(result.current.progressText).toBe('ingesting...');
        expect(result.current.progress).toBeCloseTo(200 / 3);

        await act(async () => {
            ingestDeferred.resolve({ data: [ingestedBaseStudy] });
            await ingestDeferred.promise;
        });
        expect(result.current.progressText).toBe('ingesting...');

        await act(async () => {
            updateStudysetDeferred.resolve({});
            await updateStudysetDeferred.promise;
            await initPromise;
        });
        expect(result.current.progressText).toBe('process complete');
        expect(result.current.progress).toBe(100);
    });

    it('creates a studyset, annotation, and ingests studies', async () => {
        const { result } = renderHook(() => useInitExtraction());

        let didInit = false;
        await act(async () => {
            didInit = await result.current.doExtraction(false);
        });

        expect(didInit).toBe(true);
        expect(mutateAsync(useCreateStudyset as Mock)).toHaveBeenCalledWith({
            name: 'project-name Studyset',
            description: 'project-description',
        });
        expect(mutateAsync(useCreateAnnotation as Mock)).toHaveBeenCalledWith(
            expect.objectContaining({
                source: 'neurosynth',
                annotation: expect.objectContaining({
                    name: 'Annotation for studyset new-studyset',
                    studyset: 'new-studyset',
                }),
            })
        );
        expect(mutateAsync(useIngest as Mock)).toHaveBeenCalledWith([
            {
                name: 'Study A',
                doi: '10.1/test',
                pmid: '123',
                pmcid: 'PMC1',
                year: 2020,
                description: 'abstract',
                publication: 'Journal',
                authors: 'Author',
                level: 'group',
            },
        ]);
        expect(mutateAsync(useUpdateStudyset as Mock)).toHaveBeenCalledWith({
            studysetId: 'new-studyset',
            studyset: {
                studies: [{ id: 'study-version-1', curation_stub_uuid: 'stub-1' }],
            },
        });
        expect(mockUpdateExtractionMetadata).toHaveBeenCalledWith({
            studysetId: 'new-studyset',
            annotationId: 'new-annotation',
            studyStatusList: [{ id: 'study-version-1', status: EExtractionStatus.UNCATEGORIZED }],
        });
        expect(result.current.progress).toBe(100);
        expect(result.current.progressText).toBe('process complete');
        expect(result.current.isError).toBe(false);
    });

    it('reuses an existing studyset and annotation instead of creating them', async () => {
        (useProjectExtractionStudysetId as Mock).mockReturnValue('existing-studyset');
        (useProjectExtractionAnnotationId as Mock).mockReturnValue('existing-annotation');

        const { result } = renderHook(() => useInitExtraction());

        await act(async () => {
            await result.current.doExtraction(false);
        });

        expect(mutateAsync(useCreateStudyset as Mock)).not.toHaveBeenCalled();
        expect(mutateAsync(useCreateAnnotation as Mock)).not.toHaveBeenCalled();
        expect(mockUpdateExtractionMetadata).toHaveBeenCalledWith({
            studysetId: 'existing-studyset',
            annotationId: 'existing-annotation',
            studyStatusList: [{ id: 'study-version-1', status: EExtractionStatus.UNCATEGORIZED }],
        });
        expect(mutateAsync(useUpdateStudyset as Mock)).toHaveBeenCalledWith(
            expect.objectContaining({ studysetId: 'existing-studyset' })
        );
    });

    it('sets isError and returns false when initialization fails', async () => {
        (useCreateStudyset as Mock).mockReturnValue({
            mutateAsync: vi.fn().mockRejectedValue(new Error('create failed')),
        });

        const { result } = renderHook(() => useInitExtraction());

        let didInit = true;
        await act(async () => {
            didInit = await result.current.doExtraction(false);
        });

        expect(didInit).toBe(false);
        expect(result.current.isError).toBe(true);
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith('there was an error moving to extraction', {
            variant: 'error',
        });
        expect(mockUpdateExtractionMetadata).not.toHaveBeenCalled();
    });

    it('resets progress and error state', async () => {
        (useCreateStudyset as Mock).mockReturnValue({
            mutateAsync: vi.fn().mockRejectedValue(new Error('create failed')),
        });

        const { result } = renderHook(() => useInitExtraction());

        await act(async () => {
            await result.current.doExtraction(false);
        });
        expect(result.current.isError).toBe(true);

        act(() => {
            result.current.reset();
        });

        expect(result.current.isError).toBe(false);
        expect(result.current.progress).toBe(0);
        expect(result.current.progressText).toBe('creating studyset...');
    });

    it('marks ingested studies as completed when setStudiesAsComplete is true', async () => {
        const { result } = renderHook(() => useInitExtraction());

        await act(async () => {
            await result.current.doExtraction(true);
        });

        expect(mockUpdateExtractionMetadata).toHaveBeenCalledWith({
            studysetId: 'new-studyset',
            annotationId: 'new-annotation',
            studyStatusList: [{ id: 'study-version-1', status: EExtractionStatus.COMPLETED }],
        });
    });
});
