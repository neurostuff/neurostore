import { Box, ListItem, ListItemText, Typography } from '@mui/material';
import { IAlgorithmSelection } from '../../CreateMetaAnalysisSpecificationDialogBase.types';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { EPropertyType } from 'components/EditMetadata';

const SelectAnalysesMultiGroupComponent: React.FC<{ algorithm: IAlgorithmSelection }> = (props) => {
    return (
        <Box sx={{ margin: '2rem 0' }}>
            <Typography sx={{ marginBottom: '1rem' }}>
                You selected <b>{props.algorithm?.estimator?.label || ''}</b> in the previous step,
                which is an estimator that requires a second dataset to use as a comparison. Select
                a dataset using the dropdown below. You can either select our default reference
                datasets (i.e. neurostore, neuroquery, etc) or choose another value from the
                inclusion column you set above to use as your own dataset.
            </Typography>
            <Box
                sx={{
                    padding: '2rem 0 2rem 3rem',
                    borderLeft: '6px solid',
                    borderColor: 'secondary.main',
                }}
            >
                <NeurosynthAutocomplete
                    label="Select value to filter on"
                    shouldDisable={false}
                    isOptionEqualToValue={(option, value) => option === value}
                    value={undefined}
                    size="medium"
                    inputPropsSx={{
                        color: NeurosynthTableStyles[EPropertyType.NONE],
                    }}
                    required={false}
                    renderOption={(params, option) => (
                        <ListItem {...params} key={option}>
                            <ListItemText
                                sx={{
                                    color: NeurosynthTableStyles[EPropertyType.STRING],
                                }}
                                primary={option || ''}
                            />
                        </ListItem>
                    )}
                    getOptionLabel={(option) => `${option}`}
                    onChange={(_event, newVal, _reason) => {}}
                    options={[]}
                />
            </Box>
        </Box>
    );
};

export default SelectAnalysesMultiGroupComponent;
