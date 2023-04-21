import useIsMounted from './useIsMounted';
import useInputValidation from './useInputValidation';
import useGetToken from './useGetToken';
import useGuard from './useGuard';
import useGetTour from './useGetTour';

import useGetStudyById from './requests/useGetStudyById';
import useCreateAlgorithmSpecification from './requests/useCreateAlgorithmSpecification';
import useGetMetaAnalyses from './requests/useGetMetaAnalyses';
import useGetMetaAnalysisById from './requests/useGetMetaAnalysisById';
import useGetStudysets from './requests/useGetStudysets';
import useGetAnnotationsByStudysetId from './requests/useGetAnnotationsByStudysetId';
import useCreatePoint from './requests/useCreatePoint';
import useUpdateStudy from './requests/useUpdateStudy';
import useDeletePoint from './requests/useDeletePoint';
import useCreateAnalysis from './requests/useCreateAnalysis';
import useUpdateAnalysis from './requests/useUpdateAnalysis';
import useGetConditions from './requests/useGetConditions';
import useCreateCondition from './requests/useCreateCondition';
import useUpdatePoint from './requests/useUpdatePoint';
import useDeleteAnalysis from './requests/useDeleteAnalysis';
import useGetStudies from './requests/useGetStudies';
import useCreateStudyset from './requests/useCreateStudyset';
import useUpdateStudyset from './requests/useUpdateStudyset';
import useGetAnnotationById from './requests/useGetAnnotationById';
import useUpdateAnnotationById from './requests/useUpdateAnnotationById';
import useDeleteAnnotation from './requests/useDeleteAnnotation';
import useGetStudysetById from './requests/useGetStudysetById';
import useCreateAnnotation from './requests/useCreateAnnotation';
import useDeleteStudyset from './requests/useDeleteStudyset';
import useCreateStudy from './requests/useCreateStudy';

export {
    useIsMounted,
    useInputValidation,
    useGetToken,
    useGuard,
    useGetTour,
    // STUDIES
    useGetStudies,
    useGetStudyById,
    useUpdateStudy,
    useCreateStudy,
    // META-ANALYSES
    useCreateAlgorithmSpecification,
    useGetMetaAnalyses,
    useGetMetaAnalysisById,
    // STUDYSETS
    useGetStudysets,
    useGetStudysetById,
    useCreateStudyset,
    useDeleteStudyset,
    useUpdateStudyset,
    // ANNOTATIONS
    useGetAnnotationById,
    useUpdateAnnotationById,
    useGetAnnotationsByStudysetId,
    useDeleteAnnotation,
    useCreateAnnotation,
    // POINTS
    useCreatePoint,
    useDeletePoint,
    useUpdatePoint,
    // ANALYSES
    useDeleteAnalysis,
    useCreateAnalysis,
    useUpdateAnalysis,
    // CONDITIONS
    useGetConditions,
    useCreateCondition,
};
