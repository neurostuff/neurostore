import Help from '@mui/icons-material/Help';
import Typography from '@mui/material/Typography';
import { StepType } from '@reactour/tour';

const TourSteps: { [key: string]: StepType[] } = {
    AuthenticatedLandingPage: [
        {
            selector: '[data-tour="AuthenticatedLandingPage-none"]',
            position: 'center',
            content: () => (
                <div>
                    <Typography variant="h5">Introduction</Typography>
                    <Typography variant="subtitle1">
                        Welcome to the neurosynth-compose platform.
                        <br />
                        This is an interactive guide that will get you familiarized with the
                        platform features.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="AuthenticatedLandingPage-2"]',
            content: () => (
                <div>
                    <Typography variant="h5">Documentation</Typography>
                    <Typography variant="subtitle1">
                        To get a more in depth understanding of neurosynth-compose, click this
                        button to open the documentation.
                    </Typography>
                </div>
            ),
            stepInteraction: true,
        },
        {
            selector: '.tour-studies-tab',
            content: () => (
                <div>
                    <Typography variant="subtitle1">
                        We'll start with the Public Studies Page. Click on{' '}
                        <b>STUDIES {'>'} PUBLIC STUDIES</b>
                    </Typography>
                </div>
            ),
            mutationObservables: ['.tour-highlighted-popper'],
            highlightedSelectors: ['.tour-highlighted-popper'],
            stepInteraction: true,
        },
    ],
    StudiesPage: [
        {
            selector: '[data-tour="StudiesPage-none"]',
            position: 'center',
            content: () => (
                <div>
                    <Typography variant="h5">Public Studies Page</Typography>
                    <Typography variant="subtitle1">
                        This page is used for querying the database for studies of interest.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="StudiesPage-2"]',
            content: () => (
                <Typography>
                    You can use this searchbar to filter studies by specific criteria.
                </Typography>
            ),
        },
        {
            selector: '[data-tour="StudiesPage-3"]',
            content: () => (
                <Typography variant="subtitle1">
                    Use this button to add studies to your <b>studyset</b>.
                </Typography>
            ),
        },
        {
            selector: '[data-tour="StudiesPage-4"]',
            content: () => (
                <div>
                    <Typography variant="subtitle1">
                        You can click on a row to view details about a specific study.
                    </Typography>
                    <Typography variant="subtitle1">
                        Click on this study now to view it in more detail.
                    </Typography>
                </div>
            ),
            stepInteraction: true,
        },
    ],
    StudyPage: [
        {
            selector: '[data-tour="StudyPage-1"]',
            content: () => (
                <div>
                    <Typography variant="h5">Study Details</Typography>
                    <Typography variant="subtitle1">
                        This page holds information on a particular study, including the{' '}
                        <b>study title, authors, publication, DOI, and description.</b>
                    </Typography>
                </div>
            ),
            mutationObservables: ['[data-tour="StudyPage-1"]'],
            highlightedSelectors: ['[data-tour="StudyPage-1"]'],
        },
        {
            selector: '[data-tour="StudyPage-2"]',
            content: () => (
                <div>
                    <Typography variant="h5">Metadata</Typography>
                    <Typography variant="subtitle1">
                        This section contains the metadata associated with the study. You can click
                        on it to expand or hide it.
                    </Typography>
                </div>
            ),
            resizeObservables: ['[data-tour="StudyPage-2"]'],
            stepInteraction: true,
        },
        {
            selector: '[data-tour="StudyPage-3"]',
            content: () => (
                <div>
                    <Typography variant="h5">Analyses</Typography>
                    <Typography variant="subtitle1">
                        This section contains all the analyses within a study. An <b>analysis</b> is
                        a contrast of <b>conditions</b> with statistical outputs such as{' '}
                        <b>coordinates</b> or <b>images</b>.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="StudyPage-4"]',
            content: () => (
                <div>
                    <Typography variant="h5">Conditions</Typography>
                    <Typography variant="subtitle1">
                        Conditions are experimental variables that consist of a name/description and
                        an associated weight.
                    </Typography>
                </div>
            ),
            resizeObservables: ['[data-tour="StudyPage-4"]'],
            stepInteraction: true,
        },
        {
            selector: '[data-tour="StudyPage-5"]',
            content: () => (
                <div>
                    <Typography variant="h5">Coordinates</Typography>
                    <Typography variant="subtitle1">
                        Coordinates are X, Y, and Z values that represent various brain activations.
                        They are listed here along with the kind and space.
                    </Typography>
                </div>
            ),
            resizeObservables: ['[data-tour="StudyPage-5"]'],
            stepInteraction: true,
        },
        {
            selector: '[data-tour="StudyPage-6"]',
            content: () => (
                <div>
                    <Typography variant="h5">Images</Typography>
                    <Typography variant="subtitle1">
                        Not yet implemented yet, coming soon!
                    </Typography>
                </div>
            ),
            resizeObservables: ['[data-tour="StudyPage-6"]'],
            stepInteraction: true,
        },
        {
            selector: '[data-tour="StudyPage-7"]',
            content: () => (
                <Typography variant="subtitle1">
                    For multiple analyses, you can switch between them here.
                </Typography>
            ),
            stepInteraction: true,
        },
        {
            selector: '[data-tour="StudyPage-8"]',
            content: () => (
                <Typography variant="subtitle1">
                    If there is anything in the study that you would like to modify, you can{' '}
                    <b>clone a study</b> in order to create your own version of it.
                    <br />
                    Once you have cloned a study, you can then click <b>Edit Study</b> to modify it.
                </Typography>
            ),
        },
        {
            selector: '.tour-studies-tab',
            content: () => (
                <div>
                    <Typography variant="subtitle1">
                        Now let's go to the My Studies Page. Click on{' '}
                        <b>STUDIES {'>'} MY STUDIES</b>
                    </Typography>
                </div>
            ),
            mutationObservables: ['.tour-highlighted-popper'],
            highlightedSelectors: ['.tour-highlighted-popper'],
            stepInteraction: true,
        },
    ],
    UserStudiesPage: [
        {
            selector: '[data-tour="UserStudiesPage-1"]',
            content: () => (
                <div>
                    <Typography variant="h5">My Studies Page</Typography>
                    <Typography variant="subtitle1">
                        This page holds all the studies that you have cloned.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="UserStudiesPage-2"]',
            content: () => (
                <Typography variant="subtitle1">
                    Just like with the Public Studies page, this table will contain your cloned
                    studies which can be viewed or added to a <b>studyset</b>.
                </Typography>
            ),
        },
        {
            selector: '[data-tour="UserStudiesPage-3"]',
            content: () => (
                <Typography variant="subtitle1">
                    Use this button to delete a study that you have cloned. This action is
                    irreversible!
                </Typography>
            ),
        },
        {
            selector: '.tour-studysets-tab',
            content: () => (
                <div>
                    <Typography variant="subtitle1">
                        Let's take a closer look at studysets. Click on{' '}
                        <b>STUDYSETS {'>'} PUBLIC STUDYSETS</b>
                    </Typography>
                </div>
            ),
            mutationObservables: ['.tour-highlighted-popper'],
            highlightedSelectors: ['.tour-highlighted-popper'],
            stepInteraction: true,
        },
    ],
    StudysetsPage: [
        {
            selector: '[data-tour="StudysetsPage-none"]',
            position: 'center',
            content: () => (
                <div>
                    <Typography variant="h5">Public Studysets Page</Typography>
                    <Typography variant="subtitle1">
                        This page is where you can access all public studysets.
                    </Typography>
                    <Typography variant="subtitle1">
                        A <b>studyset</b> is a collection of studies, and one or more associated{' '}
                        <b>annotations</b>.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="StudysetsPage-1"]',
            content: () => (
                <Typography variant="subtitle1">
                    Click on a studyset to view it in detail.
                </Typography>
            ),
            stepInteraction: true,
        },
    ],
    StudysetPage: [
        {
            selector: '[data-tour="StudysetPage-1"]',
            position: 'center',
            content: () => (
                <div>
                    <Typography variant="h5">Studyset Page</Typography>
                    <Typography variant="subtitle1">
                        This page represents a single <b>studyset</b>.
                    </Typography>
                    <br />
                    <Typography variant="subtitle1">
                        A <b>studyset</b> is a collection of studies, and one or more associated{' '}
                        <b>annotations</b>.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="StudysetPage-2"]',
            content: () => (
                <div>
                    <Typography variant="h5">Studyset Details</Typography>
                    <Typography variant="subtitle1">
                        If you own this studyset, you will be able to edit the studyset name and
                        associated publication, DOI, and description.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="StudysetPage-3"]',
            content: () => (
                <div>
                    <Typography variant="h5">Studies Table</Typography>
                    <Typography variant="subtitle1">
                        This table contains all the studies within the studyset.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="StudysetPage-4"]',
            content: () => (
                <div>
                    <Typography variant="h5">Annotations Table</Typography>
                    <Typography variant="subtitle1">
                        This table contains all the associated <b>annotations</b> for a studyset.
                    </Typography>
                    <br />
                    <Typography variant="subtitle1">
                        Annotations are the experimental details and inclusion criteria for a given
                        studyset.
                    </Typography>
                    <Typography>
                        <b>
                            Create an annotation in order to manually include/exclude certain
                            analyses from your meta-analysis.
                        </b>
                    </Typography>
                    <br />
                    <Typography variant="subtitle1">
                        If you want to learn more about editing annotations, you can click on an
                        existing annotation and look for the <Help color="primary" /> icon
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="StudysetPage-5"]',
            content: () => (
                <div>
                    <Typography variant="h5">Create a new annotation</Typography>
                    <Typography variant="subtitle1">
                        Click this button and provide a name and description to create a new
                        annotation for this studyset.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="StudysetPage-6"]',
            content: () => (
                <div>
                    <Typography variant="h5">Delete this studyset</Typography>
                    <Typography variant="subtitle1">
                        To delete this studyset, click this button and confirm.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '.tour-studysets-tab',
            content: () => (
                <div>
                    <Typography variant="subtitle1">
                        Now lets take a look at the <b>My Studysets Page</b>.
                    </Typography>
                    <Typography variant="subtitle1">
                        Navigate to <b>STUDYSETS {'>'} MY STUDYSETS</b>
                    </Typography>
                </div>
            ),
            mutationObservables: ['.tour-highlighted-popper'],
            highlightedSelectors: ['.tour-highlighted-popper'],
            stepInteraction: true,
        },
    ],
    UserStudysetsPage: [
        {
            selector: '[data-tour="UserStudysetsPage-none"]',
            position: 'center',
            content: () => (
                <div>
                    <Typography variant="h5">My Studysets Page</Typography>
                    <Typography variant="subtitle1">
                        This page contains all the studysets that you have created.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="UserStudysetsPage-1"]',
            content: () => (
                <div>
                    <Typography variant="h5">Create a studyset</Typography>
                    <Typography variant="subtitle1">
                        Click this button and enter a name and description to create a new studyset.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '.tour-meta-analyses-tab',
            content: () => (
                <div>
                    <Typography variant="subtitle1">
                        Now, let's move on to meta-analyses.
                    </Typography>
                    <Typography variant="subtitle1">
                        Navigate to <b>META-ANALYSES {'>'} PUBLIC META-ANALYSES</b> to continue the
                        tour.
                    </Typography>
                </div>
            ),
            mutationObservables: ['.tour-highlighted-popper'],
            highlightedSelectors: ['.tour-highlighted-popper'],
            stepInteraction: true,
        },
    ],
    MetaAnalysesPage: [
        {
            selector: '[data-tour="MetaAnalysesPage-none"]',
            content: () => (
                <div>
                    <Typography variant="h5">Public Meta-Analyses Page</Typography>
                    <Typography variant="subtitle1">
                        This page shows all publicly created meta-analyses.
                    </Typography>
                </div>
            ),
            position: 'center',
        },
        {
            selector: '[data-tour="MetaAnalysesPage-1"]',
            content: () => (
                <div>
                    <Typography variant="subtitle1">
                        Click on any meta-analysis in this table to continue.
                    </Typography>
                </div>
            ),
            stepInteraction: true,
        },
    ],
    MetaAnalysisPage: [
        {
            selector: '[data-tour="MetaAnalysisPage-none"]',
            content: () => (
                <div>
                    <Typography variant="h5">Meta-Analysis Page</Typography>
                    <Typography variant="subtitle1">
                        This page represents a single meta-analysis constructed from a curated and
                        annotated <b>studyset</b>.
                    </Typography>
                    <br />
                    <Typography variant="subtitle1">
                        You can run your meta-analysis in a few different ways.
                    </Typography>
                </div>
            ),
            position: 'center',
        },
        {
            selector: '[data-tour="MetaAnalysisPage-1"]',
            content: () => (
                <div>
                    <Typography variant="h5">Specification Summary</Typography>
                    <Typography variant="subtitle1">
                        Expand this accordion to view the specification summary of this
                        meta-analysis.
                    </Typography>
                </div>
            ),
            resizeObservables: ['[data-tour="MetaAnalysisPage-1"]'],
            stepInteraction: true,
        },
        {
            selector: '[data-tour="MetaAnalysisPage-2"]',
            content: () => (
                <div>
                    <Typography variant="h5">Google Collab</Typography>
                    <Typography variant="subtitle1">
                        We have created an environment for you to easily run your meta-analyis in
                        Google Collab.
                    </Typography>
                    <br />
                    <Typography>
                        This method is quick and easy, but may not provide sufficient resources to
                        run your meta-analysis.
                    </Typography>
                    <br />
                    <Typography>
                        Copy the given ID and then click the button to get started.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '[data-tour="MetaAnalysisPage-3"]',
            content: () => (
                <div>
                    <Typography variant="h5">Run Locally</Typography>
                    <Typography variant="subtitle1">
                        The next method is to run the analysis on your local machine via docker.
                    </Typography>
                </div>
            ),
        },
        {
            selector: '.tour-meta-analyses-tab',
            content: () => (
                <Typography>
                    Let's now go to the My Meta-Analyses Page. Click{' '}
                    <b>META-ANALYSES {'>'} MY META-ANALYSES </b>
                </Typography>
            ),
            mutationObservables: ['.tour-highlighted-popper'],
            highlightedSelectors: ['.tour-highlighted-popper'],
            stepInteraction: true,
        },
    ],
    UserMetaAnalysesPage: [
        {
            selector: '[data-tour="UserMetaAnalysesPage-none"]',
            content: () => (
                <div>
                    <Typography variant="h5">My Meta-Analyses Page</Typography>
                    <Typography variant="subtitle1">
                        This page shows all meta-analyses that you have created.
                    </Typography>
                </div>
            ),
            position: 'center',
        },
        {
            selector: '[data-tour="UserMetaAnalysesPage-1"]',
            content: () => (
                <Typography variant="subtitle1">
                    As with the Public Meta-Analyses Page, you can click on a row to view your
                    meta-analyses.
                </Typography>
            ),
        },
        {
            selector: '[data-tour="UserMetaAnalysesPage-2"]',
            content: () => (
                <div>
                    <Typography variant="h5">Create a meta-analysis</Typography>
                    <Typography variant="subtitle1">
                        Once you have a properly <b>curated and annotated studyset</b>, you can
                        proceed to create a meta-analysis.
                    </Typography>
                    <Typography variant="subtitle1">
                        Go ahead and click on this button to continue the tour and go to the
                        meta-analysis builder.
                    </Typography>
                </div>
            ),
            stepInteraction: true,
        },
    ],
    MetaAnalysisBuilderPage: [
        {
            selector: '[data-tour="MetaAnalysisBuilderPage-none"]',
            content: () => (
                <div>
                    <Typography variant="h5">Meta-Analysis Builder</Typography>
                    <Typography variant="subtitle1">
                        This wizard walks you through the process of building a meta-analysis.
                    </Typography>
                </div>
            ),
            position: 'center',
        },
        {
            selector: '[data-tour="MetaAnalysisBuilderPage-none"]',
            content: () => (
                <div>
                    <Typography variant="subtitle1">
                        To build a meta-analysis, you must have a valid{' '}
                        <b>curated and annotated studyset</b>.
                    </Typography>
                    <br />
                    <Typography>
                        You will be asked to specify certain configurations, such as the type of
                        meta-analytic algorithm you want to use as well as related inputs.
                    </Typography>
                </div>
            ),
            position: 'center',
        },
        {
            selector: '[data-tour="MetaAnalysisbuilderPage-none"]',
            content: () => (
                <div>
                    <Typography variant="h5">End of Tour</Typography>
                    <Typography variant="subtitle1">
                        This concludes the neurosynth tour. We hope this was a useful introduction
                        to the platform.
                    </Typography>
                    <br />
                    <Typography variant="subtitle1">
                        Feel free to leave feedback using the bottom right feedback tab.
                    </Typography>
                    <Typography variant="subtitle1">
                        Be sure to check out the documentation as well on the top right.
                    </Typography>
                    <br />
                    <Typography variant="subtitle1">
                        You may now close this window by clicking outside, pressing the escape key,
                        or clicking the "x" button on the top right.
                    </Typography>
                </div>
            ),
            position: 'center',
        },
    ],
};

export default TourSteps;
