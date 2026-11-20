import { createTheme, darken, lighten, responsiveFontSizes } from '@mui/material/styles';
import { themeOptions } from '@neurosynth/theme';

/** A chip's text colour and the surface it sits on. */
export interface SignColours {
    text: string;
    surface: string;
}

/** The colours of an analysis's comparison: greater (+), less (−), and a sign missing. */
export interface SignPalette {
    greater: SignColours;
    less: SignColours;
    missing: SignColours;
}

declare module '@mui/material/styles' {
    interface Palette {
        /** The surface the selected entity's fields sit on: an opaque tint of the primary colour. */
        fieldSurface: string;
        sign: SignPalette;
    }
    interface PaletteOptions {
        fieldSurface?: string;
        sign?: SignPalette;
    }
}

const { primary } = themeOptions.palette;

const FIELD_SURFACE = { light: lighten(primary.main, 0.95), dark: darken(primary.main, 0.8) };

const SIGN: Record<'light' | 'dark', SignPalette> = {
    light: {
        greater: { text: '#1557A6', surface: '#EEF4FB' },
        less: { text: '#A3410A', surface: '#FDF3EA' },
        missing: { text: '#B42318', surface: '#FEF3F2' },
    },
    dark: {
        greater: { text: '#A9CBF5', surface: '#14263D' },
        less: { text: '#F7B985', surface: '#3A2414' },
        missing: { text: '#FDA29B', surface: '#3D1714' },
    },
};

export function makeTheme(mode: 'light' | 'dark' = 'light') {
    return responsiveFontSizes(
        createTheme({
            ...themeOptions,
            palette: {
                ...themeOptions.palette,
                mode,
                fieldSurface: FIELD_SURFACE[mode],
                sign: SIGN[mode],
            },
        })
    );
}

export const theme = makeTheme();
