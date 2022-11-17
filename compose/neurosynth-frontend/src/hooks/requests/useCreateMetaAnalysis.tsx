import { AxiosError, AxiosResponse } from 'axios';
import { useMutation } from 'react-query';
import {
    AnnotationPostBody,
    MetaAnalysis,
    MetaAnalysisPostBody,
    MetaAnalysisReturn,
    SpecificationPostBody,
    SpecificationReturn,
    StudysetPostBody,
    StudysetReturn,
} from 'neurosynth-compose-typescript-sdk';
import {
    EAnalysisType,
    IEstimatorCorrectorArgs,
    IMetaAnalysisComponents,
} from 'pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import API, { NeurostoreAnnotation } from 'utils/api';

const useCreateMetaAnalysis = () => {
    const createSpecificationMutation = useMutation<
        AxiosResponse<SpecificationReturn>,
        AxiosError,
        SpecificationPostBody,
        unknown
    >((spec: SpecificationPostBody) =>
        API.NeurosynthServices.SpecificationsService.specificationsPost(spec)
    );
    const createSynthStudysetMutation = useMutation<
        AxiosResponse<StudysetReturn>,
        AxiosError,
        StudysetPostBody,
        unknown
    >((studyset) => API.NeurosynthServices.StudysetsService.studysetsPost(studyset));
    const createSynthAnnotationMutation = useMutation<
        AxiosResponse<NeurostoreAnnotation>,
        AxiosError,
        AnnotationPostBody,
        unknown
    >((annotation) => API.NeurosynthServices.AnnotationsService.annotationsPost(annotation));
    const createMetaAnalysisMutation = useMutation<
        AxiosResponse<MetaAnalysis>,
        AxiosError,
        MetaAnalysis,
        unknown
    >((metaAnalysis: MetaAnalysis) =>
        API.NeurosynthServices.MetaAnalysisService.metaAnalysesPost({
            internal_studyset_id: '',
            internal_annotation_id: '',
            specification: {},
        })
    );

    const createMetaAnalysis = (
        metaAnalysisComponents?: IMetaAnalysisComponents,
        estimatorCorrectorArgs?: IEstimatorCorrectorArgs
    ) => {
        return createMetaAnalysisMutation.mutate;
        // try {
        //     return createMetaAnalysisMutation;
        // if (!metaAnalysisComponents.studyset?.id) throw new Error('no id from studyset');
        // if (!metaAnalysisComponents.annotation?.id) throw new Error('no id from annotation');

        // const createdSpec = await createSpecificationMutation.mutateAsync({
        //     type: metaAnalysisComponents.analysisType as EAnalysisType,
        //     estimator: {
        //         type: metaAnalysisComponents.estimator?.label,
        //         args: estimatorCorrectorArgs.estimatorArgs,
        //     },
        //     mask: '', // TODO: handle these cases
        //     contrast: '', // TODO: handle these cases
        //     transformer: '', // TODO: handle these cases
        //     corrector: metaAnalysisComponents.corrector
        //         ? {
        //               type: metaAnalysisComponents.corrector?.label,
        //               args: estimatorCorrectorArgs.correctorArgs,
        //           }
        //         : null,
        //     filter: metaAnalysisComponents.inclusionColumn,
        // });
        // if (!createdSpec.data.id) throw new Error('no id from created spec');

        // const createdSynthStudyset = await createSynthStudysetMutation.mutateAsync({
        //     neurostore_id: metaAnalysisComponents.studyset?.id,
        // });
        // if (!createdSynthStudyset.data.id) throw new Error('no id from created synth studyset');

        // const createdSynthAnnotation = await createSynthAnnotationMutation.mutateAsync({
        //     neurostore_id: metaAnalysisComponents.annotation.id,
        //     internal_studyset_id: createdSynthStudyset.data.id,
        // });
        // if (!createdSynthAnnotation.data.id)
        //     throw new Error('no id from created synth annotation');

        // const createdMetaAnalysis = await createMetaAnalysisMutation.mutateAsync({
        //     name: metaAnalysisComponents.metaAnalysisName,
        //     description: metaAnalysisComponents.metaAnalysisDescription,
        //     internal_studyset_id: createdSynthStudyset.data.id,
        //     internal_annotation_id: createdSynthAnnotation.data.id,
        //     specification: createdSpec.data.id,
        // });

        // return createdMetaAnalysis;
        // } catch (e) {
        //     return Promise.reject(e);
        // }
    };

    const isLoading =
        createSpecificationMutation.isLoading ||
        createSynthStudysetMutation.isLoading ||
        createSynthAnnotationMutation.isLoading ||
        createMetaAnalysisMutation.isLoading;

    const isError =
        createSpecificationMutation.isError ||
        createSynthStudysetMutation.isError ||
        createSynthAnnotationMutation.isError ||
        createMetaAnalysisMutation.isError;

    const error =
        createSpecificationMutation.error ||
        createSynthStudysetMutation.error ||
        createSynthAnnotationMutation.error ||
        createMetaAnalysisMutation.error;

    return createMetaAnalysisMutation;

    // return {
    //     error,
    //     isLoading,
    //     isError,
    //     createMetaAnalysisMutation,
    // };
};

export default useCreateMetaAnalysis;
