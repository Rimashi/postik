import { listPosts } from './api/posts.js';
import { listTopics } from './api/taxonomy.js';
import { getSession } from './api/auth.js';
import { DEMO } from './data/demo.js';
const KEY = 'postik-demo-v1';
// JWT живёт только в HttpOnly-cookie: браузерная сессия не хранится в localStorage.
const defaults = () => ({ customPosts: [], customComments: [], saved: [], votes: {}, commentVotes: {}, following: [], interests: [...DEMO.topics], localDrafts: [], offlineCollections: [], myProfile: { displayName: 'Максим', bio: 'Люблю хорошие тексты, понятные интерфейсы и интересные технологии.' }, theme: 'dark', blockedTags: [] });
const parse = (key) => { try {
    return JSON.parse(localStorage.getItem(key) || 'null');
}
catch {
    return null;
} };
let data = { ...defaults(), ...(parse(KEY) || {}) };
for (const key of ['customPosts', 'customComments', 'saved', 'following', 'interests', 'localDrafts', 'offlineCollections', 'blockedTags'])
    if (!Array.isArray(data[key]))
        data[key] = defaults()[key];
for (const key of ['votes', 'commentVotes'])
    if (typeof data[key] !== 'object' || !data[key])
        data[key] = {};
if (!data.myProfile || typeof data.myProfile !== 'object')
    data.myProfile = defaults().myProfile;
let auth = { signedIn: false, name: '', user: null };
let remotePosts = [];
let remoteTopics = [];
let serverError = '';
const DEMO_ENABLED = import.meta.env?.VITE_DEMO_CONTENT === '1';
export const state = () => data;
export const session = () => auth;
export const save = () => { try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
}
catch {
    return false;
} };
export const update = (fn) => { fn(data); return save(); };
export const updateSession = (value) => { auth = { ...auth, ...value }; };
export const posts = () => [...remotePosts, ...(DEMO_ENABLED && remotePosts.length === 0 ? DEMO.posts.map(p => ({...p, isDemo: true})) : [])];
export const postById = (id) => posts().find(p => String(p.id) === String(id));
export const comments = (postId) => [...(DEMO_ENABLED && remotePosts.length === 0 ? DEMO.comments : []), ...data.customComments].filter(c => String(c.post) === String(postId));
export const topics = () => remoteTopics.map(t => t.name);
export const authorName = () => auth.user?.username || auth.name || '';
export const topicId = name => remoteTopics.find(t => t.name === name)?.id;
export const serverStatus = () => serverError;
export const isOwn = p => !!auth.user && Number(p?.author_id) === Number(auth.user.id);
export const isOffline = id => data.offlineCollections.some(g => g.items?.some(p => String(p.id) === String(id)));
export function toggleOffline(post) { if (!post)
    return false; const exists = isOffline(post.id); update(s => { if (exists) {
    s.offlineCollections = s.offlineCollections.map(g => ({ ...g, items: g.items.filter(p => String(p.id) !== String(post.id)) })).filter(g => g.items.length);
    return;
} const date = new Date().toLocaleDateString('ru-RU'); let group = s.offlineCollections.find(g => g.date === date); if (!group) {
    group = { id: 'collection-' + Date.now(), date, title: 'Подборка от ' + date, items: [] };
    s.offlineCollections.unshift(group);
} group.items.push({ id: post.id, title: post.title, author: post.author, excerpt: post.excerpt, topic: post.topic, tags: post.tags || [], content: post.content, savedAt: Date.now() }); }); return !exists; }
export function addDraft(draft) { update(s => { const idx = s.localDrafts.findIndex(d => String(d.id) === String(draft.id)); const record = { id: draft.id, updated: Date.now(), data: { ...draft } }; if (idx < 0)
    s.localDrafts.unshift(record);
else
    s.localDrafts[idx] = record; }); }
export function deleteDraft(id) { update(s => { s.localDrafts = s.localDrafts.filter(d => String(d.id) !== String(id)); }); }
export function getDraft(id) { const item = data.localDrafts.find(d => String(d.id) === String(id)); return item?.data ? { id: item.id, ...item.data } : null; }

// Адаптер формата API -> текущий формат карточек/читалки.
// Это позволяет не переписывать страницы и CSS при подключении FastAPI.
export function mapServerPost(p) {
    const names = p.topic_ids.map(id => remoteTopics.find(t => t.id === id)?.name).filter(Boolean);
    return {
        id: p.id, author_id: p.author_id, author: p.author_username,
        initials: p.author_username.slice(0, 2).toUpperCase(), color: '#e5dcd3',
        title: p.title, excerpt: p.summary || '', content: p.content_md,
        kind: p.format, format: p.format, topic: names[0] || '', topics: names,
        tags: p.tag_names, coverImage: p.cover_url, parentId: p.parent_id,
        isServer: true, createdAt: new Date(p.published_at).getTime(),
        minutes: Math.max(1, Math.ceil(p.content_md.split(/\s+/).length / 180)),
        time: new Date(p.published_at).toLocaleDateString('ru-RU'),
        views: p.views_count, score: 0,
    };
}
export function rememberPost(p) {
    const mapped = mapServerPost(p);
    remotePosts = [mapped, ...remotePosts.filter(row => String(row.id) !== String(p.id))];
    return mapped;
}
export async function hydrate() {
    // Запрашиваем текущего пользователя, каталог и темы при каждом старте сайта.
    // Ошибка /auth/me 401 ожидаема для гостя и НЕ означает падение API.
    const [me, topicResult, postResult] = await Promise.allSettled([
        getSession(), listTopics(), listPosts({limit: 100}),
    ]);
    if (me.status === 'fulfilled') setRemoteProfile(me.value);
    else updateSession({signedIn: false, user: null, name: ''});
    if (topicResult.status === 'fulfilled') remoteTopics = topicResult.value;
    if (postResult.status === 'fulfilled') remotePosts = postResult.value.map(mapServerPost);
    serverError = topicResult.status === 'rejected' || postResult.status === 'rejected'
        ? 'Сервер API недоступен. Запусти FastAPI и проверь /api/health.' : '';
}
export function setRemoteProfile(user) {
    updateSession({signedIn: true, user, name: user.username});
    update(s => { s.myProfile.bio = user.bio || ''; s.myProfile.displayName = user.username; });
}
