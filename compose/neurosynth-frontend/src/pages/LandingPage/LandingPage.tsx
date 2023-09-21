import { Typography, Box, Link } from '@mui/material';
import LandingPageStyles from './LandingPage.styles';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlatformComparisonTable from './PlatformComparisonTable';
import { useAuth0 } from '@auth0/auth0-react';
import { Link as ReactRouterLink } from 'react-router-dom';
import StepperDisplay from './StepperDisplay';
import { useGuard } from 'hooks';

const LandingPage = () => {
    const { isAuthenticated } = useAuth0();
    useGuard('/projects', '', isAuthenticated);

    const logos: { logoPath: string; alt: string }[] = [
        {
            logoPath: '/static/utlogo.png',
            alt: 'UT Logo',
        },
        {
            logoPath: '/static/mcgilllogo.png',
            alt: 'McGill Logo',
        },
        {
            logoPath: '/static/nihlogo.png',
            alt: 'NIH Logo',
        },
        {
            logoPath: '/static/fiulogo.png',
            alt: 'FIU Logo',
        },
        {
            logoPath: '/static/oxfordlogo.png',
            alt: 'Oxford Logo',
        },
        {
            logoPath: '/static/stanfordlogo.png',
            alt: 'Stanford Logo',
        },
        {
            logoPath: '/static/origamilogo.png',
            alt: 'Origami Labs Logo',
        },
    ];

    const steps = [
        {
            icon: <SearchIcon color="primary" />,
            title: '(1) Search Studies',
            textContent:
                'Search titles and abstracts of all articles included in neurosynth, neuroquery, and more.',
        },
        {
            icon: <AutoAwesomeMotionIcon color="primary" />,
            title: '(2) Create Studyset',
            textContent: 'Create a collection of studies that meet your search criteria.',
        },
        {
            icon: <FilterAltIcon color="primary" />,
            title: '(3) Annotate Studyset',
            textContent:
                'Annotate each analysis within your study-set with experimental details and inclusion criteria.',
        },
        {
            icon: <SettingsIcon color="primary" />,
            title: '(4) Specify Meta-Analysis',
            textContent:
                'Specify which meta-analytic algorithm and its parameters to apply to your study-set through NiMARE.',
        },
        {
            icon: <CheckCircleIcon color="primary" />,
            title: '(5) Execute Meta-Analysis',
            textContent:
                'Execute the prepared meta-analysis online or on your machine. NiMARE is the primary execution engine downloading the study-set, annotation, and meta-analysis specification for reproducible analysis.',
        },
    ];

    return (
        <>
            <Box sx={[LandingPageStyles.sectionContainer, { backgroundColor: 'primary.main' }]}>
                <Box
                    sx={[
                        LandingPageStyles.sectionContents,
                        LandingPageStyles.introContentContainer,
                    ]}
                >
                    <Box
                        sx={{
                            padding: {
                                xs: '2rem',
                                md: '2rem',
                                xl: '4rem',
                            },
                        }}
                    >
                        <Typography sx={LandingPageStyles.title} variant="h3">
                            A platform for reproducible neuroimaging meta-analysis
                        </Typography>
                        <Typography variant="h6" sx={LandingPageStyles.introSpacedText}>
                            Neurosynth compose allows you to perform an entire meta-analysis
                            directly from the browser. It provides a centralized location to edit,
                            organize, share, and keep provenance of meta-analyses.
                        </Typography>
                        <Box sx={LandingPageStyles.introSpacedText}>
                            <Typography variant="h6">Use neurosynth-compose for</Typography>
                            <ul>
                                <li>
                                    <Typography variant="h6">
                                        <li>Performing custom meta-analyses</li>
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="h6">
                                        <li>Creating systematic reviews</li>
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="h6">
                                        <li>Updating and replicating existing reviews</li>
                                    </Typography>
                                </li>
                                <li>
                                    <Typography variant="h6">
                                        <li>Analyzing neurosynth/neuroquery databases</li>
                                    </Typography>
                                </li>
                            </ul>

                            <Typography variant="h6" sx={LandingPageStyles.introSpacedText}>
                                Get started by browsing various&nbsp;
                                <Link
                                    component={ReactRouterLink}
                                    to="/base-studies"
                                    color="secondary.main"
                                >
                                    studies
                                </Link>
                                ,&nbsp;
                                <Link
                                    component={ReactRouterLink}
                                    to="/studysets"
                                    color="secondary.main"
                                >
                                    studysets
                                </Link>
                                , or&nbsp;
                                <Link
                                    component={ReactRouterLink}
                                    to="/meta-analyses"
                                    color="secondary.main"
                                >
                                    meta-analyses
                                </Link>
                                &nbsp;on the platform.
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={LandingPageStyles.imageContainer}>
                        <Box
                            component="img"
                            sx={{
                                padding: '0 4rem',
                                height: 'auto',
                                width: {
                                    // xs: '250px',
                                    // md: '35vw',
                                    // lg: '38vw',
                                    // xl: '43vw',
                                    xs: '250px',
                                    md: '530px',
                                    lg: '600px',
                                    xl: '800px',
                                },
                            }}
                            src="/static/brain-analysis.png"
                            alt="brain-analysis"
                        />
                    </Box>
                </Box>
            </Box>
            <Box
                sx={[
                    LandingPageStyles.sectionContainer,
                    { backgroundColor: 'primary.contrastText', overflow: 'visible !important' },
                ]}
            >
                <Box sx={LandingPageStyles.sectionContents}>
                    <Typography variant="h3" color="primary.main">
                        Neurosynth-Compose workflow
                    </Typography>
                    <Box sx={LandingPageStyles.workflowContainer}>
                        <Box sx={LandingPageStyles.stepperContainer}>
                            <StepperDisplay steps={steps} />
                        </Box>
                        <Box sx={LandingPageStyles.glossaryContainer}>
                            <Box
                                sx={LandingPageStyles.glossary}
                                component="img"
                                src="/static/glossary.png"
                                alt="glossary"
                            ></Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
            <Box sx={[LandingPageStyles.sectionContainer, { backgroundColor: 'primary.main' }]}>
                <Box sx={LandingPageStyles.sectionContents}>
                    <Typography
                        variant="h3"
                        color="primary.main"
                        sx={{ marginBottom: '2rem', color: 'primary.contrastText' }}
                    >
                        Platform Comparison
                    </Typography>
                    <PlatformComparisonTable />
                </Box>
            </Box>
            <Box sx={[LandingPageStyles.sectionContainer, { backgroundColor: 'aliceblue' }]}>
                <Box sx={LandingPageStyles.sectionContents}>
                    <Box>
                        <Typography variant="h3" color="primary.main" sx={{ marginBottom: '1rem' }}>
                            Neurosynth-Compose ecosystem
                        </Typography>
                        <Typography color="primary.main" variant="h6">
                            Neurosynth-Compose is part of a larger ecosystem of tools which all work
                            together to enhance the scientific community by synthesizing fMRI data.
                        </Typography>
                    </Box>
                    <Box
                        sx={{ width: '100%' }}
                        component="img"
                        src="/static/ecosystem.png"
                        alt="ecosystem"
                    />
                </Box>
            </Box>
            <Box sx={{ width: '100%', backgroundColor: 'lightgray' }}>
                <Box
                    sx={{
                        width: '80%',
                        margin: '0 auto',
                    }}
                >
                    <Typography align="center" variant="h5" sx={{ padding: '3rem 0' }}>
                        Neurosynth compose is supported by the following organizations:
                    </Typography>

                    <Box sx={{ width: '100%' }}>
                        <Box sx={LandingPageStyles.sponsorsImgContainer}>
                            {logos.map((logo) => (
                                <Box
                                    key={logo.logoPath}
                                    sx={LandingPageStyles.sponsorLogoContainer}
                                >
                                    <Box
                                        component="img"
                                        sx={LandingPageStyles.sponsorLogo}
                                        src={logo.logoPath}
                                        alt={logo.alt}
                                    />
                                </Box>
                            ))}
                        </Box>
                        <Typography align="center" sx={{ padding: '2rem 0 4rem 0' }}>
                            Supported by NIH award 5R01MH096906-06
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </>
    );
};

export default LandingPage;
