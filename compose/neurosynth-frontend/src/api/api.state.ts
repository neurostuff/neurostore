import axios from 'axios';
import { Configuration as NeurostoreConfiguration } from 'neurostore-typescript-sdk';
import { Configuration as NeurosynthConfiguration } from 'neurosynth-compose-typescript-sdk';

const env = import.meta.env.VITE_APP_ENV as 'DEV' | 'STAGING' | 'PROD';
const NEUROSTORE_API_DOMAIN = import.meta.env.VITE_APP_NEUROSTORE_API_DOMAIN as string;
const NEUROSYNTH_API_DOMAIN = import.meta.env.VITE_APP_NEUROSYNTH_API_DOMAIN as string;

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

export const updateServicesWithToken = (token: string) => {
    if (env === 'DEV' || env === 'STAGING') console.log(token);
    neurostoreConfig.accessToken = token;
    neurosynthConfig.accessToken = token;
};

export let getAccessTokenSilentlyFunc: (() => Promise<string>) | null = null;
export const setAccessTokenSilentlyFunc = (getAccessTokenSilently: () => Promise<string>) => {
    getAccessTokenSilentlyFunc = getAccessTokenSilently;
};
