// static/js/single_post.js
const postId = window.location.pathname.split('/').pop();

$(function () {
    if (!postId || isNaN(postId)) {
        $('#postContainer').html('<p>Некорректный ID поста</p>').show();
        $('#postLoading').hide();
        return;
    }

    $.getJSON(`/posts/api/posts/${postId}`)
        .done(function (post) {
            renderPost(post);
            $('#postLoading').hide();   // <-- скрываем индикатор
        })
        .fail(function () {
            $('#postContainer').html('<p>Статья не найдена</p>').show();
            $('#postLoading').hide();
        });

    function renderPost(post) {
        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
        function formatDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) +
                ' · ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }

        const likeActive = post.user_vote === 1 ? 'active-like' : '';
        const dislikeActive = post.user_vote === -1 ? 'active-dislike' : '';

        const html = `
            <header class="post-full__header">
                <div class="post-full__author-info">
                    <div class="post-full__author">
                        <span class="post-full__author-link">${escapeHtml(post.author)}</span>
                    </div>
                    <div class="post-full__date">${formatDate(post.published_at || post.created_at)}</div>
                </div>
                <h1 class="post-full__title">${escapeHtml(post.title)}</h1>
                <div class="post-full__meta">
                    <div class="post-full__time-to-read">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>~${Math.ceil((post.content_md || '').length / 1000)} мин чтения</span>
                    </div>
                    <div class="post-full__views">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>${post.views_count} просмотров</span>
                    </div>
                </div>
                <div class="post-full__tags">
                    ${post.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                </div>
            </header>
            <div class="post-full__content">
                ${post.cover_image ? `<img src="${escapeHtml(post.cover_image)}" alt="Обложка" class="post-full__cover">` : ''}
                <div class="markdown-body"></div>
            </div>
            <div class="post-full__actions">
                <button class="button-like ${likeActive}" data-post-id="${post.id}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
                    <span>${post.likes}</span>
                </button>
                <button class="button-dislike ${dislikeActive}" data-post-id="${post.id}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2h-5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM7 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg>
                    <span>${post.dislikes}</span>
                </button>
                ${window.isAuthor ? '<button id="deletePostBtn" class="btn-danger btn-sm">Удалить</button>' : ''}
            </div>
        `;
        $('#postContainer').html(html).show();

        if (typeof marked !== 'undefined') {
            $('.markdown-body').html(marked.parse(post.content_md || ''));
        }

        attachPostEvents(post.id);
    }

    function attachPostEvents(postId) {
        // Лайк / дизлайк с обновлением классов
        $(document).on('click', '.button-like, .button-dislike', function (e) {
            e.preventDefault();
            const $btn = $(this);
            const value = $btn.hasClass('button-like') ? 1 : -1;
            $.ajax({
                url: `/posts/api/posts/${postId}/vote`,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ value: value }),
                success: function (data) {
                    // Обновляем счётчики
                    $('.button-like span').text(data.likes);
                    $('.button-dislike span').text(data.dislikes);
                    // Обновляем активные классы (снимаем все, ставим нужный)
                    $('.button-like, .button-dislike').removeClass('active-like active-dislike');
                    if (data.likes !== undefined) {
                        // Сервер не возвращает user_vote при голосовании, поэтому запросим пост заново,
                        // но можно переключить визуально, зная что кнопка была нажата.
                        // Простейший способ: перезагрузить пост через API, но это лишний запрос.
                        // Вместо этого просто подсветим нажатую кнопку.
                        if (value === 1) {
                            $('.button-like').addClass('active-like');
                        } else {
                            $('.button-dislike').addClass('active-dislike');
                        }
                    }
                }
            });
        });

        $(document).on('click', '#deletePostBtn', function () {
            if (!confirm('Удалить пост безвозвратно?')) return;
            $.ajax({
                url: `/posts/api/posts/${postId}`,
                method: 'DELETE',
                success: function () {
                    window.location.href = '/posts/my';
                },
                error: function () {
                    window.notifications && window.notifications.error('Ошибка удаления');
                }
            });
        });
    }
});