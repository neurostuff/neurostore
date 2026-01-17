import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Chip } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useDisplayWarnings from '../hooks/useDisplayWarnings';
import { useGetStudyIsLoading } from 'pages/Study/store/StudyStore';

const StudyAnalysisWarnings: React.FC<{ analysisId: string }> = (props) => {
    const getStudyIsLoading = useGetStudyIsLoading();

    const { hasNoPoints, hasNoName, hasDuplicateName, hasNonMNICoordinates } = useDisplayWarnings(props.analysisId);

    return (
        <StateHandlerComponent isLoading={getStudyIsLoading} isError={false} loaderSize={20}>
            {hasNoPoints && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutlineIcon />}
                    label="This analysis has no coordinates"
                    color="warning"
                />
            )}
            {hasNoName && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutlineIcon />}
                    label="No analysis name"
                    color="warning"
                />
            )}
            {hasDuplicateName && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutlineIcon />}
                    label="Duplicate analysis name"
                    color="warning"
                />
            )}
            {hasNonMNICoordinates && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutlineIcon />}
                    label="This analysis may contain non MNI coordinates"
                    color="warning"
                />
            )}
        </StateHandlerComponent>
    );
};

export default StudyAnalysisWarnings;
