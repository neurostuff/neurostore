import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetMetaAnalysisResultById from 'hooks/metaAnalyses/useGetMetaAnalysisResultById';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { ColorOptions } from 'index';
import {
    MetaAnalysisReturn,
    NeurovaultFile,
    ResultReturn,
} from 'neurosynth-compose-typescript-sdk';
import { useProjectUser } from 'pages/Projects/ProjectPage/ProjectStore';
import { useNavigate } from 'react-router-dom';

export const getResultStatus = (
    metaAnalysisObj: MetaAnalysisReturn | undefined,
    metaAnalysisResult: ResultReturn | undefined
): {
    statusText: string;
    color: ColorOptions | 'muted';
} => {
    if ((metaAnalysisObj?.results || []).length === 0)
        return { statusText: 'No run detected', color: 'muted' };

    if (!metaAnalysisResult)
        return {
            statusText: 'No result found',
            color: 'warning',
        };

    if (!metaAnalysisResult?.neurovault_collection?.collection_id)
        return { statusText: 'Run complete but Neurovault upload failed', color: 'error' };

    if (
        metaAnalysisResult.neurovault_collection?.files &&
        metaAnalysisResult.neurovault_collection.files.length === 0
    )
        return { statusText: 'No result found', color: 'warning' };

    const allFilesAreValid = (
        metaAnalysisResult.neurovault_collection.files as Array<NeurovaultFile>
    ).every((file) => !!file.image_id);
    if (!allFilesAreValid) return { statusText: 'Latest Run Failed', color: 'error' };

    if (!metaAnalysisObj?.neurostore_analysis?.neurostore_id) {
        return { statusText: 'Run complete but Neurostore upload failed', color: 'error' };
    }

    return { statusText: 'Run successful', color: 'success' };
};

const ViewMetaAnalysis: React.FC<MetaAnalysisReturn> = (props) => {
    const { created_at, results, name, description, id, project } = props;
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const {
        data: metaAnalysisResult,
        isLoading: getMetaAnalysisResultIsLoading,
        isError: getMetaAnalysisResultIsError,
    } = useGetMetaAnalysisResultById(
        results && results.length ? (results[results.length - 1] as ResultReturn).id : undefined
    );

    const navigate = useNavigate();

    const date = new Date(created_at || '');
    const isLocked = (results?.length || 0) > 0;

    const handleUpdate = () => {
        if (!id || !project) return;

        navigate(`/projects/${project}/meta-analyses/${id}`);
    };

    const resultStatus = getResultStatus(props, metaAnalysisResult);

    return (
        <Card
            sx={{
                flex: '0 1',
                flexBasis: 'calc(94% / 3)',
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
                        <Typography variant="h6" gutterBottom>
                            {name || ''}
                        </Typography>
                        <Typography sx={{ color: 'muted.main' }}>{description || ''}</Typography>
                    </Box>
                </StateHandlerComponent>
            </CardContent>
            <CardActions>
                <Button sx={{ width: '100%' }} onClick={handleUpdate}>
                    {isLocked || !canEdit ? 'view' : 'view and edit'}
                </Button>
            </CardActions>
        </Card>
    );
};

export default ViewMetaAnalysis;
