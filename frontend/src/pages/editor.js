import { publishPost } from '../api/posts.js';
import { state, session, authorName, posts, topics, postById, addDraft, deleteDraft, update, topicId, rememberPost } from '../store.js';
import { esc, icon, safeImage } from '../shared/html.js';
import { markdownToHtml } from '../shared/markdown.js';
let current = null;
const blank = () => ({ id: 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), kind: 'article', title: '', excerpt: '', content: '', tags: [], topics: [topics()[0]], parentId: null, coverImage: null });
export function newDraft(parentId = null) { current = blank(); if (parentId) {
    const p = postById(parentId);
    if (p) {
        current.parentId = p.id;
        current.title = 'Продолжение: ' + p.title;
        current.topics = [p.topic];
        current.content = `> Продолжение материала «${p.title}», автор: ${p.author}.\n\n## Мой взгляд\n`;
    }
} return current; }
export function openDraft(id) { const rec = state().localDrafts.find(d => String(d.id) === String(id)); current = rec ? { ...rec.data, id: rec.id } : blank(); return current; }
export function draft() { return current || newDraft(); }
export function clearDraft() { current = null; }
function sanitize(d) { return { ...d, topics: [...new Set(d.topics || [])], tags: Array.isArray(d.tags) ? d.tags : String(d.tags || '').split(',').map(s => s.trim()).filter(Boolean) }; }
export function saveCurrentDraft() { if (!current)
    return; const d = sanitize(current); if ([d.title, d.content, d.excerpt, d.coverImage].some(Boolean))
    addDraft(d); }
