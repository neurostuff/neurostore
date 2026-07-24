import './api.config';
import './api.state';
import { _setAccessTokenSilentlyFunc } from './api.state';
import './axios.config';

export const initAPISetAccessTokenFunc = (getAccessTokenSilently: () => Promise<string>) => {
    _setAccessTokenSilentlyFunc(getAccessTokenSilently);
};
