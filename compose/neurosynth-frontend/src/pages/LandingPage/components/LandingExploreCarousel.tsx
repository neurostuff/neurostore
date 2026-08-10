import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { Box, IconButton, Link, Typography } from '@mui/material';
import { Niivue, SLICE_TYPE } from '@niivue/niivue';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

type CarouselSlide = {
    term: string;
    mapUrl: string;
};

/** Classic neurosynth.org association-test maps (same files the term pages download). */
const neurosynthAssociationMapUrl = (term: string) =>
    `https://neurosynth.org/api/analyses/terms/${encodeURIComponent(term)}/images/association/`;

const CAROUSEL_SLIDES: CarouselSlide[] = [
    { term: 'pain', mapUrl: neurosynthAssociationMapUrl('pain') },
    { term: 'stroop', mapUrl: neurosynthAssociationMapUrl('stroop') },
    { term: 'working memory', mapUrl: neurosynthAssociationMapUrl('working memory') },
    { term: 'reward', mapUrl: neurosynthAssociationMapUrl('reward') },
    { term: 'face', mapUrl: neurosynthAssociationMapUrl('face') },
];

const SLIDE_INTERVAL_MS = 5500;
const SPIN_DEGREES_PER_SECOND = 10;
const ANATOMICAL_URL = 'https://neurovault.org/static/images/GenericMNI.nii.gz';

type LandingExploreCarouselProps = {
    /** Square viewport, full-width fixed height, or default wide rectangle. */
    variant?: 'default' | 'square' | 'fillWidth';
};

