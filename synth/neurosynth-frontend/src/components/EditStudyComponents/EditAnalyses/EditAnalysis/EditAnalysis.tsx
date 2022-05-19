import { Tabs, Tab, Box } from '@mui/material';
import React, { SyntheticEvent, useState } from 'react';
import EditAnalysisDetails from './EditAnalysisDetails/EditAnalysisDetails';
import EditAnalysisPoints from './EditAnalysisPoints/EditAnalysisPoints';
import EditAnalysisStyles from './EditAnalysis.styles';
import { AnalysisApiResponse, ConditionApiResponse, PointApiResponse } from 'utils/api';
import EditAnalysisConditions from './EditAnalysisConditions/EditAnalysisConditions';
import EditAnalysisImages from './EditAnalysisImages/EditAnalysisImages';

const EditAnalysis: React.FC<{ analysis: AnalysisApiResponse | undefined }> = (props) => {
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
                        onChange={(event: SyntheticEvent, newValue: number) => {
                            setEditTab(newValue);
                        }}
                    >
                        <Tab sx={[EditAnalysisStyles.tab]} value={0} label="Coordinates" />
                        <Tab sx={[EditAnalysisStyles.tab]} value={1} label="Conditions" />
                        <Tab sx={EditAnalysisStyles.tab} value={2} label="Images" />
                        <Tab sx={[EditAnalysisStyles.tab]} value={3} label="General" />
                    </Tabs>
                    <Box>
                        {editTab === 0 && (
                            <EditAnalysisPoints
                                analysisId={props.analysis.id}
                                studyId={props.analysis.study}
                                points={props.analysis.points as PointApiResponse[] | undefined}
                            />
                        )}
                        {editTab === 1 && (
                            <EditAnalysisConditions
                                studyId={props.analysis.study}
                                analysisId={props.analysis.id || ''}
                                conditions={
                                    props.analysis.conditions as ConditionApiResponse[] | undefined
                                }
                                weights={props.analysis.weights}
                            />
                        )}
                        {editTab === 2 && <EditAnalysisImages />}
                        {editTab === 3 && (
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
