import { useAuth0 } from '@auth0/auth0-react';
import { useTour } from '@reactour/tour';
import { useCallback, useEffect } from 'react';
import TourSteps from 'Toursteps';

const useGetTour = (page: string) => {
    const tour = useTour();
    const { getIdTokenClaims } = useAuth0();

    const startTour = useCallback(() => {
        tour.setIsOpen(() => {
            tour.setCurrentStep(0);
            tour.setSteps(TourSteps[page]);
            return true;
        });
    }, [page, tour]);

    useEffect(() => {
        const shouldStartTour = async () => {
            const claims = await getIdTokenClaims();

            const numTimesLoggedIn = claims
                ? claims['https://neurosynth-compose/loginsCount'] || 0
                : 0;
            const isTour = sessionStorage.getItem('isTour') === 'true';
            const hasSeenPage = !!localStorage.getItem(`hasSeen${page}`);
            localStorage.setItem(`hasSeen${page}`, 'true');
            if (isTour || (numTimesLoggedIn === 1 && !hasSeenPage)) {
                startTour();
            }
        };

        shouldStartTour();
    }, []); // we dont want to add tour as a dependency as we call startTour(), which updates the tour itself

    return { startTour };
};

export default useGetTour;
