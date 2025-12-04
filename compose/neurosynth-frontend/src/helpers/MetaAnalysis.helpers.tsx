import {
    MetaAnalysisJobResponse,
    MetaAnalysisReturn,
    NeurovaultFile,
    ResultReturn,
} from 'neurosynth-compose-typescript-sdk';

export const getResultStatus = (
    metaAnalysisObj: MetaAnalysisReturn | undefined,
    metaAnalysisResult: ResultReturn | undefined,
    metaAnalysisJobs: Array<MetaAnalysisJobResponse> | undefined
): {
    statusText: string;
    color: 'success' | 'info' | 'warning' | 'error';
    severity: 'success' | 'info' | 'warning' | 'error';
} => {
    if ((metaAnalysisObj?.results || []).length === 0 && (metaAnalysisJobs || []).length === 0)
        return { statusText: 'No run detected', color: 'info', severity: 'info' };

    if ((metaAnalysisJobs || []).length > 0) {
        return {
            statusText: 'Run in progress',
            color: 'info',
            severity: 'info',
        };
    }

    if (!metaAnalysisResult)
        return {
            statusText: 'No result found. Run may be in progress',
            color: 'warning',
            severity: 'info',
        };

    if (!metaAnalysisResult?.neurovault_collection?.collection_id)
        return {
            statusText: 'Run complete but Neurovault upload failed',
            color: 'error',
            severity: 'error',
        };

    if (metaAnalysisResult.neurovault_collection?.files && metaAnalysisResult.neurovault_collection.files.length === 0)
        return {
            statusText: 'Detected run but no result found',
            color: 'warning',
            severity: 'warning',
        };

    const allFilesAreValid = (metaAnalysisResult.neurovault_collection.files as Array<NeurovaultFile>).every(
        (file) => !!file.image_id
    );
    if (!allFilesAreValid) return { statusText: 'Latest Run Failed', color: 'error', severity: 'error' };

    if (!metaAnalysisObj?.neurostore_analysis?.neurostore_id) {
        return {
            statusText: 'Run complete but Neurostore upload failed',
            color: 'error',
            severity: 'error',
        };
    }

    return { statusText: 'Run successful', color: 'success', severity: 'success' };
};