export function updateCurrentDraft(key, value) { draft()[key] = value; saveCurrentDraft(); }
export function preview() { const d = draft(), parent = postById(d.parentId); return `<article class="preview-paper prose"><span class="eyebrow">ПРЕДПРОСМОТР / ${d.kind === 'post' ? 'Пост' : d.kind === 'blog' ? 'Блог' : 'Статья'}</span><h1>${esc(d.title || 'Здесь будет заголовок')}</h1><p class="article-lead">${esc(d.excerpt || 'Краткое описание появится здесь.')}</p><div class="tags">${(d.topics || []).map(t => `<span>${esc(t)}</span>`).join('')}${(d.tags || []).map(t => `<span>#${esc(t)}</span>`).join('')}</div>${parent ? `<blockquote>Продолжение материала «${esc(parent.title)}», автор: ${esc(parent.author)}.</blockquote>` : ''}${d.coverImage ? `<img class="preview-cover" src="${safeImage(d.coverImage)}" alt="Обложка">` : ''}${markdownToHtml(d.content || '## С чего начнём?')}</article>`; }
export function renderEditor() { const d = draft(); const ownPosts = posts().filter(p => Number(p.author_id) === Number(session().user?.id) && String(p.id) !== String(d.id)); return `<div class="editor-page"><div class="editor-top"><div><span class="eyebrow">ВАША ИСТОРИЯ</span><h1>Редактор</h1><small>Черновик хранится на этом устройстве</small></div><div class="editor-top-actions"><button class="outline" data-act="new-draft">Новый черновик</button><a href="/my-posts" data-link class="icon-button" aria-label="Закрыть редактор">${icon('close')}</a></div></div><div class="editor-actionbar"><div class="tabs editor-tabs"><button data-act="editor-tab" data-tab="edit" class="active">Редактор</button><button data-act="editor-tab" data-tab="preview">Предпросмотр</button></div><button class="primary" data-act="publish">Опубликовать ↗</button></div><div class="editor-columns"><div class="editor-form"><div class="field-set"><label for="post-kind">Формат публикации</label><select id="post-kind" data-editor="kind"><option value="article" ${d.kind === 'article' ? 'selected' : ''}>Статья — подробный материал</option><option value="post" ${d.kind === 'post' ? 'selected' : ''}>Пост — короткая мысль</option><option value="blog" ${d.kind === 'blog' ? 'selected' : ''}>Блог — личная история</option></select><p class="field-help">Статья подходит для подробного текста, пост — для короткой мысли, блог — для личной истории.</p></div><div class="field-set"><label for="post-parent">Продолжение публикации (необязательно)</label><select id="post-parent" data-editor="parentId"><option value="">Самостоятельная публикация</option>${ownPosts.map(p => `<option value="${p.id}" ${String(d.parentId) === String(p.id) ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select>${d.parentId ? `<button class="text-btn" data-act="unlink-parent">Отменить продолжение</button>` : ''}</div><div class="field-set"><label class="cover-upload">${icon('file')} ${d.coverImage ? 'Заменить обложку' : 'Добавить обложку'}<input id="cover-upload" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>${d.coverImage ? `<img class="cover-thumb" src="${safeImage(d.coverImage)}" alt="Текущая обложка"><button class="text-btn" data-act="remove-cover">Удалить обложку</button>` : ''}<small>JPEG, PNG, WebP / до 5 МБ в демо</small></div><label class="sr-only" for="post-title">Заголовок</label><textarea id="post-title" class="title-input autoheight" data-editor="title" rows="2" maxlength="200" placeholder="Начните с заголовка">${esc(d.title)}</textarea><div class="field-set"><label>Темы публикации (от 1 до 3)</label><div id="selected-topics" class="selected-topics">${(d.topics || []).map(t => `<button class="topic-chip" data-act="remove-topic" data-name="${esc(t)}">${esc(t)} ×</button>`).join('')}</div><select id="add-topic"><option value="">+ Добавить тему</option>${topics().filter(t => !(d.topics || []).includes(t)).map(t => `<option>${esc(t)}</option>`).join('')}</select></div><div class="field-set"><label for="post-summary">Коротко о главном</label><textarea id="post-summary" class="autoheight" rows="2" maxlength="500" data-editor="excerpt" placeholder="Заинтересуйте читателя в двух предложениях">${esc(d.excerpt)}</textarea></div><div class="field-set"><label for="post-tags">Теги (через запятую)</label><input id="post-tags" data-editor="tags" value="${esc((d.tags || []).join(', '))}" placeholder="Linux, личный опыт, сервер"></div><div class="format-toolbar"><button data-insert="**|**" title="Жирный"><b>B</b></button><button data-insert="*|*" title="Курсив"><i>I</i></button><button data-insert="## |" title="Заголовок">H2</button><button data-insert="### |" title="Подзаголовок">H3</button><button data-insert="- |" title="Список">≡</button><button data-insert="> |" title="Цитата">❞</button><label class="import-file" title="Вставить изображение">${icon('plus')} Изображение<input id="inline-image-import" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><label class="import-file">${icon('up')} .md<input id="markdown-import" type="file" accept=".md,.markdown,text/markdown,text/plain" hidden></label></div><label class="sr-only" for="post-content">Текст статьи</label><textarea id="post-content" data-editor="content" class="content-input autoheight" rows="15" placeholder="Расскажите, что вас увлекает…">${esc(d.content)}</textarea><div class="editor-hint"><span id="word-count">${String(d.content || '').trim().split(/\s+/).filter(Boolean).length} слов</span><span>Поддерживается Markdown</span></div></div><div class="preview-area" id="preview-area">${preview()}</div></div></div>`; }
export function initializeEditor() { document.querySelectorAll('.autoheight').forEach(el => resize(el)); }
export function resize(el) { if (!(el instanceof HTMLTextAreaElement))
    return; el.style.height = 'auto'; el.style.height = Math.max(el.id === 'post-content' ? 240 : 40, el.scrollHeight) + 'px'; }
export function handleEditorInput(el) { const key = el.dataset.editor; if (!key)
    return false; const value = key === 'parentId' ? (el.value ? Number(el.value) : null) : key === 'tags' ? el.value.split(',').map(s => s.trim()).filter(Boolean) : el.value; updateCurrentDraft(key, value); if (key === 'content') {
    const counter = document.getElementById('word-count');
    if (counter)
        counter.textContent = String(value || '').trim().split(/\s+/).filter(Boolean).length + ' слов';
} if (el.matches('textarea'))
    resize(el); const pane = document.getElementById('preview-area'); if (pane)
    pane.innerHTML = preview(); return true; }
export function changeTopic(name, remove = false) { if (!name)
    return; const selected = draft().topics || []; draft().topics = remove ? selected.filter(t => t !== name) : [...new Set([...selected, name])].slice(0, 3); saveCurrentDraft(); const chips = document.getElementById('selected-topics'); if (chips)
    chips.innerHTML = draft().topics.map(t => `<button class="topic-chip" data-act="remove-topic" data-name="${esc(t)}">${esc(t)} ×</button>`).join(''); const select = document.getElementById('add-topic'); if (select)
    select.innerHTML = `<option value="">+ Добавить тему</option>${topics().filter(t => !draft().topics.includes(t)).map(t => `<option>${esc(t)}</option>`).join('')}`; const pane = document.getElementById('preview-area'); if (pane)
    pane.innerHTML = preview(); }
export async function publishDraft() {
    // Черновик остаётся локальным ДО успешного ответа сервера. При ошибке данные не теряются.
    const d = sanitize(draft());
    if (!session().signedIn) return {error:'Для публикации нужно войти в аккаунт.'};
    if (d.title.trim().length < 3 || !d.content.trim() || !d.topics.length)
        return {error:'Добавь заголовок, тему и текст статьи.'};
    const ids = d.topics.map(topicId);
    if (ids.some(id => !id)) return {error:'Одна из тем отсутствует на сервере'};
    if (d.coverImage?.startsWith('data:'))
        return {error:'Загрузка файлов на сервер пока не поддерживается. Удали локальную обложку (текст и черновик сохранятся).'};
    try {
        const posted = await publishPost({
            title:d.title.trim(), summary:d.excerpt || null, content_md:d.content,
            format:d.kind, cover_url:d.coverImage || null, topic_ids:ids,
            tag_names:d.tags, parent_id:d.parentId ? Number(d.parentId) : null,
        });
        const post = rememberPost(posted);
        deleteDraft(d.id);
        current = null;
        return {post};
    } catch (e) { return {error:e.message || 'Не удалось опубликовать'}; }
}
export function draftList() { const drafts = [...state().localDrafts].sort((a, b) => b.updated - a.updated); return `<section class="drafts"><div class="section-head"><div><span class="eyebrow">СОХРАНЕНЫ В БРАУЗЕРЕ</span><h2>Черновики <small>${drafts.length}</small></h2></div><button class="outline" data-act="new-draft">+ Новый черновик</button></div>${drafts.map(d => `<div class="draft-row"><button data-act="open-draft" data-id="${esc(d.id)}"><strong>${esc(d.data.title || 'Без названия')}</strong><small>${esc((d.data.excerpt || d.data.content || 'Пустой черновик').slice(0, 130))}</small></button><button data-act="delete-draft" data-id="${esc(d.id)}" aria-label="Удалить черновик">×</button></div>`).join('') || '<p class="muted">Черновиков пока нет.</p>'}<p class="notice">Черновики хранятся только в этом браузере и не синхронизируются с сервером.</p><h2>Опубликованные</h2></section>`; }
