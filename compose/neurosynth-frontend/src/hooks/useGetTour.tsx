const useGetTour = (page: string) => {
    // const tour = useTour();
    // const { getIdTokenClaims } = useAuth0();
    // const startTour = useCallback(() => {
    //     tour.setIsOpen(() => {
    //         tour.setCurrentStep(0);
    //         tour.setSteps(TourSteps[page]);
    //         return true;
    //     });
    // }, [page, tour]);
    // useEffect(() => {
    //     const shouldStartTour = async () => {
    //         const claims = await getIdTokenClaims();
    //         const numTimesLoggedIn = claims
    //             ? claims['https://neurosynth-compose/loginsCount'] || 1
    //             : null;
    //         const isTour = sessionStorage.getItem('isTour') === 'true';
    //         const hasSeenPage = !!localStorage.getItem(`hasSeen${page}`);
    //         localStorage.setItem(`hasSeen${page}`, 'true');
    //         if (isTour || (numTimesLoggedIn === 1 && !hasSeenPage)) {
    //             startTour();
    //         }
    //     };
    //     shouldStartTour();
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [page, getIdTokenClaims]); // we dont want to add startTour() as a dependency as it updates tour which creates a circular dependency
    // return { startTour };
};

export default useGetTour;
