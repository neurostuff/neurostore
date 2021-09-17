import { useAuth0 } from '@auth0/auth0-react';
import { Button, Tooltip, Typography } from '@material-ui/core';
import { AxiosError, AxiosResponse } from 'axios';
import React, { useContext, useEffect } from 'react';
import { useCallback } from 'react';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import DisplayMetadataTable from '../../../components/DisplayMetadataTable/DisplayMetadataTable';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
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
        API.Services.StudiesService.studiesIdGet(id)
            .then((res) => {
                const resUpdated = res as AxiosResponse<StudyApiResponse & { user: string }>;
                setStudy(resUpdated.data);
            })
            .catch(() => {});
    }, []);

    const handleCloneStudy = async () => {
        try {
            const token = await getAccessTokenSilently();
            context?.updateToken(token);
        } catch (exception) {
            console.error(exception);
        }
        API.Services.StudiesService.studiesPost(undefined, params.studyId, {})
            .then((res) => {
                context.showSnackbar('Study successfully cloned', SnackbarType.SUCCESS);
                history.push(`/studies`);
            })
            .catch((err: Error | AxiosError) => {
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
            <div className={classes.buttonContainer}>
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
                <Typography variant="h4">{study?.name}</Typography>
            </div>
            <div>
                <div style={{ margin: '15px 0' }}>
                    <Typography variant="h6">
                        <b>Metadata</b>
                    </Typography>
                </div>
                <div className={classes.metadataContainer}>
                    {study && <DisplayMetadataTable metadata={study.metadata} />}
                </div>
            </div>
        </div>
    );
};

export default StudyPage;
