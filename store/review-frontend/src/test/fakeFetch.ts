import { requestProblems } from './spec';

export interface SentRequest {
    method: string;
    url: string;
    path: string;
    body: unknown;
    keepalive: boolean;
    problems: string[];
    status?: number;
}

export type Handler = (request: SentRequest) => Response | Promise<Response>;

export const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fetch that answers with `handler` and keeps every request, checked against the spec. Past `limit` requests it throws, so a loop fails instead of hanging. */
export function fakeFetch(handler: Handler, limit = 300) {
    const requests: SentRequest[] = [];
    const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = String(input);
        const method = init.method ?? 'GET';
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
        const headers = new Headers(init.headers);
        const request: SentRequest = {
            method,
            url,
            path: new URL(url).pathname,
            body,
            keepalive: init.keepalive ?? false,
            problems: requestProblems(method, url, headers, body),
        };
        if (requests.length >= limit) throw new Error(`the fake server was asked more than ${limit} requests`);
        requests.push(request);
        const response = await handler(request);
        request.status = response.status;
        return response;
    };
    return { fetch: fetch as typeof globalThis.fetch, requests };
}
