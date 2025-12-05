import { Edit } from '@mui/icons-material';
import { Box, Button, Tab, Tabs } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetMetaAnalysisById, useUserCanEdit } from 'hooks';
import { useProjectUser } from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import useGetMetaAnalysisJobsByMetaAnalysisId from '../hooks/useGetMetaAnalysisJobsByMetaAnalysisId';
import EditSpecificationDialog from './EditSpecificationDialog';
import MetaAnalysisDangerZone from './MetaAnalysisDangerZone';
import MetaAnalysisExecution from './MetaAnalysisExecution';
import MetaAnalysisResultStatusAlert from './MetaAnalysisResultStatusAlert';
import DisplayMetaAnalysisSpecification from './MetaAnalysisSpecification';
import RunMetaAnalysisInstructions from './RunMetaAnalysisInstructions';

function MetaAnalysisDetails() {
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
    } = useGetMetaAnalysisJobsByMetaAnalysisId(metaAnalysisId);
    const projectUser = useProjectUser();
    const editsAllowed = useUserCanEdit(projectUser || undefined);

    const [tab, setTab] = useState(0);
    const [editSpecificationDialogIsOpen, setEditSpecificationDialogIsOpen] = useState(false);

    const hasResults = (metaAnalysis?.results?.length ?? 0) > 0;

    return (
        <StateHandlerComponent
            isLoading={metaAnalysisIsLoading || metaAnalysisJobsIsLoading}
            isError={metaAnalysisIsError || metaAnalysisJobsIsError}
        >
            <MetaAnalysisResultStatusAlert metaAnalysis={metaAnalysis} metaAnalysisJobs={metaAnalysisJobs} />
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
                <Tab value={1} label={hasResults ? 'View Specification' : 'Edit Specification'} />
                <Tab value={2} label={hasResults ? 'Run Again' : 'Settings'} />
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
                    <Box>
                        {hasResults ? (
                            <RunMetaAnalysisInstructions
                                metaAnalysisId={metaAnalysisId || ''}
                                onSubmitMetaAnalysisJob={() => {
                                    setTab(0);
                                }}
                            />
                        ) : (
                            <MetaAnalysisDangerZone metaAnalysisId={metaAnalysisId} />
                        )}
                    </Box>
                )}
            </Box>
        </StateHandlerComponent>
    );
}

export default MetaAnalysisDetails;
