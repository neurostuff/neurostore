import { useTour } from '@reactour/tour';
import { useEffect } from 'react';
import TourSteps from 'TourSteps';

const useGetTour = (tourPage: string, isLoaded: boolean) => {
    const tour = useTour();

    const startTour = () => {
        tour.setIsOpen(() => {
            tour.setSteps(TourSteps[tourPage]);
            return true;
        });
    };

    useEffect(() => {
        const userFirstTimeAuthenticating = true;

        if (userFirstTimeAuthenticating && isLoaded) {
            startTour();
        }
    }, [isLoaded]);

    return { startTour };
};

export default useGetTour;
