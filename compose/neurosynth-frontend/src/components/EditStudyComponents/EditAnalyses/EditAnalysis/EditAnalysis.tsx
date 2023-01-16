import { Tabs, Tab, Box } from '@mui/material';
import React, { SyntheticEvent, useState } from 'react';
import EditAnalysisDetails from './EditAnalysisDetails/EditAnalysisDetails';
import EditAnalysisPoints from './EditAnalysisPoints/EditAnalysisPoints';
import EditAnalysisStyles from './EditAnalysis.styles';
import EditAnalysisConditions from './EditAnalysisConditions/EditAnalysisConditions';
import EditAnalysisImages from './EditAnalysisImages/EditAnalysisImages';
import { AnalysisReturn, ConditionReturn, PointReturn } from 'neurostore-typescript-sdk';
import EditAnnotations from './EditAnnotations/EditAnnotations';

const EditAnalysis: React.FC<{ analysis: AnalysisReturn | undefined }> = (props) => {
    const [editTab, setEditTab] = useState(0);

    return (
        <>
            {props.analysis && (
                <>
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
                        <Tab sx={[EditAnalysisStyles.tab]} value={0} label="Annotations" />
                        <Tab sx={[EditAnalysisStyles.tab]} value={1} label="Coordinates" />
                        <Tab sx={[EditAnalysisStyles.tab]} value={2} label="Conditions" />
                        <Tab sx={EditAnalysisStyles.tab} value={3} label="Images" />
                        <Tab sx={[EditAnalysisStyles.tab]} value={4} label="General" />
                    </Tabs>
                    <Box>
                        {editTab === 0 && <EditAnnotations />}

                        {editTab === 1 && (
                            <EditAnalysisPoints
                                analysisId={props.analysis.id}
                                studyId={props.analysis.study}
                                points={props.analysis.points as PointReturn[] | undefined}
                            />
                        )}
                        {editTab === 2 && (
                            <EditAnalysisConditions
                                studyId={props.analysis.study}
                                analysisId={props.analysis.id || ''}
                                conditions={
                                    props.analysis.conditions as ConditionReturn[] | undefined
                                }
                                weights={props.analysis.weights}
                            />
                        )}
                        {editTab === 3 && <EditAnalysisImages />}
                        {editTab === 4 && (
                            <EditAnalysisDetails
                                studyId={props.analysis.study || ''}
                                analysisId={props.analysis.id || ''}
                                name={props.analysis.name || ''}
                                description={props.analysis.description || ''}
                            />
                        )}
                    </Box>
                </>
            )}
        </>
    );
};

export default EditAnalysis;
