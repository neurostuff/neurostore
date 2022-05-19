import { Typography, Box, Tabs, Tab, Divider } from '@mui/material';
import React, { useState, SyntheticEvent } from 'react';
import { AnalysisApiResponse } from '../../../utils/api';
import CreateDetailsDialog from '../../Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import EditAnalysesStyles from './EditAnalyses.styles';
import EditAnalysis from './EditAnalysis/EditAnalysis';
import AddIcon from '@mui/icons-material/Add';
import { useCreateAnalysis } from 'hooks';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';

const EditAnalyses: React.FC<{ analyses: AnalysisApiResponse[] | undefined; studyId: string }> =
    React.memo((props) => {
        const { analyses } = props;
        const { isLoading, mutate } = useCreateAnalysis();
        const [selectedAnalysis, setSelectedAnalysis] = useState(0);

        const [createDetailsDialogIsOpen, setCreateDetailsDialogIsOpen] = useState(false);

        const handleTabChange = (event: SyntheticEvent, newVal: number) => {
            setSelectedAnalysis(newVal);
        };

        const handleCreateAnalysis = (name: string, description: string) => {
            if (props.analyses) {
                mutate({
                    name,
                    description,
                    study: props.analyses[selectedAnalysis].study || '',
                });
            }
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
                                    {(analyses as AnalysisApiResponse[]).map((analysis, index) => {
                                        return (
                                            <Tab
                                                sx={EditAnalysesStyles.tab}
                                                key={analysis.id}
                                                value={index}
                                                label={analysis.name}
                                            />
                                        );
                                    })}
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
