import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { themeOptions } from '@neurosynth/theme';

export const theme = responsiveFontSizes(createTheme(themeOptions));
