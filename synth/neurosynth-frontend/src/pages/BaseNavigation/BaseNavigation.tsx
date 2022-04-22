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
import UserMetaAnalysesPage from '../MetaAnalyses/UserMetaAnalysesPage/UserMetaAnalysesPage';
import PublicMetaAnalysesPage from '../MetaAnalyses/PublicMetaAnalysesPage/PublicMetaAnalysesPage';

const BaseNavigation: React.FC = (_props) => {
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
                    <Route path="/userstudies" exact={true}>
                        <UserStudiesPage />
                    </Route>
                    <Route path="/studies/:studyId" exact={true}>
                        <StudyPage />
                    </Route>
                    <Route path="/studies/:studyId/edit">
                        <EditStudyPage />
                    </Route>
                    <Route path="/meta-analyses" exact={true}>
                        <PublicMetaAnalysesPage />
                    </Route>
                    <Route path="/usermeta-analyses" exact={true}>
                        <UserMetaAnalysesPage />
                    </Route>
                    <Route path="/meta-analyses/build" exact={true}>
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
