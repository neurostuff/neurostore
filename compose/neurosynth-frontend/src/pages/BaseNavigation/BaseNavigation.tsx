import { Box } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader';
import AnnotationsPage from 'pages/Annotations/AnnotationsPage';
import CurationImportPage from 'pages/CurationImport/CurationImportPage';
import ExtractionPage from 'pages/Extraction/ExtractionPage';
import NotFoundPage from 'pages/NotFound/NotFoundPage';
import ProjectPage from 'pages/Project/ProjectPage';
import BaseStudyPage from 'pages/Study/StudyPage';
import UserProfilePage from 'pages/UserProfile/UserProfilePage';
import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from '../LandingPage/LandingPage';
import BaseNavigationStyles from './BaseNavigation.styles';
import ForbiddenPage from 'pages/Forbidden/Forbidden';
import ProtectedProjectRoute from 'pages/Projects/ProjectPage/ProtectedRoute';
import TermsAndConditions from 'pages/TermsAndConditions/TermsAndConditions';
import ProjectEditMetaAnalyses from 'pages/Project/components/ProjectEditMetaAnalyses';
import ProjectViewMetaAnalyses from 'pages/Project/components/ProjectViewMetaAnalyses';

const ImportSleuthPage = React.lazy(() => import('pages/SleuthImport/SleuthImportPage'));
const EditStudyPage = React.lazy(() => import('../Study/EditStudyPage'));
const StudiesPage = React.lazy(() => import('../Studies/StudiesPage'));

const MetaAnalysesPage = React.lazy(() => import('../MetaAnalyses/MetaAnalysesPage'));
const MetaAnalysisPage = React.lazy(() => import('../MetaAnalysis/MetaAnalysisPage'));

const ProjectsPage = React.lazy(() => import('../Projects/ProjectsPage'));

const CurationPage = React.lazy(() => import('../Curation/CurationPage'));

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
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route
                    path="/projects"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <ProjectsPage />
                        </Box>
                    }
                />
                <Route
                    path="/projects/new/sleuth"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <ImportSleuthPage />
                        </Box>
                    }
                />
                <Route
                    path="/projects/:projectId"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <ProjectPage />
                        </Box>
                    }
                    children={[
                        <Route
                            key="project-id-project"
                            path="project"
                            element={<ProjectEditMetaAnalyses />}
                        />,
                        <Route
                            key="project-id-meta-analyses"
                            path="meta-analyses"
                            element={<ProjectViewMetaAnalyses />}
                        />,
                        <Route
                            key="project-id-index"
                            index
                            element={<Navigate replace to="project" />}
                        />,
                        <Route
                            key="project-id-*"
                            path="*"
                            element={<Navigate replace to="project" />}
                        />,
                    ]}
                />
                <Route
                    path="/projects/:projectId/curation"
                    element={
                        <Box sx={BaseNavigationStyles.curationPageContainer}>
                            <CurationPage />
                        </Box>
                    }
                />
                <Route
                    path="/projects/:projectId/curation/import"
                    element={
                        <ProtectedProjectRoute>
                            <Box sx={BaseNavigationStyles.pagesContainer}>
                                <CurationImportPage />
                            </Box>
                        </ProtectedProjectRoute>
                    }
                />
                <Route
                    path="/projects/:projectId/extraction"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <ExtractionPage />
                        </Box>
                    }
                />
                <Route
                    path="/projects/:projectId/extraction/studies/:studyId"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <EditStudyPage />
                        </Box>
                    }
                />
                {/* ENSURE THAT PEOPLE CANNOT SEE ANNOTATIONS OUTSIDE OF THE CONTEXT OF A PROJECT */}
                <Route
                    path="/projects/:projectId/extraction/annotations"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <AnnotationsPage />
                        </Box>
                    }
                />
                {/* ENSURE THAT PEOPLE CANNOT SEE META ANALYSES OUTSIDE OF THE CONTEXT OF A PROJECT */}
                <Route
                    path="/projects/:projectId/meta-analyses/:metaAnalysisId"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <MetaAnalysisPage />
                        </Box>
                    }
                />
                <Route
                    path="/base-studies"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <StudiesPage />
                        </Box>
                    }
                />
                {['/base-studies/:baseStudyId', '/base-studies/:baseStudyId/:studyVersionId'].map(
                    (path) => (
                        <Route
                            key={path}
                            path={path}
                            element={
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <BaseStudyPage />
                                </Box>
                            }
                        />
                    )
                )}
                <Route
                    path="/meta-analyses"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <MetaAnalysesPage />
                        </Box>
                    }
                />
                <Route
                    path="/user-profile"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <UserProfilePage />
                        </Box>
                    }
                />
                <Route
                    path="/forbidden"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <ForbiddenPage />
                        </Box>
                    }
                />
                <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
                <Route
                    path="*"
                    element={
                        <Box sx={BaseNavigationStyles.pagesContainer}>
                            <NotFoundPage />
                        </Box>
                    }
                />
            </Routes>
        </Suspense>
    );
};

export default BaseNavigation;
