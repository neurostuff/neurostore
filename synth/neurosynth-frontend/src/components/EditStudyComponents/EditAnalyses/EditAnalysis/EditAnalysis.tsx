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

    // TODO: Just for testing and development, delete this later
    if (props?.analysis?.conditions) {
        props.analysis.conditions = [
            {
                created_at: '2022-03-08T16:31:18.693178+00:00',
                description: null,
                id: 'dJeZjzTPM5ob',
                name: 'delayed match to sample task',
                user: null,
            },
            {
                created_at: '2022-03-08T16:31:18.626189+00:00',
                description: null,
                id: '3HCqyCDwmhfn',
                name: 'audio narrative',
                user: null,
            },
            {
                created_at: '2022-03-08T16:31:18.626189+00:00',
                description: null,
                id: '4yNzdWd4LjiX',
                name: 'reading (overt)',
                user: null,
            },
            {
                created_at: '2022-03-08T16:31:14.653935+00:00',
                description: null,
                id: '37ftCZRDpb7H',
                name: 'motor sequencing task',
                user: null,
            },
            {
                created_at: '2022-03-08T16:31:14.653935+00:00',
                description: null,
                id: '6uF4Njgj4xNa',
                name: 'multi-object localizer task',
                user: null,
            },
            {
                created_at: '2022-03-08T16:31:13.197400+00:00',
                description: null,
                id: 'bG8X3dkNhdjM',
                name: 'face monitor/discrimination',
                user: null,
            },
        ];

        props.analysis.weights = [0.5, 0.5, 1, 1, 1, 1];
    }

    return (
        <Box>
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
                        <Tab sx={EditAnalysisStyles.tab} value={0} label="Details"></Tab>
                        <Tab sx={EditAnalysisStyles.tab} value={1} label="Coordinates"></Tab>
                        <Tab sx={EditAnalysisStyles.tab} value={2} label="Conditions"></Tab>
                        <Tab sx={EditAnalysisStyles.tab} value={3} label="Images"></Tab>
                    </Tabs>
                    <Box>
                        {editTab === 0 && (
                            <>
                                <EditAnalysisDetails
                                    analysisId={props.analysis.id || ''}
                                    name={props.analysis.name || ''}
                                    description={props.analysis.description || ''}
                                    onEditAnalysisDetails={handleEditAnalysisDetails}
                                    onDeleteAnalysis={props.onDeleteAnalysis}
                                />
                            </>
                        )}
                        {editTab === 1 && (
                            <EditAnalysisPoints
                                onRemovePoint={handleRemovePoint}
                                onUpdatePoint={handleUpdatePoint}
                                onAddPoint={handleAddPoint}
                                points={props.analysis.points as PointsApiResponse[] | undefined}
                            />
                        )}
                        {editTab === 2 && (
                            <EditAnalysisConditions
                                conditions={
                                    props.analysis.conditions as ConditionApiResponse[] | undefined
                                }
                                weights={props.analysis.weights}
                            />
                        )}
                        {editTab === 3 && <EditAnalysisImages />}
                    </Box>
                </>
            )}
        </Box>
    );
};

export default EditAnalysis;
