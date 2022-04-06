import { Tabs, Tab, Box } from '@mui/material';
import React, { SyntheticEvent, useState } from 'react';
import { IEditAnalysis } from '..';
import EditAnalysisDetails from './EditAnalysisDetails/EditAnalysisDetails';
import EditAnalysisPoints from './EditAnalysisPoints/EditAnalysisPoints';
import EditAnalysisStyles from './EditAnalysis.styles';
import { ConditionApiResponse, PointApiResponse } from '../../../../utils/api';
import EditAnalysisConditions from './EditAnalysisConditions/EditAnalysisConditions';
import EditAnalysisImages from './EditAnalysisImages/EditAnalysisImages';

const EditAnalysis: React.FC<IEditAnalysis> = (props) => {
    const [editTab, setEditTab] = useState(0);

    const handleAddPoint = (pointToAdd: { x: number; y: number; z: number }) => {};
    const handleRemovePoint = (pointId: string) => {};
    const handleUpdatePoint = (pointId: string, update: { x: number; y: number; z: number }) => {};

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
                        <Tab
                            sx={[
                                EditAnalysisStyles.tab,
                                props.updateState.conditions
                                    ? EditAnalysisStyles.unsavedChanges
                                    : {},
                            ]}
                            value={1}
                            label="Conditions"
                        />
                        <Tab sx={EditAnalysisStyles.tab} value={2} label="Images" />
                        <Tab
                            sx={[
                                EditAnalysisStyles.tab,
                                props.updateState.details.name ||
                                props.updateState.details.description
                                    ? EditAnalysisStyles.unsavedChanges
                                    : {},
                            ]}
                            value={3}
                            label="General"
                        />
                    </Tabs>
                    <Box>
                        {editTab === 0 && (
                            <EditAnalysisPoints
                                onRemovePoint={handleRemovePoint}
                                onUpdatePoint={handleUpdatePoint}
                                onAddPoint={handleAddPoint}
                                points={props.analysis.points as PointApiResponse[] | undefined}
                            />
                        )}
                        {editTab === 1 && (
                            <EditAnalysisConditions
                                conditions={
                                    props.analysis.conditions as ConditionApiResponse[] | undefined
                                }
                                updateEnabled={props.updateState.conditions}
                                weights={props.analysis.weights}
                                onConditionWeightChange={props.onEditAnalysisConditions}
                                onEditAnalysisButtonPress={props.onEditAnalysisButtonPress}
                            />
                        )}
                        {editTab === 2 && <EditAnalysisImages />}
                        {editTab === 3 && (
                            <EditAnalysisDetails
                                updateEnabled={props.updateState.details}
                                name={props.analysis.name || ''}
                                description={props.analysis.description || ''}
                                onEditAnalysisDetails={props.onEditAnalysisDetails}
                                onEditAnalysisButtonPress={props.onEditAnalysisButtonPress}
                            />
                        )}
                    </Box>
                </>
            )}
        </>
    );
};

export default EditAnalysis;
