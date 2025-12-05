import {
    MetaAnalysisJobResponse,
    MetaAnalysisReturn,
    NeurovaultFile,
    ResultReturn,
} from 'neurosynth-compose-typescript-sdk';

interface MetaAnalysisResultStatus {
    statusText: string;
    status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'SUBMITTED' | 'UNKNOWN' | 'NONE';
    color: 'success' | 'info' | 'warning' | 'error';
    severity: 'success' | 'info' | 'warning' | 'error';
    description?: string;
}

const getMetaAnalysisJobStatus = (job: MetaAnalysisJobResponse | undefined): MetaAnalysisResultStatus => {
    if (job?.status === 'SUCCEEDED') {
        return {
            status: 'SUCCESS',
            statusText: 'Run successful',
            color: 'success',
            severity: 'success',
        };
    } else if (job?.status === 'FAILED') {
        return {
            status: 'FAILED',
            statusText: 'Run failed',
            color: 'error',
            severity: 'error',
        };
    } else if (job?.status === 'RUNNING') {
        return {
            status: 'RUNNING',
            statusText: 'Run in progress',
            color: 'info',
            severity: 'info',
        };
    } else if (job?.status === 'SUBMITTED') {
        return {
            statusText: 'Job submitted',
            status: 'SUBMITTED',
            color: 'info',
            severity: 'info',
        };
    }
    return {
        statusText: 'Unknown status',
        status: 'UNKNOWN',
        color: 'error',
        severity: 'error',
    };
};

const getMetaAnalysisResultStatus = (
    metaAnalysisObj: MetaAnalysisReturn | undefined,
    result: ResultReturn | undefined
): MetaAnalysisResultStatus => {
    if (!result?.neurovault_collection?.collection_id)
        return {
            statusText: 'Run complete but Neurovault upload failed',
            status: 'SUCCESS',
            color: 'warning',
            severity: 'warning',
        };

    if (result.neurovault_collection?.files && result.neurovault_collection.files.length === 0)
        return {
            statusText: 'Detected run but no result found',
            status: 'FAILED',
            color: 'warning',
            severity: 'warning',
        };

    const allFilesAreValid = (result.neurovault_collection.files as Array<NeurovaultFile>).every(
        (file) => !!file.image_id
    );
    if (!allFilesAreValid)
        return { statusText: 'Latest Run Failed', status: 'FAILED', color: 'error', severity: 'error' };

    if (!metaAnalysisObj?.neurostore_analysis?.neurostore_id) {
        return {
            statusText: 'Run complete but Neurostore upload failed',
            status: 'FAILED',
            color: 'error',
            severity: 'error',
        };
    }

    return { statusText: 'Run successful', status: 'SUCCESS', color: 'success', severity: 'success' };
};

export const getResultStatus = (
    metaAnalysisObj: MetaAnalysisReturn | undefined,
    latestMetaAnalysisResult: ResultReturn | undefined,
    latestMetaAnalysisJob: MetaAnalysisJobResponse | undefined
): {
    statusText: string;
    color: 'success' | 'info' | 'warning' | 'error';
    severity: 'success' | 'info' | 'warning' | 'error';
    description?: string;
    status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'SUBMITTED' | 'UNKNOWN' | 'NONE';
} => {
    if (!latestMetaAnalysisJob && !latestMetaAnalysisResult) {
        return {
            statusText: 'No run detected',
            status: 'NONE',
            description:
                'If you are running a meta-analysis via google colab, you will not be able to see the progress here until it has completed',
            color: 'info',
            severity: 'info',
        };
    } else if (latestMetaAnalysisJob && !latestMetaAnalysisResult) {
        return getMetaAnalysisJobStatus(latestMetaAnalysisJob);
    } else if (!latestMetaAnalysisJob && latestMetaAnalysisResult) {
        return getMetaAnalysisResultStatus(metaAnalysisObj, latestMetaAnalysisResult);
    } else {
        if (
            latestMetaAnalysisJob?.created_at &&
            latestMetaAnalysisResult?.created_at &&
            latestMetaAnalysisJob.created_at > latestMetaAnalysisResult.created_at
        ) {
            return getMetaAnalysisJobStatus(latestMetaAnalysisJob);
        } else {
            return getMetaAnalysisResultStatus(metaAnalysisObj, latestMetaAnalysisResult);
        }
    }
};
