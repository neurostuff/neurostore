import { Typography, Box, Tabs, Tab, Divider } from '@mui/material';
import React, { useState, SyntheticEvent, useEffect } from 'react';
import CreateDetailsDialog from '../../Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import EditAnalysesStyles from './EditAnalyses.styles';
import EditAnalysis from './EditAnalysis/EditAnalysis';
import AddIcon from '@mui/icons-material/Add';
import { useCreateAnalysis } from 'hooks';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { AnalysisReturn } from 'neurostore-typescript-sdk';

const EditAnalyses: React.FC<{ analyses: AnalysisReturn[] | undefined; studyId: string }> =
    React.memo((props) => {
        const [analyses, setAnalyses] = useState<AnalysisReturn[]>(props.analyses || []);
        const [selectedAnalysis, setSelectedAnalysis] = useState(0);
        const [createDetailsDialogIsOpen, setCreateDetailsDialogIsOpen] = useState(false);

        const { isLoading, mutate } = useCreateAnalysis();

        // we need to cache the analyses into an intermediate state in order to make sure that we do a check first
        // so that our tab is not selecting an analysis that was just deleted
        useEffect(() => {
            if (!props.analyses || props.analyses.length === 0) {
                setAnalyses([]);
            } else {
                if (props.analyses.length === selectedAnalysis) {
                    // if we have deleted the last analysis
                    setSelectedAnalysis(props.analyses.length - 1);
                }
                setAnalyses(props.analyses);
            }
        }, [props.analyses, selectedAnalysis]);

        const handleTabChange = (_event: SyntheticEvent, newVal: number) => {
            setSelectedAnalysis(newVal);
        };

        const handleCreateAnalysis = (name: string, description: string) => {
            mutate({
                name,
                description,
                study: props.studyId,
            });
        };

        const hasAnalyses = !!analyses && analyses.length > 0;

        return (
            <>
                <CreateDetailsDialog
                    isOpen={createDetailsDialogIsOpen}
                    titleText="Create new analysis"
                    onCloseDialog={() => setCreateDetailsDialogIsOpen(false)}
                    onCreate={handleCreateAnalysis}
                />
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        marginBottom: '15px',
                    }}
                >
                    <Typography variant="h6">
                        <b>Edit Analyses</b>
                    </Typography>
                    <LoadingButton
                        isLoading={isLoading}
                        loaderColor="secondary"
                        color="primary"
                        sx={{ width: '200px' }}
                        onClick={() => setCreateDetailsDialogIsOpen(true)}
                        variant="contained"
                        startIcon={<AddIcon />}
                        text="new analysis"
                    />
                </Box>

                {hasAnalyses ? (
                    <>
                        <Divider />
                        <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                            <Box sx={EditAnalysesStyles.matchingSibling}>
                                <Tabs
                                    scrollButtons
                                    sx={EditAnalysesStyles.analysesTabs}
                                    value={selectedAnalysis}
                                    TabScrollButtonProps={{
                                        sx: {
                                            color: 'primary.main',
                                        },
                                    }}
                                    onChange={handleTabChange}
                                    orientation="vertical"
                                    variant="scrollable"
                                >
                                    {(analyses as AnalysisReturn[]).map((analysis, index) => (
                                        <Tab
                                            sx={EditAnalysesStyles.tab}
                                            key={analysis.id}
                                            value={index}
                                            label={analysis.name}
                                        />
                                    ))}
                                </Tabs>
                            </Box>
                            <Box
                                sx={[
                                    EditAnalysesStyles.analysisContainer,
                                    EditAnalysesStyles.heightDefiningSibling,
                                ]}
                            >
                                <EditAnalysis analysis={analyses[selectedAnalysis]} />
                            </Box>
                        </Box>
                    </>
                ) : (
                    <Box component="span" sx={{ color: 'warning.dark' }}>
                        No analyses for this study
                    </Box>
                )}
            </>
        );
    });

export default EditAnalyses;
