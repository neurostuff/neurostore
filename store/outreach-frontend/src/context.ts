import { createContext, useContext } from 'react';
import type { OutreachApi } from './api';

export const ApiContext = createContext<OutreachApi | null>(null);

export function useApi(): OutreachApi {
    const api = useContext(ApiContext);
    if (!api) throw new Error('useApi needs an ApiContext provider');
    return api;
}
