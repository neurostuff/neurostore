import { Switch, Route } from 'react-router-dom';
import { LandingPage, StudiesPage, StudyPage, EditStudyPage } from '../';
import BaseNavigationStyles from './BaseNavigationStyles';

const BaseNavigation = () => {
    const classes = BaseNavigationStyles();

    return (
        <>
            <div className={classes.pagesContainer}>
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
            </div>
        </>
    );
};

export default BaseNavigation;
