import { useAuth0 } from '@auth0/auth0-react';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button } from '@mui/material';
import DisplayStudy from 'components/DisplayStudy/DisplayStudy';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
    useInitStudyStoreIfRequired,
    useStudyAnalyses,
    useStudyAuthors,
    useStudyDOI,
    useStudyDescription,
    useStudyIsLoading,
    useStudyMetadata,
    useStudyName,
    useStudyPMID,
    useStudyPublication,
    useStudyUser,
} from '../StudyStore';

const StudyPage: React.FC = (props) => {
    const { studyId } = useParams<{ studyId: string }>();

    useInitStudyStoreIfRequired();
    const studyUser = useStudyUser();
    const studyIsLoading = useStudyIsLoading();
    const studyName = useStudyName();
    const studyDescription = useStudyDescription();
    const studyDOI = useStudyDOI();
    const studyPMID = useStudyPMID();
    const studyAuthors = useStudyAuthors();
    const studyPublication = useStudyPublication();
    const studyMetadata = useStudyMetadata();
    const studyAnalyses = useStudyAnalyses();

    const [allowEdits, setAllowEdits] = useState(false);
    const history = useHistory();
    const { isAuthenticated, user } = useAuth0();

    const handleEditStudy = (event: React.MouseEvent) => {
        history.push(`/studies/${studyId}/edit`);
    };

    useEffect(() => {
        const userIDAndStudyIDExist = !!user?.sub && !!studyUser;
        const thisUserOwnsThisStudy = (studyUser || null) === (user?.sub || undefined);
        const allowEdit = isAuthenticated && userIDAndStudyIDExist && thisUserOwnsThisStudy;
        setAllowEdits(allowEdit);
    }, [isAuthenticated, user?.sub, studyUser, history]);

    return (
        <StateHandlerComponent isLoading={studyIsLoading} isError={false}>
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
            <DisplayStudy
                name={studyName}
                description={studyDescription}
                doi={studyDOI}
                pmid={studyPMID}
                authors={studyAuthors}
                publication={studyPublication}
                metadata={studyMetadata}
                analyses={studyAnalyses}
            />
        </StateHandlerComponent>
    );
};

export default StudyPage;
