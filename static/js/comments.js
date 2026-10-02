const COMMENT_NEST_LIMIT = 5;

class CommentsTree {

    constructor(containerSelector) {
        this.$container = $(containerSelector);
        this.comments = [];
        this.openThreads = new Set();
        this.activeThreadId = null;
        this.activeThreadComment = null;   // сохраняем сам объект комментария
        this.loadComments();
    }

    async loadComments() {
        const res = await fetch(`/posts/api/posts/${POST_ID}/comments`);
        this.comments = await res.json();
        this.render(this.comments);
        this.restoreOpenThreads();

        // Если была открыта модалка, перерисовываем её
        if (this.activeThreadId) {
            this.refreshActiveThreadModal();
        }
    }

    render(comments) {
        this.$container.html(`
            <div class="comments-tree">
                ${comments.map(c => this.renderNode(c, 0)).join("")}
            </div>
        `);
        this.attachEvents();
    }

    renderNode(comment, level) {
        const hasChildren = comment.children?.length > 0;
        const shouldOpenInModal = level >= COMMENT_NEST_LIMIT;
        const replyCount = this.countReplies(comment);
        const likeActive = comment.user_vote === 1 ? "active-like" : "";
        const dislikeActive = comment.user_vote === -1 ? "active-dislike" : "";

        if (level >= COMMENT_NEST_LIMIT) {
            return `
                <button class="comment__toggle"
                        data-open-thread="${comment.id}">
                    Показать ветку →
                </button>
            `;
        }

        return `
            <div class="comment-node">
                <div class="comment comment--level-${level}">
                    <div class="comment__header">
                        <div class="comment__avatar">
                            ${comment.author[0].toUpperCase()}
                        </div>
                        <div>
                            <div class="comment__author">
                                ${comment.author}
                                ${comment.is_pinned ? `<span>📌</span>` : ""}
                            </div>
                            <div class="comment__date">
                                ${this.formatDate(comment.created_at)}
                            </div>
                        </div>
                    </div>
                    <div class="comment__text">
                        ${this.escapeHtml(comment.text)}
                    </div>
                    <div class="comment__actions">
                        <button class="comment-vote-btn ${likeActive}"
                                data-comment-vote="${comment.id}"
                                data-value="1">
                            👍 ${comment.likes}
                        </button>
                        <button class="comment-vote-btn ${dislikeActive}"
                                data-comment-vote="${comment.id}"
                                data-value="-1">
                            👎 ${comment.dislikes}
                        </button>
                        ${window.isAuthenticated ? `
                            <button class="comment__reply-btn">
                                Ответить
                            </button>
                        ` : ""}
                    </div>
                    ${window.isAuthenticated ? `
                        <div class="comment__reply-form">
                            <textarea placeholder="Ваш ответ..."></textarea>
                            <div class="comment__reply-buttons">
                                <button class="comment__submit"
                                        data-parent-id="${comment.id}">
                                    Ответить
                                </button>
                                <button class="comment__cancel">
                                    Отмена
                                </button>
                            </div>
                        </div>
                    ` : ""}
                    ${hasChildren ? `
                        <button class="comment__toggle"
                                data-comment-id="${comment.id}"
                                ${shouldOpenInModal ? `data-open-thread="${comment.id}"` : ""}>
                            ${replyCount > 0
                                ? `Ответы (${replyCount})`
                                : "Показать ответы"}
                        </button>
                        <button class="comment__hide-thread" data-hide-thread="${comment.id}">
                            Скрыть ветку
                        </button>
                    ` : ""}
                </div>
                ${hasChildren && !shouldOpenInModal ? `
                    <div class="comment-node__children ${this.openThreads.has(comment.id) ? "" : "hidden"}">
                        ${comment.children.map(c =>
                            this.renderNode(c, level + 1)
                        ).join("")}
                    </div>
                ` : ""}
            </div>
        `;
    }

    countReplies(comment) {
        let count = 0;
        function walk(node) {
            if (!node.children) return;
            for (const c of node.children) {
                count++;
                walk(c);
            }
        }
        walk(comment);
        return count;
    }

