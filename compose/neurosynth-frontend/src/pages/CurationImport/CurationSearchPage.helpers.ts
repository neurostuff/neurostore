import { EAnalysisType } from 'hooks/projects/Project.types';
import { SearchDataType } from 'pages/Study/Study.types';

export const getCurationSearchPath = (projectId: string, analysisType: EAnalysisType | undefined): string => {
    const datatype = analysisType === EAnalysisType.IBMA ? SearchDataType.IMAGE : SearchDataType.COORDINATE;

    return `/projects/${projectId}/curation/search?dataType=${datatype}`;
};
