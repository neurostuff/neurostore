import { useParams } from 'react-router-dom';
import { useApi, useBundle, useSchemas } from '../api/context';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { ReviewScreen } from '../review/ReviewScreen';
import { OpClientProvider, ReviewStoresProvider, useReviewSession } from '../store/context';
import { WhenLoaded } from './WhenLoaded';

function Review({ bundle }: { bundle: ReviewBundle }) {
    const { stores, client } = useReviewSession(bundle, useApi());
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
