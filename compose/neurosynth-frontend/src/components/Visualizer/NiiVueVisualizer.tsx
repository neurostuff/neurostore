import { Download, HelpOutline, Image, OpenInNew } from '@mui/icons-material';
import { Box, Button, Checkbox, Icon, Link, Stack, Tooltip, Typography } from '@mui/material';
import { Niivue, SHOW_RENDER } from '@niivue/niivue';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import CrosshairControlsDialog from './CrosshairControlsDialog';
import ThresholdSlider from './ThresholdSlider';

type BrainCoordinates = {
    x: number;
    y: number;
    z: number;
    value: number | null;
};

// NiiVue places the crosshair at the center of GenericMNI. That center is about (0, -17.5, 5) mm for every map.
const defaultBrainCoordinates: BrainCoordinates = {
    x: 0,
    y: -17,
    z: 5,
    value: null,
};

const CoordinateReadout = ({ axis, millimeters }: { axis: string; millimeters: number }) => (
    <Typography
        component="span"
        variant="body2"
        sx={{ color: 'common.white', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}
    >
        <Box component="span" sx={{ color: 'grey.500', mr: 0.75, fontSize: '0.7rem', letterSpacing: '0.08em' }}>
            {axis}
        </Box>
        {Math.round(millimeters)}
    </Typography>
);

// Sagittal (X): left/right. Coronal (Y): down/up.
const crosshairStepByKey: Record<string, [number, number, number]> = {
    ArrowLeft: [-1, 0, 0],
    ArrowRight: [1, 0, 0],
    ArrowDown: [0, -1, 0],
    ArrowUp: [0, 1, 0],
};

// Axial (Z): shift+down/up.
const axialStepByKey: Record<string, [number, number, number]> = {
    ArrowDown: [0, 0, -1],
    ArrowUp: [0, 0, 1],
};

const INTERACTIVE_TARGET_SELECTOR =
    'input, textarea, select, [contenteditable="true"], [role="slider"], [role="listbox"], [role="menu"], [role="combobox"], [role="dialog"]';

const NiiVueVisualizer = ({
    file,
    filename,
    neurovaultCollectionLink: neurovaultCollectionLink,
}: {
    file: string;
    filename: string;
    neurovaultCollectionLink?: string;
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const niivueRef = useRef<Niivue | null>(null);
    const underlayLoadRef = useRef<Promise<void> | null>(null);
    const [softThreshold, setSoftThreshold] = useState(true);
    const [showNegatives, setShowNegatives] = useState(false);
    const [disableNegatives, setDisableNegatives] = useState(false);
    const [showCrosshairs, setShowCrosshairs] = useState(true);
    const [brainCoordinates, setBrainCoordinates] = useState<BrainCoordinates>(defaultBrainCoordinates);
    const [isCrosshairControlsOpen, setIsCrosshairControlsOpen] = useState(false);

    const [threshold, setThreshold] = useState<{
        min: number;
        max: number;
        value: number;
    }>({
        min: 0,
        max: 6,
        value: 3,
    });

    const handleChangeLocation = (location: unknown) => {
        const typedLocation = location as {
            axCorSage: number;
            frac: Float32Array;
            mm: Float32Array;
            string: string;
            values: { id: string; mm: Float32Array; name: string; value: number; vox: number[] }[];
            vox: Float32Array;
            xy: number[];
        };

        const fileValues = typedLocation?.values?.[1];
        const millimeters = fileValues?.mm;
        if (!millimeters || millimeters.length < 3) return;
        const [x, y, z] = millimeters;
        const value = fileValues.value;

        setBrainCoordinates({
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            z: Number.isFinite(z) ? z : 0,
            value: Number.isFinite(value) ? value : null,
        });
    };

    const updateSoftThresholdInNiivue = (softThresholdEnabled: boolean) => {
        if (!niivueRef.current) return;

        if (softThresholdEnabled) {
            niivueRef.current.overlayOutlineWidth = 2;
            niivueRef.current.volumes[1].alphaThreshold = 5;
        } else {
            niivueRef.current.overlayOutlineWidth = 0;
            niivueRef.current.volumes[1].alphaThreshold = 0;
        }
        niivueRef.current.updateGLVolume();
    };

    const handleToggleSoftThreshold = (event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
        setSoftThreshold(checked);
        updateSoftThresholdInNiivue(checked);
    };

    const updateCrosshairsInNiivue = (showCrosshairsEnabled: boolean) => {
        if (!niivueRef.current) return;
        if (showCrosshairsEnabled) {
            niivueRef.current.setCrosshairWidth(1);
        } else {
            niivueRef.current.setCrosshairWidth(0);
        }
        niivueRef.current.updateGLVolume();
    };

    const handleToggleShowCrosshairs = (event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
        setShowCrosshairs(checked);
        updateCrosshairsInNiivue(checked);
    };

    const updateNegativesInNiivue = (showNegativesEnabled: boolean) => {
        if (!niivueRef.current) return;

        if (showNegativesEnabled) {
            niivueRef.current.volumes[1].colormapNegative = 'winter';
        } else {
            niivueRef.current.volumes[1].colormapNegative = '';
        }
        niivueRef.current.updateGLVolume();
    };

    const handleToggleNegatives = (event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
        setShowNegatives(checked);
        updateNegativesInNiivue(checked);
    };

    useEffect(() => {
        let cancelled = false;

        const updateNiivue = async () => {
            if (!canvasRef.current) return;

            // this should only run once initially to load the niivue instance as well as a base image
            if (niivueRef.current === null) {
                niivueRef.current = new Niivue({
                    show3Dcrosshair: true,
                });
                niivueRef.current.attachToCanvas(canvasRef.current);
                niivueRef.current.overlayOutlineWidth = 2;
                niivueRef.current.opts.multiplanarShowRender = SHOW_RENDER.ALWAYS;
                niivueRef.current.opts.isColorbar = true;
                niivueRef.current.setSliceMM(false);
                niivueRef.current.onLocationChange = handleChangeLocation;
                underlayLoadRef.current = niivueRef.current
                    .addVolumeFromUrl({
                        // we can assume that maps will only be in MNI space
                        url: 'https://neurovault.org/static/images/GenericMNI.nii.gz',
                        colormap: 'gray',
                        opacity: 1,
                        colorbarVisible: false,
                    })
                    .then(() => undefined);
            }

            await underlayLoadRef.current;
            if (cancelled) return;

            const niivue = niivueRef.current;
            if (!niivue) return;

            const overlay = await niivue.addVolumeFromUrl({
                url: file,
                colormap: 'warm',
                cal_min: 0, // default
                cal_max: 6, // default
                cal_minNeg: -6, // default
                cal_maxNeg: 0, // default
                opacity: 1,
            });

            // addVolumeFromUrl inserts the volume before it resolves, so a stale load has to be removed here
            if (cancelled) {
                niivue.removeVolume(overlay);
                return;
            }

            const globalMax = overlay.global_max || 2.58;
            const globalMin = overlay.global_min || 0;
            const largestAbsoluteValue = Math.max(Math.abs(globalMin), globalMax);

            updateCrosshairsInNiivue(showCrosshairs); // update crosshair settings in case they have been updated in other maps
            updateSoftThresholdInNiivue(softThreshold); // update threshold settings in case they have been updated in other maps
            // update negative settings in case they have been updated in other maps. If no negatives, disable
            if (globalMin < 0) {
                setShowNegatives(false);
                setDisableNegatives(false);
                updateNegativesInNiivue(false);
            } else {
                setShowNegatives(false);
                setDisableNegatives(true);
                updateNegativesInNiivue(false);
            }

            let startingValue;
            let maxOrThreshold;
            if (filename.startsWith('z_')) {
                startingValue = 2.58;
                maxOrThreshold = largestAbsoluteValue < 2.58 ? 2.58 : largestAbsoluteValue;
            } else {
                startingValue = 0;
                maxOrThreshold = largestAbsoluteValue;
            }

            setThreshold({
                min: 0,
                max: Math.round(maxOrThreshold * 100) / 100,
                value: Math.round(startingValue * 100) / 100,
            });

            overlay.cal_min = startingValue;
            overlay.cal_max = maxOrThreshold;

            niivue.setInterpolation(true);
            niivue.updateGLVolume();
            niivue.createOnLocationChange();
        };

        updateNiivue();

        return () => {
            cancelled = true;
            const niivue = niivueRef.current;
            const currentOverlay = niivue?.volumes[1];
            if (niivue && currentOverlay) {
                niivue.removeVolume(currentOverlay);
            }
        };
    }, [file, filename]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            const target = event.target;
            if (target instanceof HTMLElement && target.closest(INTERACTIVE_TARGET_SELECTOR)) return;

            const step = event.shiftKey ? axialStepByKey[event.code] : crosshairStepByKey[event.code];
            const niivue = niivueRef.current;
            if (!step || !niivue?.volumes[0]) return;

            event.preventDefault();
            event.stopPropagation();
            niivue.moveCrosshairInVox(step[0], step[1], step[2]);
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, []);

    const handleDownloadImage = () => {
        if (!niivueRef.current) return;
        niivueRef.current.saveScene(filename + '.png');
    };

    const updateThresholdNiivue = (update: { thresholdValue: number; thresholdMax: number; thresholdMin: number }) => {
        if (!niivueRef.current) return;

        // update threshold positive
        niivueRef.current.volumes[1].cal_min = update.thresholdValue;
        // update threshold negative
        niivueRef.current.volumes[1].cal_minNeg = -1 * update.thresholdValue;

        niivueRef.current.volumes[1].cal_max = update.thresholdMax;
        niivueRef.current.volumes[1].cal_maxNeg = -1 * update.thresholdMax;

        niivueRef.current.updateGLVolume();
    };

    const handleUpdateThreshold = useCallback(
        (update: { thresholdValue: number; thresholdMax: number; thresholdMin: number }) => {
            setThreshold({
                min: update.thresholdMin,
                max: update.thresholdMax,
                value: update.thresholdValue,
            });

            updateThresholdNiivue(update);
        },
        []
    );

    return (
        <Box>
            <Box sx={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <Box width="250px">
                    <ThresholdSlider
                        thresholdMin={threshold.min}
                        thresholdMax={threshold.max}
                        threshold={threshold.value}
                        onDebouncedThresholdChange={handleUpdateThreshold}
                    />
                </Box>
                <Box width="140px" display="flex" flexDirection="column">
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" gutterBottom={false}>
                            Soft Threshold
                        </Typography>
                        <Tooltip
                            title={
                                <Typography variant="caption">
                                    Checking this option will also highlight areas of activation below the current
                                    selected threshold
                                </Typography>
                            }
                            placement="top"
                        >
                            <Icon fontSize="small">
                                <HelpOutline fontSize="small" sx={{ color: 'muted.main' }} />
                            </Icon>
                        </Tooltip>
                        <Checkbox sx={{ padding: 0 }} checked={softThreshold} onChange={handleToggleSoftThreshold} />
                    </Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" gutterBottom={false}>
                            Show Crosshairs
                        </Typography>
                        <Checkbox
                            sx={{ padding: 0 }}
                            value={showCrosshairs}
                            checked={showCrosshairs}
                            onChange={handleToggleShowCrosshairs}
                        />
                    </Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography
                            variant="caption"
                            color={disableNegatives ? 'muted.main' : 'inherit'}
                            gutterBottom={false}
                        >
                            {disableNegatives ? 'No Negatives' : 'Show Negatives'}
                            {/* Show Negatives */}
                        </Typography>
                        <Checkbox
                            sx={{ padding: 0 }}
                            disabled={disableNegatives}
                            checked={showNegatives}
                            onChange={handleToggleNegatives}
                        />
                    </Box>
                </Box>
            </Box>
            <Box
                data-testid="brain-coordinates"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    boxSizing: 'border-box',
                    width: '100%',
                    px: 1.5,
                    py: 0.75,
                    backgroundColor: '#333',
                    borderTopLeftRadius: '4px',
                    borderTopRightRadius: '4px',
                }}
            >
                <Stack direction="row" spacing={2} alignItems="baseline">
                    <CoordinateReadout axis="X" millimeters={brainCoordinates.x} />
                    <CoordinateReadout axis="Y" millimeters={brainCoordinates.y} />
                    <CoordinateReadout axis="Z" millimeters={brainCoordinates.z} />
                    <Typography
                        component="span"
                        variant="body2"
                        sx={{
                            color: brainCoordinates.value == null ? 'grey.500' : 'common.white',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {brainCoordinates.value == null ? '—' : brainCoordinates.value.toFixed(3)}
                    </Typography>
                </Stack>
                <Link
                    component="button"
                    type="button"
                    underline="always"
                    onClick={() => setIsCrosshairControlsOpen(true)}
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        color: 'common.white',
                        typography: 'body2',
                    }}
                >
                    <HelpOutline sx={{ fontSize: '1.1rem' }} />
                    Controls
                </Link>
            </Box>
            <CrosshairControlsDialog
                isOpen={isCrosshairControlsOpen}
                onCloseDialog={() => setIsCrosshairControlsOpen(false)}
            />
            <Box sx={{ height: '300px' }}>
                <canvas ref={canvasRef} tabIndex={0} />
            </Box>
            <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                    <Button
                        size="small"
                        variant="contained"
                        endIcon={<Download />}
                        href={file}
                        sx={{ marginTop: '0.5rem', marginRight: '0.5rem' }}
                    >
                        Download NIfTI
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        onClick={handleDownloadImage}
                        endIcon={<Image />}
                        sx={{ marginTop: '0.5rem' }}
                    >
                        Download image
                    </Button>
                </Box>
                {neurovaultCollectionLink && (
                    <Button
                        component={Link}
                        sx={{ marginTop: '0.5rem' }}
                        href={
                            neurovaultCollectionLink.includes('/api')
                                ? neurovaultCollectionLink.replace(/\/api/, '')
                                : neurovaultCollectionLink
                        }
                        rel="noreferrer"
                        size="small"
                        target="_blank"
                        disableElevation
                    >
                        Open in neurovault
                        <OpenInNew sx={{ marginLeft: '4px' }} fontSize="small" />
                    </Button>
                )}
            </Box>
        </Box>
    );
};

export default NiiVueVisualizer;
