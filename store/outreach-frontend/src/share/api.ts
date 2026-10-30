import type { AuthorReply, IssueReason, MapType, ShareView } from './types';

export class ShareError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
    }
}

/** The author's page's API. ``base`` is the neurostore API's root, /api included, or
 * empty for /api on this origin. The link's cookie rides along on every request. */
export function shareApi(base: string) {
    const root = `${base ? base.replace(/\/$/, '') : '/api'}/share`;

    async function request(path: string, init: RequestInit = {}): Promise<ShareView> {
        const headers = new Headers(init.headers);
        if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
        const response = await fetch(`${root}${path}`, { ...init, headers, credentials: 'include' });
        const body = response.headers.get('content-type')?.includes('json') ? await response.json() : null;
        if (!response.ok) throw new ShareError(response.status, body?.detail ?? response.statusText);
        return body as ShareView;
    }

    const post = (path: string, body: unknown = {}) => request(path, { method: 'POST', body: JSON.stringify(body) });

    return {
        session: (token: string) => post('/session', { token }),
        draft: () => request('/draft'),
        opened: () => post('/opened'),
        upload: (file: File, path?: string) =>
            request(`/uploads?${new URLSearchParams({ filename: file.name, ...(path ? { path } : {}) })}`, {
                method: 'POST',
                body: file,
                headers: { 'Content-Type': 'application/octet-stream' },
            }),
        assign: (
            uploadId: string,
            change: { analysis_keys?: string[]; label?: string; map_type?: MapType; partner_id?: string | null }
        ) =>
            request(`/uploads/${uploadId}`, { method: 'PATCH', body: JSON.stringify(change) }),
        remove: (uploadId: string) => post(`/uploads/${uploadId}/remove`),
        issue: (issue: { kind: 'extraction_error' | 'help'; analysis_key?: string; reason?: IssueReason; note?: string }) =>
            post('/issues', issue),
        reply: (reply: { kind: AuthorReply; note?: string; link?: string }) => post('/reply', reply),
        metadata: (collection: Record<string, string>) =>
            request('/metadata', { method: 'PATCH', body: JSON.stringify({ collection }) }),
        submit: (submitter: { name: string; orcid?: string }) => post('/submit', submitter),
    };
}

export type ShareApi = ReturnType<typeof shareApi>;

/** The link's token, from the URL's fragment: /share/#<token>. */
export const tokenFrom = (hash: string) => decodeURIComponent(hash.replace(/^#/, '')).trim() || null;
