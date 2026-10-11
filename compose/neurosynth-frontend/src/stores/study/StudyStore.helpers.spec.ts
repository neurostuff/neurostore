import { AnalysisReturn } from 'neurostore-typescript-sdk';
import { describe, expect, it } from 'vitest';
import { storeAnalysesToStudyAnalyses, studyAnalysesToStoreAnalyses } from './StudyStore.helpers';

describe('StudyStore helpers', () => {
    const analysis = {
        id: 'anc-id',
        name: 'anc',
        study: 'pipeline-study',
        order: 1,
        conditions: [],
        weights: [],
        images: [],
        points: [{ id: 'p1', x: 2, y: 2, z: 2, space: 'MNI', values: [], order: 0 }],
        role: 'anchor',
        relabelled_by: 'revision-parse',
        outcome: null,
        from_prior_study: false,
        source_id: 'parent-id',
    } as unknown as AnalysisReturn;

    it('sends back the role, outcome and source link it loaded', () => {
        const [sent] = storeAnalysesToStudyAnalyses(studyAnalysesToStoreAnalyses([analysis])) as Record<
            string,
            unknown
        >[];
        expect(sent).toMatchObject({
            id: 'anc-id',
            role: 'anchor',
            relabelled_by: 'revision-parse',
            outcome: null,
            from_prior_study: false,
            source_id: 'parent-id',
        });
    });

    it('leaves out the fields an analysis was loaded without', () => {
        const { role, relabelled_by, outcome, from_prior_study, source_id, ...bare } = analysis as unknown as Record<
            string,
            unknown
        >;
        const [sent] = storeAnalysesToStudyAnalyses(
            studyAnalysesToStoreAnalyses([bare as unknown as AnalysisReturn])
        ) as Record<string, unknown>[];
        for (const field of ['role', 'relabelled_by', 'outcome', 'from_prior_study', 'source_id']) {
            expect(sent).not.toHaveProperty(field);
        }
    });
});
