// gotta customize this myself

import { AxiosError, AxiosResponse } from 'axios';
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

export interface IBehavioralTask {
    Domain: null | undefined | string[];
    Concepts: null | undefined | string[];
    TaskName: null | undefined | string;
    Conditions: null | undefined | string[];
    TaskMetrics: null | undefined | string[];
    DesignDetails: null | undefined | string;
    TaskDescription: null | undefined | string;
}

export type IfMRITask = IBehavioralTask & {
    RestingState: null | undefined | boolean;
    RestingStateMetadata: null | undefined | Record<string, string | null>;
    TaskDesign: null | undefined | string[];
    TaskDuration: null | undefined | string;
};

export interface ITaskExtractor {
    Exclude: null | boolean;
    Modality: string[];
    fMRITasks: null | undefined | IfMRITask[];
    TaskDesign: null | undefined | string[];
    RestingState: null | undefined | boolean;
    TaskDuration: null | undefined | string;
    StudyObjective: null | undefined | string;
    BehavioralTasks: null | undefined | IBehavioralTask[];
    RestingStateMetadata: null | undefined | Record<string, string | null>;
}

export interface IGroup {
    count: null | undefined | number;
    age_mean: null | undefined | number;
    age_range: null | undefined | number;
    diagnosis: null | undefined | string;
    age_median: null | undefined | number;
    group_name: null | undefined | string;
    male_count: null | undefined | number;
    age_maximum: null | undefined | number;
    age_minimum: null | undefined | number;
    female_count: null | undefined | number;
    subgroup_name: null | undefined | string;
    imaging_sample: null | undefined | 'yes' | 'no';
}

export interface IParticipantDemographicExtractor {
    groups: IGroup[];
}

// temporary function, remove later
const normalizeData = (data: any) => {
    // base case
    if (data === null || data === undefined || typeof data !== 'object') return;

    Object.entries(data).forEach(([key, value]) => {
        if (value === 'null') {
            data[key] = null;
            return;
        } else if (Array.isArray(value)) {
            value.forEach((item) => {
                return normalizeData(item);
            });
        } else if (typeof value === 'object') {
            return normalizeData(value);
        } else {
            return;
        }
    });
};

export interface IExtractedDataResult {
    metadata: {
        total_count: number;
    };
    results: {
        base_study_id: string;
        config_id: string;
        date_executed: string;
        file_inputs: {
            [path: string]: string;
        };
        id: string;
        result_data: ITaskExtractor | IParticipantDemographicExtractor;
    }[];
}

const useGetAllAIExtractedData = (baseStudyIds?: string[]) => {
    const baseStudyIdsOrEmpty = baseStudyIds ?? [];
    return useQuery<
        [AxiosResponse<IExtractedDataResult>, AxiosResponse<IExtractedDataResult>],
        AxiosError,
        {
            [EAIExtractors.TASKEXTRACTOR]: IExtractedDataResult;
            [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]: IExtractedDataResult;
        },
        string[]
    >(
        ['extraction', ...baseStudyIdsOrEmpty],
        async () => {
            const promises = await Promise.all([
                API.NeurostoreServices.ExtractedDataResultsService.getAllExtractedDataResults(
                    [EAIExtractors.TASKEXTRACTOR],
                    baseStudyIds
                ),
                API.NeurostoreServices.ExtractedDataResultsService.getAllExtractedDataResults(
                    [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR],
                    baseStudyIds
                ),
            ]);

            promises.forEach((res) => {
                normalizeData(res.data);
            });

            return promises;
        },
        {
            select: ([taskExtractionRes, participantDemographicsExtractionRes]) => {
                return {
                    [EAIExtractors.TASKEXTRACTOR]: taskExtractionRes.data,
                    [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]: participantDemographicsExtractionRes.data,
                };
            },
            refetchOnMount: false,
            enabled: baseStudyIdsOrEmpty.length > 0,
        }
    );
};

export default useGetAllAIExtractedData;
