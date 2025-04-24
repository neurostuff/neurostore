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
    TaskDesign: null | undefined | string[];
    RestingState: null | undefined | boolean;
    TaskDuration: null | undefined | string;
    RestingStateMetadata: null | undefined | any;
};

export interface ITaskExtractor {
    Modality: string[];
    fMRITasks: null | undefined | IfMRITask[];
    BehavioralTasks: null | undefined | IBehavioralTask[];
    StudyObjective: null | undefined | string;
    Exclude: null | boolean;
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

const useGetAllAIExtractedData = () => {
    return useQuery(
        ['extraction'],
        () => {
            return Promise.all([
                API.NeurostoreServices.ExtractedDataResultsService.getAllExtractedDataResults([
                    EAIExtractors.TASKEXTRACTOR,
                ]),
                API.NeurostoreServices.ExtractedDataResultsService.getAllExtractedDataResults([
                    EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
                ]),
            ]);
        },
        {
            select: ([taskExtractionRes, participantDemographicsExtractionRes]) => {
                return {
                    [EAIExtractors.TASKEXTRACTOR]: taskExtractionRes.data,
                    [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]: participantDemographicsExtractionRes.data,
                };
            },
        }
    );
};

export default useGetAllAIExtractedData;
