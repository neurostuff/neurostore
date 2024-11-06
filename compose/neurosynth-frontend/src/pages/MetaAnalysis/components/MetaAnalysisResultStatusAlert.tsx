import { Alert } from '@mui/material';
import { getResultStatus } from 'helpers/MetaAnalysis.helpers';
import { MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import { useMemo } from 'react';

const MetaAnalysisResultStatusAlert: React.FC<{
    metaAnalysis?: MetaAnalysisReturn;
    metaAnalysisResult?: ResultReturn;
}> = ({ metaAnalysis, metaAnalysisResult }) => {
    const resultStatus = useMemo(() => {
        return getResultStatus(metaAnalysis, metaAnalysisResult);
    }, [metaAnalysis, metaAnalysisResult]);

    return (
        <Alert
            severity={resultStatus.severity}
            color={resultStatus.color}
            sx={{
                padding: '4px 10px',
                marginBottom: '1rem',
            }}
        >
            {resultStatus.statusText}
        </Alert>
    );
};

export default MetaAnalysisResultStatusAlert;