const LandingExploreCarousel = ({ variant = 'default' }: LandingExploreCarouselProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const niivueRef = useRef<Niivue | null>(null);
    const loadGenerationRef = useRef(0);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [isTermVisible, setIsTermVisible] = useState(true);
    const [isMapLoading, setIsMapLoading] = useState(true);
    const [mapLoadError, setMapLoadError] = useState<string | null>(null);

    const activeSlide = CAROUSEL_SLIDES[activeSlideIndex];

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setActiveSlideIndex((currentIndex) => (currentIndex + 1) % CAROUSEL_SLIDES.length);
        }, SLIDE_INTERVAL_MS);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        setIsTermVisible(false);
        const timeoutId = window.setTimeout(() => setIsTermVisible(true), 180);
        return () => window.clearTimeout(timeoutId);
    }, [activeSlideIndex]);

    useEffect(() => {
        let frameId = 0;
        let lastTimestamp: number | null = null;

        const tick = (timestamp: number) => {
            const niivue = niivueRef.current;
            const canSpin = Boolean(niivue) && !document.hidden && !isMapLoading && !mapLoadError;

            if (canSpin && niivue) {
                if (lastTimestamp != null) {
                    const deltaSeconds = (timestamp - lastTimestamp) / 1000;
                    const nextAzimuth =
                        (niivue.scene.renderAzimuth + SPIN_DEGREES_PER_SECOND * deltaSeconds) % 360;
                    niivue.setRenderAzimuthElevation(nextAzimuth, niivue.scene.renderElevation);
                }
                lastTimestamp = timestamp;
            } else {
                lastTimestamp = null;
            }

            frameId = window.requestAnimationFrame(tick);
        };

        frameId = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frameId);
    }, [isMapLoading, mapLoadError]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const loadSlide = async () => {
            const loadGeneration = ++loadGenerationRef.current;
            setIsMapLoading(true);
            setMapLoadError(null);

            try {
                if (niivueRef.current === null) {
                    const niivue = new Niivue({
                        show3Dcrosshair: false,
                        isResizeCanvas: true,
                        isHighResolutionCapable: true,
                        backColor: [0, 0, 0, 1],
                    });
                    niivue.attachToCanvas(canvas);
                    niivue.opts.isColorbar = false;
                    niivue.setCrosshairWidth(0);
                    niivue.setSliceMM(false);
                    // false = trilinear (smooth); true = nearest-neighbor (blocky).
                    niivue.setInterpolation(false);
                    await niivue.addVolumeFromUrl({
                        url: ANATOMICAL_URL,
                        name: 'anatomical.nii.gz',
                        colormap: 'gray',
                        opacity: 1,
                        colorbarVisible: false,
                    });
                    if (loadGeneration !== loadGenerationRef.current) return;
                    niivue.setSliceType(SLICE_TYPE.RENDER);
                    await niivue.setVolumeRenderIllumination(0.6);
                    niivueRef.current = niivue;
                }

                const niivue = niivueRef.current;
                while (niivue.volumes.length > 1) {
                    niivue.removeVolume(niivue.volumes[1]);
                }

                const overlayFilename = `${activeSlide.term.replace(/\s+/g, '_')}_association-test_z_FDR_0.01.nii.gz`;
                await niivue.addVolumeFromUrl({
                    url: activeSlide.mapUrl,
                    name: overlayFilename,
                    colormap: 'warm',
                    opacity: 1,
                    colorbarVisible: false,
                });

                if (loadGeneration !== loadGenerationRef.current) return;

                if (niivue.volumes[1]) {
                    // Neurosynth association maps are already FDR-thresholded; keep near-zero
                    // cal_min so surviving clusters remain visible in 3D render.
                    const globalMax = Math.abs(niivue.volumes[1].global_max || 0);
                    const globalMin = Math.abs(niivue.volumes[1].global_min || 0);
                    const largestAbsoluteValue = Math.max(globalMax, globalMin, 1);
                    niivue.volumes[1].cal_min = 0;
                    niivue.volumes[1].cal_max = largestAbsoluteValue;
                    niivue.overlayOutlineWidth = 0;
                    niivue.volumes[1].alphaThreshold = 0;
                }

                niivue.setInterpolation(false);
                niivue.setSliceType(SLICE_TYPE.RENDER);
                niivue.resizeListener();
                niivue.updateGLVolume();
                setIsMapLoading(false);
            } catch (error) {
                if (loadGeneration === loadGenerationRef.current) {
                    setIsMapLoading(false);
                    setMapLoadError(error instanceof Error ? error.message : 'Failed to load map');
                }
            }
        };

        loadSlide();
    }, [activeSlide.mapUrl]);

    const goToPreviousSlide = () => {
        setActiveSlideIndex((currentIndex) =>
            currentIndex === 0 ? CAROUSEL_SLIDES.length - 1 : currentIndex - 1
        );
    };

    const goToNextSlide = () => {
        setActiveSlideIndex((currentIndex) => (currentIndex + 1) % CAROUSEL_SLIDES.length);
    };

    const isSquare = variant === 'square';
    const isFillWidth = variant === 'fillWidth';
    // Slightly shorter than the previous square carousel height.
    const fillWidthHeight = 320;

    return (
        <Box sx={{ width: '100%', mt: isSquare || isFillWidth ? 0 : 1 }}>
            <Box
                sx={{
                    position: 'relative',
                    width: '100%',
                    borderRadius: isSquare || isFillWidth ? 2.5 : 2,
                    overflow: 'hidden',
                    backgroundColor: '#000000',
                    boxShadow: isSquare || isFillWidth ? 'none' : '0 8px 28px rgba(0, 119, 182, 0.18)',
                }}
            >
                <Box
                    sx={
                        isSquare
                            ? { width: '100%', aspectRatio: '1 / 1', position: 'relative' }
                            : isFillWidth
                              ? { width: '100%', height: fillWidthHeight, position: 'relative' }
                              : { height: { xs: 240, sm: 300, md: 340 }, position: 'relative' }
                    }
                >
                    <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
                    {(isMapLoading || mapLoadError) && (
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(11, 31, 42, 0.35)',
                                color: 'common.white',
                                typography: 'body2',
                                px: 2,
                                textAlign: 'center',
                            }}
                        >
                            {mapLoadError ? `Could not load map: ${mapLoadError}` : 'Loading map…'}
                        </Box>
                    )}
                </Box>
                <IconButton
                    aria-label="Previous brain map"
                    onClick={goToPreviousSlide}
                    size="small"
                    sx={{
                        position: 'absolute',
                        left: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'common.white',
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' },
                    }}
                >
                    <ChevronLeft />
                </IconButton>
                <IconButton
                    aria-label="Next brain map"
                    onClick={goToNextSlide}
                    size="small"
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'common.white',
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' },
                    }}
                >
                    <ChevronRight />
                </IconButton>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1.5 }}>
                {CAROUSEL_SLIDES.map((slide, slideIndex) => (
                    <Box
                        key={slide.term}
                        component="button"
                        type="button"
                        aria-label={`Show map for ${slide.term}`}
                        onClick={() => setActiveSlideIndex(slideIndex)}
                        sx={{
                            width: slideIndex === activeSlideIndex ? 18 : 8,
                            height: 8,
                            borderRadius: 4,
                            border: 'none',
                            p: 0,
                            cursor: 'pointer',
                            transition: 'width 200ms ease, background-color 200ms ease',
                            backgroundColor:
                                slideIndex === activeSlideIndex ? 'primary.main' : 'rgba(0, 119, 182, 0.28)',
                        }}
                    />
                ))}
            </Box>

            <Typography
                variant="h6"
                sx={{
                    mt: 2,
                    color: 'text.secondary',
                    fontWeight: 400,
                    letterSpacing: 0.2,
                    minHeight: '2rem',
                    textAlign: 'center',
                    opacity: isTermVisible ? 1 : 0,
                    transition: 'opacity 220ms ease',
                }}
            >
                <Link
                    component={RouterLink}
                    to="#"
                    onClick={(event) => event.preventDefault()}
                    underline="hover"
                    sx={{
                        color: 'primary.main',
                        fontWeight: 700,
                        fontStyle: 'italic',
                    }}
                >
                    {activeSlide.term}
                </Link>
            </Typography>
        </Box>
    );
};

export default LandingExploreCarousel;
