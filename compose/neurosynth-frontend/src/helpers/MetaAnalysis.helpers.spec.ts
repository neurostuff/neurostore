import { getResultStatus } from 'helpers/MetaAnalysis.helpers';
import { MetaAnalysisJobResponse, MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';

const metaAnalysis = {
    neurostore_analysis: { neurostore_id: 'ns-1' },
} as MetaAnalysisReturn;

const successfulResult = {
    created_at: '2024-01-02T00:00:00.000Z',
    neurovault_collection: {
        collection_id: '1',
        files: [{ image_id: '10' }],
    },
} satisfies ResultReturn;

const job = (status: string, createdAt = '2024-01-01T00:00:00.000Z') =>
    ({ status, created_at: createdAt }) as MetaAnalysisJobResponse;

describe('getResultStatus', () => {
    it('reports that no run was detected when there is no job or result', () => {
        expect(getResultStatus(metaAnalysis, undefined, undefined)).toEqual({
            statusText: 'No run detected',
            status: 'NONE',
            description:
                'If you are running a meta-analysis via google colab, you will not be able to see the progress here until it has completed',
            color: 'info',
            severity: 'info',
        });
    });

    it.each([
        ['SUCCEEDED', { statusText: 'Run successful', status: 'SUCCESS', color: 'success', severity: 'success' }],
        ['FAILED', { statusText: 'Run failed', status: 'FAILED', color: 'error', severity: 'error' }],
        ['RUNNING', { statusText: 'Run in progress', status: 'RUNNING', color: 'info', severity: 'info' }],
        ['SUBMITTED', { statusText: 'Job submitted', status: 'SUBMITTED', color: 'info', severity: 'info' }],
        ['QUEUED', { statusText: 'Unknown status', status: 'UNKNOWN', color: 'error', severity: 'error' }],
    ] as const)('describes a %s job', (status, expected) => {
        expect(getResultStatus(metaAnalysis, undefined, job(status))).toEqual(expected);
    });

    it('describes a completed result', () => {
        expect(getResultStatus(metaAnalysis, successfulResult, undefined)).toEqual({
            statusText: 'Run successful',
            status: 'SUCCESS',
            color: 'success',
            severity: 'success',
        });
    });

    it('describes a result whose neurovault upload failed', () => {
        expect(
            getResultStatus(metaAnalysis, { ...successfulResult, neurovault_collection: { files: [] } }, undefined)
        ).toEqual({
            statusText: 'Run complete but Neurovault upload failed',
            status: 'SUCCESS',
            color: 'warning',
            severity: 'warning',
        });
    });

    it('describes a result with an empty neurovault collection', () => {
        expect(
            getResultStatus(
                metaAnalysis,
                {
                    ...successfulResult,
                    neurovault_collection: { collection_id: '1', files: [] },
                },
                undefined
            )
        ).toEqual({
            statusText: 'Detected run but no result found',
            status: 'FAILED',
            color: 'warning',
            severity: 'warning',
        });
    });

    it('describes a result whose neurovault files are invalid', () => {
        expect(
            getResultStatus(
                metaAnalysis,
                {
                    ...successfulResult,
                    neurovault_collection: { collection_id: '1', files: [{ image_id: null }] },
                },
                undefined
            )
        ).toEqual({
            statusText: 'Latest Run Failed',
            status: 'FAILED',
            color: 'error',
            severity: 'error',
        });
    });

    it('describes a result whose neurostore upload failed', () => {
        expect(getResultStatus({} as MetaAnalysisReturn, successfulResult, undefined)).toEqual({
            statusText: 'Run complete but Neurostore upload failed',
            status: 'FAILED',
            color: 'error',
            severity: 'error',
        });
    });

    it('uses the job when it is newer than the result', () => {
        expect(getResultStatus(metaAnalysis, successfulResult, job('RUNNING', '2024-02-01T00:00:00.000Z'))).toEqual({
            statusText: 'Run in progress',
            status: 'RUNNING',
            color: 'info',
            severity: 'info',
        });
    });

    it('shows failed when the latest job failed, even if a result is newer', () => {
        expect(getResultStatus(metaAnalysis, successfulResult, job('FAILED', '2024-01-01T00:00:00.000Z'))).toEqual({
            statusText: 'Run failed',
            status: 'FAILED',
            color: 'error',
            severity: 'error',
        });
    });

    it('uses the result when it is newer than or as new as a job that did not fail', () => {
        expect(getResultStatus(metaAnalysis, successfulResult, job('RUNNING', successfulResult.created_at))).toEqual({
            statusText: 'Run successful',
            status: 'SUCCESS',
            color: 'success',
            severity: 'success',
        });
    });
});
