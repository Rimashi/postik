$(function() {
    const $container = $('#postsContainer');
    let allPosts = [];

    function loadPosts() {
        $.getJSON('/posts/api/my', function(posts) {
            allPosts = posts;
            renderPosts();
        });
    }

    $('#statusFilter').on('change', renderPosts);

    function renderPosts() {
        const status = $('#statusFilter').val();
        const filtered = status === 'all' ? allPosts : allPosts.filter(p => p.status === status);
        $container.empty();
        filtered.forEach(post => {
            const item = $(`
                <div class="post-item" data-id="${post.id}">
                    <div class="post-item__info">
                        <h3>${escapeHtml(post.title)}</h3>
                        <p>${post.status === 'draft' ? 'Черновик' : post.status === 'published' ? 'Опубликовано' : 'На проверке'} — ${new Date(post.created_at).toLocaleDateString()}</p>
                    </div>
                    <div class="post-item__actions">
                        <button class="btn-sm btn-edit" data-id="${post.id}">Редактировать</button>
                        <button class="btn-sm btn-stats" data-id="${post.id}">Статистика</button>
                        <button class="btn-sm btn-delete" data-id="${post.id}">Удалить</button>
                    </div>
                </div>
            `);
            $container.append(item);
        });
    }

    $container.on('click', '.btn-edit', function() {
        const id = $(this).data('id');
        window.location.href = '/posts/create?id=' + id;
    });

    $container.on('click', '.btn-stats', function() {
        const id = $(this).data('id');
        $.get('/posts/api/posts/' + id + '/stats', data => {
            $('#statsContent').html(`
                <p>Просмотры: ${data.views}</p>
                <p>Лайки: ${data.likes}</p>
                <p>Дизлайки: ${data.dislikes}</p>
                <p>Сохранения: ${data.saves}</p>
                <p>Комментарии: ${data.comments}</p>
            `);
            $('#statsModal').addClass('active');
        });
    });

    $('#statsModal .modal__close').on('click', () => $('#statsModal').removeClass('active'));
    // ... удаление аналогично

    function escapeHtml(str) {
        return $('<div>').text(str).html();
    }

    loadPosts();
});