import useIsMounted from './useIsMounted';
import useInputValidation from './useInputValidation';
import useGetToken from './useGetToken';
import useGuard from './useGuard';
import useGetTour from './useGetTour';
import useGetWindowHeight from './useGetWindowHeight';

import useCreateAlgorithmSpecification from './metaAnalyses/useCreateAlgorithmSpecification';
import useGetMetaAnalysesByProjectId from './metaAnalyses/useGetMetaAnalysesByProjectId';
import useGetMetaAnalysisById from './metaAnalyses/useGetMetaAnalysisById';
import useGetAnnotationsByStudysetId from './analyses/useGetAnnotationsByStudysetId';
import useCreatePoint from './analyses/useCreatePoint';
import useUpdateStudy from './studies/useUpdateStudy';
import useDeletePoint from './analyses/useDeletePoint';
import useCreateAnalysis from './analyses/useCreateAnalysis';
import useUpdateAnalysis from './analyses/useUpdateAnalysis';
import useGetConditions from './analyses/useGetConditions';
import useCreateCondition from './analyses/useCreateCondition';
import useUpdatePoint from './analyses/useUpdatePoint';
import useDeleteAnalysis from './analyses/useDeleteAnalysis';
import useCreateStudyset from './studysets/useCreateStudyset';
import useUpdateStudyset from './studysets/useUpdateStudyset';
import useGetAnnotationById from './analyses/useGetAnnotationById';
import useDeleteAnnotation from './analyses/useDeleteAnnotation';
import useGetStudysetById from './studysets/useGetStudysetById';
import useCreateAnnotation from './analyses/useCreateAnnotation';
import useCreateStudy from './studies/useCreateStudy';
import useCreateProject from './projects/useCreateProject';
import useGetStudysets from './studysets/useGetStudysets';
import useDeleteStudyset from './studysets/useDeleteStudyset';
import useGetBaseStudies from './studies/useGetBaseStudies';
import useGetStudyById from './studies/useGetStudyById';
import useUpdateAnnotationById from './analyses/useUpdateAnnotationById';

export {
    useIsMounted,
    useInputValidation,
    useGetToken,
    useGuard,
    useGetTour,
    useGetWindowHeight,
    // STUDIES
    useGetBaseStudies,
    useGetStudyById,
    useUpdateStudy,
    useCreateStudy,
    // META-ANALYSES
    useCreateAlgorithmSpecification,
    useGetMetaAnalysesByProjectId,
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
    // project
    useCreateProject,
};
