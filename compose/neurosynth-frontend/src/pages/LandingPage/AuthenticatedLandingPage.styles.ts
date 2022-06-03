import { Style } from 'index';

const AuthenticatedLandingPageStyles: Style = {
    landingPageContainer: {
        display: 'flex',
        width: '100%',
        maxHeight: {
            lg: '700px',
        },
        justifyContent: 'space-between',
        margin: '2rem 0',
        flexDirection: {
            xs: 'column',
            md: 'column',
            lg: 'row',
        },
    },
    list: {
        width: {
            lg: '29%',
        },
        marginBottom: '1rem',
        maxHeight: {
            xs: '400px',
            md: '600px',
            lg: '800px',
        },
    },
};

export default AuthenticatedLandingPageStyles;
