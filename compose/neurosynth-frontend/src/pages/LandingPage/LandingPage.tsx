import logo from '../../assets/images/logo.png';
import utLogo from '../../assets/images/utlogo.png';
import nihLogo from '../../assets/images/nihlogo.png';
import mcgillLogo from '../../assets/images/mcgilllogo.png';
import fiuLogo from '../../assets/images/fiulogo.png';
import oxfordLogo from '../../assets/images/oxfordlogo.png';
import stanfordLogo from '../../assets/images/stanfordlogo.png';
import origamiLogo from '../../assets/images/origamilogo.png';

import { Divider, Typography, Box } from '@mui/material';
import LandingPageStyles from './LandingPage.styles';

const LandingPage = () => {
    const logos: { logo: string; alt: string }[] = [
        {
            logo: utLogo,
            alt: 'UT Logo',
        },
        {
            logo: mcgillLogo,
            alt: 'McGill Logo',
        },
        {
            logo: nihLogo,
            alt: 'NIH Logo',
        },
        {
            logo: fiuLogo,
            alt: 'FIU Logo',
        },
        {
            logo: oxfordLogo,
            alt: 'Oxford Logo',
        },
        {
            logo: stanfordLogo,
            alt: 'Stanford Logo',
        },
        {
            logo: origamiLogo,
            alt: 'Origami Labs Logo',
        },
    ];
    return (
        <Box sx={LandingPageStyles.contentContainer}>
            <Box sx={LandingPageStyles.titleContainer}>
                <Box component="img" sx={LandingPageStyles.logo} src={logo} alt="Logo" />
                <Typography sx={LandingPageStyles.title}>welcome to neurosynth</Typography>
            </Box>
            <Box sx={LandingPageStyles.descriptor}>
                neurosynth is a platform designed to ease the process of developing, running, and
                reproducing meta-analyses for functional magnetic resonance imaging (fMRI) data.
            </Box>
            <Divider sx={LandingPageStyles.divider} />
            <Box sx={LandingPageStyles.sponsorContainer}>
                <Box sx={LandingPageStyles.sponsorsImgContainer}>
                    {logos.map((logo) => (
                        <Box key={logo.logo} sx={LandingPageStyles.sponsorLogoContainer}>
                            <Box
                                component="img"
                                sx={LandingPageStyles.sponsorLogo}
                                src={logo.logo}
                                alt={logo.alt}
                            />
                        </Box>
                    ))}
                </Box>
                <Divider sx={LandingPageStyles.divider} />
                <Box sx={LandingPageStyles.nihAwardText}>
                    Supported by NIH award 5R01MH096906-06
                </Box>
            </Box>
        </Box>
    );
};

export default LandingPage;
