import { AnalysisReturn, PointReturn } from 'neurostore-typescript-sdk';
import {
    DefaultMapTypes,
    DefaultSpaceTypes,
    getEmptyStudy,
    getPointWarnings,
    allPointsHaveCoordinates,
    isCoordinateMNI,
    IStoreAnalysis,
    IStorePoint,
    pointHasInvalidEntry,
    pointHasNonNumericValue,
    pointIsMissingCoordinate,
    pointIsOutOfBounds,
    pointIsUnset,
    storeAnalysesToStudyAnalyses,
    studyAnalysesToStoreAnalyses,
    studyPointsToStorePoints,
} from 'stores/study/StudyStore.helpers';

describe('isCoordinateMNI', () => {
    it('returns true for coordinates within MNI bounds', () => {
        expect(isCoordinateMNI(0, 0, 0)).toBe(true);
        expect(isCoordinateMNI(12, -18, 22)).toBe(true);
        expect(isCoordinateMNI(-40, -68, -20)).toBe(true);
        expect(isCoordinateMNI(90, 90, 108)).toBe(true);
        expect(isCoordinateMNI(-90, -126, -72)).toBe(true);
    });

    it('returns false for x outside bounds', () => {
        expect(isCoordinateMNI(91, 0, 0)).toBe(false);
        expect(isCoordinateMNI(-91, 0, 0)).toBe(false);
    });

    it('returns false for y outside bounds', () => {
        expect(isCoordinateMNI(0, 91, 0)).toBe(false);
        expect(isCoordinateMNI(0, -127, 0)).toBe(false);
    });

    it('returns false for z outside bounds', () => {
        expect(isCoordinateMNI(0, 0, 109)).toBe(false);
        expect(isCoordinateMNI(0, 0, -73)).toBe(false);
    });
});

/** Table cells can still hold text the user typed. */
const tablePoint = (overrides: Record<string, unknown>) => overrides as Partial<IStorePoint>;

describe('pointIsOutOfBounds', () => {
    it('flags coordinates outside the MNI box and treats blanks as the origin', () => {
        expect(pointIsOutOfBounds({ x: 91, y: 0, z: 0 })).toBe(true);
        expect(pointIsOutOfBounds({ x: 0, y: 0, z: 0 })).toBe(false);
        expect(pointIsOutOfBounds({})).toBe(false);
    });

    it('does not flag non-numeric coordinates', () => {
        expect(pointIsOutOfBounds(tablePoint({ x: 'left', y: 0, z: 0 }))).toBe(false);
    });
});

describe('pointHasNonNumericValue', () => {
    it('accepts numbers, numeric text, and blanks', () => {
        expect(pointHasNonNumericValue(tablePoint({ x: 1, y: '-2.5', z: ' ', value: null }))).toBe(false);
    });

    it('flags text and booleans in numeric fields', () => {
        expect(pointHasNonNumericValue(tablePoint({ x: 'left' }))).toBe(true);
        expect(pointHasNonNumericValue(tablePoint({ cluster_size: true }))).toBe(true);
    });

    it('ignores subpeak and deactivation', () => {
        expect(pointHasNonNumericValue(tablePoint({ subpeak: true, deactivation: false }))).toBe(false);
    });
});

describe('pointHasInvalidEntry', () => {
    it('accepts numbers, booleans, and blanks', () => {
        expect(
            pointHasInvalidEntry(tablePoint({ x: 1, value: '2', subpeak: true, deactivation: null, cluster_size: '' }))
        ).toBe(false);
    });

    it('flags text in a number column and a non-boolean in a checkbox column', () => {
        expect(pointHasInvalidEntry(tablePoint({ value: 'high' }))).toBe(true);
        expect(pointHasInvalidEntry(tablePoint({ deactivation: 'no' }))).toBe(true);
    });
});

const unsetPoint = (overrides: Record<string, unknown> = {}) =>
    tablePoint({
        x: undefined,
        y: undefined,
        z: undefined,
        subpeak: undefined,
        cluster_size: undefined,
        ...overrides,
    });

