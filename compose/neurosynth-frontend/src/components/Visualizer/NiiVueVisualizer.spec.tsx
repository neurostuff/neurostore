import { act, render } from '@testing-library/react';
import { MockThemeProvider } from 'testing/helpers';
import { vi } from 'vitest';
import NiiVueVisualizer from './NiiVueVisualizer';

const UNDERLAY_URL = 'https://neurovault.org/static/images/GenericMNI.nii.gz';

type LoadedVolume = {
    url: string;
    global_max: number;
    global_min: number;
    cal_min: number;
    cal_max: number;
};

type LoadRequest = {
    url: string;
    resolve: (volume: LoadedVolume) => void;
};

const { loadRequests, niivueInstances } = vi.hoisted(() => ({
    loadRequests: [] as LoadRequest[],
    niivueInstances: [] as Array<{ volumes: LoadedVolume[] }>,
}));

vi.mock('@niivue/niivue', () => {
    class Niivue {
        volumes: LoadedVolume[] = [];
        opts: Record<string, unknown> = {};
        overlayOutlineWidth = 0;
        onLocationChange: ((location: unknown) => void) | null = null;
        attachToCanvas = vi.fn();
        setSliceMM = vi.fn();
        setCrosshairWidth = vi.fn();
        setInterpolation = vi.fn();
        updateGLVolume = vi.fn();
        saveScene = vi.fn();

        constructor() {
            niivueInstances.push(this);
        }

        removeVolume(volume: LoadedVolume) {
            this.volumes = this.volumes.filter((loadedVolume) => loadedVolume !== volume);
        }

        addVolumeFromUrl(options: { url: string }) {
            return new Promise<LoadedVolume>((resolve) => {
                loadRequests.push({
                    url: options.url,
                    resolve: (volume) => {
                        this.volumes.push(volume);
                        resolve(volume);
                    },
                });
            });
        }
    }

    return {
        Niivue,
        SHOW_RENDER: { ALWAYS: 'always' },
    };
});

const renderVisualizer = (file: string, filename = 'stat_map.nii.gz') =>
    render(
        <MockThemeProvider>
            <NiiVueVisualizer file={file} filename={filename} />
        </MockThemeProvider>
    );

const finishLoad = async (url: string, globalMin = 0, globalMax = 4) => {
    const requestIndex = loadRequests.findIndex((request) => request.url === url);
    const request = loadRequests[requestIndex];
    loadRequests.splice(requestIndex, 1);
    const volume: LoadedVolume = {
        url,
        global_max: globalMax,
        global_min: globalMin,
        cal_min: 0,
        cal_max: 6,
    };
    await act(async () => {
        request.resolve(volume);
    });
    return volume;
};

describe('NiiVueVisualizer', () => {
    beforeEach(() => {
        loadRequests.length = 0;
        niivueInstances.length = 0;
    });

    it('waits for the underlay before loading the stat map', async () => {
        renderVisualizer('map-a.nii.gz');

        expect(loadRequests.map((request) => request.url)).toEqual([UNDERLAY_URL]);

        await finishLoad(UNDERLAY_URL);

        expect(loadRequests.map((request) => request.url)).toEqual(['map-a.nii.gz']);
    });

    it('removes a stat map that resolves after a newer map was selected', async () => {
        const view = renderVisualizer('map-a.nii.gz');
        await finishLoad(UNDERLAY_URL);

        await act(async () => {
            view.rerender(
                <MockThemeProvider>
                    <NiiVueVisualizer file="map-b.nii.gz" filename="stat_map.nii.gz" />
                </MockThemeProvider>
            );
        });

        expect(loadRequests.map((request) => request.url)).toEqual(['map-a.nii.gz', 'map-b.nii.gz']);

        await finishLoad('map-a.nii.gz', 0, 9);
        await finishLoad('map-b.nii.gz', -1, 5);

        expect(niivueInstances[0].volumes.map((volume) => volume.url)).toEqual([UNDERLAY_URL, 'map-b.nii.gz']);
        expect(niivueInstances[0].volumes[1].cal_min).toBe(0);
        expect(niivueInstances[0].volumes[1].cal_max).toBe(5);
    });
});
