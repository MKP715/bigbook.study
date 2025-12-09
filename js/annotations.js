/**
 * Annotation system for AA Literature Study
 */

import * as db from './db.js';
import { toast } from './ui/toast.js';
import { modal } from './ui/modal.js';

class Annotations {
    constructor() {
        this.cache = new Map(); // bookId -> annotations array
        this.listeners = [];
    }

    /**
     * Load annotations for a book
     */
    async loadForBook(bookId) {
        if (this.cache.has(bookId)) {
            return this.cache.get(bookId);
        }

        const annotations = await db.getAnnotationsByBook(bookId);
        this.cache.set(bookId, annotations);
        return annotations;
    }

    /**
     * Get annotations for a specific paragraph
     */
    async getForParagraph(bookId, paragraphId) {
        const bookAnnotations = await this.loadForBook(bookId);
        return bookAnnotations.filter(a => a.paragraphId === paragraphId);
    }

    /**
     * Add a highlight
     */
    async addHighlight(bookId, paragraphId, startOffset, endOffset, text, color) {
        const annotation = await db.addAnnotation({
            bookId,
            paragraphId,
            type: 'highlight',
            startOffset,
            endOffset,
            selectedText: text,
            color
        });

        this.updateCache(bookId, annotation);
        this.notify('add', annotation);
        toast.success('Highlight added');
        return annotation;
    }

    /**
     * Add an underline
     */
    async addUnderline(bookId, paragraphId, startOffset, endOffset, text, style) {
        const annotation = await db.addAnnotation({
            bookId,
            paragraphId,
            type: 'underline',
            startOffset,
            endOffset,
            selectedText: text,
            underlineStyle: style
        });

        this.updateCache(bookId, annotation);
        this.notify('add', annotation);
        toast.success('Underline added');
        return annotation;
    }

    /**
     * Add a comment
     */
    async addComment(bookId, paragraphId, startOffset, endOffset, text, content) {
        const annotation = await db.addAnnotation({
            bookId,
            paragraphId,
            type: 'comment',
            startOffset,
            endOffset,
            selectedText: text,
            content
        });

        this.updateCache(bookId, annotation);
        this.notify('add', annotation);
        toast.success('Comment added');
        return annotation;
    }

    /**
     * Add a question
     */
    async addQuestion(bookId, paragraphId, startOffset, endOffset, text, content, answer = '') {
        const annotation = await db.addAnnotation({
            bookId,
            paragraphId,
            type: 'question',
            startOffset,
            endOffset,
            selectedText: text,
            content,
            answer,
            answered: !!answer
        });

        this.updateCache(bookId, annotation);
        this.notify('add', annotation);
        toast.success('Question added');
        return annotation;
    }

    /**
     * Add a definition
     */
    async addDefinition(bookId, paragraphId, startOffset, endOffset, text, definition, source = '') {
        const annotation = await db.addAnnotation({
            bookId,
            paragraphId,
            type: 'definition',
            startOffset,
            endOffset,
            selectedText: text,
            content: definition,
            source
        });

        this.updateCache(bookId, annotation);
        this.notify('add', annotation);
        toast.success('Definition added');
        return annotation;
    }

    /**
     * Update an annotation
     */
    async update(id, updates) {
        const annotation = await db.updateAnnotation(id, updates);

        // Update cache
        for (const [bookId, annotations] of this.cache) {
            const index = annotations.findIndex(a => a.id === id);
            if (index !== -1) {
                annotations[index] = annotation;
                break;
            }
        }

        this.notify('update', annotation);
        toast.success('Annotation updated');
        return annotation;
    }

    /**
     * Delete an annotation
     */
    async delete(id) {
        await db.deleteAnnotation(id);

        // Remove from cache
        for (const [bookId, annotations] of this.cache) {
            const index = annotations.findIndex(a => a.id === id);
            if (index !== -1) {
                const deleted = annotations.splice(index, 1)[0];
                this.notify('delete', deleted);
                break;
            }
        }

        toast.success('Annotation deleted');
    }

    /**
     * Get all annotations
     */
    async getAll() {
        return db.getAllAnnotations();
    }

    /**
     * Get annotations by type
     */
    async getByType(type) {
        return db.getAnnotationsByType(type);
    }

