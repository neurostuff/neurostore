import { useAuth0 } from '@auth0/auth0-react';
import { Button, Typography } from '@material-ui/core';
import { AxiosError } from 'axios';
import React, { useCallback } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { EditMetadata } from '../../../components';
import { DisplayMetadataTableRowModel } from '../../../components/DisplayMetadataTable/DisplayMetadataTableRow/DisplayMetadataTableRow';
import API, { StudyApiResponse } from '../../../utils/api';
import EditStudyPageStyles from './EditStudyPageStyles';

const EditStudyPage = () => {
    console.log('edit study page render');

    const classes = EditStudyPageStyles();
    const [study, setStudy] = useState<StudyApiResponse>();
    const [saveEnabled, setSaveEnabled] = useState(false);
    const [metadata, setMetadata] = useState({});
    const history = useHistory();
    const params: { studyId: string } = useParams();
    const { getAccessTokenSilently } = useAuth0();

    const getStudy = useCallback((id: string) => {
        API.Services.StudiesService.studiesIdGet(id)
            .then((res) => {
                setStudy(res.data);
            })
            .catch(() => {});
    }, []);

    const handleMetadataEditChange = useCallback((metadata: { [key: string]: any }) => {
        setMetadata(metadata);
        console.log(metadata);

        setSaveEnabled(true);
    }, []);

    // useEffect(() => {
    //     setMetadata(metadata);
    // }, [metadata]);

    const handleOnCancel = (event: React.MouseEvent) => {
        history.push(`/studies/${params.studyId}`);
    };

    const handleOnSave = async (event: React.MouseEvent) => {
        try {
            const token = await getAccessTokenSilently();
            API.UpdateServicesWithToken(token);
        } catch (exception) {
            console.log(exception);
        }
        API.Services.StudiesService.studiesIdPut(params.studyId, {
            metadata: metadata,
            id: params.studyId,
        })
            .then((res) => {
                history.push(`/studies/${params.studyId}`);
            })
            .catch((err: Error | AxiosError) => {
                console.log(err.message);
            });
    };

    useEffect(() => {
        if (params.studyId) {
            getStudy(params.studyId);
        }
    }, [params.studyId, getStudy]);

    const metadataArr: DisplayMetadataTableRowModel[] = study?.metadata
        ? Object.keys(study.metadata).map((row) => ({
              metadataKey: row,
              metadataValue: (study.metadata as any)[row],
          }))
        : [];

    return (
        <div style={{ height: '100%' }}>
            <div className={classes.stickyButtonContainer}>
                <Button
                    onClick={handleOnSave}
                    disabled={!saveEnabled}
                    className={`${classes.saveButton} ${classes.button}`}
                    variant="outlined"
                >
                    Save Changes
                </Button>
                <Button
                    onClick={handleOnCancel}
                    className={`${classes.cancelButton} ${classes.button}`}
                    variant="outlined"
                >
                    Cancel
                </Button>
            </div>
            <div>
                <Typography variant="h5">{study?.name}</Typography>
            </div>

            <div style={{ margin: '15px 0' }}>
                <Typography variant="h6">
                    <b>Metadata</b>
                </Typography>
            </div>

            {study && (
                <EditMetadata
                    onMetadataEditChange={handleMetadataEditChange}
                    metadata={metadataArr}
                />
            )}
        </div>
    );
};

export default EditStudyPage;
