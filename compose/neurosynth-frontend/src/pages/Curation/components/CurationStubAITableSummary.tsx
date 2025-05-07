import { Box, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import AIICon from 'components/AIIcon';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import { IBehavioralTask, IfMRITask, IGroup } from 'hooks/extractions/useGetAllExtractedData';
import {
    ICurationTableStudy,
    PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS,
    TASK_EXTRACTOR_CURATOR_COLUMNS,
} from '../hooks/useCuratorTableState.types';

const CurationStubAITableSummary: React.FC<{ stub: ICurationTableStudy | undefined }> = ({ stub }) => {
    const TaskExtractor = stub?.TaskExtractor;
    const ParticipantDemographicsExtractor = stub?.ParticipantDemographicsExtractor;

    const modalityStr = (stub?.TaskExtractor?.Modality || []).reduce((acc, curr, index) => {
        if (index === 0) return curr;
        return `${acc}, ${curr}`;
    }, '');

    return (
        <Box>
            {TaskExtractor && (
                <NeurosynthAccordion
                    expandIconColor="gray"
                    TitleElement={
                        <Box sx={{ display: 'flex' }}>
                            <AIICon sx={{ marginRight: '0.5rem' }} />
                            Experimental Details
                        </Box>
                    }
                >
                    <Typography variant="body2" fontWeight="bold">
                        Modality:
                        
                    </Typography>
                    <Typography variant="body2">{modalityStr}</Typography>
                    <Typography variant="body2" fontWeight="bold" sx={{ marginTop: '0.5rem' }}>
                        Objective:
                    </Typography>
                    <Typography variant="body2"> {TaskExtractor.StudyObjective || ''}</Typography>
                    {TaskExtractor.fMRITasks && TaskExtractor.fMRITasks.length > 0 ? (
                        <Table sx={{ marginTop: '0.5rem' }}>
                            <TableBody>
                                {TASK_EXTRACTOR_CURATOR_COLUMNS.filter((col) => col.id.includes('fMRI')).map(
                                    (col, rowIndex) => (
                                        <TableRow key={rowIndex}>
                                            <TableCell>{col.label.replace('fMRI Task', '')}</TableCell>
                                            {TaskExtractor.fMRITasks?.map((task, cellIndex) => {
                                                const id = col.id.split('.')[1] as keyof IfMRITask;
                                                let value = task[id];
                                                if (Array.isArray(value)) {
                                                    value = value.reduce(
                                                        (acc, curr, index) => (index === 0 ? curr : `${acc}, ${curr}`),
                                                        ''
                                                    );
                                                }
                                                return (
                                                    <TableCell key={cellIndex}>
                                                        <Typography
                                                            variant="body2"
                                                            sx={{ color: value ? 'inherit' : 'warning.dark' }}
                                                        >
                                                            {value || 'no data'}
                                                            {rowIndex === 0 ? ' (fMRI)' : ''}
                                                        </Typography>
                                                    </TableCell>
                                                );
                                            })}
                                            {TaskExtractor.BehavioralTasks?.map((task, cellIndex) => {
                                                const id = col.id.split('.')[1] as keyof IBehavioralTask;
                                                let value = task[id];
                                                if (Array.isArray(value)) {
                                                    value = value.reduce(
                                                        (acc, curr, index) => (index === 0 ? curr : `${acc}, ${curr}`),
                                                        ''
                                                    );
                                                }
                                                return (
                                                    <TableCell key={cellIndex}>
                                                        <Typography
                                                            variant="body2"
                                                            sx={{ color: value ? 'inherit' : 'warning.dark' }}
                                                        >
                                                            {value || 'no data'}
                                                            {rowIndex === 0 ? ' (Behavioral)' : ''}
                                                        </Typography>
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    )
                                )}
                            </TableBody>
                        </Table>
                    ) : (
                        <Typography color="warning.dark" mt="0.5rem">
                            No tasks
                        </Typography>
                    )}
                </NeurosynthAccordion>
            )}

            {ParticipantDemographicsExtractor && (
                <NeurosynthAccordion
                    expandIconColor="gray"
                    TitleElement={
                        <Box sx={{ display: 'flex' }}>
                            <AIICon sx={{ marginRight: '0.5rem' }} />
                            Participant Demographics
                        </Box>
                    }
                >
                    <Table sx={{ marginTop: '0.5rem' }}>
                        <TableBody>
                            {PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS.map((col, index) => (
                                <TableRow key={index}>
                                    <TableCell>{col.label}</TableCell>
                                    {ParticipantDemographicsExtractor.groups?.map((group, index) => {
                                        const value =
                                            col.id === 'group_name'
                                                ? `${group[col.id as keyof IGroup]} ${group.subgroup_name ? `(${group.subgroup_name})` : ''}`
                                                : group[col.id as keyof IGroup];
                                        return (
                                            <TableCell key={index}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ color: value ? 'inherit' : 'warning.dark' }}
                                                >
                                                    {value || 'no data'}
                                                </Typography>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </NeurosynthAccordion>
            )}
        </Box>
    );
};

export default CurationStubAITableSummary;
