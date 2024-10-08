import { Box, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { useAddOrUpdateAnalysis } from 'pages/Study/store/StudyStore';
import {
    useStudyAnalysisPointSpace,
    useStudyAnalysisPointStatistic,
} from 'pages/Study/store/StudyStore';
import {
    DefaultMapTypes,
    DefaultSpaceTypes,
    MapOrSpaceType,
} from 'pages/Study/store/StudyStore.helpers';

const statisticTypeOptions: MapOrSpaceType[] = Object.keys(DefaultMapTypes).map((key) => {
    return {
        label: DefaultMapTypes[key].label,
        value: DefaultMapTypes[key].value,
    };
});

const spaceTypeOptions: MapOrSpaceType[] = Object.keys(DefaultSpaceTypes).map((key) => {
    return {
        label: DefaultSpaceTypes[key].label,
        value: DefaultSpaceTypes[key].value,
    };
});

const EditStudyAnalysisPointSpaceAndStatistic: React.FC<{
    analysisId?: string;
}> = (props) => {
    const analysisPointStatistic = useStudyAnalysisPointStatistic(props.analysisId);
    const analysisPointSpace = useStudyAnalysisPointSpace(props.analysisId);
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();

    const handleSelectStatistic = (event: SelectChangeEvent) => {
        if (!props.analysisId) return;

        addOrUpdateAnalysis({
            id: props.analysisId,
            pointStatistic: DefaultMapTypes[event.target.value],
        });
    };

    const handleSelectSpace = (event: SelectChangeEvent) => {
        if (!props.analysisId) return;

        addOrUpdateAnalysis({
            id: props.analysisId,
            pointSpace: DefaultSpaceTypes[event.target.value],
        });
    };

    return (
        <Box
            sx={{
                margin: '1rem 0',
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                maxWidth: '550px',
            }}
        >
            <FormControl sx={{ width: '250px' }} size="small" fullWidth>
                <InputLabel id="num-col-label">Statistic</InputLabel>
                <Select
                    onChange={handleSelectStatistic}
                    value={analysisPointStatistic?.value || ''}
                    label="Statistic"
                >
                    {statisticTypeOptions.map((mapTypeOption) => (
                        <MenuItem key={mapTypeOption.value} value={mapTypeOption.value}>
                            {mapTypeOption.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControl sx={{ width: '250px' }} size="small" fullWidth>
                <InputLabel id="num-col-label">Space</InputLabel>
                <Select
                    onChange={handleSelectSpace}
                    value={analysisPointSpace?.value || ''}
                    label="Space"
                >
                    {spaceTypeOptions.map((spaceTypeOption) => (
                        <MenuItem key={spaceTypeOption.value} value={spaceTypeOption.value}>
                            {spaceTypeOption.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
};

export default EditStudyAnalysisPointSpaceAndStatistic;
