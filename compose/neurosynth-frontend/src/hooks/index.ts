import useCreateAnnotation from 'hooks/analyses/useCreateAnnotation';
import useDeleteAnnotation from 'hooks/analyses/useDeleteAnnotation';
import useGetAnnotationById from 'hooks/analyses/useGetAnnotationById';
import useGetMetaAnalysesByProjectId from 'hooks/metaAnalyses/useGetMetaAnalyses';
import useGetMetaAnalysisById from 'hooks/metaAnalyses/useGetMetaAnalysisById';
import useUpdateAnnotationById from 'hooks/analyses/useUpdateAnnotationById';
import useGetFullText from 'hooks/external/useGetFullText';
import useGetPubMedIds from 'hooks/external/useGetPubMedIds';
import useCreateAlgorithmSpecification from './metaAnalyses/useCreateAlgorithmSpecification';
import useCreateStudy from 'hooks/studies/useCreateStudy';
import useGetStudies from 'hooks/studies/useGetStudies';
import useDeleteStudyset from 'hooks/studysets/useDeleteStudyset';
import useGetStudysetById from 'hooks/studysets/useGetStudysetById';
import useGetToken from './useGetToken';
import useGetTour from './useGetTour';
import useGuard from './useGuard';
import useInputValidation from './useInputValidation';
import useIsMounted from './useIsMounted';
import useGetWindowHeight from './useGetWindowHeight';
import useGetStudyById from 'hooks/studies/useGetStudyById';
import useUpdateStudy from 'hooks/studies/useUpdateStudy';
import useGetStudysets from 'hooks/studysets/useGetStudysets';
import useCreateStudyset from 'hooks/studysets/useCreateStudyset';
import useUpdateStudyset from 'hooks/studysets/useUpdateStudyset';
import useGetAnnotationsByStudysetId from 'hooks/analyses/useGetAnnotationsByStudysetId';
import useCreatePoint from 'hooks/analyses/useCreatePoint';
import useDeletePoint from 'hooks/analyses/useDeletePoint';
import useUpdatePoint from 'hooks/analyses/useUpdatePoint';
import useDeleteAnalysis from 'hooks/analyses/useDeleteAnalysis';
import useCreateAnalysis from 'hooks/analyses/useCreateAnalysis';
import useUpdateAnalysis from 'hooks/analyses/useUpdateAnalysis';
import useGetConditions from 'hooks/analyses/useGetConditions';
import useCreateCondition from 'hooks/analyses/useCreateCondition';
import useCreateProject from 'hooks/projects/useCreateProject';
import useGetProjectById from 'hooks/projects/useGetProjectById';
import useGetProjects from 'hooks/projects/useGetProjects';
import useUpdateProject from 'hooks/projects/useUpdateProject';
import useGetAnalysisById from 'hooks/analyses/useGetAnalysisById';
import useGetMetaAnalysisResultById from 'hooks/metaAnalyses/useGetMetaAnalysisResultById';
import useGetCurationSummary from 'hooks/projects/useGetCurationSummary';
import useGetExtractionSummary from 'hooks/projects/useGetExtractionSummary';
import useGetSpecificationById from 'hooks/metaAnalyses/useGetSpecificationById';
import useUpdateSpecification from 'hooks/metaAnalyses/useUpdateSpecification';
import useUpdateMetaAnalysis from 'hooks/metaAnalyses/useUpdateMetaAnalysis';

export {
    useIsMounted,
    useInputValidation,
    useGetToken,
    useGuard,
    useGetTour,
    useGetWindowHeight,
    // STUDIES
    useGetStudies,
    useGetStudyById,
    useUpdateStudy,
    useCreateStudy,
    // META-ANALYSES
    useCreateAlgorithmSpecification,
    useGetMetaAnalysesByProjectId,
    useGetMetaAnalysisById,
    useGetMetaAnalysisResultById,
    useGetSpecificationById,
    useUpdateSpecification,
    useUpdateMetaAnalysis,
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
    useGetAnalysisById,
    // CONDITIONS
    useGetConditions,
    useCreateCondition,
    // project
    useCreateProject,
    useGetProjectById,
    useGetProjects,
    useUpdateProject,
    useGetCurationSummary,
    useGetExtractionSummary,
    // EXTERNAL
    useGetPubMedIds,
    useGetFullText,
};
