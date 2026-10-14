import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { PaperSummary, ReviewApi } from './reviewApi';

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json() as Promise<T>;
}

export function fixtureApi(base: string): ReviewApi {
    const url = (file: string) => `${base}fixtures/${file}`;
    return {
        listPapers: () => getJson<PaperSummary[]>(url('index.json')),
        getBundle: (id) => getJson<ReviewBundle>(url(`${encodeURIComponent(id)}.bundle.json`)),
    };
}
