import { Box } from '@mui/system';
import { Switch, Route } from 'react-router-dom';
import { LandingPage, StudiesPage, StudyPage, EditStudyPage } from '../';
import BaseNavigationStyles from './BaseNavigationStyles';

const BaseNavigation = () => {
    return (
        <>
            <Box sx={BaseNavigationStyles.pagesContainer}>
                <Switch>
                    <Route path="/" exact={true}>
                        <LandingPage />
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
