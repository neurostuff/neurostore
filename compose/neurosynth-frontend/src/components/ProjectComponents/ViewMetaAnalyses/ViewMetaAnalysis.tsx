import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetMetaAnalysisResultById from 'hooks/requests/useGetMetaAnalysisResultById';
import { ColorOptions } from 'index';
import {
    MetaAnalysisReturn,
    NeurovaultFile,
    ResultReturn,
} from 'neurosynth-compose-typescript-sdk';
import { useHistory, useRouteMatch } from 'react-router-dom';

export const getResultStatus = (
    metaAnalysisObj: MetaAnalysisReturn,
    metaAnalysisResult: ResultReturn | undefined
): {
    statusText: string;
    color: ColorOptions | 'muted';
} => {
    if ((metaAnalysisObj.results || []).length === 0)
        return { statusText: 'Not yet run', color: 'muted' };

    if (!metaAnalysisResult)
        return {
            statusText: 'No result found',
            color: 'warning',
        };

    if (!metaAnalysisResult?.neurovault_collection?.collection_id)
        return { statusText: 'Latest Run Failed', color: 'error' };

    if (
        metaAnalysisResult.neurovault_collection?.files &&
        metaAnalysisResult.neurovault_collection.files.length === 0
    )
        return { statusText: 'No result found', color: 'warning' };

    const allFilesAreValid = (
        metaAnalysisResult.neurovault_collection.files as Array<NeurovaultFile>
    ).every((file) => !!file.image_id);
    if (!allFilesAreValid) return { statusText: 'Latest Run Failed', color: 'error' };

    if (!metaAnalysisObj.neurostore_analysis?.neurostore_id) {
        return { statusText: 'Latest Run Failed', color: 'error' };
    }

    return { statusText: 'Run sucessful', color: 'success' };
};

const ViewMetaAnalysis: React.FC<MetaAnalysisReturn> = (props) => {
    const { created_at, results, name, description, id } = props;

    const {
        data: metaAnalysisResult,
        isLoading: getMetaAnalysisResultIsLoading,
        isError: getMetaAnalysisResultIsError,
    } = useGetMetaAnalysisResultById(
        results && results.length ? (results[results.length - 1] as ResultReturn).id : undefined
    );

    console.log({
        props,
        metaAnalysisResult,
    });

    const path = useRouteMatch();
    const history = useHistory();

    const date = new Date(created_at || '');
    const isLocked = (results?.length || 0) > 0;

    const handleUpdate = (id?: string) => {
        if (!id) return;
        history.push(`${path.url}/${id}`);
    };

    const resultStatus = getResultStatus(props, metaAnalysisResult);

    return (
        <Card
            sx={{
                flex: '0 1 23%',
                margin: '10px 1%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
            }}
        >
            <CardContent>
                <StateHandlerComponent
                    isError={getMetaAnalysisResultIsError}
                    isLoading={getMetaAnalysisResultIsLoading}
                >
                    <Box>
                        <Typography
                            variant="body2"
                            sx={{ color: 'muted.main', marginBottom: '5px' }}
                        >
                            {`${date.toLocaleDateString()} ${date.toLocaleTimeString()}`}
                        </Typography>
                        <Typography color={`${resultStatus.color}.main`} variant="body2">
                            {resultStatus.statusText}
                        </Typography>
                    </Box>

                    <Box sx={{ marginTop: '5px' }}>
                        <Typography variant="h6">{name || ''}</Typography>
                        <Typography>{description || ''}</Typography>
                    </Box>
                </StateHandlerComponent>
            </CardContent>
            <CardActions>
                <Button sx={{ width: '100%' }} onClick={() => handleUpdate(id)}>
                    {isLocked ? 'view' : 'view and edit'}
                </Button>
            </CardActions>
        </Card>
    );
};

export default ViewMetaAnalysis;
