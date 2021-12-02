import { Box } from '@mui/system';
import { Switch, Route } from 'react-router-dom';
import { LandingPage, StudiesPage, StudyPage, EditStudyPage } from '../';
import DatasetPage from '../DatasetsPage/DatasetPage/DatasetPage';
import DatasetsPage from '../DatasetsPage/DatasetsPage';
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
                    <Route path="/datasets/:datasetId" exact={true}>
                        <DatasetPage />
                    </Route>
                    <Route path="/studies" exact={true}>
                        <StudiesPage />
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
