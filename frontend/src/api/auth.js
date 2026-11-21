import { request } from './client.js';
// Cookie sessions OR JWT in HttpOnly cookie. Client code never reads JWT.
export const register = data => request('/auth/register', { method: 'POST', body: data });
export const login = data => request('/auth/login', { method: 'POST', body: data });
export const logout = () => request('/auth/logout', { method: 'POST' });
export const getSession = () => request('/auth/me');
