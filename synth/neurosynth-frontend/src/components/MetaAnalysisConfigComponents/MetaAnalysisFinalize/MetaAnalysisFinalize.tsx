import { Box, Typography, Divider } from '@mui/material';
import { NavigationButtons } from '../..';
import {
    EAnalysisType,
    IAnalysisComponents,
    IDynamicArgs,
} from '../../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import { INavigationButtonFn } from '../../NavigationButtons/NavigationButtons';
import DynamicInputDisplay from './DynamicInputDisplay/DynamicInputDisplay';
import FinalizeCardSummary from './FinalizeCardSummary/FinalizeCardSummary';

interface IMetaAnalysisFinalize extends IAnalysisComponents, IDynamicArgs {
    onNext: INavigationButtonFn;
}

const MetaAnalysisFinalize: React.FC<IMetaAnalysisFinalize> = (props) => {
    return (
        <Box sx={{ marginBottom: '2em' }}>
            <Typography variant="h5" sx={{ marginBottom: '2rem' }}>
                Meta analysis summary
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around' }}>
                <FinalizeCardSummary
                    cardTitle="analysis type"
                    sx={{ width: '33%', margin: '10px' }}
                    label={
                        props.analysisType === EAnalysisType.CBMA
                            ? 'Coordinate Based Meta Analysis'
                            : 'Image Based Meta Analysis'
                    }
                    description=""
                />

                <FinalizeCardSummary
                    cardTitle="studyset"
                    sx={{ width: '33%', margin: '10px' }}
                    label={props.studyset?.name || ''}
                    description=""
                />

                <FinalizeCardSummary
                    cardTitle="annotation"
                    sx={{ width: '33%', margin: '10px' }}
                    label={props.annotation?.name || ''}
                    description=""
                />
            </Box>

            <Divider sx={{ margin: '1rem 0' }} />

            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around' }}>
                <FinalizeCardSummary
                    cardTitle="algorithm"
                    sx={{ width: '33%', margin: '10px' }}
                    label={props.algorithm?.label || ''}
                    description={props.algorithm?.description || ''}
                >
                    {Object.keys(props.estimatorArgs).length > 0 && (
                        <DynamicInputDisplay dynamicArg={props.estimatorArgs} />
                    )}
                </FinalizeCardSummary>

                {props.corrector?.label ? (
                    <FinalizeCardSummary
                        cardTitle="corrector"
                        label={props.corrector?.label || ''}
                        description={props.corrector?.description || ''}
                        sx={{ width: '33%', margin: '10px' }}
                    >
                        <DynamicInputDisplay dynamicArg={props.correctorArgs} />
                    </FinalizeCardSummary>
                ) : (
                    <Box sx={{ width: '33%', margin: '10px' }}></Box>
                )}

                <Box sx={{ width: '33%', margin: '10px' }}></Box>
            </Box>

            <NavigationButtons
                onButtonClick={props.onNext}
                nextButtonStyle="contained"
                nextButtonText="Create meta analysis"
            />
        </Box>
    );
};

export default MetaAnalysisFinalize;
