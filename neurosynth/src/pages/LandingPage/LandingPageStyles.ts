import { makeStyles } from '@material-ui/core';

const LandingPageStyles = makeStyles((theme) => ({
    contentContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'Inter',
        width: '650px',
        [theme.breakpoints.down('sm')]: {
            flexDirection: 'column',
            width: '100%',
        },
    },
    title: {
        fontSize: '2.5rem',
        textAlign: 'center',
        [theme.breakpoints.down('sm')]: {
            marginRight: '0',
            fontSize: '1.5rem',
        },
    },
    logo: {
        width: '120px',
        [theme.breakpoints.down('sm')]: {
            width: '100px',
        },
    },
    sponsorContainer: {
        width: '100%',
    },
    sponsorsImgContainer: {
        display: 'flex',
        justifyContent: 'space-around',
        width: '100%',
        flexWrap: 'wrap',
        [theme.breakpoints.down('sm')]: {
            alignItems: 'center',
        },
    },
    sponsorLogoContainer: {
        margin: 'auto 5%',
        [theme.breakpoints.down('sm')]: {
            margin: '10% 5%',
        },
    },
    sponsorLogo: {
        width: '200px',
        [theme.breakpoints.down('sm')]: {
            width: '100px',
        },
    },
    nihAwardText: {
        textAlign: 'center',
        margin: '2% 0',
    },
    descriptor: {
        fontSize: '1.5rem',
        fontFamily: 'Roboto',
        color: theme.palette.muted.main,
        margin: '2% 0 0 0',
        lineHeight: '2',
        [theme.breakpoints.down('sm')]: {
            fontSize: '1rem',
            margin: '8% 0',
            textAlign: 'center',
        },
    },
    divider: {
        margin: '4% 0 4% 0',
        width: '100%',
    },
}));

export default LandingPageStyles;