describe('pointIsMissingCoordinate', () => {
    it('is missing when any coordinate is undefined', () => {
        expect(pointIsMissingCoordinate(tablePoint({}))).toBe(true);
        expect(pointIsMissingCoordinate(tablePoint({ x: 1, y: 2 }))).toBe(true);
        expect(pointIsMissingCoordinate(tablePoint({ x: 1, y: 2, z: undefined }))).toBe(true);
    });

    it('is present when x, y, and z are set, including zero', () => {
        expect(pointIsMissingCoordinate(tablePoint({ x: 0, y: 0, z: 0 }))).toBe(false);
        expect(pointIsMissingCoordinate(tablePoint({ x: 1, y: 2, z: 3, value: undefined }))).toBe(false);
    });
});

describe('allPointsHaveCoordinates', () => {
    it('is false when the list is empty or any point is missing a coordinate', () => {
        expect(allPointsHaveCoordinates([])).toBe(false);
        expect(allPointsHaveCoordinates([tablePoint({ x: 1, y: 2 })])).toBe(false);
        expect(allPointsHaveCoordinates([tablePoint({}), tablePoint({ x: 1, y: 2, z: 3 })])).toBe(false);
    });

    it('is true when every point has x, y, and z', () => {
        expect(allPointsHaveCoordinates([tablePoint({ x: 0, y: 0, z: 0 })])).toBe(true);
        expect(
            allPointsHaveCoordinates([tablePoint({ x: 0, y: 0, z: 0 }), tablePoint({ x: 1, y: 2, z: 3 })])
        ).toBe(true);
    });
});

describe('pointIsUnset', () => {
    it('is unset only when coordinates, value, subpeak, cluster size, and deactivation are all undefined', () => {
        expect(pointIsUnset(unsetPoint())).toBe(true);
        expect(pointIsUnset(unsetPoint({ deactivation: true }))).toBe(false);
        expect(pointIsUnset(unsetPoint({ deactivation: false }))).toBe(false);
        expect(pointIsUnset(unsetPoint({ x: 0 }))).toBe(false);
        expect(pointIsUnset(unsetPoint({ value: 0 }))).toBe(false);
        expect(pointIsUnset(unsetPoint({ subpeak: false }))).toBe(false);
        expect(pointIsUnset(unsetPoint({ cluster_size: 0 }))).toBe(false);
    });
});

describe('getPointWarnings', () => {
    const asPoint = (overrides: Record<string, unknown>) => tablePoint(overrides) as IStorePoint;

    it('reports empty, non-MNI, and invalid rows independently', () => {
        expect(getPointWarnings([])).toEqual({
            hasEmptyPoints: false,
            hasNonMNICoordinates: false,
            hasInvalidEntries: false,
        });
        expect(
            getPointWarnings([
                asPoint({ x: 1, y: 2, z: undefined }),
                asPoint({ x: 91, y: 0, z: 0 }),
                asPoint({ x: 1, y: 2, z: 3, value: 'high' }),
            ])
        ).toEqual({
            hasEmptyPoints: true,
            hasNonMNICoordinates: true,
            hasInvalidEntries: true,
        });
    });

    it('treats a non-numeric coordinate as an invalid entry, not an out-of-bounds point', () => {
        expect(getPointWarnings([asPoint({ x: 'left', y: 0, z: 0 })])).toEqual({
            hasEmptyPoints: false,
            hasNonMNICoordinates: false,
            hasInvalidEntries: true,
        });
    });
});

