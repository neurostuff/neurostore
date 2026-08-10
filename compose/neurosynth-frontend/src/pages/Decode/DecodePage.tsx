import { CloudUpload } from '@mui/icons-material';
import { Box, Button, TextField, Typography } from '@mui/material';
import { usePageMetadata } from '../../../seo/hooks';

const DecodePage = () => {
    usePageMetadata({
        title: 'Decode | Neurosynth Compose',
        description: 'Decode a brain map into associated cognitive terms (coming soon).',
        canonicalPath: '/decode',
    });

    return (
        <Box
            sx={{
                maxWidth: 640,
                mx: 'auto',
                py: { xs: 2, md: 4 },
            }}
        >
            <Typography variant="h4" color="primary" sx={{ fontWeight: 700, mb: 1 }}>
                Decode a brain map
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Upload a statistical map or paste a NeuroVault URL to decode associated cognitive terms. This
                wireframe is not connected to a decode backend yet.
            </Typography>
            <Box
                sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 3,
                    backgroundColor: 'background.paper',
                }}
            >
                <TextField
                    fullWidth
                    label="NeuroVault URL or map identifier"
                    placeholder="https://neurovault.org/images/…"
                    sx={{ mb: 2 }}
                />
                <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUpload />}
                    sx={{ mb: 3, textTransform: 'none' }}
                >
                    Choose NIfTI file
                    <input type="file" hidden accept=".nii,.nii.gz" disabled />
                </Button>
                <Box>
                    <Button variant="contained" disabled sx={{ textTransform: 'none', fontWeight: 600 }}>
                        Decode map
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                        Coming soon — decode results will appear here.
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default DecodePage;
