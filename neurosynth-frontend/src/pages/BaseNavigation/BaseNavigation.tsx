import { Box } from '@mui/system';
import { Switch, Route } from 'react-router-dom';
import DatasetPage from '../Datasets/DatasetPage/DatasetPage';
import DatasetsPage from '../Datasets/PublicDatasetsPage/PublicDatasetsPage';
import UserDatasetsPage from '../Datasets/UserDatasetsPage/UserDatasetsPage';
import LandingPage from '../LandingPage/LandingPage';
import EditStudyPage from '../Studies/EditStudyPage/EditStudyPage';
import PublicStudiesPage from '../Studies/PublicStudiesPage/PublicStudiesPage';
import StudyPage from '../Studies/StudyPage/StudyPage';
import UserStudiesPage from '../Studies/UserStudiesPage/UserStudiesPage';
import BaseNavigationStyles from './BaseNavigation.styles';

const BaseNavigation = () => {
    return (
        <>
            <Box sx={BaseNavigationStyles.pagesContainer}>
                <Switch>
                    <Route path="/" exact={true}>
                        <LandingPage />
                    </Route>
                    <Route path="/datasets" exact={true}>
                        <DatasetsPage />
                    </Route>
                    <Route path="/datasets/userdatasets" exact={true}>
                        <UserDatasetsPage />
                    </Route>
                    <Route path="/datasets/:datasetId" exact={true}>
                        <DatasetPage />
                    </Route>
                    <Route path="/studies" exact={true}>
                        <PublicStudiesPage />
                    </Route>
                    <Route path="/studies/userclonedstudies" exact={true}>
                        <UserStudiesPage />
                    </Route>
                    <Route path="/studies/:studyId" exact={true}>
                        <StudyPage />
                    </Route>
                    <Route path="/studies/edit/:studyId">
                        <EditStudyPage />
                    </Route>
                </Switch>
            </Box>
        </>
    );
};

export default BaseNavigation;
