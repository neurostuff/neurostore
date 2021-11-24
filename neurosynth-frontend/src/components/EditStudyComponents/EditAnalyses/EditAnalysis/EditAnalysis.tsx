import { Tabs, Tab, Box } from '@mui/material';
import { SyntheticEvent, useState } from 'react';
import { IEditAnalysis } from '..';
import EditAnalysisDetails from './EditAnalysisDetails/EditAnalysisDetails';
import EditAnalysisPoints from './EditAnalysisPoints/EditAnalysisPoints';
import EditAnalysisStyles from './EditAnalysis.styles';
import { PointsApiResponse } from '../../../../utils/api';
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
                        <Tab
                            sx={EditAnalysisStyles.tab}
                            value={0}
                            label="Edit Analysis Details"
                        ></Tab>
                        <Tab sx={EditAnalysisStyles.tab} value={1} label="Edit Coordinates"></Tab>
                        <Tab sx={EditAnalysisStyles.tab} value={2} label="Edit Conditions"></Tab>
                        <Tab sx={EditAnalysisStyles.tab} value={3} label="Edit Images"></Tab>
                    </Tabs>
                    <Box>
                        {editTab === 0 && (
                            <>
                                <EditAnalysisDetails
                                    analysisId={props.analysis.id || ''}
                                    name={props.analysis.name}
                                    description={props.analysis.description}
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
                        {editTab === 2 && <EditAnalysisConditions />}
                        {editTab === 3 && <EditAnalysisImages />}
                    </Box>
                </>
            )}
        </Box>
    );
};

export default EditAnalysis;
