import { useAuth0 } from '@auth0/auth0-react';
import { ExpandMoreOutlined } from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Button,
    Paper,
    Tooltip,
    Typography,
} from '@mui/material';
import { AxiosError, AxiosResponse } from 'axios';
import { useCallback, useState, useEffect, useContext } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { DisplayMetadataTable } from '../../../components';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import API, { StudyApiResponse } from '../../../utils/api';
import StudyPageStyles from './StudyPageStyles';

const StudyPage = () => {
    const [study, setStudy] = useState<StudyApiResponse>();
    const [editDisabled, setEditDisabled] = useState(true);
    const context = useContext(GlobalContext);
    const classes = StudyPageStyles();
    const history = useHistory();
    const { isAuthenticated, getAccessTokenSilently, user } = useAuth0();
    const params: { studyId: string } = useParams();

    const getStudy = useCallback((id: string) => {
        API.Services.StudiesService.studiesIdGet(id)
            .then((res) => {
                const resUpdated = res as AxiosResponse<StudyApiResponse & { user: string }>;
                setStudy(resUpdated.data);
            })
            .catch((err) => {
                console.log(err);
            });
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
                    <Typography variant="h6">{study?.publication}</Typography>
                    {study?.doi && <Typography variant="h6">DOI: {study?.doi}</Typography>}
                </div>
                <Typography className={classes.spaceBelow} variant="subtitle1">
                    {study?.description}
                </Typography>
            </div>

            <div className={classes.spaceBelow}>
                <Typography variant="h6">
                    <b>Metadata</b>
                </Typography>
                <div>
                    <Accordion elevation={4}>
                        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                            <span>Click to see study metadata</span>
                        </AccordionSummary>
                        <AccordionDetails>
                            <div className={classes.metadataContainer}>
                                {study && <DisplayMetadataTable metadata={study.metadata} />}
                            </div>
                        </AccordionDetails>
                    </Accordion>
                </div>
            </div>

            <div className={classes.spaceBelow}>
                <Typography variant="h6">
                    <b>Analyses</b>
                </Typography>
                <div style={{ width: '100%', display: 'flex' }}>
                    <div style={{ width: '45%' }}>
                        <Paper
                            className={classes.spaceBelow}
                            style={{ padding: '30px', backgroundColor: '#0077b6' }}
                        >
                            <Typography style={{ color: 'white' }}>Hello</Typography>
                            <div className={classes.spaceBelow}>
                                <Accordion elevation={1}>
                                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                                        Coordinates
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <div className={classes.metadataContainer}>
                                            {study && (
                                                <DisplayMetadataTable metadata={study.metadata} />
                                            )}
                                        </div>
                                    </AccordionDetails>
                                </Accordion>
                            </div>

                            <div>
                                <Accordion elevation={1}>
                                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                                        Analysis Metadata
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <div className={classes.metadataContainer}>
                                            {study && (
                                                <DisplayMetadataTable metadata={study.metadata} />
                                            )}
                                        </div>
                                    </AccordionDetails>
                                </Accordion>
                            </div>
                        </Paper>

                        <Paper
                            className={classes.spaceBelow}
                            style={{ padding: '30px', backgroundColor: '#0077b6' }}
                        >
                            <Typography style={{ color: 'white' }}>Hello</Typography>
                            <div className={classes.spaceBelow}>
                                <Accordion elevation={1}>
                                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                                        Coordinates
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <div className={classes.metadataContainer}>
                                            {study && (
                                                <DisplayMetadataTable metadata={study.metadata} />
                                            )}
                                        </div>
                                    </AccordionDetails>
                                </Accordion>
                            </div>

                            <div>
                                <Accordion elevation={1}>
                                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                                        Analysis Metadata
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <div className={classes.metadataContainer}>
                                            {study && (
                                                <DisplayMetadataTable metadata={study.metadata} />
                                            )}
                                        </div>
                                    </AccordionDetails>
                                </Accordion>
                            </div>
                        </Paper>

                        <Paper
                            className={classes.spaceBelow}
                            style={{ padding: '30px', backgroundColor: '#0077b6' }}
                        >
                            <Typography style={{ color: 'white' }}>Hello</Typography>
                            <div className={classes.spaceBelow}>
                                <Accordion elevation={1}>
                                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                                        Coordinates
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <div className={classes.metadataContainer}>
                                            {study && (
                                                <DisplayMetadataTable metadata={study.metadata} />
                                            )}
                                        </div>
                                    </AccordionDetails>
                                </Accordion>
                            </div>

                            <div>
                                <Accordion elevation={1}>
                                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                                        Analysis Metadata
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <div className={classes.metadataContainer}>
                                            {study && (
                                                <DisplayMetadataTable metadata={study.metadata} />
                                            )}
                                        </div>
                                    </AccordionDetails>
                                </Accordion>
                            </div>
                        </Paper>

                        <Paper
                            className={classes.spaceBelow}
                            style={{ padding: '30px', backgroundColor: '#0077b6' }}
                        >
                            <Typography style={{ color: 'white' }}>Hello</Typography>
                            <div className={classes.spaceBelow}>
                                <Accordion elevation={1}>
                                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                                        Coordinates
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <div className={classes.metadataContainer}>
                                            {study && (
                                                <DisplayMetadataTable metadata={study.metadata} />
                                            )}
                                        </div>
                                    </AccordionDetails>
                                </Accordion>
                            </div>

                            <div>
                                <Accordion elevation={1}>
                                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                                        Analysis Metadata
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <div className={classes.metadataContainer}>
                                            {study && (
                                                <DisplayMetadataTable metadata={study.metadata} />
                                            )}
                                        </div>
                                    </AccordionDetails>
                                </Accordion>
                            </div>
                        </Paper>
                    </div>
                    <div
                        style={{
                            width: '55%',
                        }}
                    >
                        <div
                            style={{
                                marginLeft: 'auto',
                                position: 'sticky',
                                top: '47px',
                                width: '550px',
                                height: '450px',
                                backgroundColor: 'black',
                                color: 'white',
                            }}
                        >
                            Papaya Visualizer placeholder
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudyPage;
