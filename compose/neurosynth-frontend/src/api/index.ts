import './api.config';
import './api.state';
import { _setAccessTokenSilentlyFunc, _updateServicesWithToken } from './api.state';
import './axios.config';

export const updateAPISetToken = (token: string) => {
    _updateServicesWithToken(token);
};

export const initAPISetAccessTokenFunc = (getAccessTokenSilently: () => Promise<string>) => {
    _setAccessTokenSilentlyFunc(getAccessTokenSilently);
};
