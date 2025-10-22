import { Box, Link, Typography } from '@mui/material';
import { ErrorBoundary } from '@sentry/react';
import ProgressLoader from 'components/ProgressLoader';
import AnnotationsPage from 'pages/Annotations/AnnotationsPage';
import ProtectedMetaAnalysesRoute from 'pages/BaseNavigation/components/ProtectedMetaAnalysesRoute';
import ProtectedProjectRoute from 'pages/BaseNavigation/components/ProtectedProjectRoute';
import CurationImportPage from 'pages/CurationImport/CurationImportPage';
import ExtractionPage from 'pages/Extraction/ExtractionPage';
import ForbiddenPage from 'pages/Forbidden/Forbidden';
import NotFoundPage from 'pages/NotFound/NotFoundPage';
import ProjectEditMetaAnalyses from 'pages/Project/components/ProjectEditMetaAnalyses';
import ProjectViewMetaAnalyses from 'pages/Project/components/ProjectViewMetaAnalyses';
import ProjectPage from 'pages/Project/ProjectPage';
import BaseStudyPage from 'pages/Study/BaseStudyPage';
import TermsAndConditions from 'pages/TermsAndConditions/TermsAndConditions';
import UserProfilePage from 'pages/UserProfile/UserProfilePage';
import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from '../LandingPage/LandingPage';
import BaseNavigationStyles from './BaseNavigation.styles';
import ProtectedRoute from './components/ProtectedRoute';
import HelpPage from 'pages/HelpPage/HelpPage';

const EditStudyPage = React.lazy(() => import('pages/Study/EditStudyPage'));
const ProjectStudyPage = React.lazy(() => import('pages/Study/ProjectStudyPage'));
const StudiesPage = React.lazy(() => import('pages/Studies/StudiesPage'));

const MetaAnalysesPage = React.lazy(() => import('pages/MetaAnalyses/MetaAnalysesPage'));
const MetaAnalysisPage = React.lazy(() => import('pages/MetaAnalysis/MetaAnalysisPage'));

const ProjectsPage = React.lazy(() => import('pages/Projects/ProjectsPage'));

const CurationPage = React.lazy(() => import('pages/Curation/CurationPage'));

const BaseNavigation: React.FC = () => {
    return (
        <ErrorBoundary
            fallback={
                <Box sx={BaseNavigationStyles.pagesContainer}>
                    <Typography color="error">
                        There was an error.{' '}
                        <Link style={{ cursor: 'pointer' }} href="/" underline="hover">
                            Click here
                        </Link>{' '}
                        to go back to the home page.
                    </Typography>
                </Box>
            }
        >
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
                            <ProtectedRoute errorMessage="Please log in or sign up to access your projects">
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <ProjectsPage />
                                </Box>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/projects/:projectId"
                        element={
                            <ProtectedProjectRoute errorMessage="You do not have access to this project">
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <ProjectPage />
                                </Box>
                            </ProtectedProjectRoute>
                        }
                        children={[
                            <Route key="project-id-project" path="project" element={<ProjectEditMetaAnalyses />} />,
                            <Route
                                key="project-id-meta-analyses"
                                path="meta-analyses"
                                element={<ProjectViewMetaAnalyses />}
                            />,
                            <Route key="project-id-index" index element={<Navigate replace to="project" />} />,
                        ]}
                    />
                    <Route
                        path="/projects/:projectId/curation"
                        element={
                            <ProtectedProjectRoute errorMessage="You do not have access to this project">
                                <Box sx={BaseNavigationStyles.curationPageContainer}>
                                    <CurationPage />
                                </Box>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route
                        path="/projects/:projectId/curation/import"
                        element={
                            <ProtectedProjectRoute
                                onlyOwnerCanAccess
                                errorMessage="You do not own this project, so you cannot import studies into it."
                            >
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <CurationImportPage />
                                </Box>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route
                        path="/projects/:projectId/extraction"
                        element={
                            <ProtectedProjectRoute errorMessage="You do not have access to this project">
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <ExtractionPage />
                                </Box>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route
                        path="/projects/:projectId/extraction/studies/:studyId/edit"
                        element={
                            <ProtectedProjectRoute
                                onlyOwnerCanAccess
                                errorMessage="You do not have access to this project"
                            >
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <EditStudyPage />
                                </Box>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route
                        path="/projects/:projectId/extraction/studies/:studyId"
                        element={
                            <ProtectedProjectRoute errorMessage="You do not have access to this project">
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <ProjectStudyPage />
                                </Box>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route
                        path="/projects/:projectId/extraction/annotations"
                        element={
                            <ProtectedProjectRoute errorMessage="You do not have access to this project">
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <AnnotationsPage />
                                </Box>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route
                        path="/projects/:projectId/meta-analyses/:metaAnalysisId"
                        element={
                            <ProtectedProjectRoute errorMessage="You do not have access to this project">
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <MetaAnalysisPage />
                                </Box>
                            </ProtectedProjectRoute>
                        }
                    />
                    <Route
                        path="/meta-analyses/:metaAnalysisId"
                        element={
                            <ProtectedMetaAnalysesRoute errorMessage="You do not have access to this meta-analysis">
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <MetaAnalysisPage />
                                </Box>
                            </ProtectedMetaAnalysesRoute>
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
                    {['/base-studies/:baseStudyId', '/base-studies/:baseStudyId/:studyVersionId'].map((path) => (
                        <Route
                            key={path}
                            path={path}
                            element={
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <BaseStudyPage />
                                </Box>
                            }
                        />
                    ))}
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
                            <ProtectedRoute errorMessage="Please log in to view your user profile">
                                <Box sx={BaseNavigationStyles.pagesContainer}>
                                    <UserProfilePage />
                                </Box>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/help" element={<HelpPage />} />
                    <Route
                        path="/forbidden"
                        element={
                            <Box sx={BaseNavigationStyles.pagesContainer}>
                                <ForbiddenPage />
                            </Box>
                        }
                    />
                    <Route
                        path="/termsandconditions"
                        element={
                            <Box sx={BaseNavigationStyles.pagesContainer}>
                                <TermsAndConditions />
                            </Box>
                        }
                    />
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
        </ErrorBoundary>
    );
};

export default BaseNavigation;
