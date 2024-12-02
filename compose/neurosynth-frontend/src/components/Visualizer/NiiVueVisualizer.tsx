import { Box, Slider, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Niivue, SHOW_RENDER } from '@niivue/niivue';

let niivue: Niivue;

const NiiVueVisualizer: React.FC<{ imageURL: string }> = ({ imageURL }) => {
    const canvasRef = useRef(null);
    const [thresholdPositive, setThresholdPositive] = useState(3);
    const [thresholdNegative, setThresholdNegative] = useState(-3);

    const handleUpdateThresholdPositive = (event: Event, newValue: number | number[]) => {
        if (!niivue) return;
        setThresholdPositive(newValue as number);
        niivue.volumes[1].cal_min = newValue as number;
        niivue.updateGLVolume();
    };

    const handleUpdateThresholdNegative = (event: Event, newValue: number | number[]) => {
        if (!niivue) return;
        setThresholdNegative(newValue as number);
        niivue.volumes[1].cal_minNeg = -6;
        niivue.volumes[1].cal_maxNeg = newValue as number;
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
                colormapNegative: 'winter',
                cal_min: 3,
                cal_max: 6,
                cal_minNeg: -6,
                cal_maxNeg: -3,
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
            niivue.volumes[0].colorbarVisible = false;
            niivue.opts.multiplanarShowRender = SHOW_RENDER.ALWAYS;
            niivue.setInterpolation(true);
            niivue.updateGLVolume();
            console.log(niivue);
        });
    }, [imageURL]);

    return (
        <Box>
            <Box sx={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <Box width="200px">
                    <Typography variant="body2" gutterBottom>
                        -Threshold
                    </Typography>
                    <Slider
                        valueLabelDisplay="auto"
                        min={-6}
                        step={0.01}
                        max={0}
                        onChange={handleUpdateThresholdNegative}
                        value={thresholdNegative}
                    ></Slider>
                </Box>
                <Box width="200px">
                    <Typography variant="body2" gutterBottom>
                        +Threshold
                    </Typography>
                    <Slider
                        valueLabelDisplay="auto"
                        min={0}
                        step={0.01}
                        max={6}
                        onChange={handleUpdateThresholdPositive}
                        value={thresholdPositive}
                    ></Slider>
                </Box>
            </Box>
            <Box sx={{ height: '300px' }}>
                <canvas ref={canvasRef} />
            </Box>
        </Box>
    );
};

export default NiiVueVisualizer;
