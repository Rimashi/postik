$(function () {
    const $container = $('#postsContainer');
    const currentFilters = {
        sort: 'recent',
        tags: [],
        period: 'all'
    };

    // Загрузка постов с сервера
    function loadPosts() {
        const params = {
            sort: currentFilters.sort,
            period: currentFilters.period
        };
        if (currentFilters.tags.length > 0) {
            // Массив тегов будет передан как повторяющиеся параметры tag=тег1&tag=тег2
            params.tag = currentFilters.tags;
        }
        $.ajax({
            url: '/posts/api/feed',
            data: params,
            traditional: true,  // отключаем [] в имени параметра
            dataType: 'json',
            success: function (posts) {
                renderPosts(posts);
            },
            error: function () {
                $container.html('<p class="no-articles">Ошибка загрузки постов</p>');
            }
        });
    }
    // Отрисовка сетки постов
    function renderPosts(posts) {
        if (!posts.length) {
            $container.html('<p class="no-articles">Пока нет опубликованных статей.</p>');
            return;
        }

        const html = posts.map(post => {
            const readTime = post.content_length ? Math.ceil(post.content_length / 1000) : 1;
            return `
            <article class="post" data-href="/posts/${post.id}">
                <div class="post__header">
                    <div class="post__upload_section">
                        <div class="post__author">
                            <a href="#to_person" class="author__link">${escapeHtml(post.author)}</a>
                        </div>
                        <div class="post__time">
                            <p class="time__upload">${formatDate(post.published_at || post.created_at)}</p>
                        </div>
                    </div>
                    <div class="post__name">
                        <h3 class="post__title">${escapeHtml(post.title)}</h3>
                    </div>
                    <div class="post__meta_section">
                        <div class="meta_section__upside">
                            <div class="post__time_to_read">
                                <span class="time__icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                </span>
                                <p class="read_time">~${readTime} мин</p>
                            </div>
                            <div class="post__views">
                                <span class="views__icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                </span>
                                <p class="views">${post.views_count}</p>
                            </div>
                        </div>
                        <div class="meta_section__downside">
                            <div class="tags">
                                ${post.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="post__body">
                    ${post.cover_image ? `<div class="post__image"><img src="${escapeHtml(post.cover_image)}" alt=""></div>` : ''}
                    <div class="post__description">
                        <p>${escapeHtml(post.excerpt || '')}</p>
                    </div>
                </div>
                <div class="post__footer">
                    <div class="post__buttons">
                        <button class="button-like" type="button" data-post-id="${post.id}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                            </svg>
                            <span>${post.likes || 0}</span>
                        </button>
                        <button class="button-dislike" type="button" data-post-id="${post.id}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2h-5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM7 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
                            </svg>
                            <span>${post.dislikes || 0}</span>
                        </button>
                    </div>
                </div>
            </article>
            `;
        }).join('');

        $container.html(html);
        attachFeedEvents();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return $('<div>').text(str).html();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) +
            ' · ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    function attachFeedEvents() {
        // Клик по карточке – переход к посту
        $('.post').off('click').on('click', function (e) {
            if ($(e.target).closest('.button-like, .button-dislike, .tag, .filter-tag').length) return;
            const href = $(this).data('href');
            if (href) window.location.href = href;
        });

        // Голосование
        $('.button-like, .button-dislike').off('click').on('click', function (e) {
            e.stopPropagation();
            const $btn = $(this);
            const postId = $btn.data('post-id');
            const value = $btn.hasClass('button-like') ? 1 : -1;
            $.ajax({
                url: `/posts/api/posts/${postId}/vote`,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ value: value }),
                success: function (data) {
                    $btn.closest('.post__buttons')
                        .find('.button-like span').text(data.likes)
                        .end()
                        .find('.button-dislike span').text(data.dislikes);
                }
            });
        });
    }

    // Обработчики фильтров
    $('#sortSelect').on('change', function () {
        currentFilters.sort = this.value;
        loadPosts();
    });

    // Множественный выбор тегов
    $('#tagsFilter').on('click', '.filter-tag', function () {
        const tag = $(this).data('tag');
        const index = currentFilters.tags.indexOf(tag);
        if (index === -1) {
            currentFilters.tags.push(tag);
            $(this).addClass('active');
        } else {
            currentFilters.tags.splice(index, 1);
            $(this).removeClass('active');
        }
        loadPosts();
    });

    $('input[name="period"]').on('change', function () {
        currentFilters.period = this.value;
        loadPosts();
    });

    $('#resetFilters').on('click', function () {
        currentFilters.sort = 'recent';
        currentFilters.tags = [];
        currentFilters.period = 'all';
        $('#sortSelect').val('recent');
        $('input[name="period"][value="all"]').prop('checked', true);
        $('#tagsFilter .filter-tag').removeClass('active');
        loadPosts();
    });

    // Загружаем теги для фильтра
    $.getJSON('/posts/api/tags')
        .done(function (tags) {
            const $tagsContainer = $('#tagsFilter').empty();
            tags.forEach(tag => {
                $tagsContainer.append(`<button class="filter-tag" data-tag="${tag}">${tag}</button>`);
            });
        })
        .fail(function () {
            $('#tagsFilter').html('<span class="text-muted">Нет тегов</span>');
        });

    // Первоначальная загрузка
    loadPosts();
});