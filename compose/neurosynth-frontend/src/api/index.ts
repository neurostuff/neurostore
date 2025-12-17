import './api.config';
import './api.state';
import { setAccessTokenSilentlyFunc, updateServicesWithToken } from './api.state';
import './axios.config';

export const updateAPISetToken = (token: string) => {
    updateServicesWithToken(token);
};

export const initAPISetAccessTokenFunc = (getAccessTokenSilently: () => Promise<string>) => {
    setAccessTokenSilentlyFunc(getAccessTokenSilently);
};
