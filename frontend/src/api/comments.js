import { request } from './client.js';
export const listComments = postId => request(`/posts/${encodeURIComponent(postId)}/comments`);
export const createComment = (postId, data) => request(`/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: data });
