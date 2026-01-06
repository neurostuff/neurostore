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
import MetaAnalysisStatusAlert from './MetaAnalysisStatusAlert';
import DisplayMetaAnalysisSpecification from './MetaAnalysisSpecification';
import MetaAnalysisInstructions from './MetaAnalysisInstructions';

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

    const hasResults = (metaAnalysis?.results?.length ?? 0) > 0;
    const hasJobs = (metaAnalysisJobs?.length ?? 0) > 0;

    return (
        <StateHandlerComponent
            isLoading={metaAnalysisIsLoading || metaAnalysisJobsIsLoading}
            isError={metaAnalysisIsError || metaAnalysisJobsIsError}
        >
            <MetaAnalysisStatusAlert metaAnalysis={metaAnalysis} metaAnalysisJobs={metaAnalysisJobs} />
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
                <Tab
                    value={1}
                    label={hasResults || hasJobs || !editsAllowed ? 'View Specification' : 'Edit Specification'}
                />
                {editsAllowed && <Tab value={2} label={hasResults || hasJobs ? 'Run Again' : 'Settings'} />}
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
                            {!hasResults && !hasJobs && (
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
                        {hasResults || hasJobs ? (
                            <MetaAnalysisInstructions
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
