import { Tabs, Tab, Box } from '@mui/material';
import { SyntheticEvent, useState } from 'react';
import { IEditAnalysis } from '..';
import EditAnalysisDetails from './EditAnalysisDetails/EditAnalysisDetails';
import EditAnalysisPoints from './EditAnalysisPoints/EditAnalysisPoints';
import EditAnalysisStyles from './EditAnalysis.styles';
import { ConditionApiResponse, PointsApiResponse } from '../../../../utils/api';
import EditAnalysisConditions from './EditAnalysisConditions/EditAnalysisConditions';
import EditAnalysisImages from './EditAnalysisImages/EditAnalysisImages';

const EditAnalysis: React.FC<IEditAnalysis> = (props) => {
    const [editTab, setEditTab] = useState(0);

    const handleEditAnalysisDetails = (update: { [key: string]: any }) => {
        if (props.analysis && props.analysis.id) {
            props.onEditAnalysisDetails(props.analysis.id as string, update);
        }
    };

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
                        <Tab sx={EditAnalysisStyles.tab} value={0} label="Coordinates"></Tab>
                        <Tab sx={EditAnalysisStyles.tab} value={1} label="Conditions"></Tab>
                        <Tab sx={EditAnalysisStyles.tab} value={2} label="Images"></Tab>
                        <Tab sx={EditAnalysisStyles.tab} value={3} label="Details"></Tab>
                    </Tabs>
                    <Box>
                        <Box sx={{ display: editTab === 0 ? 'block' : 'none' }}>
                            <EditAnalysisPoints
                                onRemovePoint={handleRemovePoint}
                                onUpdatePoint={handleUpdatePoint}
                                onAddPoint={handleAddPoint}
                                points={props.analysis.points as PointsApiResponse[] | undefined}
                            />
                        </Box>
                        <Box sx={{ display: editTab === 1 ? 'block' : 'none' }}>
                            <EditAnalysisConditions
                                analysisId={props.analysis.id || ''}
                                conditions={
                                    props.analysis.conditions as ConditionApiResponse[] | undefined
                                }
                                weights={props.analysis.weights}
                                onConditionWeightChange={props.onEditAnalysisConditions}
                            />
                        </Box>
                        <Box sx={{ display: editTab === 2 ? 'block' : 'none' }}>
                            <EditAnalysisImages />
                        </Box>
                        <Box sx={{ display: editTab === 3 ? 'block' : 'none' }}>
                            <EditAnalysisDetails
                                analysisId={props.analysis.id || ''}
                                name={props.analysis.name || ''}
                                description={props.analysis.description || ''}
                                onEditAnalysisDetails={handleEditAnalysisDetails}
                                onDeleteAnalysis={props.onDeleteAnalysis}
                            />
                        </Box>
                    </Box>
                </>
            )}
        </>
    );
};

export default EditAnalysis;
