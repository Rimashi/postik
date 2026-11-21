import { request } from './client.js';
export const listTopics = () => request('/topics');
export const listTags = (search = '') => request(`/tags?${new URLSearchParams({ search })}`);
