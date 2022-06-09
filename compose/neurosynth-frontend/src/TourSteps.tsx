import { Typography } from '@mui/material';
import { StepType } from '@reactour/tour';

const TourSteps: {
    [key: string]: StepType[];
} = {
    AuthenticatedLandingPage: [
        {
            selector: '[data-tour="AuthenticatedLandingPage-1"]',
            content: () => (
                <div>
                    <Typography variant="h5">Introduction</Typography>
                    <Typography variant="subtitle1">
                        Welcome to the neurosynth-compose platform.
                        <br />
                        This is an interactive guide that will get you familiarized with the
                        features of the meta-analysis builder
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="AuthenticatedLandingPage-1"]',
            content: () => (
                <Typography variant="subtitle1">
                    Get started by navigating to
                    <br /> Studies {'>'} Public Studies
                </Typography>
            ),
            highlightedSelectors: ['.tour-highlighted-popper'],
            mutationObservables: ['.tour-highlighted-popper'],
        },
    ],
    PublicStudiesPage: [
        {
            selector: '[data-tour="PublicStudiesPage-1"]',
            content: () => (
                <Typography variant="subtitle1">
                    This page is used for querying the database for studies of interest.
                </Typography>
            ),
        },
        {
            selector: '[data-tour="PublicStudiesPage-2"]',
            content: () => (
                <Typography variant="subtitle1">
                    Use this button to add studies to a <b>studyset</b>
                </Typography>
            ),
            // highlightedSelectors: [
            //     '[data-tour="highlight-popper"]',
            // ],
            // mutationObservables: [
            //     '[data-tour="highlight-popper"]',
            // ],
        },
        {
            selector: '[data-tour="PublicStudiesPage-3"]',
            content: () => (
                <Typography variant="subtitle1">Click on a study to view more details</Typography>
            ),
        },
    ],
    StudyPage: [
        {
            selector: '[data-tour="StudyPage-1"]',
            content: () => (
                <Typography variant="subtitle1">
                    This page holds information on a particular study, including the{' '}
                    <b>study title, authors, publication, DOI, and description.</b>
                </Typography>
            ),
        },
        {
            selector: '[data-tour="StudyPage-2"]',
            content: () => (
                <Typography variant="subtitle1">
                    Expanding this section shows the metadata associated with the study.
                </Typography>
            ),
        },
        {
            selector: '[data-tour="StudyPage-3"]',
            content: () => (
                <Typography variant="subtitle1">
                    This section contains all the analyses within a study. An <b>analysis</b> is a
                    contrast of <b>conditions</b> with statistical outputs such as{' '}
                    <b>coordinates</b> or <b>images</b>.
                </Typography>
            ),
        },
        {
            selector: '[data-tour="StudyPage-4"]',
            content: () => (
                <Typography variant="subtitle1">
                    If there are details about the study that you would like to modify, then you can{' '}
                    <b>clone a study</b> in order to create your own version of it.
                    <br />
                    Once you have cloned a study, you can then click <b>Edit Study</b> to modify it.
                </Typography>
            ),
        },
    ],
};

export default TourSteps;
