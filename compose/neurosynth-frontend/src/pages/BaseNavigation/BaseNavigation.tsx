import React, { Suspense } from 'react';
import { Box } from '@mui/material';
import { Switch, Route } from 'react-router-dom';
import LandingPage from '../LandingPage/LandingPage';
import BaseNavigationStyles from './BaseNavigation.styles';
import { ProgressLoader } from 'components';

const EditAnnotationsPage = React.lazy(
    () => import('../Annotations/EditAnnotationsPage/EditAnnotationsPage')
);
const StudysetPage = React.lazy(() => import('../Studysets/StudysetPage/StudysetPage'));
const PublicStudysetsPage = React.lazy(
    () => import('../Studysets/PublicStudysetsPage/PublicStudysetsPage')
);
const UserStudysetsPage = React.lazy(
    () => import('../Studysets/UserStudysetsPage/UserStudysetsPage')
);
const EditStudyPage = React.lazy(() => import('../Studies/EditStudyPage/EditStudyPage'));
const PublicStudiesPage = React.lazy(
    () => import('../Studies/PublicStudiesPage/PublicStudiesPage')
);
const StudyPage = React.lazy(() => import('../Studies/StudyPage/StudyPage'));
const UserStudiesPage = React.lazy(() => import('../Studies/UserStudiesPage/UserStudiesPage'));
const MetaAnalysisBuilderPage = React.lazy(
    () => import('../MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage')
);
const UserMetaAnalysesPage = React.lazy(
    () => import('../MetaAnalyses/UserMetaAnalysesPage/UserMetaAnalysesPage')
);
const PublicMetaAnalysesPage = React.lazy(
    () => import('../MetaAnalyses/PublicMetaAnalysesPage/PublicMetaAnalysesPage')
);
const MetaAnalysisPage = React.lazy(
    () => import('../MetaAnalyses/MetaAnalysisPage/MetaAnalysisPage')
);

const BaseNavigation: React.FC = (_props) => {
    return (
        <Suspense
            fallback={
                <div
                    style={{
                        display: 'flex',
                        width: '100%',
                        height: '100%',
                        justifyContent: 'center',
                        margin: '2rem 0',
                    }}
                >
                    <ProgressLoader />
                </div>
            }
        >
            <Switch>
                <Route path="/" exact={true}>
                    <LandingPage />
                </Route>
                <Route path="/studysets" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <PublicStudysetsPage />
                    </Box>
                </Route>
                <Route path="/userstudysets" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <UserStudysetsPage />
                    </Box>
                </Route>
                <Route path="/studysets/:studysetId/annotations/:annotationId" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <EditAnnotationsPage />
                    </Box>
                </Route>
                <Route path="/studysets/:studysetId" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <StudysetPage />
                    </Box>
                </Route>
                <Route path="/studies" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <PublicStudiesPage />
                    </Box>
                </Route>
                <Route path="/userstudies" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <UserStudiesPage />
                    </Box>
                </Route>
                <Route path="/meta-analyses/build" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <MetaAnalysisBuilderPage />
                    </Box>
                </Route>
                <Route path="/studies/:studyId" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <StudyPage />
                    </Box>
                </Route>
                <Route path="/studies/:studyId/edit">
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <EditStudyPage />
                    </Box>
                </Route>
                <Route path="/meta-analyses" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <PublicMetaAnalysesPage />
                    </Box>
                </Route>
                <Route path="/meta-analyses/:metaAnalysisId" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <MetaAnalysisPage />
                    </Box>
                </Route>
                <Route path="/usermeta-analyses" exact={true}>
                    <Box sx={BaseNavigationStyles.pagesContainer}>
                        <UserMetaAnalysesPage />
                    </Box>
                </Route>
                <Route>
                    <div>Page not found</div>
                </Route>
            </Switch>
        </Suspense>
    );
};

export default BaseNavigation;
