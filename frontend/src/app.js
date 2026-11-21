import { getPost as apiGetPost } from './api/posts.js';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from './api/auth.js';
import { updateProfile as apiUpdateProfile } from './api/users.js';
/** Координатор приложения. Страницы чистые: render → строка HTML, действия → единая диспетчеризация. */
import { startRouter, navigate } from './router.js';
import { state, session, postById, comments, update, updateSession, toggleOffline, authorName, deleteDraft, setRemoteProfile, serverStatus, rememberPost } from './store.js';
import { esc, icon, username } from './shared/html.js';
import { renderHome } from './pages/home.js';
import { renderFeed, feedFilters, resetFeed } from './pages/feed.js';
import { renderArticle, branchHTML } from './pages/article.js';
import { renderEditor, newDraft, openDraft, saveCurrentDraft, updateCurrentDraft, handleEditorInput, changeTopic, initializeEditor, resize, publishDraft, draftList, draft } from './pages/editor.js';
import { renderLibrary, libraryFilters, download, snapshotMd } from './pages/library.js';
import { authPage, settingsPage, profilePage, moderationPage } from './pages/account.js';
let current = { page: 'home' }, menuOpen = false, accountOpen = false, mobileSearch = false, toastTimer, modalCallback = null;
const root = document.getElementById('app'), overlay = document.getElementById('overlay-root');
const navigation = [['/', 'Главная'], ['/posts', 'Публикации'], ['/following', 'Подписки']];
function shell() { const logged = session().signedIn; return `<header class="site-header"><div class="header-inner"><a class="brand" href="/" data-link aria-label="Постик: главная"><span class="brand-mark">п<span>•</span></span><span class="brand-text">постик<span class="brand-dot">.</span></span></a><nav class="main-nav" aria-label="Навигация">${navigation.map(([url, label]) => `<a href="${url}" data-link class="${location.pathname === url ? 'active' : ''}">${label}</a>`).join('')}</nav><span class="mobile-page-title">${esc(pageTitle())}</span><div class="header-search" id="header-search"><span class="search-icon">${icon('search')}</span><input id="search-input" type="search" placeholder="Поиск публикаций" value="${esc(feedFilters.search)}" aria-label="Поиск публикаций"><span class="search-key">/</span></div><button class="icon-button mobile-search-button" data-act="toggle-search" aria-label="Поиск">${icon('search')}</button>${logged ? `<a class="primary header-write" href="/editor" data-link data-new-draft>${icon('plus')} <span>Написать</span></a>` : ''}<button class="icon-button theme-switch" data-act="theme" aria-label="Сменить тему">${icon(state().theme === 'dark' ? 'sun' : 'moon')}</button>${logged ? `<button class="avatar-button" data-act="account" aria-label="Аккаунт">${esc(authorName().slice(0, 1).toUpperCase())}</button>` : `<a href="/login" data-link class="outline header-login">Войти</a>`}<button class="icon-button burger" data-act="menu" aria-label="Меню" aria-expanded="${menuOpen}">${icon(menuOpen ? 'close' : 'menu')}</button></div>${accountOpen && logged ? `<div class="account-menu"><div class="account-menu-head"><strong>${esc(authorName())}</strong><small>Профиль Постика</small></div>${[['/users/' + encodeURIComponent(username(authorName())), 'Мой профиль'], ['/my-posts', 'Мои публикации'], ['/bookmarks', 'Закладки'], ['/offline', 'Офлайн-подборки'], ['/settings', 'Настройки профиля']].map(([url, title]) => `<a href="${url}" data-link>${title}</a>`).join('')}<button data-act="logout">Выйти из аккаунта ${icon('log')}</button></div>` : ''}</header><div class="mobile-search-panel ${mobileSearch ? 'open' : ''}" id="mobile-search-panel"><input type="search" id="mobile-search-input" placeholder="Найти публикацию" value="${esc(feedFilters.search)}" aria-label="Мобильный поиск"></div>${menuOpen ? `<nav class="mobile-dropdown" aria-label="Мобильное меню">${navigation.map(([url, label]) => `<a href="${url}" data-link>${label}</a>`).join('')}${logged ? `<a href="/bookmarks" data-link>Закладки</a><a href="/my-posts" data-link>Мои публикации</a><a href="/offline" data-link>Офлайн-подборки</a><a href="/editor" data-link data-new-draft>Написать публикацию</a><button data-act="logout">Выйти из аккаунта</button>` : `<a href="/login" data-link>Войти</a><a href="/register" data-link>Зарегистрироваться</a>`}</nav>` : ''}<main id="main" class="main-container" tabindex="-1"></main><footer class="site-footer">ПОСТИК / ЕСТЬ ЧТО ОБСУДИТЬ <span>✳</span></footer><button id="back-top" class="back-top" data-act="top" title="К началу">${icon('up')}</button>`; }
function pageTitle() { return ({ home: 'Главная', feed: 'Публикации', following: 'Подписки', bookmarks: 'Закладки', mine: 'Мои публикации', offline: 'Офлайн', editor: 'Редактор', login: 'Вход', register: 'Регистрация', settings: 'Настройки', article: 'Статья', profile: 'Профиль' })[current.page] || 'Постик'; }
function renderPage() { switch (current.page) {
    case 'home': return renderHome();
    case 'feed':
    case 'following':
    case 'bookmarks':
    case 'mine': return renderFeed(current.page);
    case 'article': return renderArticle(current.id);
    case 'editor': return renderEditor();
    case 'offline': return renderLibrary();
    case 'profile': return profilePage(current.name);
    case 'settings': return settingsPage();
    case 'login':
    case 'register': return authPage(current.page);
    case 'moderation': return moderationPage();
    default: return '<div class="empty"><h1>Страница не найдена</h1><a href="/" data-link>На главную</a></div>';
} }
function pageChanged(route) { current = route; menuOpen = false; accountOpen = false; mobileSearch = false; if (route.page === 'editor' && !draft())
    newDraft(); renderAll();
    if (route.page === 'article') {
        // Подгружаем статью по прямой ссылке и увеличиваем серверный счётчик просмотров.
        // Ошибка не уничтожает каталог/локальные черновики.
        apiGetPost(route.id).then(post => {
            rememberPost(post);
            if (current.page === 'article' && String(current.id) === String(route.id)) refresh();
        }).catch(error => toast(error.message));
    }
    if (location.hash && location.hash !== '#main')
    requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView()); }
