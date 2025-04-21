// gotta customize this myself

import axios from 'axios';
import { useQuery } from 'react-query';
import API from 'utils/api';

export enum EAIExtractors {
    PARTICIPANTSDEMOGRAPHICSEXTRACTOR = 'ParticipantDemographicsExtractor',
    TASKEXTRACTOR = 'TaskExtractor',
}

export interface IExtractionDataResultsArg {
    featureFilter?: string[];
    featureDisplay?: string[];
    pipelineConfig?: string[];
    studyId?: string[];
    version?: string;
}

const useGetAllAIExtractedData = ({
    featureFilter = [],
    featureDisplay = [],
    pipelineConfig = [],
    studyId = [],
    version = undefined,
}: IExtractionDataResultsArg) => {
    return useQuery(
        ['extraction'],
        () => API.NeurostoreServices.ExtractedDataResultsService.getAllExtractedDataResults(),
        {}
    );
};

export default useGetAllAIExtractedData;
