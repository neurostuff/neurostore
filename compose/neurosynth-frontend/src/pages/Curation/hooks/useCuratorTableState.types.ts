import {
    EAIExtractors,
    IParticipantDemographicExtractor,
    ITaskExtractor,
} from 'hooks/extractions/useGetAllExtractedData';
import { ICurationStubStudy } from '../Curation.types';
import { SortingColumnDef } from '@tanstack/react-table';

export interface IGenericCustomAccessorReturn {
    [key: string]: number | string | boolean | null | undefined | string[];
}

export interface ICurationBoardAIInterfaceCuratorTableType {
    id: string;
    isAIExtracted: boolean;
    label: string;
    filterVariant: undefined | 'text' | 'numeric';
    canSort: boolean;
    sortingFn?: SortingColumnDef<ICurationTableStudy>['sortingFn'];
    customAccessor?: (stub: ICurationTableStudy) => string | number | string[] | IGenericCustomAccessorReturn;
}

export const STUB_CURATOR_COLUMNS: ICurationBoardAIInterfaceCuratorTableType[] = [
    {
        id: 'articleYear',
        label: 'Year',
        filterVariant: 'numeric',
        canSort: true,
        sortingFn: 'alphanumeric',
        isAIExtracted: false,
    },
    { id: 'title', label: 'Title', filterVariant: 'text', canSort: true, sortingFn: 'text', isAIExtracted: false },
    { id: 'authors', label: 'Authors', filterVariant: 'text', canSort: true, sortingFn: 'text', isAIExtracted: false },
    {
        id: 'keywords',
        label: 'Keywords',
        filterVariant: 'text',
        canSort: true,
        sortingFn: 'text',
        isAIExtracted: false,
    },
    {
        id: 'pmid',
        label: 'PMID',
        filterVariant: 'text',
        canSort: true,
        sortingFn: 'alphanumeric',
        isAIExtracted: false,
    },
    { id: 'doi', label: 'DOI', filterVariant: 'text', canSort: true, sortingFn: 'alphanumeric', isAIExtracted: false },
    { id: 'journal', label: 'Journal', filterVariant: 'text', canSort: true, sortingFn: 'text', isAIExtracted: false },
    {
        id: 'abstractText',
        label: 'Abstract',
        filterVariant: undefined,
        canSort: true,
        sortingFn: 'text',
        isAIExtracted: false,
    },
    {
        id: 'identificationSource',
        label: 'Source',
        filterVariant: 'text',
        canSort: true,
        sortingFn: 'text',
        customAccessor: (stub) => stub.identificationSource.label,
        isAIExtracted: false,
    },
];

