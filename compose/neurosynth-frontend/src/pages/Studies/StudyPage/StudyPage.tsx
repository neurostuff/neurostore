import { useAuth0 } from '@auth0/auth0-react';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button } from '@mui/material';
import DisplayStudy from 'components/DisplayStudy/DisplayStudy';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useGetStudyById } from 'hooks';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useInitStudyStoreIfRequired } from '../StudyStore';

const StudyPage: React.FC = (props) => {
    const { studyId } = useParams<{ studyId: string }>();

    useInitStudyStoreIfRequired();

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
                        sx={{ width: '190px', marginLeft: 'auto', marginRight: '15px' }}
                        variant="contained"
                        disableElevation
                        color="secondary"
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
