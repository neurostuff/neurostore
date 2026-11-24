import { ErrorOutline } from '@mui/icons-material';
import { Chip } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudyIsLoading, useStudyAnalysisWarnings } from 'stores/study/StudyStore';

const StudyAnalysisWarnings = (props: { analysisId: string }) => {
    const getStudyIsLoading = useGetStudyIsLoading();

    const { hasEmptyPoints, hasNoName, hasDuplicateName, hasNonMNICoordinates, hasInvalidEntries } =
        useStudyAnalysisWarnings(props.analysisId);

    return (
        <StateHandlerComponent isLoading={getStudyIsLoading} isError={false} loaderSize={20}>
            {hasEmptyPoints && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutline />}
                    label="This analysis has empty coordinates"
                    color="warning"
                />
            )}
            {hasNoName && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutline />}
                    label="No analysis name"
                    color="warning"
                />
            )}
            {hasDuplicateName && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutline />}
                    label="Duplicate analysis name"
                    color="warning"
                />
            )}
            {hasNonMNICoordinates && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutline />}
                    label="This analysis may contain non MNI coordinates"
                    color="warning"
                />
            )}
            {hasInvalidEntries && (
                <Chip
                    sx={{ margin: '2px', marginBottom: '1rem' }}
                    icon={<ErrorOutline />}
                    label="This analysis has invalid entries"
                    color="warning"
                />
            )}
        </StateHandlerComponent>
    );
};

export default StudyAnalysisWarnings;
