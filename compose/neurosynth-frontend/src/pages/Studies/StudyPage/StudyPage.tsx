import { useAuth0 } from '@auth0/auth0-react';
import { Button, Box } from '@mui/material';
import React, { useState, useEffect } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useGetStudyById } from 'hooks';
import EditIcon from '@mui/icons-material/Edit';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useInitStudyStore } from '../StudyStore';
import DisplayStudy from 'components/DisplayStudy/DisplayStudy';

const StudyPage: React.FC = (props) => {
    const { studyId } = useParams<{ studyId: string }>();

    const initStudyStore = useInitStudyStore();

    useEffect(() => {
        initStudyStore(studyId);
    }, [initStudyStore, studyId]);

    const [allowEdits, setAllowEdits] = useState(false);
    const history = useHistory();
    const { isAuthenticated, user } = useAuth0();
    const {
        isLoading: getStudyIsLoading,
        isError: getStudyIsError,
        isFetching: getStudyIsFetching,
        isRefetching: getStudyIsRefetching,
        data,
    } = useGetStudyById(studyId);

    const handleEditStudy = (event: React.MouseEvent) => {
        history.push(`/studies/${studyId}/edit`);
    };

    useEffect(() => {
        const userIDAndStudyIDExist = !!user?.sub && !!data?.user;
        const thisUserOwnsThisStudy = (data?.user || null) === (user?.sub || undefined);
        const allowEdit = isAuthenticated && userIDAndStudyIDExist && thisUserOwnsThisStudy;
        setAllowEdits(allowEdit);
    }, [isAuthenticated, user?.sub, data?.user, history]);

    return (
        <StateHandlerComponent
            isLoading={getStudyIsLoading || getStudyIsFetching || getStudyIsRefetching}
            isError={getStudyIsError}
        >
            {allowEdits && (
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginBottom: '0.5rem',
                    }}
                >
                    <Button
                        onClick={handleEditStudy}
                        endIcon={<EditIcon />}
                        disabled={!allowEdits}
                        sx={{ width: '190px', marginLeft: 'auto' }}
                        variant="contained"
                    >
                        Edit Study
                    </Button>
                </Box>
            )}
            <DisplayStudy {...data} />
        </StateHandlerComponent>
    );
};

export default StudyPage;
