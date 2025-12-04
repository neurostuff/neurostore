import { Edit } from '@mui/icons-material';
import { Box, Button, Tab, Tabs } from '@mui/material';
import { useGetMetaAnalysisById, useGetMetaAnalysisResultById, useUserCanEdit } from 'hooks';
import { useProjectUser } from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import DisplayMetaAnalysisResults from './DisplayMetaAnalysisResults';
import EditSpecificationDialog from './EditSpecificationDialog';
import MetaAnalysisDangerZone from './MetaAnalysisDangerZone';
import MetaAnalysisResultStatusAlert from './MetaAnalysisResultStatusAlert';
import DisplayMetaAnalysisSpecification from './MetaAnalysisSpecification';
import RunMetaAnalysisInstructions from './RunMetaAnalysisInstructions';
import { ResultReturn } from 'neurosynth-compose-typescript-sdk';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetMetaAnalysisJobs from '../hooks/useGetMetaAnalysisJobs';
import MetaAnalysisJob from './MetaAnalysisJob';

function MetaAnalysisResult() {
    const { projectId, metaAnalysisId } = useParams<{
        projectId: string;
        metaAnalysisId: string;
    }>();
    const {
        data: metaAnalysis,
        isLoading: metaAnalysisIsLoading,
        isError: metaAnalysisIsError,
    } = useGetMetaAnalysisById(metaAnalysisId);
    const {
        data: metaAnalysisJobs,
        isLoading: metaAnalysisJobsIsLoading,
        isError: metaAnalysisJobsIsError,
    } = useGetMetaAnalysisJobs();
    const {
        data: metaAnalysisResult,
        isLoading: metaAnalysisResultIsLoading,
        isError: metaAnalysisResultIsError,
    } = useGetMetaAnalysisResultById(
        metaAnalysis?.results?.length
            ? (metaAnalysis.results[metaAnalysis.results.length - 1] as ResultReturn)?.id
            : undefined
    );
    const projectUser = useProjectUser();
    const editsAllowed = useUserCanEdit(projectUser || undefined);
    const [editSpecificationDialogIsOpen, setEditSpecificationDialogIsOpen] = useState(false);
    const [tab, setTab] = useState(0);

    const hasResults = (metaAnalysis?.results?.length ?? 0) > 0;
    const hasJobs = (metaAnalysisJobs?.results?.length ?? 0) > 0;

    return (
        <StateHandlerComponent
            isLoading={metaAnalysisIsLoading || metaAnalysisResultIsLoading || metaAnalysisJobsIsLoading}
            isError={metaAnalysisIsError || metaAnalysisResultIsError || metaAnalysisJobsIsError}
        >
            <MetaAnalysisResultStatusAlert
                metaAnalysis={metaAnalysis}
                metaAnalysisResult={metaAnalysisResult}
                metaAnalysisJobs={metaAnalysisJobs?.results}
            />
            <Tabs
                sx={{
                    mt: 2,
                    '.MuiTabs-flexContainer': {
                        borderBottom: '1px solid lightgray',
                    },
                    '.MuiButtonBase-root.Mui-selected': {
                        backgroundColor: 'white',
                        border: '1px solid',
                        borderTopLeftRadius: '6px',
                        borderTopRightRadius: '6px',
                        borderColor: 'lightgray',
                        borderBottom: '0px',
                        marginBottom: '-2px',
                    },
                    '.MuibuttonBase-root': {},
                    transition: 'none',
                }}
                TabIndicatorProps={{
                    sx: {
                        display: 'none',
                    },
                }}
                value={tab}
                onChange={(_, newValue) => setTab(newValue)}
            >
                <Tab value={0} label={hasResults ? 'Meta Analysis Results' : 'Run Meta-Analysis'} />
                {hasResults && <Tab value={1} label="Run Again" />}
                <Tab value={2} label={hasResults ? 'View Specification' : 'Edit Specification'} />
                {!hasResults && <Tab value={3} label="Settings" />}
            </Tabs>
            <Box mt={2}>
                {tab === 0 ? (
                    hasJobs ? (
                        <MetaAnalysisJob metaAnalysisJobs={metaAnalysisJobs?.results ?? []} />
                    ) : hasResults ? (
                        <DisplayMetaAnalysisResults metaAnalysis={metaAnalysis} />
                    ) : (
                        <RunMetaAnalysisInstructions metaAnalysisId={metaAnalysisId || ''} />
                    )
                ) : tab === 1 ? (
                    <RunMetaAnalysisInstructions metaAnalysisId={metaAnalysisId || ''} />
                ) : tab === 2 ? (
                    <Box>
                        <EditSpecificationDialog
                            isOpen={editSpecificationDialogIsOpen}
                            onCloseDialog={() => setEditSpecificationDialogIsOpen(false)}
                        />
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: {
                                    xs: 'column-reverse',
                                    sm: 'row',
                                },
                                justifyContent: 'space-between',
                            }}
                        >
                            <DisplayMetaAnalysisSpecification
                                metaAnalysisId={metaAnalysisId || ''}
                                projectId={projectId || ''}
                            />
                            {!hasResults && (
                                <Box>
                                    <Button
                                        sx={{
                                            mb: 1,
                                            width: {
                                                xs: '100%',
                                                sm: 'auto',
                                            },
                                            whiteSpace: 'nowrap',
                                        }}
                                        onClick={() => setEditSpecificationDialogIsOpen(true)}
                                        variant="contained"
                                        color="secondary"
                                        disableElevation
                                        disabled={!editsAllowed}
                                    >
                                        <Edit sx={{ mr: 1 }} />
                                        Edit Specification
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    </Box>
                ) : (
                    <Box>{!hasResults && <MetaAnalysisDangerZone metaAnalysisId={metaAnalysisId} />}</Box>
                )}
            </Box>
        </StateHandlerComponent>
    );
}

export default MetaAnalysisResult;
