import { posts, state, topics, comments, isOwn } from '../store.js';
import { esc, plainText } from '../shared/html.js';
import { postCard, postKind } from '../components/card.js';
export const feedFilters = { mode: 'all', sort: 'interesting', topic: '', tag: '', period: '', view: 'cards', search: '' };
export const resetFeed = () => Object.assign(feedFilters, { mode: 'all', topic: '', tag: '', period: '', search: '' });
export function selectedPosts(page = 'feed', name = '') {
    let list = [...posts()];
    if (page === 'mine')
        list = list.filter(p => isOwn(p));
    if (page === 'bookmarks')
        list = list.filter(p => state().saved.some(id => String(id) === String(p.id)));
    if (page === 'following')
        list = list.filter(p => state().following.includes(p.author));
    if (page === 'profile')
        list = list.filter(p => p.author === name);
    if (feedFilters.mode !== 'all')
        list = list.filter(p => postKind(p) === feedFilters.mode);
    if (feedFilters.topic)
        list = list.filter(p => p.topic === feedFilters.topic || (p.topics || []).includes(feedFilters.topic));
    if (feedFilters.tag)
        list = list.filter(p => (p.tags || []).includes(feedFilters.tag));
    if (feedFilters.search) {
        const q = feedFilters.search.toLocaleLowerCase('ru');
        list = list.filter(p => [p.title, p.excerpt, p.author, plainText(p.content)].join(' ').toLocaleLowerCase('ru').includes(q));
    }
    if (feedFilters.period) {
        const days = Number(feedFilters.period);
        const now = Date.now();
        list = list.filter(p => !p.createdAt || now - new Date(p.createdAt).getTime() < days * 86400000);
    }
    if (feedFilters.sort === 'interesting')
        list.sort((a, b) => (b.score || 0) - (a.score || 0));
    if (feedFilters.sort === 'new')
        list.sort((a, b) => (b.createdAt || b.id) - (a.createdAt || a.id));
    if (feedFilters.sort === 'discussed')
        list.sort((a, b) => comments(b.id).length - comments(a.id).length);
    return list;
}
export function feedControls() { const allTags = [...new Set(posts().flatMap(p => p.tags || []))].sort((a, b) => a.localeCompare(b, 'ru')); return `<div class="feed-filters"><div class="tabs" aria-label="Сортировка"><button data-act="sort" data-value="interesting" class="${feedFilters.sort === 'interesting' ? 'active' : ''}">Интересное</button><button data-act="sort" data-value="new" class="${feedFilters.sort === 'new' ? 'active' : ''}">Свежее <span class="live-dot"></span></button><button data-act="sort" data-value="discussed" class="${feedFilters.sort === 'discussed' ? 'active' : ''}">Обсуждаемое</button></div><div class="filter-row"><div class="format-group">${[['all', 'Всё'], ['article', 'Статьи'], ['post', 'Посты'], ['blog', 'Блоги']].map(([id, label]) => `<button data-act="format" data-value="${id}" class="pill ${feedFilters.mode === id ? 'selected' : ''}">${label}</button>`).join('')}</div><div class="filter-selects"><label>Тема<select data-filter="topic"><option value="">Все темы</option>${topics().map(v => `<option ${v === feedFilters.topic ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label><label>Тег<select data-filter="tag"><option value="">Все теги</option>${allTags.map(v => `<option ${v === feedFilters.tag ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label><label>Период<select data-filter="period"><option value="">За всё время</option><option value="1" ${feedFilters.period === '1' ? 'selected' : ''}>За день</option><option value="7" ${feedFilters.period === '7' ? 'selected' : ''}>За неделю</option><option value="30" ${feedFilters.period === '30' ? 'selected' : ''}>За месяц</option></select></label><button class="outline reset-button" data-act="reset-filters">Сбросить</button></div></div></div>`; }
export function renderFeed(page = 'feed', name = '') { const texts = { feed: ['Публикации', 'Найдите темы, авторов и статьи по душе.'], following: ['На вашей волне', 'Истории людей, на которых вы подписаны.'], bookmarks: ['Вернуться к интересному', 'Сохранённые публикации.'], mine: ['Ваши истории', 'Опубликованные материалы и черновики на устройстве.'], profile: [`Публикации: ${name}`, 'Материалы автора.'] }; const [title, subtitle] = texts[page] || texts.feed; const list = selectedPosts(page, name); return `<div class="page-head"><div><span class="eyebrow">ЛЮДИ / ИДЕИ / ОПЫТ</span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div></div>${feedControls()}${page === 'mine' ? '<div id="drafts-area"></div>' : ''}<div class="post-grid ${feedFilters.view === 'compact' ? 'compact' : ''}" id="feed-grid">${list.map(p => postCard(p, { compact: feedFilters.view === 'compact' })).join('') || `<div class="empty">Пока здесь ничего нет. <a href="/posts" data-link>К публикациям →</a></div>`}</div><div class="end-note">Вы на своей волне ✳<small>Все публикации этой подборки уже здесь</small></div>`; }
