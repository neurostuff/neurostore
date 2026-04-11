import { EAnalysisType } from 'hooks/projects/Project.types';
import { SearchDataType } from 'pages/Study/Study.types';

export const getDefaultCurationSearchDataType = (analysisType: EAnalysisType | undefined): SearchDataType =>
    analysisType === EAnalysisType.IBMA ? SearchDataType.IMAGE : SearchDataType.COORDINATE;

export const getCurationSearchPath = (projectId: string, analysisType: EAnalysisType | undefined): string => {
    const dataType = getDefaultCurationSearchDataType(analysisType);
    return `/projects/${projectId}/curation/search?dataType=${dataType}`;
};
