import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useBundle } from '../api/context';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { ReviewScreen } from '../review/ReviewScreen';
import { ReviewStoreProvider } from '../store/context';
import { createReviewStore } from '../store/reviewStore';
import { WhenLoaded } from './WhenLoaded';

function Review({ bundle }: { bundle: ReviewBundle }) {
    const store = useMemo(() => createReviewStore(bundle), [bundle]);
    return (
        <ReviewStoreProvider store={store}>
            <ReviewScreen />
        </ReviewStoreProvider>
    );
}

export function ReviewPage() {
    const { id = '' } = useParams();
    const bundle = useBundle(id);
    return <WhenLoaded query={bundle}>{(value) => <Review key={id} bundle={value} />}</WhenLoaded>;
}