export const PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS: ICurationBoardAIInterfaceCuratorTableType[] = [
    {
        id: 'groupName',
        label: 'Group Name(s)',
        filterVariant: 'text',
        canSort: false,
        sortingFn: 'alphanumeric',
        customAccessor: (stub) => {
            if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
                const groupNameList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups
                    .filter((g) => !!g.group_name)
                    .map((g) => g.group_name);
                return groupNameList as string[];
            }
            return [];
        },
        isAIExtracted: true,
    },
    // {
    //     id: 'maleCount',
    //     label: 'Male Subject Count',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const maleCountList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map(
    //                 (g, index) => ({
    //                     label: g.group_name || `Group ${index + 1}`,
    //                     value: g.male_count,
    //                 })
    //             );
    //             return maleCountList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
    // {
    //     id: 'femaleCount',
    //     label: 'Female Subject Count',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const femaleCountList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map(
    //                 (g, index) => ({
    //                     label: g.group_name || `Group ${index + 1}`,
    //                     value: g.female_count,
    //                 })
    //             );
    //             return femaleCountList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
    // {
    //     id: 'ageMaximum',
    //     label: 'Age Maximum',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const ageMaximumList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map(
    //                 (g, index) => ({
    //                     label: g.group_name || `Group ${index + 1}`,
    //                     value: g.age_maximum,
    //                 })
    //             );
    //             return ageMaximumList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
    // {
    //     id: 'ageMinimum',
    //     label: 'Minimum Age',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const ageMinimumList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map(
    //                 (g, index) => ({
    //                     label: g.group_name || `Group ${index + 1}`,
    //                     value: g.age_minimum,
    //                 })
    //             );
    //             return ageMinimumList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
    // {
    //     id: 'ageMedian',
    //     label: 'Median Age',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const ageMedianList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map(
    //                 (g, index) => ({
    //                     label: g.group_name || `Group ${index + 1}`,
    //                     value: g.age_median,
    //                 })
    //             );
    //             return ageMedianList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
    // {
    //     id: 'meanAge',
    //     label: 'Mean Age',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const ageMeanList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map(
    //                 (g, index) => ({
    //                     label: g.group_name || `Group ${index + 1}`,
    //                     value: g.age_mean,
    //                 })
    //             );
    //             return ageMeanList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
    // {
    //     id: 'ageRange',
    //     label: 'ageRange',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const ageRangeList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map(
    //                 (g, index) => ({
    //                     label: g.group_name || `Group ${index + 1}`,
    //                     value: g.age_range,
    //                 })
    //             );
    //             return ageRangeList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
    // {
    //     id: 'count',
    //     label: 'Count',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const countList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map((g, index) => ({
    //                 label: g.group_name || `Group ${index + 1}`,
    //                 value: g.count,
    //             }));
    //             return countList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
    // {
    //     id: 'diagnosis',
    //     label: 'Diagnosis',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const diagnosisList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map(
    //                 (g, index) => ({
    //                     label: g.group_name || `Group ${index + 1}`,
    //                     value: g.diagnosis,
    //                 })
    //             );
    //             return diagnosisList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
    // {
    //     id: 'imagingSample',
    //     label: 'Imaging Sample',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const imagineSampleList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map(
    //                 (g, index) => ({
    //                     label: g.group_name || `Group ${index + 1}`,
    //                     value: g.imaging_sample,
    //                 })
    //             );
    //             return imagineSampleList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
    // {
    //     id: 'subgroupName',
    //     label: 'Subgroup Name',
    //     filterVariant: 'array',
    //     canSort: false,
    //     sortingFn: 'alphanumeric',
    //     customAccessor: (stub) => {
    //         if (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) {
    //             const subgroupNameList = stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups.map(
    //                 (g, index) => ({
    //                     label: g.group_name || `Group ${index + 1}`,
    //                     value: g.subgroup_name,
    //                 })
    //             );
    //             return subgroupNameList;
    //         }
    //         return [];
    //     },
    //     isAIExtracted: true,
    // },
];

export const TASK_EXTRACTOR_CURATOR_COLUMNS: ICurationBoardAIInterfaceCuratorTableType[] = [
    {
        id: 'modality',
        label: 'Modality',
        filterVariant: 'text',
        canSort: false,
        sortingFn: 'alphanumeric',
        customAccessor: (stub) => {
            if (stub[EAIExtractors.TASKEXTRACTOR]) {
                return stub[EAIExtractors.TASKEXTRACTOR]?.Modality;
            }
            return [];
        },
        isAIExtracted: true,
    },
    {
        id: 'studyObjective',
        label: 'Study Objective',
        filterVariant: 'text',
        canSort: false,
        customAccessor: (stub) => {
            if (stub[EAIExtractors.TASKEXTRACTOR]) {
                return stub[EAIExtractors.TASKEXTRACTOR]?.StudyObjective || '';
            }
            return '';
        },
        isAIExtracted: true,
    },
    {
        id: 'taskName',
        label: 'fMRI Task Name',
        filterVariant: 'text',
        canSort: false,
        customAccessor: (stub) => {
            if (stub[EAIExtractors.TASKEXTRACTOR]) {
                const taskNames = (stub[EAIExtractors.TASKEXTRACTOR]?.fMRITasks || [])
                    .filter((t) => !!t.TaskName)
                    .map((task) => task.TaskName);
                return taskNames as string[];
            }
            return [];
        },
        isAIExtracted: true,
    },
    {
        id: 'taskMetrics',
        label: 'fMRI Task Metrics',
        filterVariant: 'text',
        canSort: false,
        customAccessor: (stub) => {
            if (stub[EAIExtractors.TASKEXTRACTOR]) {
                const ageMaximum = (stub[EAIExtractors.TASKEXTRACTOR]?.fMRITasks || []).reduce((acc, curr, index) => {
                    const groupName = curr.TaskName || `fMRI Task ${index + 1}`;
                    acc[groupName] = curr.TaskMetrics;
                    return acc;
                }, {} as IGenericCustomAccessorReturn);
                return ageMaximum;
            }
            return {};
        },
        isAIExtracted: true,
    },
];

export type ICurationTableStudy = ICurationStubStudy & {
    [EAIExtractors.TASKEXTRACTOR]: ITaskExtractor | null;
    [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]: IParticipantDemographicExtractor | null;
};
