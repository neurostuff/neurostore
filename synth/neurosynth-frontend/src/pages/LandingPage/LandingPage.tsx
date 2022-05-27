import {
    Typography,
    Box,
    Link,
    Stepper,
    Step,
    StepLabel,
    Paper,
    Button,
    StepContent,
} from '@mui/material';
import LandingPageStyles from './LandingPage.styles';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const LandingPage = () => {
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

    return (
        <>
            <Box sx={{ width: '100%', backgroundColor: 'primary.main' }}>
                <Box
                    sx={{
                        width: '80%',
                        margin: '0 auto',
                        paddingBottom: '10rem',
                    }}
                >
                    <Typography
                        sx={[
                            { color: 'primary.contrastText', fontWeight: 'bold' },
                            { padding: '2rem 0' },
                            { paddingTop: '9rem' },
                        ]}
                        variant="h3"
                    >
                        A platform for reproducible neuroimaging meta-analysis
                    </Typography>
                    <Typography
                        variant="h6"
                        sx={[{ color: 'lightgray' }, { paddingBottom: '2rem' }]}
                    >
                        Neurosynth compose allows you to perform an entire meta-analysis directly
                        from the browser. It provides a centralized location to edit, organize,
                        share, and keep provenance of meta-analyses.
                    </Typography>
                    <Typography
                        variant="h6"
                        sx={[{ color: 'lightgray' }, { paddingBottom: '2.5rem' }]}
                    >
                        Get started by browsing various &nbsp;
                        <Link href="#" color="secondary.main">
                            studies
                        </Link>
                        &nbsp;,
                        <Link href="#" color="secondary.main">
                            studysets
                        </Link>
                        , or &nbsp;
                        <Link href="#" color="secondary.main">
                            meta-analyses
                        </Link>
                        &nbsp;on the platform.
                    </Typography>
                    <Box>
                        <Paper elevation={4} sx={{ padding: '1.5rem', display: 'inline-block' }}>
                            <Button variant="contained">Sign up or sign in now</Button> &nbsp;in
                            order to get started curating your own meta-analyses
                        </Paper>
                    </Box>
                </Box>
            </Box>
            <Box sx={{ width: '80%', margin: '0 auto' }}>
                <Box sx={[{ margin: '2rem 0' }]}>
                    <Typography variant="h3" color="primary.main">
                        neurosynth compose workflow
                    </Typography>
                </Box>
                <Box sx={[{ margin: '2rem 0', width: '50%' }]}>
                    <Stepper orientation="vertical">
                        <Step
                            sx={{
                                '.MuiSvgIcon-root': { fontSize: '3.5rem', paddingRight: '20px' },
                            }}
                            expanded={true}
                        >
                            <StepLabel
                                StepIconComponent={(_props) => <SearchIcon color="primary" />}
                            >
                                <Typography color="primary" variant="h5">
                                    <b>(1)</b> Search studies
                                </Typography>
                            </StepLabel>
                            <StepContent>
                                <Typography sx={{ padding: '1rem 0' }} variant="h6">
                                    Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                                    Recusandae deserunt laudantium ullam maiores, hic nulla tenetur
                                    porro. Cupiditate minus, consequatur ratione excepturi
                                    laboriosam nostrum! Ducimus iure optio maiores ab omnis?
                                </Typography>
                            </StepContent>
                        </Step>
                        <Step
                            sx={{
                                '.MuiSvgIcon-root': { fontSize: '3.5rem', paddingRight: '20px' },
                            }}
                            expanded={true}
                        >
                            <StepLabel
                                StepIconComponent={(_props) => (
                                    <AutoAwesomeMotionIcon color="primary" />
                                )}
                            >
                                <Typography color="primary" variant="h5">
                                    <b>(2)</b> Create a studyset
                                </Typography>
                            </StepLabel>
                            <StepContent>
                                <Typography sx={{ padding: '1rem 0' }} variant="h6">
                                    Lorem ipsum dolor sit amet consectetur adipisicing elit. Aut
                                    vero, dolorum animi quis quisquam blanditiis ipsam expedita
                                    impedit cum fugit dolore maxime quod molestiae culpa, laboriosam
                                    libero repellat. Ipsam, soluta.
                                </Typography>
                            </StepContent>
                        </Step>
                        <Step
                            sx={{
                                '.MuiSvgIcon-root': { fontSize: '3.5rem', paddingRight: '20px' },
                            }}
                            expanded={true}
                        >
                            <StepLabel
                                StepIconComponent={(_props) => <FilterAltIcon color="primary" />}
                            >
                                <Typography color="primary" variant="h5">
                                    <b>(3)</b> Annotate the studyset
                                </Typography>
                            </StepLabel>
                            <StepContent>
                                <Typography sx={{ padding: '1rem 0' }} variant="h6">
                                    Lorem, ipsum dolor sit amet consectetur adipisicing elit. Iste
                                    dolorem fugiat adipisci consectetur temporibus. Autem vero
                                    eaque, et eos vel inventore quia accusantium perferendis
                                    molestias illum rerum odio numquam iure!
                                </Typography>
                            </StepContent>
                        </Step>
                        <Step
                            sx={{
                                '.MuiSvgIcon-root': { fontSize: '3.5rem', paddingRight: '20px' },
                            }}
                            expanded={true}
                        >
                            <StepLabel
                                StepIconComponent={(_props) => <SettingsIcon color="primary" />}
                            >
                                <Typography color="primary" variant="h5">
                                    <b>(4)</b> Specify the meta-analysis
                                </Typography>
                            </StepLabel>
                            <StepContent>
                                <Typography sx={{ padding: '1rem 0' }} variant="h6">
                                    Lorem ipsum dolor sit amet consectetur adipisicing elit. Sequi
                                    placeat temporibus maxime blanditiis ipsam unde optio harum quae
                                    tenetur magni mollitia voluptate autem, in ullam nisi fugiat
                                    nemo iure natus.
                                </Typography>
                            </StepContent>
                        </Step>
                        <Step
                            sx={{
                                '.MuiSvgIcon-root': { fontSize: '3.5rem', paddingRight: '20px' },
                            }}
                            expanded={true}
                        >
                            <StepLabel
                                StepIconComponent={(_props) => <CheckCircleIcon color="primary" />}
                            >
                                <Typography color="primary" variant="h5">
                                    <b>(5)</b> Execute the meta-analysis
                                </Typography>
                            </StepLabel>
                            <StepContent>
                                <Typography sx={{ padding: '1rem 0' }} variant="h6">
                                    Lorem ipsum dolor sit amet consectetur, adipisicing elit. Odio
                                    id vel fugiat corporis magni possimus eveniet reiciendis
                                    eligendi unde ullam, quasi praesentium itaque beatae maxime
                                    dolore aut. Asperiores, quibusdam consequatur.
                                </Typography>
                            </StepContent>
                        </Step>
                    </Stepper>
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

                    <Box sx={LandingPageStyles.sponsorContainer}>
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
        // <Box sx={LandingPageStyles.contentContainer}>
        //     <Box sx={{ backgroundColor: 'lightpink', height: '100%', width: '100%' }}>hello</Box>

        //     <Box sx={LandingPageStyles.titleContainer}>
        //         <Box
        //             component="img"
        //             sx={LandingPageStyles.logo}
        //             src="/static/logo.png"
        //             alt="Logo"
        //         />
        //         <Typography sx={LandingPageStyles.title}>welcome to neurosynth</Typography>
        //     </Box>
        //     <Box sx={LandingPageStyles.descriptor}>
        //         neurosynth is a platform designed to ease the process of developing, running, and
        //         reproducing meta-analyses for functional magnetic resonance imaging (fMRI) data.
        //     </Box>
        //     <Divider sx={LandingPageStyles.divider} />

        // </Box>
    );
};

export default LandingPage;
