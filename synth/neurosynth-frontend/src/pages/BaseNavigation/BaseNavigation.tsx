import { Box } from '@mui/system';
import { Switch, Route } from 'react-router-dom';
import EditAnnotationsPage from '../Annotations/EditAnnotationsPage/EditAnnotationsPage';
import StudysetPage from '../Studysets/StudysetPage/StudysetPage';
import PublicStudysetsPage from '../Studysets/PublicStudysetsPage/PublicStudysetsPage';
import UserStudysetsPage from '../Studysets/UserStudysetsPage/UserStudysetsPage';
import LandingPage from '../LandingPage/LandingPage';
import EditStudyPage from '../Studies/EditStudyPage/EditStudyPage';
import PublicStudiesPage from '../Studies/PublicStudiesPage/PublicStudiesPage';
import StudyPage from '../Studies/StudyPage/StudyPage';
import UserStudiesPage from '../Studies/UserStudiesPage/UserStudiesPage';
import BaseNavigationStyles from './BaseNavigation.styles';
import MetaAnalysisBuilderPage from '../MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';

const BaseNavigation = () => {
    return (
        <>
            <Box sx={BaseNavigationStyles.pagesContainer}>
                <Switch>
                    <Route path="/" exact={true}>
                        <LandingPage />
                    </Route>
                    <Route path="/studysets" exact={true}>
                        <PublicStudysetsPage />
                    </Route>
                    <Route path="/userstudysets" exact={true}>
                        <UserStudysetsPage />
                    </Route>
                    <Route path="/studysets/:studysetId/annotations/:annotationId" exact={true}>
                        <EditAnnotationsPage />
                    </Route>
                    <Route path="/studysets/:studysetId" exact={true}>
                        <StudysetPage />
                    </Route>
                    <Route path="/studies" exact={true}>
                        <PublicStudiesPage />
                    </Route>
                    <Route path="/userclonedstudies" exact={true}>
                        <UserStudiesPage />
                    </Route>
                    <Route path="/studies/:studyId" exact={true}>
                        <StudyPage />
                    </Route>
                    <Route path="/studies/edit/:studyId">
                        <EditStudyPage />
                    </Route>
                    <Route path="/meta-analyses">
                        <div>WORK IN PROGRESS PUBLIC META ANALYSES</div>
                    </Route>
                    <Route path="/usermeta-analyses">
                        <div>WORK IN PROGRESS USER META ANALYSES</div>
                    </Route>
                    <Route path="/meta-analysisbuilder">
                        <MetaAnalysisBuilderPage />
                    </Route>
                    <Route>
                        <div>Page not found</div>
                    </Route>
                </Switch>
            </Box>
        </>
    );
};

export default BaseNavigation;
