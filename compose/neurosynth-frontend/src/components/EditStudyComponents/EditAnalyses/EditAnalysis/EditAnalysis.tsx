import { Tabs, Tab, Box, Typography, Button } from '@mui/material';
import React, { SyntheticEvent, useState } from 'react';
import EditAnalysisDetails from './EditAnalysisDetails/EditAnalysisDetails';
import EditAnalysisPoints from './EditAnalysisPoints/EditAnalysisPoints';
import EditAnalysisStyles from './EditAnalysis.styles';
import EditAnalysisConditions from './EditAnalysisConditions/EditAnalysisConditions';
import EditAnalysisImages from './EditAnalysisImages/EditAnalysisImages';
import { AnalysisReturn, ConditionReturn, PointReturn } from 'neurostore-typescript-sdk';
import TextEdit from 'components/TextEdit/TextEdit';
import EditAnalysisAnnotations from './EditAnalysisAnnotations/EditAnalysisAnnotations';

const EditAnalysis: React.FC<{ analysis: AnalysisReturn | undefined }> = (props) => {
    const [editTab, setEditTab] = useState(0);

    return (
        <>
            {props.analysis && (
                <>
                    <Box>
                        <Box sx={{ marginBottom: '15px' }}>
                            <TextEdit
                                sx={{ fontSize: '1.5rem' }}
                                textToEdit={props.analysis.name || ''}
                                onSave={() => {}}
                            >
                                <Typography color="primary" variant="h5">
                                    {props.analysis.name}
                                </Typography>
                            </TextEdit>
                            {props.analysis.description && (
                                <TextEdit
                                    textToEdit={props.analysis.description || ''}
                                    onSave={() => {}}
                                >
                                    <Typography sx={{ color: 'muted.main' }}>
                                        {props.analysis.description}
                                    </Typography>
                                </TextEdit>
                            )}
                        </Box>
                        <Tabs
                            sx={EditAnalysisStyles.editTabs}
                            TabScrollButtonProps={{
                                sx: {
                                    color: 'primary.main',
                                },
                            }}
                            value={editTab}
                            onChange={(_event: SyntheticEvent, newValue: number) => {
                                setEditTab(newValue);
                            }}
                        >
                            <Tab sx={[EditAnalysisStyles.tab]} value={0} label="Coordinates" />
                            <Tab sx={[EditAnalysisStyles.tab]} value={1} label="Conditions" />
                            <Tab sx={[EditAnalysisStyles.tab]} value={2} label="Annotations" />
                            <Tab sx={EditAnalysisStyles.tab} value={3} label="Images" />
                        </Tabs>
                        {editTab === 0 && (
                            <EditAnalysisPoints
                                analysisId={props.analysis.id}
                                studyId={props.analysis.study}
                                points={props.analysis.points as PointReturn[] | undefined}
                            />
                        )}
                        {editTab === 1 && (
                            <EditAnalysisConditions
                                studyId={props.analysis.study}
                                analysisId={props.analysis.id || ''}
                                conditions={
                                    props.analysis.conditions as ConditionReturn[] | undefined
                                }
                                weights={props.analysis.weights}
                            />
                        )}
                        {editTab === 2 && <EditAnalysisAnnotations />}
                        {editTab === 3 && <EditAnalysisImages />}

                        <Box
                            sx={{
                                marginTop: '2.5rem',
                                display: 'flex',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <Button variant="contained" color="error">
                                Delete Analysis
                            </Button>
                        </Box>
                    </Box>
                </>
            )}
        </>
    );
};

export default EditAnalysis;