describe('storeAnalysesToStudyAnalyses placeholder points', () => {
    const analysis = (points: Partial<IStorePoint>[], overrides: Partial<IStoreAnalysis> = {}): IStoreAnalysis =>
        ({
            name: 'analysis',
            isNew: true,
            conditions: [],
            points,
            pointSpace: undefined,
            pointStatistic: undefined,
            ...overrides,
        }) as IStoreAnalysis;

    it('drops a single new row with nothing entered', () => {
        const [result] = storeAnalysesToStudyAnalyses([analysis([unsetPoint({ isNew: true, value: undefined })])]);
        expect(result.points).toEqual([]);
    });

    it('keeps a row that has a statistic value', () => {
        const [result] = storeAnalysesToStudyAnalyses([
            analysis([unsetPoint({ isNew: true, value: 1, id: 'point-1' })]),
        ]);

        expect(result.points).toHaveLength(1);
    });

    it('drops a saved row when every checked field is still unset', () => {
        const [result] = storeAnalysesToStudyAnalyses([
            analysis([unsetPoint({ isNew: false, value: undefined, id: 'point-2' })]),
        ]);

        expect(result.points).toEqual([]);
    });

    it('scrubs new ids and maps space, statistic, and point fields', () => {
        const [result] = storeAnalysesToStudyAnalyses([
            analysis(
                [
                    unsetPoint({
                        isNew: true,
                        id: 'temp-point',
                        analysis: 'analysis-id',
                        image: 'image-id',
                        x: 1,
                        y: 2,
                        z: 3,
                        value: 4,
                        subpeak: true,
                        cluster_size: 5,
                        deactivation: false,
                    }),
                ],
                {
                    isNew: true,
                    id: 'temp-analysis',
                    name: 'Named',
                    description: 'desc',
                    pointSpace: { value: 'MNI', label: 'MNI' },
                    pointStatistic: { value: 'Z', label: 'Z Map' },
                    conditions: [
                        { isNew: true, id: 'temp-condition', name: 'new cond', description: 'd1' },
                        { isNew: false, id: 'saved-condition', name: 'saved cond', description: 'd2' },
                    ],
                }
            ),
        ]);

        expect(result.id).toBeUndefined();
        expect(result.order).toBe(1);
        expect(result.conditions).toEqual([
            { id: undefined, name: 'new cond', description: 'd1' },
            { id: 'saved-condition', name: 'saved cond', description: 'd2' },
        ]);
        expect(result.points).toEqual([
            {
                analysis: 'analysis-id',
                id: undefined,
                image: 'image-id',
                order: 0,
                space: 'MNI',
                subpeak: true,
                x: 1,
                y: 2,
                z: 3,
                values: [{ value: 4, kind: 'Z' }],
                cluster_size: 5,
                deactivation: false,
            },
        ]);
    });

    it('sends null for blank optional fields on a new point and leaves them unset on a saved point', () => {
        const [created] = storeAnalysesToStudyAnalyses([
            analysis([unsetPoint({ isNew: true, id: 'new', x: 1, y: 2, z: 3 })]),
        ]);
        const [saved] = storeAnalysesToStudyAnalyses([
            analysis([unsetPoint({ isNew: false, id: 'saved', x: 1, y: 2, z: 3 })], {
                isNew: false,
                id: 'analysis-id',
            }),
        ]);

        expect(created.points?.[0]).toMatchObject({
            id: undefined,
            space: null,
            subpeak: null,
            cluster_size: null,
            deactivation: null,
            values: [{ value: null, kind: null }],
        });
        expect(saved.id).toBe('analysis-id');
        expect(saved.points?.[0]).toMatchObject({
            id: 'saved',
            space: undefined,
            subpeak: undefined,
            cluster_size: undefined,
            deactivation: undefined,
            values: [{ value: undefined, kind: undefined }],
        });
    });

    it('numbers analyses from 1 in list order', () => {
        const results = storeAnalysesToStudyAnalyses([
            analysis([], { name: 'first', isNew: false, id: 'a' }),
            analysis([], { name: 'second', isNew: false, id: 'b' }),
        ]);

        expect(results.map((item) => [item.id, item.order])).toEqual([
            ['a', 1],
            ['b', 2],
        ]);
    });
});

