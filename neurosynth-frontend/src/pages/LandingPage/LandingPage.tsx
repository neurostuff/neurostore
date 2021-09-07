import logo from '../../assets/images/logo.png';
import utLogo from '../../assets/images/utlogo.png';
import nihLogo from '../../assets/images/nihlogo.png';
import mcgillLogo from '../../assets/images/mcgilllogo.png';
import fiuLogo from '../../assets/images/fiulogo.png';
import oxfordLogo from '../../assets/images/oxfordlogo.png';
import stanfordLogo from '../../assets/images/stanfordlogo.png';
import origamiLogo from '../../assets/images/origamilogo.png';

import { Divider } from '@material-ui/core';
import LandingPageStyles from './LandingPageStyles';

const LandingPage = () => {
    const classes = LandingPageStyles();
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
        <div className={classes.contentContainer}>
            <div className={classes.titleContainer}>
                <h1 className={classes.title}>welcome to neurosynth</h1>
                <div>
                    <img className={classes.logo} src={logo} alt="Logo" />
                </div>
            </div>
            <div className={classes.descriptor}>
                neurosynth is a platform for large-scale, automated synthesis of functional magnetic resonance imaging
                (fMRI) data.
            </div>
            <Divider className={classes.divider} />
            <div className={classes.sponsorContainer}>
                <div className={classes.sponsorsImgContainer}>
                    {logos.map((logo) => (
                        <div key={logo.logo} className={classes.sponsorLogoContainer}>
                            <img className={classes.sponsorLogo} src={logo.logo} alt={logo.alt} />
                        </div>
                    ))}
                </div>
                <Divider className={classes.divider} />
                <div className={classes.nihAwardText}>Supported by NIH award 5R01MH096906-06</div>
            </div>
        </div>
    );
};

export default LandingPage;
