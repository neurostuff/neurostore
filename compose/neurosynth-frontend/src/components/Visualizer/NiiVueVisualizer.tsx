import { Box, Checkbox, Slider, Typography } from '@mui/material';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Niivue, SHOW_RENDER } from '@niivue/niivue';

let niivue: Niivue;

const NiiVueVisualizer: React.FC<{ imageURL: string }> = ({ imageURL }) => {
    const canvasRef = useRef(null);
    const [softThreshold, setSoftThresold] = useState(false);
    const [showNegatives, setShowNegatives] = useState(false);
    const [showCrosshairs, setShowCrosshairs] = useState(true);
    const [threshold, setThreshold] = useState<{
        min: number;
        max: number;
        value: number;
    }>({
        min: 0,
        max: 6,
        value: 3,
    });

    const handleUpdateThreshold = (event: Event, newValue: number | number[]) => {
        if (!niivue) return;
        const typedVal = newValue as number;
        setThreshold((prev) => ({
            ...prev,
            value: typedVal,
        }));

        // update threshold positive
        niivue.volumes[1].cal_min = typedVal;

        // update threshold negative
        niivue.volumes[1].cal_maxNeg = -1 * typedVal;

        niivue.updateGLVolume();
    };

    const handleToggleSoftThreshold = (event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
        if (!niivue) return;

        setSoftThresold(checked);
        if (checked) {
            niivue.overlayOutlineWidth = 2;
            niivue.volumes[1].alphaThreshold = 5;
        } else {
            niivue.overlayOutlineWidth = 0;
            niivue.volumes[1].alphaThreshold = 0;
        }
        niivue.updateGLVolume();
    };

    const handleToggleShowCrosshairs = (event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
        if (!niivue) return;
        setShowCrosshairs(checked);
        if (checked) {
            niivue.setCrosshairWidth(1);
        } else {
            niivue.setCrosshairWidth(0);
        }
        niivue.updateGLVolume();
    };

    const handleToggleNegatives = (event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
        if (!niivue) return;
        setShowNegatives(checked);
        if (checked) {
            niivue.volumes[1].colormapNegative = 'winter';
        } else {
            niivue.volumes[1].colormapNegative = '';
        }
        niivue.updateGLVolume();
    };

    useEffect(() => {
        if (!canvasRef.current) return;

        const volumes = [
            {
                // TODO: need to check if TAL vs MNI and set accordingly
                url: 'https://neurovault.org/static/images/GenericMNI.nii.gz',
                // url: 'https://niivue.github.io/niivue/images/fslmean.nii.gz',
                colormap: 'gray',
                opacity: 1,
            },
            {
                url: imageURL,
                // url: 'https://niivue.github.io/niivue/images/fslt.nii.gz',
                colorMap: 'warm',
                cal_min: 0, // default
                cal_max: 6, // default
                cal_minNeg: -6, // default
                cal_maxNeg: 0, // default
                opacity: 1,
            },
        ];

        niivue = new Niivue({
            show3Dcrosshair: true,
        });

        niivue.opts.isColorbar = true;
        niivue.setSliceMM(false);

        niivue.attachToCanvas(canvasRef.current);
        niivue.addVolumesFromUrl(volumes).then(() => {
            niivue.volumes[1].alphaThreshold = 0;
            niivue.overlayOutlineWidth = 0;

            niivue.volumes[0].colorbarVisible = false;
            niivue.volumes[1].colormapNegative = '';

            niivue.opts.multiplanarShowRender = SHOW_RENDER.ALWAYS;

            const globalMax = niivue.volumes[1].global_max || 6;
            const globalMin = niivue.volumes[1].global_min || 0;
            const largestAbsoluteValue = Math.max(Math.abs(globalMin), globalMax);
            const startingValue = largestAbsoluteValue < 2.58 ? largestAbsoluteValue : 2.58;

            setThreshold({
                min: 0,
                max: largestAbsoluteValue + 0.1,
                value: startingValue,
            });
            niivue.volumes[1].cal_min = startingValue;
            niivue.volumes[1].cal_max = largestAbsoluteValue + 0.1;

            niivue.setInterpolation(true);
            niivue.updateGLVolume();
        });
    }, [imageURL]);

    return (
        <Box>
            <Box sx={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <Box width="300px">
                    <Typography gutterBottom={false}>Threshold</Typography>
                    <Slider
                        valueLabelDisplay="auto"
                        min={threshold.min}
                        step={0.01}
                        max={threshold.max}
                        onChange={handleUpdateThreshold}
                        value={threshold.value}
                    ></Slider>
                </Box>
                <Box>
                    <Typography gutterBottom={false}>Soft Threshold</Typography>
                    <Checkbox checked={softThreshold} onChange={handleToggleSoftThreshold} />
                </Box>
                <Box>
                    <Typography gutterBottom={false}>Show Negatives</Typography>
                    <Checkbox checked={showNegatives} onChange={handleToggleNegatives} />
                </Box>
                <Box>
                    <Typography gutterBottom={false}>Show Crosshairs</Typography>
                    <Checkbox value={showCrosshairs} checked={showCrosshairs} onChange={handleToggleShowCrosshairs} />
                </Box>
            </Box>
            <Box sx={{ height: '300px' }}>
                <canvas ref={canvasRef} />
            </Box>
        </Box>
    );
};

export default NiiVueVisualizer;
