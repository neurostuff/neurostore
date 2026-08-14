import { useAuth0 } from '@auth0/auth0-react';
import { AccountTree, ArrowForward, Psychology, Science, Search } from '@mui/icons-material';
import { Box, Button, InputAdornment, TextField, Typography } from '@mui/material';
import useAuthenticate from 'hooks/useAuthenticate';
import LandingExploreCarousel from 'pages/LandingPage/components/LandingExploreCarousel';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageMetadata } from '../../../seo/hooks';

const fadeUp = {
    '@keyframes landing2FadeUp': {
        from: { opacity: 0, transform: 'translateY(18px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
    },
};

const mapGlow = {
    '@keyframes landing2Glow': {
        '0%, 100%': { opacity: 0.45, transform: 'scale(1)' },
        '50%': { opacity: 0.75, transform: 'scale(1.04)' },
    },
};

/**
 * Alternate wireframe: left/right split explore entrypoint.
 * View at /landing-2. Does not replace the primary landing page.
 */
const LandingPage2 = () => {
    const { isAuthenticated } = useAuth0();
    const { handleLogin } = useAuthenticate();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    usePageMetadata({
        title: 'Landing v2 (split) | Neurosynth Compose',
        description: 'Alternate left/right split wireframe for the explore landing entrypoint.',
        canonicalPath: '/landing-2',
    });

    const handleSearchSubmit = (event: FormEvent) => {
        event.preventDefault();
        const trimmedQuery = searchQuery.trim();
        if (trimmedQuery) {
            navigate(`/explore?q=${encodeURIComponent(trimmedQuery)}`);
        } else {
            navigate('/explore');
        }
    };

    const handleNewMetaAnalysis = () => {
        if (isAuthenticated) {
            navigate('/projects');
        } else {
            handleLogin();
        }
    };

    return (
        <Box
            sx={{
                ...fadeUp,
                ...mapGlow,
                position: 'relative',
                minHeight: 'calc(100vh - 64px)',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                overflow: 'hidden',
                background: `
                    radial-gradient(ellipse 80% 60% at 12% 40%, rgba(0, 180, 216, 0.14) 0%, transparent 55%),
                    radial-gradient(ellipse 50% 50% at 85% 20%, rgba(0, 119, 182, 0.1) 0%, transparent 50%),
                    linear-gradient(145deg, #f4fafc 0%, #ffffff 42%, #eef7fb 100%)
                `,
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    opacity: 0.35,
                    backgroundImage: `
                        linear-gradient(rgba(0, 119, 182, 0.045) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 119, 182, 0.045) 1px, transparent 1px)
                    `,
                    backgroundSize: '48px 48px',
                    maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 75%)',
                },
            }}
        >
            {/* Left: map stage (45%) */}
            <Box
                sx={{
                    position: 'relative',
                    flex: { xs: 'none', md: '0 0 45%' },
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: { xs: 2.5, sm: 3, md: 4 },
                    py: { xs: 4, md: 5 },
                    boxSizing: 'border-box',
                    order: { xs: 2, md: 1 },
                    background: {
                        xs: 'transparent',
                        md: 'linear-gradient(165deg, #062635 0%, #0a3a4d 42%, #0d4a63 100%)',
                    },
                    '&::after': {
                        content: '""',
                        display: { xs: 'none', md: 'block' },
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: 1,
                        height: '100%',
                        background:
                            'linear-gradient(180deg, transparent 0%, rgba(144, 224, 239, 0.35) 50%, transparent 100%)',
                    },
                }}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        width: '70%',
                        maxWidth: 420,
                        aspectRatio: '1 / 1',
                        borderRadius: '50%',
                        background:
                            'radial-gradient(circle, rgba(0, 180, 216, 0.35) 0%, rgba(0, 119, 182, 0.12) 45%, transparent 70%)',
                        animation: 'landing2Glow 7s ease-in-out infinite',
                        pointerEvents: 'none',
                        display: { xs: 'none', md: 'block' },
                    }}
                />
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: 400,
                        animation: 'landing2FadeUp 0.8s ease-out both',
                        animationDelay: '0.12s',
                    }}
                >
                    <Typography
                        sx={{
                            display: 'block',
                            color: { xs: 'primary.main', md: 'rgba(144, 224, 239, 0.9)' },
                            letterSpacing: '0.22em',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            mb: 2,
                            textAlign: 'center',
                            textTransform: 'uppercase',
                        }}
                    >
                        Live meta-analytic maps
                    </Typography>
                    <Box
                        sx={{
                            borderRadius: 3,
                            p: { xs: 0, md: 1.25 },
                            background: {
                                xs: 'transparent',
                                md: 'linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
                            },
                            boxShadow: {
                                xs: 'none',
                                md: '0 24px 60px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
                            },
                            backdropFilter: { md: 'blur(8px)' },
                            '& .MuiTypography-root': {
                                color: { md: 'rgba(232, 244, 248, 0.85)' },
                            },
                            '& a': {
                                color: { md: '#90e0ef !important' },
                            },
                        }}
                    >
                        <LandingExploreCarousel variant="square" />
                    </Box>
                </Box>
            </Box>

            {/* Right: brand + search (55%), centered */}
            <Box
                sx={{
                    position: 'relative',
                    flex: { xs: 'none', md: '0 0 55%' },
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    px: { xs: 3, sm: 4, md: 6 },
                    py: { xs: 5, md: 6 },
                    boxSizing: 'border-box',
                    order: { xs: 1, md: 2 },
                }}
            >
                <Box
                    sx={{
                        width: '100%',
                        maxWidth: 460,
                        animation: 'landing2FadeUp 0.75s ease-out both',
                    }}
                >
                    <Box
                        component="img"
                        src="/static/synth.png"
                        alt="neurosynth compose logo"
                        sx={{
                            width: 68,
                            height: 68,
                            mb: 2.5,
                            display: 'block',
                            mx: 'auto',
                            filter: 'drop-shadow(0 8px 18px rgba(0, 119, 182, 0.25))',
                        }}
                    />
                    <Typography
                        component="h1"
                        sx={{
                            color: 'primary.dark',
                            fontWeight: 800,
                            mb: 1.75,
                            fontSize: { xs: '2rem', md: '2.65rem' },
                            lineHeight: 1.15,
                            letterSpacing: '-0.02em',
                        }}
                    >
                        neurosynth compose
                    </Typography>
                    <Typography
                        sx={{
                            color: 'text.secondary',
                            fontWeight: 400,
                            fontSize: { xs: '1.05rem', md: '1.2rem' },
                            lineHeight: 1.6,
                            mb: 4,
                            maxWidth: 400,
                            mx: 'auto',
                        }}
                    >
                        Discover what the literature says about the brain—search meta-analytic maps, or build your own
                        reproducible analysis.
                    </Typography>

                    <Box
                        component="form"
                        onSubmit={handleSearchSubmit}
                        sx={{
                            width: '100%',
                            mb: 2.75,
                            p: 0.75,
                            borderRadius: 4,
                            background:
                                'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.8) 100%)',
                            boxShadow: '0 10px 40px rgba(0, 119, 182, 0.12), 0 0 0 1px rgba(0, 119, 182, 0.08)',
                        }}
                    >
                        <TextField
                            fullWidth
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Try pain, stroop, working memory…"
                            inputProps={{ 'aria-label': 'Search brain maps' }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search sx={{ color: 'primary.main' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            size="small"
                                            endIcon={<ArrowForward />}
                                            sx={{
                                                textTransform: 'none',
                                                fontWeight: 700,
                                                borderRadius: 2,
                                                px: 1.75,
                                                boxShadow: 'none',
                                            }}
                                        >
                                            Explore
                                        </Button>
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 3,
                                    fontSize: '1.05rem',
                                    backgroundColor: 'transparent',
                                    '& fieldset': { borderColor: 'transparent' },
                                    '&:hover fieldset': { borderColor: 'transparent' },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'rgba(0, 119, 182, 0.25)',
                                    },
                                },
                            }}
                        />
                    </Box>

                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 1.25,
                            width: '100%',
                            justifyContent: 'center',
                        }}
                    >
                        <Button
                            variant="outlined"
                            startIcon={<AccountTree />}
                            onClick={() => navigate('/explore')}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                px: 2,
                                borderRadius: 2.5,
                                borderColor: 'rgba(0, 119, 182, 0.35)',
                                backgroundColor: 'rgba(255,255,255,0.65)',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    backgroundColor: 'rgba(0, 119, 182, 0.06)',
                                },
                            }}
                        >
                            Explore
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<Psychology />}
                            onClick={() => navigate('/decode')}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                px: 2,
                                borderRadius: 2.5,
                                borderColor: 'rgba(0, 119, 182, 0.35)',
                                backgroundColor: 'rgba(255,255,255,0.65)',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    backgroundColor: 'rgba(0, 119, 182, 0.06)',
                                },
                            }}
                        >
                            Decode
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<Science />}
                            onClick={handleNewMetaAnalysis}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                px: 2.25,
                                borderRadius: 2.5,
                                boxShadow: '0 8px 22px rgba(0, 119, 182, 0.28)',
                                '&:hover': {
                                    boxShadow: '0 10px 28px rgba(0, 119, 182, 0.36)',
                                },
                            }}
                        >
                            New meta-analysis
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default LandingPage2;
