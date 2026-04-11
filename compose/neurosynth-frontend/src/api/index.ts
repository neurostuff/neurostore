import './api.config';
import './api.state';
import { _setAccessTokenSilentlyFunc } from './api.state';
import './axios.config';

export const initAPISetAccessTokenFunc = (getAccessTokenSilently: (audience?: string) => Promise<string>) => {
    _setAccessTokenSilentlyFunc(getAccessTokenSilently);
};
