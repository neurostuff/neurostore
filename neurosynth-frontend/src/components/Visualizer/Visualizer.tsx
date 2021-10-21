import { Box, SxProps, Theme } from '@mui/system';
import { useEffect } from 'react';
import VisualizerStyles from './VisualizerStyles';

export interface VisualizerModel {
    overlayURL: string;
    imageURL: string;
    fileName: string;
    index: number; // the ith papaya container (set this to 0 if you have 1 papaya viewer)
    sx?: SxProps<Theme>;
}

const Visualizer: React.FC<VisualizerModel> = (props) => {
    useEffect(() => {
        const anyWindow = window as any;
        const params: any = {};
        params.images = ['https://neurovault.org/static/images/GenericMNI.nii.gz', props.imageURL];

        if (!props.fileName || !props.imageURL || !props.overlayURL) return;
        params.luts = [
            {
                name: 'PuBu',
                data: [
                    [0, 1, 0.968627, 0.984314],
                    [0.125, 0.92549, 0.905882, 0.94902],
                    [0.25, 0.815686, 0.819608, 0.901961],
                    [0.375, 0.65098, 0.741176, 0.858824],
                    [0.5, 0.454902, 0.662745, 0.811765],
                    [0.625, 0.211765, 0.564706, 0.752941],
                    [0.75, 0.0196078, 0.439216, 0.690196],
                    [0.875, 0.0156863, 0.352941, 0.552941],
                    [1, 0.00784314, 0.219608, 0.345098],
                ],
            },
            {
                name: 'OrRd',
                data: [
                    [0, 1, 0.968627, 0.92549],
                    [0.125, 0.996078, 0.909804, 0.784314],
                    [0.25, 0.992157, 0.831373, 0.619608],
                    [0.375, 0.992157, 0.733333, 0.517647],
                    [0.5, 0.988235, 0.552941, 0.34902],
                    [0.625, 0.937255, 0.396078, 0.282353],
                    [0.75, 0.843137, 0.188235, 0.121569],
                    [0.875, 0.701961, 0, 0],
                    [1, 0.498039, 0, 0],
                ],
            },
        ];

        params[props.fileName] = {
            parametric: true,
            min: 0,
            lut: 'OrRd',
            negative_lut: 'PuBu',
            alpha: '0.75',
            symmetric: true,
        };

        params.worldSpace = true;
        params.expandable = true;
        params.combineParametric = true;
        params.showControls = false;
        params.smoothDisplay = false;

        if (
            !anyWindow.papayaContainers ||
            (anyWindow.papayaContainers && anyWindow.papayaContainers.length === 0)
        ) {
            anyWindow.papaya.Container.startPapaya();
        }

        anyWindow.papaya.Container.resetViewer(props.index, params);
    }, [props.fileName, props.imageURL, props.overlayURL, props.index, props]);

    useEffect(() => {
        return () => {
            (window as any).papayaContainers = [];
        };
    }, []);

    return (
        <Box sx={{ ...VisualizerStyles.container, ...props.sx }}>
            <div className="papaya"></div>
            {/* <Box className="papaya"></Box> */}
        </Box>
    );
};

export default Visualizer;
