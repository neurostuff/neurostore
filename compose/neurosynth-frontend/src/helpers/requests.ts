export const executeHTTPRequestsAsBatches = async <T, Y>(
    requestList: T[],
    mapFunc: (request: T) => Promise<Y>,
    rateLimit: number,
    delayInMS?: number,
    progressCallbackFunc?: (progress: number) => void
) => {
    const arrayOfRequestArrays = [];
    for (let i = 0; i < requestList.length; i += rateLimit) {
        arrayOfRequestArrays.push(requestList.slice(i, i + rateLimit));
    }

    const batchedResList: Y[] = [];
    for (const requests of arrayOfRequestArrays) {
        /**
         * I have to do the mapping from object to HTTP request here because
         * the promises are not lazy. The HTTP requests are launched as soon as
         * the function is called regardless of whether a .then() is added
         */
        const batchedRes = await Promise.all(requests.map(mapFunc));
        batchedResList.push(...batchedRes);
        if (progressCallbackFunc) {
            progressCallbackFunc(Math.round((batchedResList.length / requestList.length) * 100));
        }
        if (delayInMS) {
            await new Promise((res) => {
                setTimeout(() => res(null), delayInMS);
            });
        }
    }
    return batchedResList;
};
