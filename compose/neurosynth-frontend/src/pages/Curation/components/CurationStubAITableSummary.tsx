import { ExpandMoreOutlined } from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import AIICon from 'components/AIIcon';
import { IfMRITask, IGroup } from 'hooks/extractions/useGetAllExtractedDataForStudies';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS,
    TASK_EXTRACTOR_CURATOR_COLUMNS,
} from '../hooks/useCuratorTableState.consts';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import { useIsFetching } from 'react-query';

const CurationStubAITableSummary: React.FC<{ stub: ICurationTableStudy | undefined }> = ({ stub }) => {
    const isFetchingExtractions = useIsFetching({ queryKey: ['extraction'] }) > 0;
    const TaskExtractor = stub?.TaskExtractor;
    const { projectId } = useParams<{ projectId: string }>();
    const AIFocusModeSummaryLocalStorageKey = `${projectId}_FOCUS_MODE_AI_SUMMARY_EXPANDED_STATE`;
    const ParticipantDemographicsExtractor = stub?.ParticipantDemographicsExtractor;

    const [expandedState, setExpandedState] = useState(() => {
        const value = localStorage.getItem(AIFocusModeSummaryLocalStorageKey);
        if (!value) return [false, false];
        return JSON.parse(value);
    });

    const modalityStr = (stub?.TaskExtractor?.Modality || []).reduce((acc, curr, index) => {
        if (index === 0) return curr;
        return `${acc}, ${curr}`;
    }, '');

    const handleSetExpandedState = (newExpandedState: [boolean, boolean]) => {
        localStorage.setItem(AIFocusModeSummaryLocalStorageKey, JSON.stringify(newExpandedState));
        setExpandedState(newExpandedState);
    };

    if (isFetchingExtractions) {
        return (
            <>
                <Skeleton width="100%" height="50px" sx={{ transform: 'none', marginBottom: '2px' }} />
                <Skeleton width="100%" height="50px" sx={{ transform: 'none' }} />
            </>
        );
    }

    if (!TaskExtractor && !ParticipantDemographicsExtractor) {
        return (
            <Typography color="warning.dark" variant="body2">
                We have no extracted data for this study. (Perhaps this is a new record and we have no text for it yet)
            </Typography>
        );
    }

    return (
        <Box>
            <Accordion expanded={expandedState[0]}>
                <AccordionSummary
                    onClick={() => handleSetExpandedState([!expandedState[0], expandedState[1]])}
                    expandIcon={<ExpandMoreOutlined />}
                >
                    <Box sx={{ display: 'flex' }}>
                        <AIICon sx={{ marginRight: '0.5rem' }} />
                        Experimental Details
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    {TaskExtractor ? (
                        <>
                            <Typography variant="body2" fontWeight="bold">
                                Modality:
                            </Typography>
                            <Typography variant="body2">{modalityStr}</Typography>
                            <Typography variant="body2" fontWeight="bold" sx={{ marginTop: '0.5rem' }}>
                                Objective:
                            </Typography>
                            <Typography variant="body2"> {TaskExtractor.StudyObjective || ''}</Typography>
                            {TaskExtractor.fMRITasks && TaskExtractor.fMRITasks.length > 0 ? (
                                <Table sx={{ marginTop: '0.5rem', tableLayout: 'fixed' }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ p: '8px' }}>
                                                <Typography variant="body2" fontWeight="bold">
                                                    fMRI Tasks
                                                </Typography>
                                            </TableCell>
                                            {TaskExtractor.fMRITasks.map((task, index) => (
                                                <TableCell key={index} sx={{ p: '8px' }}>
                                                    <Typography variant="body2">Task {index + 1}</Typography>
                                                </TableCell>
                                            ))}
                                            {/* {TaskExtractor.BehavioralTasks?.map((task, index) => (
                                                <TableCell key={index} sx={{ p: '8px' }}>
                                                    <Typography variant="body2">
                                                        Behavioral Task ({index + 1})
                                                    </Typography>
                                                </TableCell>
                                            ))} */}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {TASK_EXTRACTOR_CURATOR_COLUMNS.filter((col) => col.id.includes('fMRI')).map(
                                            (col, rowIndex) => (
                                                <TableRow key={rowIndex}>
                                                    <TableCell sx={{ p: '8px' }}>
                                                        <Box style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <Typography variant="body2">
                                                                {col.label.replace('fMRI Task', '')}
                                                            </Typography>
                                                            <Typography variant="caption">{col.description}</Typography>
                                                        </Box>
                                                    </TableCell>
                                                    {TaskExtractor.fMRITasks?.map((task, cellIndex) => {
                                                        const id = col.id.split('.')[1] as keyof IfMRITask;
                                                        let value = task[id];
                                                        if (Array.isArray(value)) {
                                                            value = value.reduce(
                                                                (acc, curr, index) =>
                                                                    index === 0 ? curr : `${acc}, ${curr}`,
                                                                ''
                                                            );
                                                        } else if (value !== null && typeof value === 'object') {
                                                            value = Object.entries(value).reduce(
                                                                (acc, [key, value], index, list) => {
                                                                    return `${acc}${key}: ${value}${index === list.length - 1 ? '' : '\n\n'}`;
                                                                },
                                                                ''
                                                            );
                                                        } else if (value === undefined) {
                                                            value = 'undefined';
                                                        } else if (value === null) {
                                                            value = 'null';
                                                        } else if (typeof value !== 'string') {
                                                            value = value.toString();
                                                        }

                                                        return (
                                                            <TableCell key={cellIndex} sx={{ p: '8px' }}>
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        whiteSpace: 'pre-wrap',
                                                                        color:
                                                                            value === null || value === undefined
                                                                                ? 'warning.dark'
                                                                                : 'inherit',
                                                                    }}
                                                                >
                                                                    {value ?? '---'}
                                                                </Typography>
                                                            </TableCell>
                                                        );
                                                    })}
                                                    {/* {TaskExtractor.BehavioralTasks?.map((task, cellIndex) => {
                                                        const id = col.id.split('.')[1] as keyof IBehavioralTask;
                                                        let value = task[id];
                                                        if (Array.isArray(value)) {
                                                            value = value.reduce(
                                                                (acc, curr, index) =>
                                                                    index === 0 ? curr : `${acc}, ${curr}`,
                                                                ''
                                                            );
                                                        }
                                                        return (
                                                            <TableCell key={cellIndex}>
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        whiteSpace: 'pre-wrap',
                                                                        color:
                                                                            value === null || value === undefined
                                                                                ? 'warning.dark'
                                                                                : 'inherit',
                                                                    }}
                                                                >
                                                                    {value || '---'}
                                                                </Typography>
                                                            </TableCell>
                                                        );
                                                    })} */}
                                                </TableRow>
                                            )
                                        )}
                                    </TableBody>
                                </Table>
                            ) : (
                                <Typography color="warning.dark" mt="0.5rem" variant="body2">
                                    No tasks
                                </Typography>
                            )}
                        </>
                    ) : (
                        <Typography color="warning.dark" variant="body2">
                            No extraction found
                        </Typography>
                    )}
                </AccordionDetails>
            </Accordion>

            <Accordion expanded={expandedState[1]}>
                <AccordionSummary
                    onClick={() => handleSetExpandedState([expandedState[0], !expandedState[1]])}
                    expandIcon={<ExpandMoreOutlined />}
                >
                    <Box sx={{ display: 'flex' }}>
                        <AIICon sx={{ marginRight: '0.5rem' }} />
                        Participant Demographics
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    {ParticipantDemographicsExtractor ? (
                        <Table sx={{ marginTop: '0.5rem', tableLayout: 'fixed' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell></TableCell>
                                    {ParticipantDemographicsExtractor.groups?.map((group, index) => (
                                        <TableCell key={index}>
                                            <Typography variant="body2">Group {index + 1}</Typography>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS.map((col, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <Box style={{ display: 'flex', flexDirection: 'column' }}>
                                                <Typography>{col.label}</Typography>
                                                <Typography variant="caption">{col.description}</Typography>
                                            </Box>
                                        </TableCell>
                                        {ParticipantDemographicsExtractor.groups?.map((group, index) => {
                                            const value =
                                                col.id === 'group_name'
                                                    ? `${group[col.id as keyof IGroup]} ${group.subgroup_name ? `(${group.subgroup_name})` : ''}`
                                                    : group[col.id as keyof IGroup];
                                            return (
                                                <TableCell key={index}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            whiteSpace: 'pre-wrap',
                                                            color: value ? 'inherit' : 'warning.dark',
                                                        }}
                                                    >
                                                        {value || '---'}
                                                    </Typography>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Typography color="warning.dark" variant="body2">
                            No extraction found
                        </Typography>
                    )}
                </AccordionDetails>
            </Accordion>
        </Box>
    );
};

export default CurationStubAITableSummary;
