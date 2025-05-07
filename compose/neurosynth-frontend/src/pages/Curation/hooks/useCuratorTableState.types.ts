import { SortingColumnDef } from '@tanstack/react-table';
import {
    EAIExtractors,
    IBehavioralTask,
    IfMRITask,
    IGroup,
    IParticipantDemographicExtractor,
    ITaskExtractor,
} from 'hooks/extractions/useGetAllExtractedData';
import { ICurationStubStudy } from '../Curation.types';

export interface IGenericCustomAccessorReturn {
    key: string;
    value: number | string | boolean | null | undefined | string[];
}

export type ICurationTableColumnType = IGenericCustomAccessorReturn[] | string | number | string[];

export interface ICurationBoardAIInterfaceCuratorColumnType {
    id: string;
    label: string;
    AIExtractor?: EAIExtractors;
    filterVariant?: 'text' | 'numeric' | 'autocomplete';
    canSort: boolean;
    sortingFn?: SortingColumnDef<ICurationTableStudy>['sortingFn'];
    customAccessor?: (stub: ICurationTableStudy) => ICurationTableColumnType;
}

// must put here instead of useCurratorTableState.helpers.ts in order to prevent circular dependency
const createCustomTaskExtractorAccessor = (
    property: keyof IfMRITask | keyof IBehavioralTask,
    taskType: 'FMRI' | 'BEHAVIORAL',
    stub: ICurationTableStudy
): IGenericCustomAccessorReturn[] => {
    if (!stub[EAIExtractors.TASKEXTRACTOR]) return [];

    let allValuesEmpty = true;
    const tasksList: IGenericCustomAccessorReturn[] = [];

    if (taskType === 'FMRI') {
        (stub[EAIExtractors.TASKEXTRACTOR]?.fMRITasks || []).forEach((task, index) => {
            const groupName = task.TaskName || `fMRI Task ${index + 1}`;
            const value = task[property];
            if (value !== undefined && value !== null && value !== 'undefined' && value !== 'null')
                allValuesEmpty = false;
            tasksList.push({ key: groupName, value: value });
        });
    } else {
        (stub[EAIExtractors.TASKEXTRACTOR]?.BehavioralTasks || []).forEach((task, index) => {
            const groupName = task.TaskName || `Behavioral Task ${index + 1}`;
            const typedProperty = property as keyof IBehavioralTask;
            const value = task[typedProperty];
            if (value !== undefined && value !== null && value !== 'undefined' && value !== 'null')
                allValuesEmpty = false;
            tasksList.push({ key: groupName, value: value });
        });
    }

    return allValuesEmpty ? [] : tasksList;
};

// must put here instead of useCurratorTableState.helpers.ts in order to prevent circular dependency
const createCustomParticipantDemographicsExtractorAccessor = (
    property: keyof IGroup,
    stub: ICurationTableStudy
): IGenericCustomAccessorReturn[] => {
    if (!stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) return [];
    let allValuesEmpty = true;
    const groupsList: IGenericCustomAccessorReturn[] = [];

    (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups || [])?.forEach((group, index) => {
        const groupName = group.group_name || `fMRI Task ${index + 1}`;
        const value = group[property];
        if (value !== undefined && value !== null && value !== 'undefined' && value !== 'null') allValuesEmpty = false;
        groupsList.push({ key: groupName, value: value });
    });

    return allValuesEmpty ? [] : groupsList;
};

