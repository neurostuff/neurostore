import type { ReviewApi } from '../api/reviewApi';
import { createOpClient } from '../store/opClient';
import type { ReviewStores } from '../store/reviewStores';

const never = () => new Promise<never>(() => {});

/** A started op client of `stores` whose server never answers, so what it sends stays pending; stop it after. */
export function heldClient({ session }: ReviewStores) {
    const api = new Proxy({}, { get: () => never }) as ReviewApi;
    const client = createOpClient(session, api);
    client.start();
    return client;
}
