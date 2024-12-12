import { Alert } from '@mui/material';
import { getResultStatus } from 'helpers/MetaAnalysis.helpers';
import { MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import { useEffect, useMemo, useState } from 'react';

const localStorageResultAlertKey = 'hide-meta-analysis-result-alert';

const MetaAnalysisResultStatusAlert: React.FC<{
    metaAnalysis?: MetaAnalysisReturn;
    metaAnalysisResult?: ResultReturn;
}> = ({ metaAnalysis, metaAnalysisResult }) => {
    const resultStatus = useMemo(() => {
        return getResultStatus(metaAnalysis, metaAnalysisResult);
    }, [metaAnalysis, metaAnalysisResult]);

    const [hideAlert, setHideAlert] = useState<boolean>();

    useEffect(() => {
        if (!resultStatus || !metaAnalysis?.id) return;
        const shouldHide = !!localStorage.getItem(
            `${localStorageResultAlertKey}-${resultStatus.severity}-${metaAnalysis?.id}`
        );
        setHideAlert(shouldHide);
    }, [metaAnalysis?.id, resultStatus]);

    if (hideAlert === undefined) return null;

    return (
        <>
            {!hideAlert && (
                <Alert
                    severity={resultStatus.severity}
                    color={resultStatus.color}
                    onClose={() => {
                        setHideAlert(true);
                        localStorage.setItem(
                            `${localStorageResultAlertKey}-${resultStatus?.severity}-${metaAnalysis?.id}`,
                            'true'
                        );
                    }}
                    sx={{
                        padding: '4px 10px',
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
