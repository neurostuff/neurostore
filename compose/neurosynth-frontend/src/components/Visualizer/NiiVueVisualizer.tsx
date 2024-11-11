import { Box, Slider, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Niivue, SHOW_RENDER } from '@niivue/niivue';

let niivue: Niivue;

const NiiVueVisualizer: React.FC<{ imageURL: string }> = ({ imageURL }) => {
    const canvasRef = useRef(null);
    const [thresholdPositive, setThresholdPositive] = useState(0);
    const [thresholdNegative, setThresholdNegative] = useState(0);

    const handleUpdateThresholdPositive = (event: Event, newValue: number | number[]) => {
        if (!niivue) return;
        setThresholdPositive(newValue as number);
        niivue.volumes[1].cal_min = newValue as number;
        niivue.updateGLVolume();
    };

    const handkleUpdateThresholdNegative = (event: Event, newValue: number | number[]) => {
        if (!niivue) return;
        setThresholdNegative(newValue as number);
        niivue.volumes[1].cal_minNeg = -2;
        niivue.volumes[1].cal_maxNeg = newValue as number;
        niivue.updateGLVolume();
    };

    useEffect(() => {
        if (!canvasRef.current) return;

        const volumes = [
            {
                url: 'https://neurovault.org/static/images/GenericMNI.nii.gz',
                colormap: 'gray',
                opacity: 1,
            },
            {
                url: imageURL,
                colorMap: 'warm',
                colormapNegative: 'winter',
                cal_min: 0,
                cal_max: 2,
                cal_minNeg: -1,
                cal_maxNeg: -2,
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
            niivue.volumes[1].cal_minNeg = -1.0;
            niivue.volumes[1].cal_maxNeg = -2.0;
            niivue.opts.multiplanarShowRender = SHOW_RENDER.ALWAYS;
            niivue.setInterpolation(true);
            niivue.updateGLVolume();
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
                        min={-2}
                        step={0.01}
                        max={0}
                        onChange={handkleUpdateThresholdNegative}
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
                        max={2}
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