export const STUB_CURATOR_COLUMNS: ICurationBoardAIInterfaceCuratorColumnType[] = [
    {
        id: 'articleYear',
        label: 'Year',
        filterVariant: 'numeric',
        canSort: true,
        sortingFn: 'alphanumeric',
    },
    { id: 'title', label: 'Title', filterVariant: 'text', canSort: true, sortingFn: 'text' },
    { id: 'authors', label: 'Authors', filterVariant: 'text', canSort: true, sortingFn: 'text' },
    {
        id: 'keywords',
        label: 'Keywords',
        filterVariant: 'text',
        canSort: false,
    },
    {
        id: 'pmid',
        label: 'PMID',
        filterVariant: 'text',
        canSort: true,
        sortingFn: 'alphanumeric',
    },
    { id: 'doi', label: 'DOI', filterVariant: 'text', canSort: true, sortingFn: 'alphanumeric' },
    { id: 'journal', label: 'Journal', filterVariant: 'autocomplete', canSort: true, sortingFn: 'text' },
    {
        id: 'abstractText',
        label: 'Abstract',
        filterVariant: 'text',
        canSort: false,
    },
    {
        id: 'identificationSource',
        label: 'Source',
        filterVariant: 'autocomplete',
        canSort: true,
        sortingFn: 'text',
        customAccessor: (stub) => stub.identificationSource.label,
    },
];

