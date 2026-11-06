import { useParams } from 'react-router-dom';
import { useStore } from 'zustand';
import { Loading } from '../Loading';
import { useApi, useBundle, useSchemas } from '../api/context';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { ReviewScreen } from '../review/ReviewScreen';
import { OpClientProvider, ReviewStoresProvider, useReviewSession } from '../store/context';
import { selectIsLoading } from '../store/sessionStore';
import { WhenLoaded } from './WhenLoaded';

function Review({ bundle }: { bundle: ReviewBundle }) {
    const { stores, client } = useReviewSession(bundle, useApi());
    const loading = useStore(stores.session, selectIsLoading);
    if (loading) return <Loading />;
    return (
        <ReviewStoresProvider stores={stores}>
            <OpClientProvider client={client}>
                <ReviewScreen />
            </OpClientProvider>
        </ReviewStoresProvider>
    );
}

export function ReviewPage() {
    const { id = '' } = useParams();
    const schemas = useSchemas();
    const bundle = useBundle(id);
    return <WhenLoaded queries={[schemas, bundle]}>{([, value]) => <Review key={id} bundle={value} />}</WhenLoaded>;
}
