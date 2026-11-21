import { request } from './client.js';
export const listPosts = (params = {}) => request(`/posts?${new URLSearchParams(params)}`);
export const getPost = id => request(`/posts/${encodeURIComponent(id)}`);
export const publishPost = data => request('/posts', { method: 'POST', body: data });
export const updatePost = (id, data) => request(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
export const getContinuations = id => request(`/posts/${encodeURIComponent(id)}/continuations`);
