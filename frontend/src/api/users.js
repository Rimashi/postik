import { request } from './client.js';
export const getProfile = username => request(`/users/${encodeURIComponent(username)}`);
export const updateProfile = data => request('/users/me', { method: 'PATCH', body: data });