export const PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS: ICurationBoardAIInterfaceCuratorColumnType[] = [
    {
        id: 'group_name',
        label: 'Group Names',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('subgroup_name', stub),
        // customAccessor: (stub) => {
        //     if (!stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) return [];
        //     const groupNames = (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups || [])
        //         .filter((g) => !!g.group_name)
        //         .map((g) => ({
        //             key: g.group_name,
        //             value: g.subgroup_name || '',
        //         }));

        //     return groupNames as IGenericCustomAccessorReturn[];
        // },
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    // {
    //     id: 'subgroupName',
    //     label: 'Subgroup Name',
    //     canSort: false,
    //     customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('subgroup_name', stub),
    //     AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    //     filterVariant: 'autocomplete',
    // },
    {
        id: 'diagnosis',
        label: 'Diagnosis',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => {
            if (!stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) return [];
            const diagnoses = (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups || [])
                .filter((g) => !!g.diagnosis)
                .map((g) => g.diagnosis as string);
            return diagnoses;
        },
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'count',
        label: 'Count',
        canSort: false,
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('count', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'male_count',
        label: 'Male Subject Count',
        canSort: false,
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('male_count', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'female_count',
        label: 'Female Subject Count',
        canSort: false,
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('female_count', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'age_maximum',
        label: 'Maximum Age',
        canSort: false,
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('age_maximum', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'age_minimum',
        label: 'Minimum Age',
        canSort: false,
        filterVariant: 'numeric',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('age_minimum', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'age_median',
        label: 'Median Age',
        canSort: false,
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('age_median', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'age_mean',
        label: 'Mean Age',
        canSort: false,
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('age_mean', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'age_range',
        label: 'Age Range',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('age_range', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'imaging_sample',
        label: 'Imaging Sample',
        canSort: false,
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('imaging_sample', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
        filterVariant: 'autocomplete',
    },
];

export const TASK_EXTRACTOR_CURATOR_COLUMNS: ICurationBoardAIInterfaceCuratorColumnType[] = [
    {
        id: 'Modality',
        label: 'Modality',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => {
            if (!stub[EAIExtractors.TASKEXTRACTOR]) return [];
            return stub[EAIExtractors.TASKEXTRACTOR]?.Modality || [];
        },
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'StudyObjective',
        label: 'Study Objective',
        filterVariant: 'text',
        canSort: false,
        customAccessor: (stub) => {
            if (!stub[EAIExtractors.TASKEXTRACTOR]) return '';
            return stub[EAIExtractors.TASKEXTRACTOR]?.StudyObjective || '';
        },
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.TaskName',
        label: 'fMRI Task Name',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => {
            if (!stub[EAIExtractors.TASKEXTRACTOR]) return [];
            const taskNames = (stub[EAIExtractors.TASKEXTRACTOR]?.fMRITasks || [])
                .filter((t) => !!t.TaskName)
                .map((task) => task.TaskName);
            return taskNames as string[];
        },
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.Domain',
        label: 'fMRI Task Domain',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => createCustomTaskExtractorAccessor('Domain', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.Concepts',
        label: 'fMRI Task Concepts',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('Concepts', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
        filterVariant: 'autocomplete',
    },
    {
        id: 'fMRITasks.Conditions',
        label: 'fMRI Task Conditions',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('Conditions', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
        filterVariant: 'autocomplete',
    },
    {
        id: 'fMRITasks.TaskMetrics',
        label: 'fMRI Task Metrics',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => createCustomTaskExtractorAccessor('TaskMetrics', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.TaskDescription',
        label: 'fMRI Task Description',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('TaskDescription', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.DesignDetails',
        label: 'fMRI Task Design Details',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('DesignDetails', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.TaskDesign',
        label: 'fMRI Task Design',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('TaskDesign', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
        filterVariant: 'autocomplete',
    },
    {
        id: 'fMRITasks.RestingState',
        label: 'fMRI Task Resting State',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('RestingState', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
        filterVariant: 'autocomplete',
    },
    {
        id: 'fMRITasks.RestingStateMetadata',
        label: 'fMRI Task Resting State Metadata',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('RestingStateMetadata', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.TaskDuration',
        label: 'fMRI Task Duration',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('TaskDuration', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    // {
    //     id: 'behavioralTaskName',
    //     label: 'Behavioral Task Name',
    //     canSort: false,
    //     customAccessor: (stub) => {
    //         if (!stub[EAIExtractors.TASKEXTRACTOR]) return [];
    //         const taskNames = (stub[EAIExtractors.TASKEXTRACTOR]?.BehavioralTasks || [])
    //             .filter((t) => !!t.TaskName)
    //             .map((task) => task.TaskName);
    //         return taskNames as string[];
    //     },
    //     AIExtractor: EAIExtractors.TASKEXTRACTOR,
    // },
    // {
    //     id: 'behavioralTaskMetrics',
    //     label: 'Behavioral Task Metrics',
    //     canSort: false,
    //     filterVariant: 'autocomplete',
    //     customAccessor: (stub) => createCustomTaskExtractorAccessor('TaskMetrics', 'BEHAVIORAL', stub),
    //     AIExtractor: EAIExtractors.TASKEXTRACTOR,
    // },
    // {
    //     id: 'behavioralTaskDescription',
    //     label: 'Behavioral Task Description',
    //     canSort: false,
    //     customAccessor: (stub) => createCustomTaskExtractorAccessor('TaskDescription', 'BEHAVIORAL', stub),
    //     AIExtractor: EAIExtractors.TASKEXTRACTOR,
    // },
    // {
    //     id: 'behavioralDomain',
    //     label: 'Behavioral Task Domain',
    //     canSort: false,
    //     customAccessor: (stub) => createCustomTaskExtractorAccessor('Domain', 'BEHAVIORAL', stub),
    //     AIExtractor: EAIExtractors.TASKEXTRACTOR,
    // },
    // {
    //     id: 'behavioralDesignDetails',
    //     label: 'Behavioral Task Design Details',
    //     canSort: false,
    //     customAccessor: (stub) => createCustomTaskExtractorAccessor('DesignDetails', 'BEHAVIORAL', stub),
    //     AIExtractor: EAIExtractors.TASKEXTRACTOR,
    // },
    // {
    //     id: 'behavioralConditions',
    //     label: 'Behavioral Task Conditions',
    //     canSort: false,
    //     customAccessor: (stub) => createCustomTaskExtractorAccessor('Conditions', 'BEHAVIORAL', stub),
    //     AIExtractor: EAIExtractors.TASKEXTRACTOR,
    // },
    // {
    //     id: 'behavioralConcepts',
    //     label: 'Behavioral Task Concepts',
    //     canSort: false,
    //     filterVariant: 'autocomplete',
    //     customAccessor: (stub) => createCustomTaskExtractorAccessor('Concepts', 'BEHAVIORAL', stub),
    //     AIExtractor: EAIExtractors.TASKEXTRACTOR,
    // },
];

export type ICurationTableStudy = ICurationStubStudy & {
    [EAIExtractors.TASKEXTRACTOR]: ITaskExtractor | null;
    [EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]: IParticipantDemographicExtractor | null;
};
