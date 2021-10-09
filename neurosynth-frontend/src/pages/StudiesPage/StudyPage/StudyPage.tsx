import { useAuth0 } from '@auth0/auth0-react';
import { ExpandMoreOutlined } from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import { AxiosError, AxiosResponse } from 'axios';
import React, { useContext, useEffect } from 'react';
import { useCallback } from 'react';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import DisplayMetadataTable from '../../../components/DisplayMetadataTable/DisplayMetadataTable';
import Visualizer from '../../../components/Visualizer/Visualizer';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import { Analysis, ReadOnly } from '../../../gen/api';
import API, { StudyApiResponse } from '../../../utils/api';
import StudyPageStyles from './StudyPageStyles';

const StudyPage = () => {
    const [study, setStudy] = useState<StudyApiResponse & { user: string }>();
    const [editDisabled, setEditDisabled] = useState(true);
    const context = useContext(GlobalContext);
    const classes = StudyPageStyles();
    const history = useHistory();
    const { isAuthenticated, getAccessTokenSilently, user } = useAuth0();
    const params: { studyId: string } = useParams();

    const getStudy = useCallback((id: string) => {
        API.Services.StudiesService.studiesIdGet(id, true)
            .then((res) => {
                const resUpdated = res as AxiosResponse<StudyApiResponse & { user: string }>;
                setStudy(resUpdated.data);
            })
            .catch(() => {});
    }, []);

    const handleCloneStudy = async () => {
        try {
            const token = await getAccessTokenSilently();
            context?.handleToken(token);
        } catch (exception) {
            context.showSnackbar('There was an error', SnackbarType.ERROR);
            console.error(exception);
        }
        API.Services.StudiesService.studiesPost(undefined, params.studyId, {})
            .then((res) => {
                context.showSnackbar('Study successfully cloned', SnackbarType.SUCCESS);
                history.push(`/studies`);
            })
            .catch((err: Error | AxiosError) => {
                context.showSnackbar('There was an error', SnackbarType.ERROR);
                console.log(err.message);
            });
    };

    const handleEditStudy = (event: React.MouseEvent) => {
        history.push(`/studies/edit/${params.studyId}`);
    };

    useEffect(() => {
        if (params.studyId) {
            getStudy(params.studyId);
        }
    }, [params.studyId, getStudy]);

    useEffect(() => {
        const userIDAndStudyIDExist = !!user?.sub && !!study?.user;
        const shouldDisableEdit =
            !isAuthenticated || !userIDAndStudyIDExist || user?.sub !== study?.user;
        setEditDisabled(shouldDisableEdit);
    }, [isAuthenticated, user?.sub, study?.user]);

    return (
        <div>
            <div className={`${classes.buttonContainer} ${classes.spaceBelow}`}>
                <Tooltip placement="top" title={!isAuthenticated ? 'login to clone study' : ''}>
                    <div style={{ display: 'inline' }}>
                        <Button
                            onClick={handleCloneStudy}
                            disabled={!isAuthenticated}
                            variant="outlined"
                            color="primary"
                        >
                            Clone Study
                        </Button>
                    </div>
                </Tooltip>
                <Tooltip
                    placement="top"
                    title={editDisabled ? 'you can only edit studies you have cloned' : ''}
                >
                    <div style={{ display: 'inline' }}>
                        <Button
                            disabled={editDisabled}
                            onClick={handleEditStudy}
                            variant="outlined"
                            color="secondary"
                        >
                            Edit Study
                        </Button>
                    </div>
                </Tooltip>
            </div>
            <div>
                <Typography className={classes.spaceBelow} variant="h5">
                    <b>{study?.name}</b>
                </Typography>
                <Typography className={classes.spaceBelow} variant="h6">
                    {study?.authors}
                </Typography>
                <div className={classes.spaceBelow}>
                    {study?.publication && (
                        <Typography variant="subtitle1">Journal: {study?.publication}</Typography>
                    )}
                    {study?.doi && <Typography variant="subtitle1">DOI: {study?.doi}</Typography>}
                </div>
                <Typography className={classes.spaceBelow} variant="subtitle1">
                    {study?.description}
                </Typography>
            </div>

            <div className={classes.spaceBelow}>
                <Typography variant="h6">
                    <b>Study Metadata</b>
                </Typography>
                <div>
                    <Accordion elevation={4}>
                        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                            Click to expand study metadata
                        </AccordionSummary>
                        <AccordionDetails>
                            <div className={classes.metadataContainer}>
                                {study && <DisplayMetadataTable metadata={study.metadata} />}
                            </div>
                        </AccordionDetails>
                    </Accordion>
                </div>
            </div>

            <div>
                <Typography
                    style={{
                        position: 'sticky',
                        top: 20,
                    }}
                    variant="h6"
                >
                    <b>Analyses</b>
                </Typography>
                <div>
                    {study?.analyses?.map((element, index) => (
                        <Paper
                            elevation={4}
                            className={classes.spaceBelow}
                            style={{ padding: '16px' }}
                        >
                            <Typography className={classes.spaceBelow} variant="h6">
                                Name: <b>{(element as any).name}</b>
                            </Typography>

                            <Typography variant="h6">Conditions:</Typography>

                            <div className={classes.spaceBelow}>
                                {(element as any).conditions.map((condition: any) => (
                                    <span>{condition.name}</span>
                                ))}
                            </div>

                            <Typography variant="h6">Images:</Typography>
                            {(element as any)?.images.length > 0 && (
                                <div>
                                    <Visualizer
                                        index={index}
                                        overlayURL="https://neurovault.org/static/images/GenericMNI.nii.gz"
                                        fileName={(element as any)?.images[0]?.filename}
                                        imageURL={(element as any)?.images[0]?.url}
                                    />
                                </div>
                            )}

                            <Typography variant="h6">Coordinates:</Typography>
                            {(element as any).points.length > 0 && (
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>X</TableCell>
                                                <TableCell>Y</TableCell>
                                                <TableCell>Z</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {(element as any).points.map((row: any) => (
                                                <TableRow>
                                                    <TableCell>
                                                        <span>{row.coordinates[0]}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span>{row.coordinates[1]}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span>{row.coordinates[2]}</span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Paper>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StudyPage;
