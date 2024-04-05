import { Box, Chip, Link as MuiLink, Stepper, Typography } from '@mui/material';
import { useGetMetaAnalysesByIds, useGetStudysetById } from 'hooks';
import { INeurosynthProjectReturn } from 'hooks/projects/useGetProjects';
import { getCurationSummary } from 'hooks/useGetCurationSummary';
import { getExtractionSummary } from 'hooks/useGetExtractionSummary';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ProjectPageCardStep from './ProjectPageCardStep';
import ProjectPageCardSummaryCuration from './ProjectPageCardSummaryCuration';
import ProjectPageCardExtractionSummary from './ProjectPageCardSummaryExtraction';
import ProjectPageCardSummaryMetaAnalyses from './ProjectPageCardSummaryMetaAnalyses';
import { MetaAnalysis } from 'neurosynth-compose-typescript-sdk';

const ProjectsPageCard: React.FC<INeurosynthProjectReturn> = (props) => {
    const { name, description, provenance, updated_at, created_at, id, meta_analyses = [] } = props;

    const { data: studyset } = useGetStudysetById(
        provenance?.extractionMetadata?.studysetId,
        false
    );
    const { data: metaAnalyses } = useGetMetaAnalysesByIds(meta_analyses as string[]);

    const lastUpdateDate = useMemo(() => {
        const lastUpdated = new Date(updated_at || created_at || '');
        return `${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString()}`;
    }, [created_at, updated_at]);

    const curationSummary = useMemo(() => {
        if (provenance.curationMetadata.columns.length === 0) return;

        return getCurationSummary(provenance.curationMetadata.columns);
    }, [provenance.curationMetadata.columns]);

    const extractionSummary = useMemo(() => {
        if (!provenance.extractionMetadata.studysetId) return;

        const studysetStudies = (studyset?.studies || []) as string[];
        const studyStatusesList = provenance.extractionMetadata.studyStatusList;
        return getExtractionSummary(studysetStudies, studyStatusesList);
    }, [
        provenance.extractionMetadata.studyStatusList,
        provenance.extractionMetadata.studysetId,
        studyset?.studies,
    ]);

    const activeStep = useMemo(() => {
        if (!curationSummary) return -1;
        if (!extractionSummary) return 0;
        if (!provenance?.metaAnalysisMetadata?.canEditMetaAnalyses) return 1;

        const metaAnalysesWithResults = ((metaAnalyses || []) as Array<MetaAnalysis>).filter(
            (analysis) => (analysis.results?.length || 0) > 0
        );
        if (metaAnalyses?.length === 0 || metaAnalysesWithResults.length === 0) return 2;
        return 3; // getting here means that at least one meta-analysis has been run
    }, [
        curationSummary,
        extractionSummary,
        metaAnalyses,
        provenance?.metaAnalysisMetadata?.canEditMetaAnalyses,
    ]);

    const metaAnalysisOptionalText = useMemo(() => {
        if (!metaAnalyses || metaAnalyses.length === 0) {
            return 'Not started';
        }
        const metaAnalysesWithResultsList = ((metaAnalyses || []) as Array<MetaAnalysis>).filter(
            (analysis) => (analysis.results?.length || 0) > 0
        );
        if (metaAnalysesWithResultsList.length === 0) {
            return 'In progress';
        } else {
            return `Ran ${metaAnalysesWithResultsList.length}/${metaAnalyses.length} meta-analyses`;
        }
    }, [metaAnalyses]);

    return (
        <Box sx={{ display: 'flex', padding: '1rem', marginBottom: '0.5rem' }}>
            <Box
                sx={{
                    width: '250px',
                    maxWidth: '250px',
                    minWidth: '250px',
                    position: 'sticky',
                    top: '1rem',
                    height: '100%',
                }}
            >
                <Stepper
                    orientation="vertical"
                    activeStep={activeStep}
                    sx={{
                        '.MuiStepConnector-lineVertical': {
                            minHeight: '0px !important',
                            height: '0px !important',
                        },
                    }}
                >
                    <ProjectPageCardStep
                        title="Curation"
                        optionalText={
                            activeStep < 0
                                ? 'Not started'
                                : activeStep === 0
                                ? 'In progress'
                                : 'Completed'
                        }
                        isActive={activeStep === 0}
                    />
                    <ProjectPageCardStep
                        title="Extraction"
                        optionalText={
                            activeStep < 1
                                ? 'Not started'
                                : activeStep === 1
                                ? 'In progress'
                                : 'Completed'
                        }
                        isActive={activeStep === 1}
                    />
                    <ProjectPageCardStep
                        title="Meta Analyses"
                        optionalText={metaAnalysisOptionalText}
                        isActive={activeStep === 2}
                    />
                </Stepper>
            </Box>
            <Box sx={{ flexGrow: 1 }}>
                <Box mb="0.5rem" sx={{ width: '100%' }}>
                    {
                        <Chip
                            label={`Last updated ${lastUpdateDate}`}
                            variant="outlined"
                            size="small"
                            sx={{ mr: '6px' }}
                        />
                    }
                    {studyset && (
                        <Chip
                            variant="outlined"
                            size="small"
                            label={`${(studyset.studies || []).length} studies`}
                        />
                    )}
                </Box>
                <MuiLink
                    component={Link}
                    to={
                        provenance?.metaAnalysisMetadata?.canEditMetaAnalyses
                            ? `/projects/${id}/meta-analyses`
                            : `/projects/${id}`
                    }
                    underline="hover"
                    sx={{
                        wordBreak: 'break-all',
                        wordWrap: 'break-word',
                    }}
                >
                    <Typography
                        sx={{
                            wordBreak: 'break-all',
                            wordWrap: 'break-word',
                        }}
                        color="primary"
                        variant="h5"
                    >
                        {name || ''}
                    </Typography>
                </MuiLink>
                <Typography
                    sx={{
                        color: description ? 'muted.main' : 'warning.dark',
                        wordBreak: 'break-all',
                        wordWrap: 'break-word',
                    }}
                >
                    {description || 'no description'}
                </Typography>
                <Box mt="0.5rem">
                    {activeStep < 0 ? (
                        <Box sx={{ color: 'warning.dark' }}>
                            This project has not been initialized. <br />
                            Click the name of this project above to get started
                        </Box>
                    ) : activeStep === 0 && curationSummary ? (
                        <ProjectPageCardSummaryCuration projectId={id || ''} {...curationSummary} />
                    ) : activeStep === 1 && extractionSummary ? (
                        <ProjectPageCardExtractionSummary
                            projectId={id || ''}
                            {...extractionSummary}
                        />
                    ) : (
                        <ProjectPageCardSummaryMetaAnalyses
                            projectId={id || ''}
                            metaAnalysisIds={meta_analyses as string[]}
                        />
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default ProjectsPageCard;