    /**
     * Apply annotations to content
     * Returns HTML with annotation markup
     */
    applyToContent(text, annotations, paragraphId) {
        if (!annotations || annotations.length === 0) {
            return text;
        }

        // Filter annotations for this paragraph
        const paraAnnotations = annotations.filter(a => a.paragraphId === paragraphId);
        if (paraAnnotations.length === 0) {
            return text;
        }

        // Sort by start offset (descending) to apply from end to start
        const sorted = [...paraAnnotations].sort((a, b) => b.startOffset - a.startOffset);

        let result = text;
        for (const annotation of sorted) {
            const { startOffset, endOffset, type, color, underlineStyle, id } = annotation;

            // Validate offsets
            if (startOffset < 0 || endOffset > result.length || startOffset >= endOffset) {
                continue;
            }

            const before = result.slice(0, startOffset);
            const selected = result.slice(startOffset, endOffset);
            const after = result.slice(endOffset);

            let className = '';
            let dataAttrs = `data-annotation-id="${id}"`;

            switch (type) {
                case 'highlight':
                    className = `highlight highlight-${color}`;
                    break;
                case 'underline':
                    className = `underline underline-${underlineStyle}`;
                    break;
                case 'comment':
                    className = 'has-comment';
                    break;
                case 'question':
                    className = 'has-question';
                    break;
                case 'definition':
                    className = 'has-definition';
                    break;
            }

            result = `${before}<span class="${className}" ${dataAttrs}>${selected}</span>${after}`;
        }

        return result;
    }

    /**
     * Update cache with new annotation
     */
    updateCache(bookId, annotation) {
        if (!this.cache.has(bookId)) {
            this.cache.set(bookId, []);
        }
        this.cache.get(bookId).push(annotation);
    }

    /**
     * Clear cache for a book
     */
    clearCache(bookId) {
        this.cache.delete(bookId);
    }

    /**
     * Subscribe to annotation changes
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Notify listeners of changes
     */
    notify(action, annotation) {
        this.listeners.forEach(callback => callback(action, annotation));
    }

    /**
     * Show annotation popover
     */
    showPopover(annotation, x, y) {
        // Create popover element
        const existing = document.querySelector('.annotation-popover');
        if (existing) existing.remove();

        const popover = document.createElement('div');
        popover.className = 'annotation-popover';

        const typeLabel = annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1);
        const isSimpleAnnotation = ['highlight', 'underline'].includes(annotation.type);

        // Get color/style info for highlights and underlines
        let styleInfo = '';
        if (annotation.type === 'highlight') {
            styleInfo = `<span class="popover-color-badge" style="background-color: var(--highlight-${annotation.color}, #fef08a);"></span>`;
        } else if (annotation.type === 'underline') {
            styleInfo = `<span class="popover-underline-badge underline-${annotation.underlineStyle}">Abc</span>`;
        }

        popover.innerHTML = `
            <div class="popover-header">
                <span class="popover-type ${annotation.type}">${typeLabel} ${styleInfo}</span>
                <div class="popover-actions">
                    ${!isSimpleAnnotation ? `
                    <button class="popover-btn edit-btn" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </button>
                    ` : ''}
                    <button class="popover-btn delete-btn" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="popover-selected">"${escapeHtml(annotation.selectedText)}"</div>
            ${annotation.content ? `<div class="popover-content">${escapeHtml(annotation.content)}</div>` : ''}
            ${annotation.answer ? `<div class="popover-content" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color);"><strong>Answer:</strong> ${escapeHtml(annotation.answer)}</div>` : ''}
        `;

        // Position popover
        popover.style.left = `${x}px`;
        popover.style.top = `${y}px`;

        document.body.appendChild(popover);

        // Adjust position if off-screen
        const rect = popover.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            popover.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            popover.style.top = `${y - rect.height - 10}px`;
        }

        // Event handlers
        const editBtn = popover.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', async () => {
                popover.remove();
                await this.editAnnotation(annotation);
            });
        }

        popover.querySelector('.delete-btn').addEventListener('click', async () => {
            popover.remove();
            const confirmed = await modal.confirm('Are you sure you want to delete this annotation?');
            if (confirmed) {
                await this.delete(annotation.id);
            }
        });

        // Close on click outside
        const closeHandler = (e) => {
            if (!popover.contains(e.target)) {
                popover.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    /**
     * Edit an annotation
     */
    async editAnnotation(annotation) {
        let result;

        switch (annotation.type) {
            case 'comment':
                result = await modal.showCommentModal(annotation.selectedText, annotation.content);
                break;
            case 'question':
                result = await modal.showQuestionModal(annotation.selectedText, annotation.content);
                break;
            case 'definition':
                result = await modal.showDefinitionModal(annotation.selectedText, annotation.content);
                break;
            default:
                return;
        }

        if (result) {
            await this.update(annotation.id, result);
        }
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export singleton
export const annotations = new Annotations();
