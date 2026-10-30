import type {
    Candidate,
    Collection,
    DraftAnalysis,
    DraftDetail,
    DraftStatus,
    DraftSummary,
    Invitation,
    PersonDetail,
} from './types';

/** The Authorization header to send, or null when signed out. */
export type Authorize = () => Promise<string | null>;

export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
    }
}

export interface DraftFilters {
    status?: DraftStatus[];
    idleDays?: number;
    limit?: number;
}

export function outreachApi(base: string, authorize: Authorize) {
    const root = `${base.replace(/\/$/, '')}/api/outreach`;

    async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const authorization = await authorize();
        const headers = new Headers(init.headers);
        if (authorization) headers.set('Authorization', authorization);
        if (init.body) headers.set('Content-Type', 'application/json');
        const response = await fetch(`${root}${path}`, { ...init, headers });
        const body = response.headers.get('content-type')?.includes('json') ? await response.json() : null;
        if (!response.ok) throw new ApiError(response.status, body?.detail ?? response.statusText);
        return body as T;
    }

    const post = <T>(path: string, body: unknown = {}) =>
        request<T>(path, { method: 'POST', body: JSON.stringify(body) });

    return {
        me: () => request<{ admin: string }>('/me'),
        candidates: (sinceYear: number, limit = 200) =>
            request<{ results: Candidate[] }>(`/candidates/?since_year=${sinceYear}&limit=${limit}`).then(
                (r) => r.results
            ),
        drafts: ({ status = [], idleDays, limit = 500 }: DraftFilters = {}) => {
            const params = new URLSearchParams({ limit: String(limit) });
            status.forEach((s) => params.append('status', s));
            if (idleDays !== undefined) params.set('idle_days', String(idleDays));
            return request<{ results: DraftSummary[] }>(`/drafts/?${params}`).then((r) => r.results);
        },
        draft: (id: string) => request<DraftDetail>(`/drafts/${id}`),
        buildDraft: (baseStudyId: string) => post<DraftDetail>('/drafts/', { base_study_id: baseStudyId }),
        editDraft: (id: string, change: { analyses?: DraftAnalysis[]; collection?: Collection }) =>
            request<DraftDetail>(`/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(change) }),
        checkDraft: (id: string) => post<DraftDetail>(`/drafts/${id}/check`),
        invitation: (id: string) => post<Invitation>(`/drafts/${id}/invitation`),
        markSent: (id: string, sent: { batch?: string; kind?: 'invite' | 'reminder'; template_version?: string }) =>
            post<DraftDetail>(`/drafts/${id}/sent`, sent),
        person: (id: string) => request<PersonDetail>(`/people/${id}`),
        suppress: (id: string, what: 'opt_out' | 'bounced', note?: string) =>
            post<PersonDetail>(`/people/${id}/suppression`, { what, note }),
    };
}

export type OutreachApi = ReturnType<typeof outreachApi>;
