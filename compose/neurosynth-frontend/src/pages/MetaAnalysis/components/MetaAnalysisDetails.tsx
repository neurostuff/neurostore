import { Edit } from '@mui/icons-material';
import { Box, Button, Tab, Tabs } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalysisById, useUserCanEdit } from 'hooks';
import { useProjectUser } from 'stores/projects/ProjectStore';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import useGetMetaAnalysisJobsByMetaAnalysisId from '../hooks/useGetMetaAnalysisJobsByMetaAnalysisId';
import EditSpecificationDialog from './EditSpecificationDialog';
import MetaAnalysisDangerZone from './MetaAnalysisDangerZone';
import MetaAnalysisExecution from './MetaAnalysisExecution';
import DisplayMetaAnalysisSpecification from './DisplayMetaAnalysisSpecification';
import MetaAnalysisInstructions from './MetaAnalysisInstructions';
import MetaAnalysisSettingsForm from './MetaAnalysisSettingsForm';
import CiteMe from './CiteMe';

function MetaAnalysisDetails() {
    const projectUser = useProjectUser();
    const editsAllowed = useUserCanEdit(projectUser || undefined);

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
    } = useGetMetaAnalysisJobsByMetaAnalysisId(metaAnalysisId, editsAllowed);

    const [tab, setTab] = useState(0);
    const [editSpecificationDialogIsOpen, setEditSpecificationDialogIsOpen] = useState(false);

    const canEditMetaAnalysis = useUserCanEdit(metaAnalysis?.user || undefined);
    const canEdit = editsAllowed || canEditMetaAnalysis;
    const hasResults = (metaAnalysis?.results?.length ?? 0) > 0;
    const hasJobs = (metaAnalysisJobs?.length ?? 0) > 0;
    const hasBeenRun = hasResults || hasJobs;

    return (
        <StateHandlerComponent
            isLoading={metaAnalysisIsLoading || metaAnalysisJobsIsLoading}
            isError={metaAnalysisIsError || metaAnalysisJobsIsError}
        >
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
                <Tab value={0} label={hasResults || !editsAllowed ? 'Meta Analysis Results' : 'Run Meta-Analysis'} />
                <Tab value={1} label={hasBeenRun || !editsAllowed ? 'View Specification' : 'Edit Specification'} />
                <Tab value={2} label="Method & Citations" />
                {editsAllowed && hasBeenRun && <Tab value={3} label="Run Again" />}
                {canEdit && <Tab value={4} label="Settings" />}
            </Tabs>
            <Box mt={2}>
                {tab === 0 ? (
                    <MetaAnalysisExecution metaAnalysis={metaAnalysis} metaAnalysisJobs={metaAnalysisJobs} />
                ) : tab === 1 ? (
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
                            {!hasBeenRun && (
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
                ) : tab === 2 ? (
                    <CiteMe metaAnalysis={metaAnalysis} />
                ) : tab === 3 ? (
                    <MetaAnalysisInstructions
                        metaAnalysisId={metaAnalysisId || ''}
                        onSubmitMetaAnalysisJob={() => {
                            setTab(0);
                        }}
                    />
                ) : tab === 4 ? (
                    <Box sx={{ maxWidth: 720 }}>
                        <MetaAnalysisSettingsForm />
                        {!hasBeenRun && <MetaAnalysisDangerZone metaAnalysisId={metaAnalysisId} />}
                    </Box>
                ) : null}
            </Box>
        </StateHandlerComponent>
    );
}

export default MetaAnalysisDetails;
