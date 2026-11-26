import { gunzipSync } from 'zlib';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InternalAxiosRequestConfig } from 'axios';
import API from 'api/api.config';
import { axiosInstance } from 'api/api.state';
import 'api/axios.config';
import { INeurosynthProject } from 'hooks/projects/Project.types';
import useUpdateProject from 'hooks/projects/useUpdateProject';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

vi.mock('notistack');

const stub = (i: number) => ({
    id: `stub-${i}`,
    title: `Study ${i}`,
    abstractText: 'Participants viewed faces during fMRI. '.repeat(20),
    exclusionTag: null,
    tags: [],
});

const project = {
    name: 'big import',
    provenance: {
        curationMetadata: {
            columns: [{ id: 'identification', name: 'Identification', stubStudies: [...Array(500).keys()].map(stub) }],
        },
    },
} as unknown as INeurosynthProject;

describe('useUpdateProject', () => {
    let sent: InternalAxiosRequestConfig[];
    const defaultAdapter = axiosInstance.defaults.adapter;
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
            {children}
        </QueryClientProvider>
    );

    beforeEach(() => {
        sent = [];
        axiosInstance.defaults.adapter = async (config) => {
            sent.push(config);
            return { data: { id: 'project-id' }, status: 200, statusText: 'OK', headers: {}, config };
        };
    });

    afterEach(() => {
        axiosInstance.defaults.adapter = defaultAdapter;
    });

    it('sends the project gzipped', async () => {
        const { result } = renderHook(() => useUpdateProject(), { wrapper });

        await act(() => result.current.mutateAsync({ projectId: 'project-id', project }));

        const [request] = sent;
        const raw = JSON.stringify(project);
        expect(request.method).toBe('put');
        expect(request.headers.get('Content-Encoding')).toBe('gzip');
        expect(request.data).toBeInstanceOf(ArrayBuffer);
        expect(request.data.byteLength * 10).toBeLessThan(raw.length);
        expect(JSON.parse(gunzipSync(Buffer.from(request.data)).toString())).toEqual(project);
    });

    it('leaves a request that does not ask for gzip uncompressed', async () => {
        await API.NeurosynthServices.ProjectsService.projectsIdPut('project-id', true, project);

        const [request] = sent;
        expect(request.headers.get('Content-Encoding')).toBeUndefined();
        expect(request.data).toBe(JSON.stringify(project));
    });
});
