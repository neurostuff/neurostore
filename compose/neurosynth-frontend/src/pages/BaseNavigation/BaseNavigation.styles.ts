import { Style } from '../..';

const curationPageMargin = 2;

const BaseNavigationStyles: Style = {
    pagesContainer: {
        width: {
            xs: '90%',
            md: '80%',
        },
        margin: '2rem auto',
    },
    curationPageContainer: {
        marginTop: `1rem`,
        marginLeft: `${curationPageMargin}rem`,
        marginRight: `${curationPageMargin}rem`,
        display: 'flex',
        flexDirection: 'column',
    },
};

export default BaseNavigationStyles;
