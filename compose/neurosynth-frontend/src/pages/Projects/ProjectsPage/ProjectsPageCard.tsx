import {
    Box,
    Chip,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Link as MuiLink,
    Step,
    StepLabel,
    Stepper,
    Typography,
} from '@mui/material';
import { useGetMetaAnalysesByIds, useGetStudysetById } from 'hooks';
import { INeurosynthProjectReturn } from 'hooks/projects/useGetProjects';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

const ProjectsPageCard: React.FC<INeurosynthProjectReturn> = (props) => {
    const { name, description, provenance, updated_at, created_at, id, meta_analyses } = props;

    const { data: studyset, isLoading } = useGetStudysetById(
        provenance?.extractionMetadata?.studysetId
    );

    const { data: metaAnalyses, isError } = useGetMetaAnalysesByIds(meta_analyses as string[]);

    const lastUpdateDate = useMemo(() => {
        const lastUpdated = new Date(updated_at || created_at || '');
        return `${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString()}`;
    }, [created_at, updated_at]);

    return (
        <Box
            sx={{
                backgroundColor: '#f9f9f9',
                padding: '1.5rem',
                margin: '1rem 0',
                borderRadius: '8px',
            }}
        >
            <Box sx={{ display: 'flex' }}>
                <Box sx={{ width: '80%' }}>
                    <Typography color="black" variant="caption">
                        Last updated: {lastUpdateDate}
                    </Typography>
                    <MuiLink component={Link} to={`/projects/${id}`} underline="hover">
                        <Typography color="primary" variant="h6">
                            {name || ''}
                        </Typography>
                    </MuiLink>
                    <Box mb="0.5rem">
                        {studyset && (
                            <Chip
                                color="info"
                                variant="outlined"
                                size="small"
                                label={`${(studyset.studies || []).length} studies`}
                            />
                        )}
                    </Box>
                    <Typography sx={{ color: 'muted.main' }} variant="body1">
                        {description || ''}
                    </Typography>
                    <Box>
                        <List sx={{ backgroundColor: '#e9e9e9' }} disablePadding>
                            {(metaAnalyses || []).map((metaAnalysis) => (
                                <ListItem disablePadding>
                                    <ListItemButton>
                                        <ListItemText secondary={metaAnalysis.description}>
                                            {metaAnalysis.name || ''}
                                        </ListItemText>
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                </Box>
                <Box sx={{ width: '20%', display: 'flex', justifyContent: 'flex-end' }}>
                    <Stepper orientation="vertical" activeStep={1}>
                        <Step>
                            <StepLabel>Curation</StepLabel>
                        </Step>
                        <Step>
                            <StepLabel>Extraction</StepLabel>
                        </Step>
                        <Step>
                            <StepLabel>Meta-Analysis</StepLabel>
                        </Step>
                    </Stepper>
                </Box>
            </Box>
        </Box>
    );
};

export default ProjectsPageCard;
