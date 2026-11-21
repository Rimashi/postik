/** Единственная точка HTTP-доступа. Для FastAPI используем /api/v1. */
const apiBase = import.meta.env?.VITE_API_BASE_URL || '/api/v1';
const readCookie = key => document.cookie.split('; ').find(pair => pair.startsWith(key + '='))?.slice(key.length + 1) || '';

export class ApiError extends Error {
    constructor(message, status, body) { super(message); this.name = 'ApiError'; this.status = status; this.body = body; }
}
export async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
    const response = await fetch(`${apiBase}${path}`, {
        method, credentials: 'include', signal,
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(['POST','PATCH','PUT','DELETE'].includes(method.toUpperCase())
                ? { 'X-CSRF-Token': decodeURIComponent(readCookie('postik_csrf')) } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 204)
        return null;
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok)
        throw new ApiError(typeof data?.detail === 'string' ? data.detail : `HTTP ${response.status}: проверка данных`, response.status, data);
    return data;
}
