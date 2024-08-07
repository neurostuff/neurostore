import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const routeMapping = (path: string) => {
    if (/^\/projects\/.*\/curation\/import.*$/g.test(path)) {
        return 'curation import page';
    } else if (/^\/projects\/.*\/curation$/g.test(path)) {
        return 'curation page';
    } else if (/^\/projects\/.*\/project$/g.test(path)) {
        return 'project page';
    } else if (/^\/projects$/g.test(path)) {
        return 'projects page';
    } else if (/^\/projects\/.*\/meta-analyses\/.*/g.test(path)) {
        return 'project meta-analysis page';
    } else if (/^\/projects\/.*\/meta-analyses$/g.test(path)) {
        return 'project meta-analyses page';
    } else if (/^\/projects\/new\/sleuth$/g.test(path)) {
        return 'sleuth import page';
    } else if (/^\/base-studies$/g.test(path)) {
        return 'base-studies page';
    } else if (/^\/base-studies\/.*$/g.test(path)) {
        return 'base-study page';
    } else if (/^\/meta-analyses\/.*$/g.test(path)) {
        return 'meta-analysis page';
    } else if (/^\/meta-analyses$/g.test(path)) {
        return 'meta-analyses page';
    } else if (/^\/projects\/.*\/extraction\/studies\/.*\/edit$/g.test(path)) {
        return 'edit project study page';
    } else if (/^\/projects\/.*\/extraction\/studies\/.*$/g.test(path)) {
        return 'project study page';
    } else if (/^\/projects\/.*\/extraction\/annotations$/g.test(path)) {
        return 'annotations page';
    } else if (/^\/projects\/.*\/extraction$/g.test(path)) {
        return 'extraction page';
    } else if (/^\/user-profile$/g.test(path)) {
        return 'user profile page';
    } else if (/^\/forbidden$/g.test(path)) {
        return 'forbidden page';
    } else if (/^\/termsandconditions$/g.test(path)) {
        return 'terms and conditions page';
    } else {
        return 'not found page';
    }
};

const useGoogleAnalytics = () => {
    const location = useLocation();

    useEffect(() => {
        if (window.gtag) {
            window.gtag('event', 'page_view', {
                page_path: routeMapping(location.pathname + location.search),
            });
        }
    }, [location]);
};

export default useGoogleAnalytics;
