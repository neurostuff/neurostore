import { createTheme, darken, lighten, responsiveFontSizes } from '@mui/material/styles';
import { themeOptions } from '@neurosynth/theme';

declare module '@mui/material/styles' {
    interface Palette {
        /** The surface the selected entity's fields sit on: an opaque tint of the primary colour. */
        fieldSurface: string;
    }
    interface PaletteOptions {
        fieldSurface?: string;
    }
}

const { primary } = themeOptions.palette;

const FIELD_SURFACE = { light: lighten(primary.main, 0.95), dark: darken(primary.main, 0.8) };

export function makeTheme(mode: 'light' | 'dark' = 'light') {
    return responsiveFontSizes(
        createTheme({ ...themeOptions, palette: { ...themeOptions.palette, mode, fieldSurface: FIELD_SURFACE[mode] } })
    );
}

export const theme = makeTheme();