describe('studyPointsToStorePoints', () => {
    it('returns no points when the analysis has none', () => {
        expect(studyPointsToStorePoints([], false)).toEqual({
            points: [],
            analysisMap: undefined,
            analysisSpace: undefined,
        });
    });

    it('creates one blank new point when asked to init an empty list', () => {
        const { points, analysisMap, analysisSpace } = studyPointsToStorePoints([], true);

        expect(analysisMap).toBeUndefined();
        expect(analysisSpace).toBeUndefined();
        expect(points).toHaveLength(1);
        expect(points[0]).toMatchObject({
            isNew: true,
            x: undefined,
            y: undefined,
            z: undefined,
            value: undefined,
            subpeak: undefined,
            cluster_size: undefined,
            deactivation: undefined,
        });
        expect(points[0].id).toEqual(expect.any(String));
    });

    it('uses the first point space and statistic, then sorts rows by order', () => {
        const { points, analysisMap, analysisSpace } = studyPointsToStorePoints(
            [
                {
                    id: 'later',
                    order: 2,
                    coordinates: [4, 5, 6],
                    space: 'TAL',
                    subpeak: false,
                    cluster_size: 8,
                    deactivation: true,
                    values: [{ kind: 'T', value: 9 }],
                },
                {
                    id: 'first',
                    order: 0,
                    coordinates: [1, 2, 3],
                    space: 'MNI',
                    subpeak: null,
                    cluster_size: null,
                    deactivation: null,
                    values: [{ kind: 'Z', value: 1.5 }],
                },
            ] as PointReturn[],
            false
        );

        expect(analysisSpace).toEqual(DefaultSpaceTypes.TAL);
        expect(analysisMap).toEqual(DefaultMapTypes.T);
        expect(points.map((point) => point.id)).toEqual(['first', 'later']);
        expect(points[0]).toMatchObject({
            x: 1,
            y: 2,
            z: 3,
            isNew: false,
            value: 1.5,
            subpeak: undefined,
            cluster_size: undefined,
            deactivation: undefined,
        });
        expect(points[1]).toMatchObject({
            x: 4,
            y: 5,
            z: 6,
            value: 9,
            subpeak: false,
            cluster_size: 8,
            deactivation: true,
        });
    });

    it('uses Other when space or statistic kind is unknown', () => {
        const { analysisMap, analysisSpace, points } = studyPointsToStorePoints(
            [{ id: 'p', space: 'NATIVE', values: [{ kind: 'CUSTOM', value: 1 }] }] as PointReturn[],
            false
        );

        expect(analysisSpace).toEqual(DefaultSpaceTypes.OTHER);
        expect(analysisMap).toEqual(DefaultMapTypes.OTHER);
        expect(points[0]).toMatchObject({ x: undefined, y: undefined, z: undefined, value: 1, isNew: false });
    });
});

describe('studyAnalysesToStoreAnalyses', () => {
    it('sorts analyses, marks saved rows, and copies point space from the points', () => {
        const analyses = studyAnalysesToStoreAnalyses([
            {
                id: 'a2',
                name: 'second',
                order: 2,
                entities: [{ label: 'entity' }],
                conditions: [{ id: 'c', name: 'cond', description: 'd' }],
                points: [{ id: 'p', coordinates: [1, 2, 3], space: 'TAL', values: [{ kind: 'T', value: 2 }] }],
            },
            {
                id: 'a1',
                name: 'first',
                order: 1,
                conditions: [],
                points: [],
            },
        ] as AnalysisReturn[]);

        expect(analyses.map((item) => item.id)).toEqual(['a1', 'a2']);
        expect(analyses[0]).toMatchObject({
            isNew: false,
            points: [],
            pointSpace: undefined,
            pointStatistic: undefined,
        });
        expect(analyses[1].conditions[0]).toMatchObject({ id: 'c', isNew: false });
        expect(analyses[1].pointSpace).toEqual(DefaultSpaceTypes.TAL);
        expect(analyses[1].pointStatistic).toEqual(DefaultMapTypes.T);
        expect(analyses[1].points[0]).toMatchObject({ x: 1, y: 2, z: 3, value: 2, isNew: false });
        expect(analyses[1]).not.toHaveProperty('entities');
    });

    it('adds a blank point when an analysis has none and init is requested', () => {
        const [analysis] = studyAnalysesToStoreAnalyses(
            [{ id: 'a', name: 'empty', points: [], conditions: [] }] as AnalysisReturn[],
            true
        );

        expect(analysis.points).toHaveLength(1);
        expect(analysis.points[0]).toMatchObject({ isNew: true, x: undefined, y: undefined, z: undefined });
    });
});

describe('getEmptyStudy', () => {
    it('returns a study with no metadata and no analyses', () => {
        expect(getEmptyStudy()).toEqual({
            id: undefined,
            base_study: undefined,
            name: undefined,
            description: undefined,
            doi: undefined,
            pmid: undefined,
            pmcid: undefined,
            authors: undefined,
            year: undefined,
            publication: undefined,
            public: undefined,
            metadata: [],
            analyses: [],
            studysets: [],
            user: undefined,
            username: undefined,
            source: undefined,
            source_id: undefined,
            source_updated_at: undefined,
            created_at: undefined,
            updated_at: undefined,
        });
    });
});
