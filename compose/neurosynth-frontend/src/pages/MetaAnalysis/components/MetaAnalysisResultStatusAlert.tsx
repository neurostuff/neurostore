import { Alert } from '@mui/material';
import { getResultStatus } from 'helpers/MetaAnalysis.helpers';
import { MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import { useMemo, useState } from 'react';

const localStorageResultAlertKey = 'hide-meta-analysis-result-alert';

const MetaAnalysisResultStatusAlert: React.FC<{
    metaAnalysis?: MetaAnalysisReturn;
    metaAnalysisResult?: ResultReturn;
}> = ({ metaAnalysis, metaAnalysisResult }) => {
    const shouldHide = !!localStorage.getItem(`${localStorageResultAlertKey}-${metaAnalysis?.id}`);
    const [hideAlert, setHideAlert] = useState(shouldHide);

    const resultStatus = useMemo(() => {
        return getResultStatus(metaAnalysis, metaAnalysisResult);
    }, [metaAnalysis, metaAnalysisResult]);

    return (
        <>
            {!hideAlert && (
                <Alert
                    severity={resultStatus.severity}
                    color={resultStatus.color}
                    onClose={() => {
                        setHideAlert(true);
                        localStorage.setItem(`${localStorageResultAlertKey}-${metaAnalysis?.id}`, 'true');
                    }}
                    sx={{
                        padding: '4px 10px',
                        marginBottom: '1rem',
                        alignItems: 'center',
                    }}
                >
                    {resultStatus.statusText}
                </Alert>
            )}
        </>
    );
};

export default MetaAnalysisResultStatusAlert;
