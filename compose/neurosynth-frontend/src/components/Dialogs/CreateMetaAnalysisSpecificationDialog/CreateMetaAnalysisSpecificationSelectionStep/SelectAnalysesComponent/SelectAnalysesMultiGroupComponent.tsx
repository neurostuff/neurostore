import { Box, Typography } from '@mui/material';
import { IAlgorithmSelection } from '../../CreateMetaAnalysisSpecificationDialogBase.types';

const SelectAnalysesMultiGroupComponent: React.FC<{ algorithm: IAlgorithmSelection }> = (props) => {
    return (
        <Box sx={{ margin: '2rem 0' }}>
            <Typography>
                You selected <b>{props.algorithm?.estimator?.label || ''}</b> in the previous step,
                which is an estimator that requires a second dataset to use as a comparison. Select
                a dataset using the dropdown below. You can either select our default reference
                datasets (i.e. neurostore, neuroquery, etc) or choose another value from the
                inclusion column you set above to use as your own dataset.
            </Typography>
        </Box>
    );
};

export default SelectAnalysesMultiGroupComponent;