    attachEvents() {
        $(document).off("click.comments");

        // toggle replies
        $(document).on("click.comments", ".comment__toggle:not([data-open-thread])", (e) => {
            const $btn = $(e.currentTarget);
            const id = Number($btn.data("comment-id"));
            const $children = $btn.closest(".comment-node")
                .find("> .comment-node__children");
            $children.toggleClass("hidden");
            if ($children.hasClass("hidden")) {
                this.openThreads.delete(id);
            } else {
                this.openThreads.add(id);
            }
        });

        // reply form
        $(document).on("click.comments", ".comment__reply-btn", function () {
            $(this).closest(".comment")
                .find(".comment__reply-form")
                .toggleClass("active");
        });

        $(document).on("click.comments", ".comment__cancel", function () {
            $(this).closest(".comment__reply-form")
                .removeClass("active");
        });

        $(document).on("click.comments", ".comment__hide-thread", (e) => {
            const id = Number($(e.currentTarget).data("hide-thread"));
            const $node = $(`[data-comment-id="${id}"]`)
                .closest(".comment-node");
            $node.find("> .comment-node__children").addClass("hidden");
            this.openThreads.delete(id);
        });

        // root comment
        $("#send-root-comment-btn")
            .off("click.comments")
            .on("click.comments", async () => {
                const text = $("#root-comment-input").val().trim();
                if (!text) return;
                await this.sendComment(text);
                $("#root-comment-input").val("");
                await this.loadComments();
            });

        // reply submit
        $(document).on("click.comments", ".comment__submit", async (e) => {
            const parentId = $(e.currentTarget).data("parent-id");
            const text = $(e.currentTarget)
                .closest(".comment__reply-form")
                .find("textarea")
                .val()
                .trim();
            if (!text) return;
            await this.sendComment(text, parentId);
            await this.loadComments();
        });

        // votes
        $(document).on("click.comments", ".comment-vote-btn", async (e) => {
            const id = $(e.currentTarget).data("comment-vote");
            const value = $(e.currentTarget).data("value");
            await fetch(`/posts/api/comments/${id}/vote`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ value })
            });
            await this.loadComments();
        });

        // open modal thread
        $(document).on("click.comments", "[data-open-thread]", (e) => {
            const id = Number($(e.currentTarget).data("open-thread"));
            this.openThreadModal(id);
        });
    }

    // ===== МОДАЛКА =====
    openThreadModal(commentId) {
        const comment = this.findCommentById(commentId);
        if (!comment) return;

        this.activeThreadId = commentId;
        this.activeThreadComment = comment;   // сохраняем объект

        window.openModal("commentThread", {
            id: commentId,
            comment: comment
        });

        setTimeout(() => {
            this.renderThreadModal(comment);
            this.attachThreadModalEvents();
        }, 50);
    }

    // Новый метод: перерисовать содержимое модалки, если она открыта
    refreshActiveThreadModal() {
        if (!this.activeThreadId) return;
        const comment = this.findCommentById(this.activeThreadId);
        if (!comment) return;
        this.activeThreadComment = comment;
        this.renderThreadModal(comment);
        this.attachThreadModalEvents();
    }

    renderThreadModal(comment) {
        const $modal = $(".modal__background.active");
        if (!$modal.length) return;

        const $parent = $modal.find(".comment-thread-parent-modal");
        $parent.html(`
            <div class="comment comment--modal-parent">
                <div class="comment__header">
                    <div class="comment__avatar">
                        ${comment.author[0].toUpperCase()}
                    </div>
                    <div>
                        <div class="comment__author">${comment.author}</div>
                        <div class="comment__date">${this.formatDate(comment.created_at)}</div>
                    </div>
                </div>
                <div class="comment__text">${this.escapeHtml(comment.text)}</div>
                <div class="comment__actions">
                    <button class="comment-vote-btn ${comment.user_vote === 1 ? 'active-like' : ''}" data-comment-vote="${comment.id}" data-value="1">
                        👍 ${comment.likes}
                    </button>
                    <button class="comment-vote-btn ${comment.user_vote === -1 ? 'active-dislike' : ''}" data-comment-vote="${comment.id}" data-value="-1">
                        👎 ${comment.dislikes}
                    </button>
                </div>
            </div>
        `);

        const $children = $modal.find(".comment-thread-children");
        if (comment.children && comment.children.length > 0) {
            $children.html(`
                <div class="comments-tree">
                    ${comment.children.map(c => this.renderNodeInModal(c, 0)).join("")}
                </div>
            `);
        } else {
            $children.html("<p class='comment-thread-empty'>Нет ответов</p>");
        }
    }

    renderNodeInModal(comment, level) {
        const hasChildren = comment.children?.length > 0;
        const shouldOpenInModal = level >= COMMENT_NEST_LIMIT;
        const replyCount = this.countReplies(comment);
        const likeActive = comment.user_vote === 1 ? "active-like" : "";
        const dislikeActive = comment.user_vote === -1 ? "active-dislike" : "";

        if (level >= COMMENT_NEST_LIMIT) {
            return `
                <button class="comment__toggle"
                        data-open-thread="${comment.id}">
                    Показать ветку →
                </button>
            `;
        }

        return `
            <div class="comment-node">
                <div class="comment comment--level-${level}">
                    <div class="comment__header">
                        <div class="comment__avatar">${comment.author[0].toUpperCase()}</div>
                        <div>
                            <div class="comment__author">
                                ${comment.author}
                                ${comment.is_pinned ? `<span>📌</span>` : ""}
                            </div>
                            <div class="comment__date">${this.formatDate(comment.created_at)}</div>
                        </div>
                    </div>
                    <div class="comment__text">${this.escapeHtml(comment.text)}</div>
                    <div class="comment__actions">
                        <button class="comment-vote-btn ${likeActive}"
                                data-comment-vote="${comment.id}"
                                data-value="1">
                            👍 ${comment.likes}
                        </button>
                        <button class="comment-vote-btn ${dislikeActive}"
                                data-comment-vote="${comment.id}"
                                data-value="-1">
                            👎 ${comment.dislikes}
                        </button>
                        ${window.isAuthenticated ? `
                            <button class="comment__reply-btn">Ответить</button>
                        ` : ""}
                    </div>
                    ${window.isAuthenticated ? `
                        <div class="comment__reply-form">
                            <textarea placeholder="Ваш ответ..."></textarea>
                            <div class="comment__reply-buttons">
                                <button class="comment__submit" data-parent-id="${comment.id}">Ответить</button>
                                <button class="comment__cancel">Отмена</button>
                            </div>
                        </div>
                    ` : ""}
                    ${hasChildren ? `
                        <button class="comment__toggle"
                                data-comment-id="${comment.id}"
                                ${shouldOpenInModal ? `data-open-thread="${comment.id}"` : ""}>
                            ${replyCount > 0 ? `Ответы (${replyCount})` : "Показать ответы"}
                        </button>
                        <button class="comment__hide-thread" data-hide-thread="${comment.id}">Скрыть ветку</button>
                    ` : ""}
                </div>
                ${hasChildren && !shouldOpenInModal ? `
                    <div class="comment-node__children">
                        ${comment.children.map(c => this.renderNodeInModal(c, level + 1)).join("")}
                    </div>
                ` : ""}
            </div>
        `;
    }

    attachThreadModalEvents() {
        const $modal = $(".modal__background.active");
        if (!$modal.length) return;

        // toggle replies in modal
        $modal.off("click.modal-comments").on("click.modal-comments", ".comment__toggle:not([data-open-thread])", (e) => {
            const $btn = $(e.currentTarget);
            const $children = $btn.closest(".comment-node").find("> .comment-node__children");
            $children.toggleClass("hidden");
        });

        // reply form toggle
        $modal.off("click.modal-comments").on("click.modal-comments", ".comment__reply-btn", function () {
            $(this).closest(".comment").find(".comment__reply-form").toggleClass("active");
        });

        $modal.off("click.modal-comments").on("click.modal-comments", ".comment__cancel", function () {
            $(this).closest(".comment__reply-form").removeClass("active");
        });

        // hide thread
        $modal.off("click.modal-comments").on("click.modal-comments", ".comment__hide-thread", (e) => {
            const $node = $(e.currentTarget).closest(".comment-node");
            $node.find("> .comment-node__children").addClass("hidden");
        });

        // votes in modal – после ответа перерисовываем содержимое модалки
        $modal.off("click.modal-comments").on("click.modal-comments", ".comment-vote-btn", async (e) => {
            const id = $(e.currentTarget).data("comment-vote");
            const value = $(e.currentTarget).data("value");
            await fetch(`/posts/api/comments/${id}/vote`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ value })
            });
            await this.loadComments();
            // обновлённая ветка будет внутри this.comments, перерисуем модалку
            this.refreshActiveThreadModal();
        });

        // reply submit in modal – перерисовываем после отправки
        $modal.off("click.modal-comments").on("click.modal-comments", ".comment__submit", async (e) => {
            const parentId = $(e.currentTarget).data("parent-id");
            const text = $(e.currentTarget).closest(".comment__reply-form").find("textarea").val().trim();
            if (!text) return;
            await this.sendComment(text, parentId);
            await this.loadComments();
            this.refreshActiveThreadModal();
        });

        // open nested modal thread
        $modal.off("click.modal-comments").on("click.modal-comments", "[data-open-thread]", (e) => {
            const id = Number($(e.currentTarget).data("open-thread"));
            this.openThreadModal(id);
        });
    }

    // ===== utils =====
    restoreOpenThreads() {
        this.openThreads.forEach(id => {
            $(`[data-comment-id="${id}"]`)
                .closest(".comment-node")
                .find("> .comment-node__children")
                .removeClass("hidden");
        });
    }

    async sendComment(text, parentId = null) {
        return fetch(`/posts/api/posts/${POST_ID}/comments`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ text, parent_id: parentId })
        });
    }

    findCommentById(id, list = this.comments) {
        for (const c of list) {
            if (c.id === id) return c;
            if (c.children) {
                const found = this.findCommentById(id, c.children);
                if (found) return found;
            }
        }
        return null;
    }

    formatDate(d) {
        return new Date(d).toLocaleString("ru-RU");
    }

    escapeHtml(t) {
        return t
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }
}

window.commentsTree = new CommentsTree("#commentsList");