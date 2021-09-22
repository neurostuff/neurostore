import { useAuth0 } from '@auth0/auth0-react';
import { Button, Typography } from '@mui/material';
import { AxiosError } from 'axios';
import React, { useContext } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { EditMetadata } from '../../../components';
import { DisplayMetadataTableRowModel } from '../../../components/DisplayMetadataTable/DisplayMetadataTableRow/DisplayMetadataTableRow';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import API, { StudyApiResponse } from '../../../utils/api';
import EditStudyPageStyles from './EditStudyPageStyles';

const arrayToMetadata = (arr: DisplayMetadataTableRowModel[]): { [key: string]: any } => {
    const tempObj: { [key: string]: any } = {};
    arr.forEach((element) => (tempObj[element.metadataKey] = element.metadataValue));
    return tempObj;
};

const EditStudyPage = () => {
    const globalContext = useContext(GlobalContext);
    const { getAccessTokenSilently } = useAuth0();
    const classes = EditStudyPageStyles();
    const [study, setStudy] = useState<StudyApiResponse>();
    const [saveEnabled, setSaveEnabled] = useState(false);

    // metadata edits are updated and stored in this state
    const [updatedMetadata, setUpdatedMetadata] = useState<DisplayMetadataTableRowModel[]>([]);

    // initial metadata received from the study is set in this state
    const [initialMetadataArr, setInitialMetadataArr] = useState<DisplayMetadataTableRowModel[]>(
        []
    );
    const history = useHistory();
    const params: { studyId: string } = useParams();

    const handleMetadataEditChange = (metadata: DisplayMetadataTableRowModel[]) => {
        setUpdatedMetadata(metadata);
        setSaveEnabled(true);
    };

    useEffect(() => {
        const metadataArr: DisplayMetadataTableRowModel[] = study?.metadata
            ? Object.keys(study.metadata).map((row) => ({
                  metadataKey: row,
                  metadataValue: (study.metadata as any)[row],
              }))
            : [];
        setInitialMetadataArr(metadataArr);
    }, [study]);

    useEffect(() => {
        const getStudy = (id: string) => {
            API.Services.StudiesService.studiesIdGet(id)
                .then((res) => {
                    setStudy(res.data);
                })
                .catch(() => {});
        };

        if (params.studyId) {
            getStudy(params.studyId);
        }
    }, [params.studyId]);

    const handleOnCancel = (event: React.MouseEvent) => {
        history.push(`/studies/${params.studyId}`);
    };

    const handleOnSave = async (event: React.MouseEvent) => {
        const metadata = arrayToMetadata(updatedMetadata);
        try {
            const token = await getAccessTokenSilently();
            globalContext.handleToken(token);
        } catch (exception) {
            console.log(exception);
        }
        API.Services.StudiesService.studiesIdPut(params.studyId, {
            metadata: metadata,
        })
            .then((res) => {
                globalContext.showSnackbar('study successfully updated', SnackbarType.SUCCESS);
                history.push(`/studies/${params.studyId}`);
            })
            .catch((err: Error | AxiosError) => {
                console.log(err.message);
            });
    };

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
                    color="error"
                    onClick={handleOnCancel}
                    className={`${classes.button}`}
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
                    metadata={initialMetadataArr}
                />
            )}
        </div>
    );
};

export default EditStudyPage;
