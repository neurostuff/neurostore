import { Typography, Box, Link, Stepper, Step, StepLabel, StepContent } from '@mui/material';
import LandingPageStyles from './LandingPage.styles';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlatformComparisonTable from './PlatformComparisonTable';
import AuthenticatedLandingPage from './AuthenticatedLandingPage';
import { useAuth0 } from '@auth0/auth0-react';
import { Link as ReactRouterLink } from 'react-router-dom';

const LandingPage = () => {
    const { isAuthenticated } = useAuth0();

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

    if (isAuthenticated) {
        return <AuthenticatedLandingPage />;
    }

    return (
        <>
            <Box sx={{ width: '100%', backgroundColor: 'primary.main' }}>
                <Box sx={LandingPageStyles.sectionContainer}>
                    <Typography sx={LandingPageStyles.title} variant="h3">
                        A platform for reproducible neuroimaging meta-analysis
                    </Typography>
                    <Typography variant="h6" sx={LandingPageStyles.introSpacedText}>
                        Neurosynth compose allows you to perform an entire meta-analysis directly
                        from the browser. It provides a centralized location to edit, organize,
                        share, and keep provenance of meta-analyses.
                    </Typography>
                    <Box sx={LandingPageStyles.introDetailsContainer}>
                        <Box
                            sx={{
                                color: 'primary.contrastText',
                                marginRight: '2rem',
                            }}
                        >
                            <Typography variant="h6">Use neurosynth-compose for</Typography>
                            <ul style={{ marginBottom: 0 }}>
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
                                    to="/studies"
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

                        <Box sx={{ flex: '1 0 55%' }}>
                            <PlatformComparisonTable />
                        </Box>
                    </Box>
                </Box>
            </Box>
            <Box sx={{ width: '100%', backgroundColor: 'white' }}>
                <Box sx={LandingPageStyles.sectionContainer}>
                    <Typography variant="h3" color="primary.main">
                        Neurosynth-Compose workflow
                    </Typography>
                    <Box sx={LandingPageStyles.workflowContainer}>
                        <Box sx={LandingPageStyles.stepperContainer}>
                            <Stepper orientation="vertical">
                                {steps.map((step) => (
                                    <Step
                                        key={step.title}
                                        sx={{
                                            '.MuiSvgIcon-root': {
                                                fontSize: '3.5rem',
                                                paddingRight: '20px',
                                            },
                                        }}
                                        expanded={true}
                                    >
                                        <StepLabel StepIconComponent={(_props) => step.icon}>
                                            <Typography color="primary" variant="h5">
                                                {step.title}
                                            </Typography>
                                        </StepLabel>
                                        <StepContent>
                                            <Typography sx={{ padding: '1rem 0' }} variant="h6">
                                                {step.textContent}
                                            </Typography>
                                        </StepContent>
                                    </Step>
                                ))}
                            </Stepper>
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
            <Box sx={{ width: '100%', backgroundColor: 'aliceblue' }}>
                <Box sx={LandingPageStyles.sectionContainer}>
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
