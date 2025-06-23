import { EAIExtractors, IBehavioralTask, IfMRITask, IGroup } from 'hooks/extractions/useGetAllExtractedData';
import {
    ICurationBoardAIInterfaceCuratorColumnType,
    ICurationTableStudy,
    IGenericCustomAccessorReturn,
} from './useCuratorTableState.types';

// must put here instead of useCurratorTableState.helpers.ts in order to prevent circular dependency
const createCustomTaskExtractorAccessor = (
    property: keyof IfMRITask | keyof IBehavioralTask,
    taskType: 'FMRI' | 'BEHAVIORAL',
    stub: ICurationTableStudy
): IGenericCustomAccessorReturn[] | null => {
    if (!stub[EAIExtractors.TASKEXTRACTOR]) return null;

    let allValuesEmpty = true;
    const tasksList: IGenericCustomAccessorReturn[] = [];

    if (taskType === 'FMRI') {
        (stub[EAIExtractors.TASKEXTRACTOR]?.fMRITasks || []).forEach((task, index) => {
            const groupName = task.TaskName || `fMRI Task ${index + 1}`;
            const value = task[property];
            if (value !== undefined && value !== null && value !== 'undefined' && value !== 'null') {
                allValuesEmpty = false;
            }
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
): IGenericCustomAccessorReturn[] | null => {
    if (!stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) return null;
    let allValuesEmpty = true;
    const groupsList: IGenericCustomAccessorReturn[] = [];

    (stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]?.groups || [])?.forEach((group, index) => {
        const groupName = group.group_name || `Group ${index + 1}`;
        const value = group[property];
        if (value !== undefined && value !== null && value !== 'undefined' && value !== 'null') allValuesEmpty = false;
        groupsList.push({ key: groupName, value: value });
    });

    return allValuesEmpty ? [] : groupsList;
};

export const STUB_CURATOR_COLUMNS: ICurationBoardAIInterfaceCuratorColumnType[] = [
    { id: 'title', label: 'Title', filterVariant: 'text', canSort: true, sortingFn: 'text' },
    {
        id: 'articleYear',
        label: 'Year',
        filterVariant: 'numeric',
        canSort: true,
        sortingFn: 'alphanumeric',
        size: 150,
    },
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
        id: 'group_name', // combine subgroup and group names
        label: 'Group Names',
        description: 'Group name, healthy or patients',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('subgroup_name', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'diagnosis',
        label: 'Diagnosis',
        description: 'Diagnosis of the group, if any',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => {
            if (!stub[EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR]) return null;
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
        description: 'Number of participants in this group',
        canSort: false,
        filterVariant: 'numeric',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('count', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'male_count',
        label: 'Male Subject Count',
        description: 'Number of male participants in this group',
        canSort: false,
        filterVariant: 'numeric',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('male_count', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'female_count',
        label: 'Female Subject Count',
        description: 'Number of female participants in this group',
        canSort: false,
        filterVariant: 'numeric',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('female_count', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'age_maximum',
        label: 'Maximum Age',
        description: 'Maximum age of participants in this group',
        canSort: false,
        filterVariant: 'numeric',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('age_maximum', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'age_minimum',
        label: 'Minimum Age',
        description: 'Minimum age of participants in this group',
        canSort: false,
        filterVariant: 'numeric',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('age_minimum', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'age_median',
        label: 'Median Age',
        description: 'Median age of participants in this group',
        canSort: false,
        filterVariant: 'numeric',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('age_median', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'age_mean',
        label: 'Mean Age',
        description: 'Mean age of participants in this group',
        canSort: false,
        filterVariant: 'numeric',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('age_mean', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'age_range',
        label: 'Age Range',
        description: 'Age range of participants in this group, separated by a dash',
        canSort: false,
        // filterVariant: 'autocomplete',
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('age_range', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
    },
    {
        id: 'imaging_sample',
        label: 'Imaging Sample',
        description: 'Whether this subgroup underwent fMRI, MRI, or neuroimaging (yes or no',
        canSort: false,
        customAccessor: (stub) => createCustomParticipantDemographicsExtractorAccessor('imaging_sample', stub),
        AIExtractor: EAIExtractors.PARTICIPANTSDEMOGRAPHICSEXTRACTOR,
        filterVariant: 'autocomplete',
    },
];

export const TASK_EXTRACTOR_CURATOR_COLUMNS: ICurationBoardAIInterfaceCuratorColumnType[] = [
    {
        id: 'modality',
        label: 'Modality',
        description: 'Modality of the neuroimaging data',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => {
            if (!stub[EAIExtractors.TASKEXTRACTOR]) return null;
            return stub[EAIExtractors.TASKEXTRACTOR]?.Modality || [];
        },
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'studyobjective',
        label: 'Study Objective',
        description: 'A brief summary of the primary research question or objective of the study.',
        filterVariant: 'text',
        canSort: false,
        customAccessor: (stub) => {
            if (!stub[EAIExtractors.TASKEXTRACTOR]) return null;
            return stub[EAIExtractors.TASKEXTRACTOR]?.StudyObjective || '';
        },
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.TaskName',
        label: 'fMRI Task Name',
        description: "Name of the task, e.g., 'Stroop Task' or 'Go/No-Go Task'.",
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => {
            if (!stub[EAIExtractors.TASKEXTRACTOR]) return null;
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
        description: 'The domain of the task, e.g., "Perception", "Attention", "Emotion" etc.',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => createCustomTaskExtractorAccessor('Domain', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.Concepts',
        label: 'fMRI Task Concepts',
        description:
            'List of mental concepts associated with the task, such as cognitive processes or representations it engages',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('Concepts', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
        filterVariant: 'autocomplete',
    },
    {
        id: 'fMRITasks.Conditions',
        label: 'fMRI Task Conditions',
        description: 'Conditions of task performed by the subjects.',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('Conditions', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
        filterVariant: 'autocomplete',
    },
    {
        id: 'fMRITasks.TaskMetrics',
        label: 'fMRI Task Metrics',
        description:
            'Key metrics or outcomes measured during the task, e.g., "response time", "accuracy", and "fMRI BOLD signal".',
        canSort: false,
        filterVariant: 'autocomplete',
        customAccessor: (stub) => createCustomTaskExtractorAccessor('TaskMetrics', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.TaskDescription',
        label: 'fMRI Task Description',
        description: 'Description of the key features of the task, such as its purpose or what it measures.',
        canSort: false,
        filterVariant: 'text',
        customAccessor: (stub) => createCustomTaskExtractorAccessor('TaskDescription', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.DesignDetails',
        label: 'fMRI Task Design Details',
        description:
            'A detailed description of the task design including information on the number of conditions, the number of trials per condition, the length of trials, and the length of inter-trial intervals.',
        canSort: false,
        filterVariant: 'text',
        customAccessor: (stub) => createCustomTaskExtractorAccessor('DesignDetails', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
    },
    {
        id: 'fMRITasks.TaskDesign',
        label: 'fMRI Task Design',
        description: 'Design(s) of the task',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('TaskDesign', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
        filterVariant: 'autocomplete',
    },
    {
        id: 'fMRITasks.RestingState',
        label: 'fMRI Task Resting State',
        description: 'Whether this task wa a resting state task or not',
        canSort: false,
        customAccessor: (stub) => createCustomTaskExtractorAccessor('RestingState', 'FMRI', stub),
        AIExtractor: EAIExtractors.TASKEXTRACTOR,
        filterVariant: 'autocomplete',
    },
    // {
    //     id: 'fMRITasks.RestingStateMetadata',
    //     label: 'fMRI Task Resting State Metadata',
    //     description:
    //         'Additional details about the resting-state task, such as duration and instructions provided to participants, if applicable',
    //     canSort: false,
    //     customAccessor: (stub) => createCustomTaskExtractorAccessor('RestingStateMetadata', 'FMRI', stub),
    //     AIExtractor: EAIExtractors.TASKEXTRACTOR,
    // },
    {
        id: 'fMRITasks.TaskDuration',
        label: 'fMRI Task Duration',
        description: "Total duration of the task, e.g., '10 minutes' or '600 seconds'.",
        canSort: false,
        filterVariant: 'text',
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
