/**
 * Annotation Toolbar component for AA Literature Study
 */

class AnnotationToolbar {
    constructor() {
        this.element = document.getElementById('annotation-toolbar');
        this.isVisible = false;
        this.currentSelection = null;
        this.currentParagraphId = null;
        this.currentBookId = null;

        this.callbacks = {
            onHighlight: null,
            onUnderline: null,
            onComment: null,
            onQuestion: null,
            onDefinition: null,
            onCrossRef: null
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Color buttons
        this.element.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = btn.dataset.color;
                if (this.callbacks.onHighlight) {
                    this.callbacks.onHighlight(color, this.getSelectionInfo());
                }
                this.hide();
            });
        });

        // Underline buttons
        this.element.querySelectorAll('.underline-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const style = btn.dataset.style;
                if (this.callbacks.onUnderline) {
                    this.callbacks.onUnderline(style, this.getSelectionInfo());
                }
                this.hide();
            });
        });

        // Action buttons
        this.element.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const callback = this.callbacks[`on${capitalize(action)}`];
                if (callback) {
                    callback(this.getSelectionInfo());
                }
                this.hide();
            });
        });

        // Hide on click outside
        document.addEventListener('mousedown', (e) => {
            if (this.isVisible && !this.element.contains(e.target)) {
                this.hide();
            }
        });

        // Hide on scroll
        document.addEventListener('scroll', () => {
            if (this.isVisible) {
                this.hide();
            }
        }, true);
    }

    /**
     * Show toolbar at position
     */
    show(x, y, selection, bookId, paragraphId) {
        this.currentSelection = selection;
        this.currentBookId = bookId;
        this.currentParagraphId = paragraphId;

        // Position toolbar
        const rect = this.element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust position to stay in viewport
        let left = x - rect.width / 2;
        let top = y - rect.height - 10;

        if (left < 10) left = 10;
        if (left + rect.width > viewportWidth - 10) {
            left = viewportWidth - rect.width - 10;
        }
        if (top < 10) {
            top = y + 30; // Show below selection
        }

        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;

        this.element.classList.remove('hidden');
        this.isVisible = true;
    }

    /**
     * Hide toolbar
     */
    hide() {
        this.element.classList.add('hidden');
        this.isVisible = false;
        this.currentSelection = null;
    }

    /**
     * Get selection info
     */
    getSelectionInfo() {
        if (!this.currentSelection) return null;

        const range = this.currentSelection.getRangeAt(0);
        const text = this.currentSelection.toString().trim();

        // Find the paragraph element
        let paragraphEl = range.startContainer;
        while (paragraphEl && !paragraphEl.classList?.contains('paragraph')) {
            paragraphEl = paragraphEl.parentElement;
        }

        return {
            text,
            bookId: this.currentBookId,
            paragraphId: this.currentParagraphId || paragraphEl?.dataset?.paragraphId,
            startOffset: this.getTextOffset(paragraphEl, range.startContainer, range.startOffset),
            endOffset: this.getTextOffset(paragraphEl, range.endContainer, range.endOffset),
            range
        };
    }

    /**
     * Calculate text offset within paragraph
     */
    getTextOffset(container, node, offset) {
        if (!container) return offset;

        let totalOffset = 0;
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let currentNode = walker.nextNode();
        while (currentNode) {
            if (currentNode === node) {
                return totalOffset + offset;
            }
            totalOffset += currentNode.textContent.length;
            currentNode = walker.nextNode();
        }

        return offset;
    }

    /**
     * Set callbacks
     */
    on(event, callback) {
        const callbackName = `on${capitalize(event)}`;
        if (callbackName in this.callbacks) {
            this.callbacks[callbackName] = callback;
        }
        return this;
    }
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Export singleton
export const toolbar = new AnnotationToolbar();
