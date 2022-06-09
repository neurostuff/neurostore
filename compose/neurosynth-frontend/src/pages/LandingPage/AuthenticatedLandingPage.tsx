import { Box, Typography, Button } from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import NeurosynthList from 'components/NeurosynthList/NeurosynthList';
import { useGetMetaAnalyses, useGetStudies, useGetStudysets, useCreateStudyset } from 'hooks';
import { SearchCriteria } from 'pages/Studies/PublicStudiesPage/PublicStudiesPage';
import { useAuth0 } from '@auth0/auth0-react';
import AuthenticatedLandingPageStyles from './AuthenticatedLandingPage.styles';
import { useHistory } from 'react-router-dom';
import { useState } from 'react';
import { useTour } from '@reactour/tour';

const AuthenticatedLandingPage: React.FC = (props) => {
    const history = useHistory();
    const tour = useTour();
    const { user } = useAuth0();
    const {
        mutate,
        isLoading: createStudysetIsLoading,
        isError: createStudysetIsError,
    } = useCreateStudyset();
    const {
        data: studies,
        isLoading: getStudiesIsLoading,
        isError: getStudiesIsError,
    } = useGetStudies({
        ...new SearchCriteria(),
        userId: user?.sub,
    });
    const {
        data: studysets,
        isLoading: getStudysetsIsLoading,
        isError: getStudysetsIsError,
    } = useGetStudysets(user?.sub);
    const {
        data: metaAnalyses,
        isLoading: getMetaAnalysesIsLoading,
        isError: getMetaAnalysesIsError,
    } = useGetMetaAnalyses(user?.sub);

    const [dialogIsOpen, setDialogIsOpen] = useState(false);

    const handleCreateStudyset = (name: string, description: string) => {
        mutate({
            name,
            description,
        });
    };

    return (
        <Box sx={{ width: '80%', margin: '3rem auto' }}>
            <button onClick={() => tour.setIsOpen(true)}>open tour</button>
            <CreateDetailsDialog
                titleText="Create new studyset"
                onCreate={handleCreateStudyset}
                isOpen={dialogIsOpen}
                onCloseDialog={() => setDialogIsOpen(false)}
            />
            <Box sx={AuthenticatedLandingPageStyles.landingPageContainer}>
                <NeurosynthList
                    containerSx={{
                        ...AuthenticatedLandingPageStyles.list,
                        ...{ backgroundColor: 'primary.main' },
                    }}
                    NoDataElement={
                        <Typography color="primary.contrastText">
                            No studies have been cloned yet
                        </Typography>
                    }
                    loaderColor="secondary.main"
                    isLoading={getStudiesIsLoading}
                    isError={getStudiesIsError}
                    listIcon={<ArticleIcon sx={{ color: 'primary.main' }} />}
                    titleText="Studies"
                    listItems={(studies || []).map((study) => ({
                        primaryText: study.name || '',
                        secondaryText: study.authors || '',
                        id: study?.id || '',
                        link: `/studies/${study?.id}`,
                    }))}
                />
                <NeurosynthList
                    containerSx={{
                        ...AuthenticatedLandingPageStyles.list,
                        ...{ backgroundColor: '#42ab55' },
                    }}
                    NoDataElement={
                        <Typography color="primary.contrastText">
                            No studysets have been been created yet
                        </Typography>
                    }
                    TitleElement={
                        <Button
                            onClick={() => setDialogIsOpen(true)}
                            variant="contained"
                            disableElevation
                        >
                            new studyset
                        </Button>
                    }
                    loaderColor="secondary.main"
                    isLoading={getStudysetsIsLoading || createStudysetIsLoading}
                    isError={getStudysetsIsError || createStudysetIsError}
                    listIcon={<AutoAwesomeMotionIcon sx={{ color: '#42ab55' }} />}
                    titleText="Studysets"
                    listItems={(studysets || []).map((studyset) => ({
                        primaryText: studyset.name || '',
                        secondaryText: studyset.description || '',
                        id: studyset?.id || '',
                        link: `/studysets/${studyset?.id}`,
                    }))}
                />
                <NeurosynthList
                    TitleElement={
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={() => history.push('/meta-analyses/build')}
                        >
                            new meta-analysis
                        </Button>
                    }
                    containerSx={{
                        ...AuthenticatedLandingPageStyles.list,
                        ...{ backgroundColor: '#5C2751' },
                    }}
                    NoDataElement={
                        <Typography color="primary.contrastText">
                            No meta-analyses have been created yet
                        </Typography>
                    }
                    loaderColor="secondary.main"
                    isLoading={getMetaAnalysesIsLoading}
                    isError={getMetaAnalysesIsError}
                    listIcon={<PsychologyIcon sx={{ color: '#5C2751' }} />}
                    titleText="Meta-Analyses"
                    listItems={(metaAnalyses || []).map((metaAnalysis) => ({
                        primaryText: metaAnalysis.name || '',
                        secondaryText: metaAnalysis.description || '',
                        id: metaAnalysis?.id || '',
                        link: `/meta-analyses/${metaAnalysis?.id}`,
                    }))}
                />
            </Box>
        </Box>
    );
};

export default AuthenticatedLandingPage;
