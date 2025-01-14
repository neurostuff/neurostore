import { Box, Button, Checkbox, Link, Slider, TextField, Typography } from '@mui/material';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Niivue, SHOW_RENDER } from '@niivue/niivue';
import { Download, OpenInNew } from '@mui/icons-material';
import ImageIcon from '@mui/icons-material/Image';
import ThresholdSlider from './ThresholdSlider';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';

let thresholdDebounce: NodeJS.Timeout;

const NiiVueVisualizer: React.FC<{ file: string; filename: string; neurovaultLink?: string }> = ({
    file,
    filename,
    neurovaultLink,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const niivueRef = useRef<Niivue | null>(null);
    const [softThreshold, setSoftThreshold] = useState(true);
    const [showNegatives, setShowNegatives] = useState(false);
    const [disableNegatives, setDisableNegatives] = useState(false);
    const [showCrosshairs, setShowCrosshairs] = useState(true);
    const [brainCoordinateString, setBrainCoordinateString] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
        if (!fileValues) return;
        const [x, y, z] = fileValues?.mm || [];
        const value = fileValues?.value;

        const str = `X: ${Math.round(x)} | Y: ${Math.round(y)} | Z: ${Math.round(z)} = ${value.toFixed(3)}`;
        setBrainCoordinateString(str);
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
                await niivueRef.current.addVolumeFromUrl({
                    // we can assume that maps will only be in MNI space
                    url: 'https://neurovault.org/static/images/GenericMNI.nii.gz',
                    colormap: 'gray',
                    opacity: 1,
                    colorbarVisible: false,
                });
            }

            const niivue = niivueRef.current;
            await niivueRef.current.addVolumeFromUrl({
                url: file,
                colormap: 'warm',
                cal_min: 0, // default
                cal_max: 6, // default
                cal_minNeg: -6, // default
                cal_maxNeg: 0, // default
                opacity: 1,
            });

            const globalMax = niivue.volumes[1].global_max || 2.58;
            const globalMin = niivue.volumes[1].global_min || 0;
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

            niivue.volumes[1].cal_min = startingValue;
            niivue.volumes[1].cal_max = maxOrThreshold;

            niivue.setInterpolation(true);
            niivue.updateGLVolume();
        };

        updateNiivue();

        return () => {
            if (niivueRef.current && niivueRef.current.volumes[1]) {
                niivueRef.current.removeVolume(niivueRef.current.volumes[1]);
            }
        };
    }, [file, filename]);

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
            {/* <StateHandlerComponent isLoading={isLoading} isError={false}> */}
            <Box sx={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <Box width="250px">
                    <ThresholdSlider
                        thresholdMin={threshold.min}
                        thresholdMax={threshold.max}
                        threshold={threshold.value}
                        onDebouncedThresholdChange={handleUpdateThreshold}
                    />
                </Box>
                <Box width="130px" display="flex" flexDirection="column">
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" gutterBottom={false}>
                            Soft Threshold
                        </Typography>
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
            {/* </StateHandlerComponent> */}
            <Box sx={{ height: '32px' }}>
                {brainCoordinateString && (
                    <Box
                        sx={{
                            width: '260px',
                            backgroundColor: 'black',
                            textAlign: 'center',
                            borderTopLeftRadius: '4px',
                            borderTopRightRadius: '4px',
                        }}
                    >
                        <Typography padding="4px 8px" display="inline-block" color="white">
                            {brainCoordinateString}
                        </Typography>
                    </Box>
                )}
            </Box>
            <Box sx={{ height: '300px' }}>
                <canvas ref={canvasRef} />
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
                        endIcon={<ImageIcon />}
                        sx={{ marginTop: '0.5rem' }}
                    >
                        Download image
                    </Button>
                </Box>
                {neurovaultLink && (
                    <Button
                        component={Link}
                        sx={{ marginTop: '0.5rem' }}
                        href={neurovaultLink.includes('/api') ? neurovaultLink.replace(/\/api/, '') : neurovaultLink}
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
