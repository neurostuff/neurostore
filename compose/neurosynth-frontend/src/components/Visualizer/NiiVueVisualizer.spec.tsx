import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    niivueInstances: [] as Array<{ volumes: LoadedVolume[]; moveCrosshairInVox: ReturnType<typeof vi.fn> }>,
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
        createOnLocationChange = vi.fn();
        saveScene = vi.fn();
        moveCrosshairInVox = vi.fn();

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

    it('shows the template center before a location update and opens crosshair controls', async () => {
        const user = userEvent.setup();
        renderVisualizer('map-a.nii.gz');

        const coordinates = screen.getByTestId('brain-coordinates');
        expect(coordinates).toHaveTextContent(/X\s*0/);
        expect(coordinates).toHaveTextContent(/Y\s*-17/);
        expect(coordinates).toHaveTextContent(/Z\s*5/);

        await user.click(screen.getByRole('button', { name: 'Controls' }));

        expect(screen.getByText('Crosshair controls')).toBeInTheDocument();
        expect(screen.getByText('Move left (sagittal plane)')).toBeInTheDocument();
        expect(screen.getByText('Higher slice (axial plane)')).toBeInTheDocument();
        expect(screen.getByText('Lower slice (axial plane)')).toBeInTheDocument();
    });

    it('steps the crosshair one voxel on each plane without focusing the canvas', async () => {
        const user = userEvent.setup();
        renderVisualizer('map-a.nii.gz');
        await finishLoad(UNDERLAY_URL);

        await user.keyboard('{ArrowLeft}');
        await user.keyboard('{ArrowRight}');
        await user.keyboard('{ArrowDown}');
        await user.keyboard('{ArrowUp}');
        await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
        await user.keyboard('{Shift>}{ArrowUp}{/Shift}');

        expect(niivueInstances[0].moveCrosshairInVox.mock.calls).toEqual([
            [-1, 0, 0],
            [1, 0, 0],
            [0, -1, 0],
            [0, 1, 0],
            [0, 0, -1],
            [0, 0, 1],
        ]);
    });

    it('does not move the crosshair while editing a control or for unrelated modifiers', async () => {
        const user = userEvent.setup();
        renderVisualizer('map-a.nii.gz');
        await finishLoad(UNDERLAY_URL);

        const thresholdInput = document.querySelector('input');
        if (!thresholdInput) throw new Error('threshold input missing');
        thresholdInput.focus();
        await user.keyboard('{ArrowUp}{Shift>}{ArrowDown}{/Shift}');

        const canvas = document.querySelector('canvas');
        if (!canvas) throw new Error('canvas missing');
        canvas.focus();
        await user.keyboard('{Control>}{ArrowRight}{/Control}');
        await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
        await user.keyboard('ws');

        expect(niivueInstances[0].moveCrosshairInVox).not.toHaveBeenCalled();
    });

    it('does not move the crosshair while a tab or Handsontable cell is focused', async () => {
        const user = userEvent.setup();
        renderVisualizer('map-a.nii.gz');
        await finishLoad(UNDERLAY_URL);

        const tab = document.createElement('button');
        tab.setAttribute('role', 'tab');
        const handsontableRoot = document.createElement('div');
        handsontableRoot.className = 'ht-wrapper handsontable';
        const handsontableCell = document.createElement('td');
        handsontableCell.tabIndex = -1;
        handsontableRoot.appendChild(handsontableCell);
        document.body.append(tab, handsontableRoot);

        tab.focus();
        await user.keyboard('{ArrowRight}{ArrowLeft}');
        handsontableCell.focus();
        await user.keyboard('{ArrowDown}{Shift>}{ArrowUp}{/Shift}');

        expect(niivueInstances[0].moveCrosshairInVox).not.toHaveBeenCalled();
        tab.remove();
        handsontableRoot.remove();
    });

    it('stops plane keys before Niivue handles them', async () => {
        const user = userEvent.setup();
        renderVisualizer('map-a.nii.gz');
        await finishLoad(UNDERLAY_URL);

        const canvas = document.querySelector('canvas');
        if (!canvas) throw new Error('canvas missing');
        const bubbleListener = vi.fn();
        canvas.addEventListener('keydown', bubbleListener);
        canvas.focus();

        await user.keyboard('{ArrowLeft}');
        await user.keyboard('{Shift>}{ArrowUp}{/Shift}');

        const bubbledCodes = bubbleListener.mock.calls.map((call) => (call[0] as KeyboardEvent).code);
        expect(bubbledCodes).not.toContain('ArrowLeft');
        expect(bubbledCodes).not.toContain('ArrowUp');
        expect(niivueInstances[0].moveCrosshairInVox).toHaveBeenCalledTimes(2);
    });
});
