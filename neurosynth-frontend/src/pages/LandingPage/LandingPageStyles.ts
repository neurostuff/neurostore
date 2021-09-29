import makeStyles from '@mui/styles/makeStyles';

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
        [theme.breakpoints.down('md')]: {
            flexDirection: 'column',
            width: '100%',
        },
    },
    title: {
        fontSize: '2.5rem',
        textAlign: 'center',
        [theme.breakpoints.down('md')]: {
            marginRight: '0',
            fontSize: '1.5rem',
        },
    },
    logo: {
        width: '100px',
        [theme.breakpoints.down('md')]: {
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
        [theme.breakpoints.down('md')]: {
            alignItems: 'center',
        },
    },
    sponsorLogoContainer: {
        margin: 'auto 5%',
        [theme.breakpoints.down('md')]: {
            margin: '10% 5%',
        },
    },
    sponsorLogo: {
        width: '150px',
        [theme.breakpoints.down('md')]: {
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
        [theme.breakpoints.down('md')]: {
            fontSize: '1rem',
            margin: '8% 0',
            textAlign: 'center',
        },
    },
    divider: {
        margin: '2% 0 !important',
        width: '100%',
    },
}));

export default LandingPageStyles;