function afterPageRender() { if (current.page === 'mine') {
    const el = document.getElementById('drafts-area');
    if (el)
        el.innerHTML = draftList();
} if (current.page === 'editor')
    initializeEditor(); }
function renderAll() { document.documentElement.dataset.postikVersion = '14'; document.documentElement.classList.toggle('dark', state().theme === 'dark'); root.innerHTML = shell(); renderContent();
    const status = serverStatus();
    if (status && !document.getElementById('api-warning')) {
        document.getElementById('main').insertAdjacentHTML('afterbegin', `<p id="api-warning" class="notice" role="status">${esc(status)}</p>`);
    } }
function renderContent(preserve = false) { const main = document.getElementById('main'); if (!main)
    return; const y = window.scrollY; main.innerHTML = renderPage(); afterPageRender(); if (preserve)
    window.scrollTo(0, y); }
function refresh(preserve = true) { renderContent(preserve); }
function toast(message) { const node = document.getElementById('toast'); node.textContent = message; node.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'), 3200); }
function modal(title, body, buttons) { overlay.innerHTML = `<div class="modal-backdrop" data-act="close-modal"><div class="modal-window" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-button" data-act="close-modal" aria-label="Закрыть">${icon('close')}</button></div>${body}<div class="modal-buttons">${buttons || ''}</div></div></div>`; document.body.classList.add('modal-open'); }
function closeModal() { overlay.innerHTML = ''; document.body.classList.remove('modal-open'); modalCallback = null; }
function confirmAction(title, message, fn) { modal(title, `<p>${esc(message)}</p>`, `<button class="outline" data-act="close-modal">Отмена</button><button class="primary" data-act="modal-confirm">Подтвердить</button>`); modalCallback = fn; }
function navigateTo(href, newPost = false) { if (current.page === 'editor')
    saveCurrentDraft(); if (newPost) {
    newDraft();
} navigate(href); }
function rerenderPostActions() { if (current.page === 'article')
    refresh(true);
else if (['feed', 'following', 'bookmarks', 'mine', 'profile', 'home'].includes(current.page))
    refresh(true); }
async function handleAction(el, e) {
    const act = el.dataset.act, id = el.dataset.id, value = el.dataset.value;
    switch (act) {
        case 'menu':
            menuOpen = !menuOpen;
            accountOpen = false;
            renderAll();
            break;
        case 'account':
            if (matchMedia('(max-width:680px)').matches) {
                navigateTo('/users/' + encodeURIComponent(username(authorName())));
            }
            else {
                accountOpen = !accountOpen;
                menuOpen = false;
                renderAll();
            }
            break;
        case 'theme':
            update(s => { s.theme = s.theme === 'dark' ? 'light' : 'dark'; });
            renderAll();
            break;
        case 'toggle-search':
            mobileSearch = !mobileSearch;
            document.getElementById('mobile-search-panel').classList.toggle('open', mobileSearch);
            if (mobileSearch)
                document.getElementById('mobile-search-input').focus();
            break;
        case 'logout':
            try {
                await apiLogout();
                updateSession({ signedIn: false, user: null, name: '' });
                renderAll();
                navigateTo('/login');
                toast('Вы вышли из аккаунта');
            } catch (error) { toast(error.message); }
            break;
        case 'vote': {
            const dir = Number(el.dataset.dir);
            update(s => { s.votes[id] = Number(s.votes[id] || 0) === dir ? 0 : dir; });
            rerenderPostActions();
            break;
        }
        case 'bookmark':
            update(s => { if (s.saved.some(x => String(x) === String(id)))
                s.saved = s.saved.filter(x => String(x) !== String(id));
            else
                s.saved.push(Number(id)); });
            rerenderPostActions();
            break;
        case 'follow':
            update(s => { const name = el.dataset.name; if (s.following.includes(name))
                s.following = s.following.filter(n => n !== name);
            else
                s.following.push(name); });
            refresh();
            break;
        case 'format':
            feedFilters.mode = value;
            refresh();
            break;
        case 'sort':
            feedFilters.sort = value;
            refresh();
            break;
        case 'reset-filters':
            resetFeed();
            refresh();
            break;
        case 'top':
            window.scrollTo({ top: 0, behavior: 'smooth' });
            break;
        case 'download-post': {
            const p = postById(id);
            if (p)
                download((p.title || 'post') + '.md', `# ${p.title}\n\n${p.content || ''}`);
            break;
        }
        case 'share':
            navigator.clipboard?.writeText(location.href).then(() => toast('Ссылка скопирована')).catch(() => toast('Скопируйте адрес из строки браузера'));
            break;
        case 'offline-toggle': {
            const p = postById(id);
            const inserted = toggleOffline(p);
            toast(inserted ? 'Статья добавлена в подборку' : 'Статья удалена из подборок');
            refresh();
            break;
        }
        case 'continue':
            if (!session().signedIn) {
                navigateTo('/login');
                return;
            }
            newDraft(id);
            navigateTo('/editor');
            break;
        case 'reply': {
            const c = comments(current.id).find(x => String(x.id) === String(id));
            if (!c)
                return;
            const slot = el.closest('.comment')?.querySelector('[data-reply-slot]');
            if (slot) {
                slot.innerHTML = `<form data-form="comment" data-post="${c.post}" data-parent="${c.id}" class="reply-form"><textarea name="text" rows="2" placeholder="Ответить @${esc(c.author)}" required></textarea><div><button class="primary">Отправить</button><button class="text-btn" type="button" data-act="cancel-reply">Отмена</button></div></form>`;
                slot.querySelector('textarea').focus();
            }
            break;
        }
        case 'cancel-reply':
            el.closest('.reply-form-slot').innerHTML = '';
            break;
        case 'comment-vote': {
            const dir = Number(el.dataset.dir);
            update(s => { s.commentVotes[id] = Number(s.commentVotes[id] || 0) === dir ? 0 : dir; });
            if (overlay.innerHTML && overlay.querySelector('.thread-list')) {
                overlay.querySelector('.thread-list').innerHTML = branchHTML(current.id, overlay.dataset.root);
            }
            else
                refresh();
            break;
        }
        case 'thread': {
            const list = comments(current.id);
            const c = list.find(x => String(x.id) === String(id));
            if (c) {
                modal('Одна ветка — весь контекст', branchHTML(current.id, id));
                overlay.dataset.root = id;
            }
            break;
        }
        case 'jump-comment': {
            e.preventDefault();
            const target = document.getElementById('comment-' + id);
            if (target)
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
        }
        case 'new-draft':
            saveCurrentDraft();
            newDraft();
            navigateTo('/editor');
            break;
        case 'open-draft':
            openDraft(id);
            navigateTo('/editor');
            break;
        case 'delete-draft':
            confirmAction('Удалить черновик?', 'Это действие нельзя отменить.', () => { deleteDraft(id); refresh(); toast('Черновик удалён'); });
            break;
        case 'publish': {
            el.disabled = true;
            const result = await publishDraft();
            el.disabled = false;
            if (result.error)
                toast(result.error);
            else {
                toast('Публикация сохранена в PostgreSQL');
                navigateTo('/posts/' + result.post.id);
            }
            break;
        }
        case 'unlink-parent':
            updateCurrentDraft('parentId', null);
            refresh();
            break;
        case 'remove-cover':
            updateCurrentDraft('coverImage', null);
            refresh();
            break;
        case 'remove-topic':
            changeTopic(el.dataset.name, true);
            break;
        case 'editor-tab': {
            const cols = document.querySelector('.editor-columns');
            cols?.classList.toggle('show-preview', el.dataset.tab === 'preview');
            document.querySelectorAll('.editor-tabs button').forEach(btn => btn.classList.toggle('active', btn === el));
            break;
        }
        case 'download-snapshot': {
            const g = state().offlineCollections.find(x => String(x.id) === String(el.dataset.group));
            const item = g?.items.find(x => String(x.id) === String(id));
            if (item)
                download(item.title + '.md', snapshotMd(item));
            break;
        }
        case 'download-collection': {
            const g = state().offlineCollections.find(x => String(x.id) === String(id));
            if (g)
                download(g.title + '.md', g.items.map(snapshotMd).join('\n---\n\n'));
            break;
        }
        case 'remove-snapshot':
            confirmAction('Удалить сохранённую статью?', 'Копия будет удалена из этой подборки.', () => { update(s => { const group = s.offlineCollections.find(g => String(g.id) === String(el.dataset.group)); if (group)
                group.items = group.items.filter(x => String(x.id) !== String(id)); s.offlineCollections = s.offlineCollections.filter(x => x.items.length); }); refresh(); });
            break;
        case 'remove-collection':
            confirmAction('Удалить подборку?', 'Все локальные копии статей в ней будут удалены.', () => { update(s => { s.offlineCollections = s.offlineCollections.filter(g => String(g.id) !== String(id)); }); refresh(); });
            break;
        case 'rename-collection': {
            const g = state().offlineCollections.find(x => String(x.id) === String(id));
            if (g)
                modal('Переименовать подборку', `<form data-form="rename" data-id="${esc(g.id)}"><input name="title" value="${esc(g.title)}" maxlength="100" required><div class="modal-buttons"><button class="primary">Сохранить</button></div></form>`);
            break;
        }
        case 'reset-library':
            libraryFilters.search = '';
            libraryFilters.date = '';
            refresh();
            break;
        case 'close-modal':
            closeModal();
            break;
        case 'modal-confirm': {
            const f = modalCallback;
            closeModal();
            f?.();
            break;
        }
        default: break;
    }
}
function onClick(e) { const insert = e.target.closest('[data-insert]'); if (insert) {
    e.preventDefault();
    const area = document.getElementById('post-content');
    if (area) {
        const [before, after = ''] = insert.dataset.insert.split('|');
        const start = area.selectionStart, end = area.selectionEnd;
        area.setRangeText(before + area.value.slice(start, end) + after, start, end, 'end');
        area.dispatchEvent(new Event('input', { bubbles: true }));
        area.focus();
    }
    return;
} const link = e.target.closest('a[data-link]'); if (link && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
    e.preventDefault();
    const target = link.getAttribute('href') || '';
    if (!target.startsWith('/'))
        return;
    const newPost = link.hasAttribute('data-new-draft');
    navigateTo(target, newPost);
    return;
} const btn = e.target.closest('[data-act]'); if (btn) {
    if (btn.closest('.modal-backdrop') && btn.classList.contains('modal-backdrop') && e.target !== btn)
        return;
    e.preventDefault();
    handleAction(btn, e);
    return;
} if (accountOpen && !e.target.closest('.account-menu,.avatar-button')) {
    accountOpen = false;
    const node = document.querySelector('.account-menu');
    if (node)
        node.remove();
} if (mobileSearch && !e.target.closest('.mobile-search-panel,.mobile-search-button')) {
    const field = document.getElementById('mobile-search-input');
    if (!field?.value.trim()) {
        mobileSearch = false;
        document.getElementById('mobile-search-panel')?.classList.remove('open');
    }
} }
function onInput(e) { const el = e.target; if (el.dataset.editor) {
    if (handleEditorInput(el))
        return;
} if (el.id === 'search-input' || el.id === 'mobile-search-input') {
    feedFilters.search = el.value;
    renderContent(true);
    return;
} if (el.id === 'offline-search') {
    libraryFilters.search = el.value;
    refresh();
    document.getElementById('offline-search')?.focus();
    return;
} if (el.id === 'offline-date') {
    libraryFilters.date = el.value;
    refresh();
    return;
} if (el.matches('.comment-form textarea'))
    resize(el); }
function onChange(e) { const el = e.target; if (el.dataset.filter) {
    feedFilters[el.dataset.filter] = el.value;
    refresh();
    return;
} if (el.id === 'add-topic') {
    changeTopic(el.value);
    return;
} if (el.id === 'cover-upload' && el.files?.[0]) {
    const file = el.files[0];
    if (file.size > 5 * 1024 * 1024) {
        toast('Обложка больше 5 МБ');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => { updateCurrentDraft('coverImage', String(reader.result)); refresh(); };
    reader.readAsDataURL(file);
    return;
} if (el.id === 'inline-image-import' && el.files?.[0]) {
    const file = el.files[0];
    if (file.size > 2 * 1024 * 1024) {
        toast('В демо встроенное изображение должно быть меньше 2 МБ');
        return;
    }
    const reader = new FileReader();
    reader.onload = () => { const area = document.getElementById('post-content'); if (!area)
        return; const snippet = '\n![Изображение](' + String(reader.result) + ')\n'; area.setRangeText(snippet, area.selectionStart, area.selectionEnd, 'end'); area.dispatchEvent(new Event('input', { bubbles: true })); toast('Изображение вставлено в Markdown'); };
    reader.readAsDataURL(file);
    return;
} if (el.id === 'markdown-import' && el.files?.[0]) {
    el.files[0].text().then(text => { updateCurrentDraft('content', text); refresh(); toast('Markdown импортирован'); });
    return;
} if (el.dataset.interest) {
    const name = el.dataset.interest;
    update(s => { if (el.checked && !s.interests.includes(name))
        s.interests.push(name); if (!el.checked)
        s.interests = s.interests.filter(t => t !== name); });
    return;
} }
async function onSubmit(e) {
    const form = e.target.closest('form[data-form]');
    if (!form)
        return;
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    switch (form.dataset.form) {
        case 'comment': {
            if (!session().signedIn) {
                navigateTo('/login');
                return;
            }
            if (!String(data.text || '').trim())
                return;
            update(s => s.customComments.push({ id: Date.now(), post: Number(form.dataset.post), parent: form.dataset.parent ? Number(form.dataset.parent) : null, author: authorName(), initials: authorName().slice(0, 1), text: String(data.text).trim(), score: 0, age: 'Только что' }));
            if (overlay.querySelector('.thread-list')) {
                const rootId = overlay.dataset.root;
                overlay.querySelector('.thread-list').innerHTML = branchHTML(current.id, rootId);
            }
            else
                refresh();
            toast('Комментарий добавлен локально');
            break;
        }
        case 'auth': {
            // Вместо демо-флага вызываем FastAPI. JWT не получаем в JS:
            // сервер отдаёт его через Set-Cookie (HttpOnly), fetch включает cookie автоматически.
            const reg = form.dataset.mode === 'register';
            const errorNode = document.getElementById('auth-error');
            if (reg && data.password !== data.confirm) {
                errorNode.textContent = 'Пароли не совпадают';
                return;
            }
            const submit = form.querySelector('button[type="submit"],button.primary');
            submit.disabled = true;
            errorNode.textContent = '';
            try {
                const user = reg
                    ? await apiRegister({username: String(data.username), email: String(data.email), password: String(data.password)})
                    : await apiLogin({email: String(data.email), password: String(data.password)});
                setRemoteProfile(user);
                renderAll();
                navigateTo('/');
                toast(reg ? 'Аккаунт создан' : 'Вход выполнен');
            } catch (error) {
                errorNode.textContent = error.message || 'Ошибка авторизации';
            } finally { submit.disabled = false; }
            break;
        }
        case 'profile': {
            try {
                const user = await apiUpdateProfile({
                    username: String(data.displayName).trim(), bio: String(data.bio || ''),
                    city: String(data.city || ''), other_site: String(data.other_site || ''),
                });
                setRemoteProfile(user);
                toast('Профиль обновлён на сервере');
                navigateTo('/users/' + encodeURIComponent(user.username));
                renderAll();
            } catch (error) { toast(error.message); }
            break;
        }
        case 'rename': {
            update(s => { const group = s.offlineCollections.find(g => String(g.id) === String(form.dataset.id)); if (group)
                group.title = String(data.title).trim(); });
            closeModal();
            refresh();
            toast('Подборка переименована');
            break;
        }
        case 'topic': {
            update(s => { s.extraTopics = [...new Set([...(s.extraTopics || []), String(data.topic).trim()])]; });
            refresh();
            break;
        }
    }
}
function onKey(e) { if (e.key === 'Escape') {
    if (overlay.innerHTML) {
        closeModal();
        return;
    }
    if (menuOpen || accountOpen || mobileSearch) {
        menuOpen = false;
        accountOpen = false;
        mobileSearch = false;
        renderAll();
    }
} if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    const input = document.getElementById('search-input');
    input?.focus();
} }
export function launch() { document.addEventListener('click', onClick); document.addEventListener('input', onInput); document.addEventListener('change', onChange); document.addEventListener('submit', onSubmit); document.addEventListener('keydown', onKey); window.addEventListener('scroll', () => { document.getElementById('back-top')?.classList.toggle('visible', window.scrollY > 500); }); startRouter(pageChanged); }
