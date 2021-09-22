import { useAuth0 } from '@auth0/auth0-react';
import { Button, Tooltip, Typography } from '@mui/material';
import { AxiosError, AxiosResponse } from 'axios';
import React, { useEffect } from 'react';
import { useCallback } from 'react';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import DisplayMetadataTable from '../../../components/DisplayMetadataTable/DisplayMetadataTable';
import API, { StudyApiResponse } from '../../../utils/api';
import StudyPageStyles from './StudyPageStyles';

const StudyPage = () => {
    const [study, setStudy] = useState<StudyApiResponse & { user: string }>();
    const classes = StudyPageStyles();
    const history = useHistory();
    const { isAuthenticated, getAccessTokenSilently } = useAuth0();
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
            API.UpdateServicesWithToken(token);
        } catch (exception) {
            console.log(exception);
        }
        API.Services.StudiesService.studiesPost(undefined, params.studyId, {})
            .then((res) => {
                console.log(res);
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
                <Button onClick={handleEditStudy} variant="outlined" color="secondary">
                    Edit Study
                </Button>
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
