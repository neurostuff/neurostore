import { Box, Typography, Paper, Button } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import {
    EAnalysisType,
    IMetaAnalysisComponents,
    IEstimatorCorrectorArgs,
} from 'pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import DynamicInputDisplay from './DynamicInputDisplay/DynamicInputDisplay';
import MetaAnalysisSummaryRow from './MetaAnalysisSummaryRow/MetaAnalysisSummaryRow';
import MetaAnalysisFinalizeStyles from './MetaAnalysisFinalize.styles';
import { useCreateMetaAnalysis } from 'hooks';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { useSnackbar } from 'notistack';
interface IMetaAnalysisFinalize extends IMetaAnalysisComponents, IEstimatorCorrectorArgs {
    onNavigate: (button: ENavigationButton) => void;
}

export const getAnalysisTypeDescription = (name: string | undefined): string => {
    switch (name) {
        case EAnalysisType.CBMA:
            return 'Coordinate Based Meta-Analysis';
        case EAnalysisType.IBMA:
            return 'Image Based Meta-Analysis';
        default:
            return '';
    }
};

const MetaAnalysisFinalize: React.FC<IMetaAnalysisFinalize> = (props) => {
    // const { createMetaAnalysis, isLoading } = useCreateMetaAnalysis();
    const history = useHistory();
    const hasCorrector = !!props.corrector;
    const { enqueueSnackbar } = useSnackbar();

    // const handleCreateMetaAnalysis = async () => {
    //     createMetaAnalysis(
    //         {
    //             analysisType: props.analysisType,
    //             estimator: props.estimator,
    //             corrector: props.corrector,
    //             studyset: props.studyset,
    //             annotation: props.annotation,
    //             inclusionColumn: props.inclusionColumn,
    //             metaAnalysisName: props.metaAnalysisName,
    //             metaAnalysisDescription: props.metaAnalysisDescription,
    //         },
    //         {
    //             estimatorArgs: props.estimatorArgs,
    //             correctorArgs: props.correctorArgs,
    //         }
    //     )
    //         .then((res) => {
    //             enqueueSnackbar('new meta-analysis created successfully', { variant: 'success' });
    //             // history.push(`/meta-analyses/${res?.data?.id}`);
    //         })
    //         .catch((err) => {
    //             enqueueSnackbar('there was an error creating the meta-analysis', {
    //                 variant: 'error',
    //             });
    //         });
    // };

    const handleNavigation = (_event: React.MouseEvent) => {
        props.onNavigate(ENavigationButton.PREV);
    };

    return (
        <Box sx={{ marginBottom: '2em' }}>
            <Typography variant="h6" sx={{ marginBottom: '1rem' }}>
                Meta-Analysis specification summary
            </Typography>

            <Paper elevation={2} sx={MetaAnalysisFinalizeStyles.stepContainer}>
                <Typography variant="h6" sx={MetaAnalysisFinalizeStyles.title}>
                    Details
                </Typography>

                <MetaAnalysisSummaryRow
                    title="meta-analysis name"
                    value={props.metaAnalysisName || ''}
                    caption={props.metaAnalysisDescription || ''}
                />
            </Paper>

            <Paper elevation={2} sx={MetaAnalysisFinalizeStyles.stepContainer}>
                <Typography variant="h6" sx={MetaAnalysisFinalizeStyles.title}>
                    Data
                </Typography>

                <MetaAnalysisSummaryRow
                    title="analysis type"
                    value={props.analysisType || ''}
                    caption={getAnalysisTypeDescription(props.analysisType)}
                />

                <MetaAnalysisSummaryRow
                    title="studyset"
                    value={props.studyset?.name || ''}
                    caption={props.studyset?.description || ''}
                />

                <MetaAnalysisSummaryRow
                    title="annotation"
                    value={props.annotation?.name || ''}
                    caption={props.annotation?.description || ''}
                />

                <MetaAnalysisSummaryRow
                    title="inclusion column"
                    value={props.inclusionColumn || ''}
                />
            </Paper>

            <Paper elevation={2} sx={MetaAnalysisFinalizeStyles.stepContainer}>
                <Typography variant="h6" sx={MetaAnalysisFinalizeStyles.title}>
                    Algorithm
                </Typography>

                <MetaAnalysisSummaryRow
                    title="algorithm"
                    value={props.estimator?.label || ''}
                    caption={props.estimator?.description || ''}
                >
                    <DynamicInputDisplay dynamicArg={props.estimatorArgs} />
                </MetaAnalysisSummaryRow>

                {hasCorrector && (
                    <MetaAnalysisSummaryRow
                        title="corrector"
                        value={props.corrector?.label || ''}
                        caption={props.corrector?.description || ''}
                    >
                        <DynamicInputDisplay dynamicArg={props.correctorArgs} />
                    </MetaAnalysisSummaryRow>
                )}
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button sx={{ fontSize: '1rem' }} onClick={handleNavigation} variant="outlined">
                    back
                </Button>
                <LoadingButton
                    sx={{ fontSize: '1rem', width: '250px' }}
                    loaderColor="secondary"
                    isLoading={false}
                    text="create meta-analysis"
                    variant="contained"
                    onClick={() => {}}
                />
            </Box>
        </Box>
    );
};

export default MetaAnalysisFinalize;
