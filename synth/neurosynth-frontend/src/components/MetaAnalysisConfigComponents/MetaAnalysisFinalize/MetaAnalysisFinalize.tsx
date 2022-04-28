import { Box, Typography, Divider, Paper } from '@mui/material';
import { NavigationButtons } from '../..';
import {
    EAnalysisType,
    IMetaAnalysisComponents,
    IEstimatorCorrectorArgs,
} from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import { INavigationButtonFn } from '../../Buttons/NavigationButtons/NavigationButtons';
import DynamicInputDisplay from './DynamicInputDisplay/DynamicInputDisplay';
import MetaAnalysisSummaryRow from './MetaAnalysisSummaryRow/MetaAnalysisSummaryRow';
import MetaAnalysisFinalizeStyles from './MetaAnalysisFinalize.styles';

interface IMetaAnalysisFinalize extends IMetaAnalysisComponents, IEstimatorCorrectorArgs {
    onNext: INavigationButtonFn;
}

const MetaAnalysisFinalize: React.FC<IMetaAnalysisFinalize> = (props) => {
    const hasCorrector = Object.keys(props.correctorArgs).length > 0;

    return (
        <Box sx={{ marginBottom: '2em' }}>
            <Typography variant="h5" sx={{ marginBottom: '1rem' }}>
                Meta-Analysis summary
            </Typography>

            <Paper elevation={3} sx={MetaAnalysisFinalizeStyles.stepContainer}>
                <Typography variant="h5" sx={MetaAnalysisFinalizeStyles.title}>
                    Details
                </Typography>

                <MetaAnalysisSummaryRow
                    title="meta-analysis name"
                    value={props.metaAnalysisName}
                    divider={false}
                    caption={props.metaAnalysisDescription}
                />
            </Paper>

            <Paper elevation={3} sx={MetaAnalysisFinalizeStyles.stepContainer}>
                <Typography variant="h5" sx={MetaAnalysisFinalizeStyles.title}>
                    Data
                </Typography>

                <MetaAnalysisSummaryRow
                    title="analysis type"
                    value={props.analysisType || ''}
                    divider={true}
                    caption={
                        props.analysisType === EAnalysisType.IBMA
                            ? 'Image Based Meta-Analysis'
                            : 'Coordinate Based Meta-Analysis'
                    }
                />

                <MetaAnalysisSummaryRow
                    title="studyset"
                    value={props.studyset?.name || ''}
                    divider={true}
                    caption={props.studyset?.description || ''}
                />

                <MetaAnalysisSummaryRow
                    title="annotation"
                    value={props.annotation?.name || ''}
                    divider={true}
                    caption={props.annotation?.description || ''}
                />

                <MetaAnalysisSummaryRow
                    title="inclusion column"
                    value={props.inclusionColumn || ''}
                    divider={false}
                />
            </Paper>

            <Paper elevation={3} sx={MetaAnalysisFinalizeStyles.stepContainer}>
                <Typography variant="h5" sx={MetaAnalysisFinalizeStyles.title}>
                    Algorithm
                </Typography>

                <MetaAnalysisSummaryRow
                    title="algorithm"
                    value={props.algorithm?.label || ''}
                    divider={hasCorrector}
                    caption={props.algorithm?.description || ''}
                >
                    <DynamicInputDisplay dynamicArg={props.estimatorArgs} />
                </MetaAnalysisSummaryRow>

                {hasCorrector && (
                    <MetaAnalysisSummaryRow
                        title="corrector"
                        value={props.corrector?.label || ''}
                        divider={false}
                        caption={props.corrector?.description || ''}
                    >
                        <DynamicInputDisplay dynamicArg={props.correctorArgs} />
                    </MetaAnalysisSummaryRow>
                )}
            </Paper>

            <NavigationButtons
                onButtonClick={props.onNext}
                nextButtonStyle="contained"
                nextButtonText="Create Meta-Analysis"
            />
        </Box>
    );
};

export default MetaAnalysisFinalize;
