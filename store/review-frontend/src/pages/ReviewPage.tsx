import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi, useBundle } from '../api/context';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { ReviewScreen } from '../review/ReviewScreen';
import { OpClientProvider, ReviewStoreProvider } from '../store/context';
import { createOpClient } from '../store/opClient';
import { createReviewStore } from '../store/reviewStore';
import { WhenLoaded } from './WhenLoaded';

function Review({ bundle }: { bundle: ReviewBundle }) {
    const api = useApi();
    const [store] = useState(() => createReviewStore(bundle));
    const [client] = useState(() => createOpClient(store, api));
    useEffect(() => {
        client.start();
        return () => client.stop();
    }, [client]);
    return (
        <ReviewStoreProvider store={store}>
            <OpClientProvider client={client}>
                <ReviewScreen />
            </OpClientProvider>
        </ReviewStoreProvider>
    );
}

export function ReviewPage() {
    const { id = '' } = useParams();
    const bundle = useBundle(id);
    return <WhenLoaded query={bundle}>{(value) => <Review key={id} bundle={value} />}</WhenLoaded>;
}
