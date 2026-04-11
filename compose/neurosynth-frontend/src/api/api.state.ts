import axios from 'axios';
import { Configuration as NeurostoreConfiguration } from 'neurostore-typescript-sdk';
import { Configuration as NeurosynthConfiguration } from 'neurosynth-compose-typescript-sdk';

const env = import.meta.env.VITE_APP_ENV as 'DEV' | 'STAGING' | 'PROD';
const NEUROSTORE_API_DOMAIN = import.meta.env.VITE_APP_NEUROSTORE_API_DOMAIN as string;
const NEUROSYNTH_API_DOMAIN = import.meta.env.VITE_APP_NEUROSYNTH_API_DOMAIN as string;
const NEUROSYNTH_AUTH0_AUDIENCE = import.meta.env.VITE_APP_AUTH0_AUDIENCE as string;
const NEUROSTORE_AUTH0_AUDIENCE =
    (import.meta.env.VITE_APP_NEUROSTORE_AUTH0_AUDIENCE as string | undefined) ||
    `${NEUROSTORE_API_DOMAIN.replace(/\/+$/, '')}/`;

export const neurostoreConfig: NeurostoreConfiguration = new NeurostoreConfiguration({
    basePath: NEUROSTORE_API_DOMAIN,
    accessToken: '',
});

export const neurosynthConfig: NeurosynthConfiguration = new NeurosynthConfiguration({
    basePath: NEUROSYNTH_API_DOMAIN,
    accessToken: '',
});

export const axiosInstance = axios.create({
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
    },
});

/**
 * Only for usage within the api folder.
 * For external usage, use the initAPISetAccessTokenFunc function.
 */
export let _getAccessTokenSilentlyFunc: ((audience?: string) => Promise<string>) | null = null;
export const _setAccessTokenSilentlyFunc = (getAccessTokenSilently: (audience?: string) => Promise<string>) => {
    _getAccessTokenSilentlyFunc = getAccessTokenSilently;
};

export const getAudienceForRequest = (url?: string): string => {
    if (!url) return NEUROSYNTH_AUTH0_AUDIENCE;
    return url.startsWith(NEUROSTORE_API_DOMAIN)
        ? NEUROSTORE_AUTH0_AUDIENCE
        : NEUROSYNTH_AUTH0_AUDIENCE;
};
