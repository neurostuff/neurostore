import { useAuth0 } from '@auth0/auth0-react';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import IosShareIcon from '@mui/icons-material/IosShare';
import OpenInNew from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import NeurosynthActivitySummary from 'components/NeurosynthActivitySummary';
import { useGuard } from 'hooks';
import { LOGOS } from 'pages/LandingPage/LandingPage.helpers';
import LandingPageStyles from './LandingPage.styles';
import PlatformComparisonTable from 'pages/LandingPage/components/PlatformComparisonTable';
import { useNavigate } from 'react-router';

const AUTH0_AUDIENCE = process.env.REACT_APP_AUTH0_AUDIENCE;

const LandingPage = () => {
    const { isAuthenticated, loginWithPopup } = useAuth0();
    const navigate = useNavigate();
    useGuard('/projects', '', isAuthenticated, true);

    const handleLogin = async () => {
        await loginWithPopup({
            audience: AUTH0_AUDIENCE,
            scope: 'openid profile email offline_access',
        });
        if (window.gtag) {
            window.gtag('event', 'login');
        }
        navigate('/');
    };

    return (
        <>
            <Box sx={[LandingPageStyles.sectionContainer, { backgroundColor: 'primary.main' }]}>
                <Box
                    sx={[
                        LandingPageStyles.sectionContents,
                        LandingPageStyles.heroBannerContentContainer,
                    ]}
                >
                    <Box sx={LandingPageStyles.heroBannerTextContainer}>
                        <Typography sx={LandingPageStyles.title} variant="h3">
                            A free and open platform for neuroimaging meta-analysis
                        </Typography>
                        <Typography variant="h5" sx={LandingPageStyles.heroBannerText}>
                            Perform custom neuroimaging meta-analyses entirely in the browser, and
                            quickly get results in the cloud using automated analysis pipelines.
                        </Typography>
                        <Box
                            sx={{
                                marginBottom: '2rem',
                                display: 'flex',
                                justifyContent: { xs: 'center', lg: 'flex-start' },
                            }}
                        >
                            <NeurosynthActivitySummary />
                        </Box>
                        <Box sx={LandingPageStyles.heroButtonContainer}>
                            <Button
                                variant="contained"
                                sx={[
                                    LandingPageStyles.getStartedButton,
                                    LandingPageStyles.heroButtons,
                                ]}
                                onClick={handleLogin}
                            >
                                get started
                            </Button>
                            <Button
                                sx={[LandingPageStyles.heroButtons, { marginTop: '10px' }]}
                                color="secondary"
                                endIcon={<OpenInNew />}
                                target="_blank"
                                rel="noreferrer"
                                href="https://neurostuff.github.io/compose-docs/"
                            >
                                Learn More
                            </Button>
                        </Box>
                    </Box>
                    <Box sx={LandingPageStyles.imageContainer}>
                        <Box
                            component="img"
                            sx={LandingPageStyles.img}
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
                    <Box sx={LandingPageStyles.cardsContainer}>
                        <Card elevation={0} sx={LandingPageStyles.card}>
                            <CardContent>
                                <SearchIcon sx={LandingPageStyles.cardIcon} />
                                <Typography variant="h5" sx={LandingPageStyles.cardTitle}>
                                    Find Studies
                                </Typography>
                                <Typography variant="h6">
                                    Search across thousands of indexed neuroimaging studies, or
                                    import custom studies from PubMed and other sources
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={0} sx={LandingPageStyles.card}>
                            <CardContent>
                                <AutoAwesomeMotionIcon sx={LandingPageStyles.cardIcon} />
                                <Typography variant="h5" sx={LandingPageStyles.cardTitle}>
                                    Curate collections
                                </Typography>
                                <Typography variant="h6">
                                    Systematically select relevant studies, and track exclusion
                                    criteria using a PRISMA-compliant workflow
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={0} sx={LandingPageStyles.card}>
                            <CardContent>
                                <SettingsIcon sx={LandingPageStyles.cardIcon} />
                                <Typography variant="h5" sx={LandingPageStyles.cardTitle}>
                                    Specify & Execute Meta-analysis
                                </Typography>
                                <Typography variant="h6">
                                    Choose from dozens of meta-analysis algorithms, and execute
                                    either locally or in the cloud
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={0} sx={LandingPageStyles.card}>
                            <CardContent>
                                <IosShareIcon sx={LandingPageStyles.cardIcon} />
                                <Typography variant="h5" sx={LandingPageStyles.cardTitle}>
                                    Share your results!
                                </Typography>
                                <Typography variant="h6">
                                    Automatically upload results to NeuroVault for easy sharing and
                                    complete analysis provenance. Geneate comprehensive reports to
                                    facilitate interpretation
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                </Box>
            </Box>
            <Box sx={[LandingPageStyles.sectionContainer, { backgroundColor: 'secondary.main' }]}>
                <Box sx={LandingPageStyles.sectionContents}>
                    <Typography
                        variant="h3"
                        color="primary.main"
                        sx={{
                            marginBottom: '2rem',
                            color: 'secondary.contrastText',
                            textAlign: {
                                xs: 'center',
                                lg: 'left',
                            },
                        }}
                    >
                        Platform Comparison
                    </Typography>

                    <PlatformComparisonTable />
                </Box>
            </Box>
            <Box sx={{ width: '100%', backgroundColor: 'lightgray' }}>
                <Box
                    sx={{
                        width: '80%',
                        margin: '0 auto',
                    }}
                >
                    <Typography
                        variant="h5"
                        sx={{ padding: '3rem 0', textAlign: { xs: 'center', sm: 'left' } }}
                    >
                        Neurosynth compose is supported by the following organizations:
                    </Typography>

                    <Box sx={{ width: '100%' }}>
                        <Box sx={LandingPageStyles.sponsorsImgContainer}>
                            {LOGOS.map((logo) => (
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
                        <Typography
                            sx={{
                                padding: '2rem 0 4rem 0',
                                textAlign: { sx: 'center', lg: 'left' },
                            }}
                        >
                            Supported by NIH award 5R01MH096906-06
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </>
    );
};

export default LandingPage;
