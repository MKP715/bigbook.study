/**
 * Modal component for AA Literature Study
 */

class Modal {
    constructor() {
        this.overlay = document.getElementById('modal-overlay');
        this.modal = document.getElementById('modal');
        this.titleEl = document.getElementById('modal-title');
        this.bodyEl = document.getElementById('modal-body');
        this.footerEl = document.getElementById('modal-footer');
        this.closeBtn = document.getElementById('modal-close');
        this.cancelBtn = document.getElementById('modal-cancel');
        this.confirmBtn = document.getElementById('modal-confirm');

        this.currentResolve = null;
        this.currentReject = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close(null);
            }
        });

        // Close button
        this.closeBtn.addEventListener('click', () => this.close(null));
        this.cancelBtn.addEventListener('click', () => this.close(null));

        // Confirm button
        this.confirmBtn.addEventListener('click', () => {
            const result = this.getFormData();
            this.close(result);
        });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close(null);
            }
        });
    }

    /**
     * Open a modal
     * @param {Object} options - Modal options
     * @returns {Promise} Resolves with form data or null if cancelled
     */
    open(options = {}) {
        const {
            title = 'Modal',
            body = '',
            confirmText = 'Save',
            cancelText = 'Cancel',
            showCancel = true,
            showConfirm = true,
            onOpen = null
        } = options;

        this.titleEl.textContent = title;
        this.bodyEl.innerHTML = body;
        this.confirmBtn.textContent = confirmText;
        this.cancelBtn.textContent = cancelText;

        this.cancelBtn.style.display = showCancel ? '' : 'none';
        this.confirmBtn.style.display = showConfirm ? '' : 'none';

        // Show modal - use requestAnimationFrame to ensure repaint between
        // removing 'hidden' and adding 'visible' for smooth CSS transition
        this.overlay.classList.remove('hidden');
        requestAnimationFrame(() => {
            this.overlay.classList.add('visible');

            // Focus first input
            requestAnimationFrame(() => {
                const firstInput = this.bodyEl.querySelector('input, textarea, select');
                if (firstInput) firstInput.focus();
                if (onOpen) onOpen(this.bodyEl);
            });
        });

        return new Promise((resolve, reject) => {
            this.currentResolve = resolve;
            this.currentReject = reject;
        });
    }

    /**
     * Close the modal
     */
    close(result) {
        this.overlay.classList.remove('visible');
        setTimeout(() => {
            this.overlay.classList.add('hidden');
            this.bodyEl.innerHTML = '';
        }, 250);

        if (this.currentResolve) {
            this.currentResolve(result);
            this.currentResolve = null;
            this.currentReject = null;
        }
    }

    /**
     * Check if modal is open
     */
    isOpen() {
        return this.overlay.classList.contains('visible');
    }

    /**
     * Get form data from modal body
     */
    getFormData() {
        const data = {};
        const inputs = this.bodyEl.querySelectorAll('input, textarea, select');

        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    data[input.name] = input.checked;
                } else {
                    data[input.name] = input.value;
                }
            }
        });

        return data;
    }

    /**
     * Show comment modal
     */
    showCommentModal(selectedText, existingComment = '') {
        return this.open({
            title: 'Add Comment',
            body: `
                <div class="selected-text-preview">"${escapeHtml(selectedText)}"</div>
                <div class="form-group">
                    <label class="form-label" for="comment-text">Your Comment</label>
                    <textarea class="form-textarea" name="content" id="comment-text"
                        placeholder="Write your thoughts about this passage...">${escapeHtml(existingComment)}</textarea>
                </div>
            `,
            confirmText: existingComment ? 'Update' : 'Save'
        });
    }

    /**
     * Show question modal
     */
    showQuestionModal(selectedText, existingQuestion = '') {
        return this.open({
            title: 'Add Question',
            body: `
                <div class="selected-text-preview">"${escapeHtml(selectedText)}"</div>
                <div class="form-group">
                    <label class="form-label" for="question-text">Your Question</label>
                    <textarea class="form-textarea" name="content" id="question-text"
                        placeholder="What question does this raise for you?">${escapeHtml(existingQuestion)}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="answer-text">Answer (optional)</label>
                    <textarea class="form-textarea" name="answer" id="answer-text"
                        placeholder="Add an answer if you have one..." style="min-height: 80px;"></textarea>
                </div>
            `,
            confirmText: existingQuestion ? 'Update' : 'Save'
        });
    }

    /**
     * Show definition modal
     */
    showDefinitionModal(selectedText, existingDefinition = '') {
        return this.open({
            title: 'Add Definition',
            body: `
                <div class="selected-text-preview">"${escapeHtml(selectedText)}"</div>
                <div class="form-group">
                    <label class="form-label" for="definition-text">Definition</label>
                    <textarea class="form-textarea" name="content" id="definition-text"
                        placeholder="Define this term or phrase...">${escapeHtml(existingDefinition)}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="source-text">Source (optional)</label>
                    <input type="text" class="form-input" name="source" id="source-text"
                        placeholder="e.g., Webster's Dictionary">
                </div>
            `,
            confirmText: existingDefinition ? 'Update' : 'Save'
        });
    }

    /**
     * Show settings modal
     */
    showSettingsModal(currentSettings = {}) {
        return this.open({
            title: 'Settings',
            body: `
                <div class="form-group">
                    <label class="form-label" for="theme-select">Theme</label>
                    <select class="form-input" name="theme" id="theme-select">
                        <option value="light" ${currentSettings.theme === 'light' ? 'selected' : ''}>Light</option>
                        <option value="dark" ${currentSettings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                        <option value="sepia" ${currentSettings.theme === 'sepia' ? 'selected' : ''}>Sepia</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="font-size">Font Size</label>
                    <input type="range" class="form-input" name="fontSize" id="font-size"
                        min="12" max="24" value="${currentSettings.fontSize || 16}">
                    <span id="font-size-value">${currentSettings.fontSize || 16}px</span>
                </div>
                <hr style="margin: 16px 0; border-color: var(--border-color);">
                <div class="form-group">
                    <label class="form-label">Data Management</label>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button type="button" class="btn btn-secondary" id="export-data-btn">Export Data</button>
                        <button type="button" class="btn btn-secondary" id="import-data-btn">Import Data</button>
                    </div>
                    <input type="file" id="import-file-input" accept=".json" style="display: none;">
                </div>
            `,
            confirmText: 'Save Settings',
            onOpen: (body) => {
                const fontSizeInput = body.querySelector('#font-size');
                const fontSizeValue = body.querySelector('#font-size-value');
                fontSizeInput.addEventListener('input', (e) => {
                    fontSizeValue.textContent = e.target.value + 'px';
                });
            }
        });
    }

    /**
     * Show confirmation dialog
     */
    confirm(message, title = 'Confirm') {
        return this.open({
            title,
            body: `<p>${escapeHtml(message)}</p>`,
            confirmText: 'Confirm',
            cancelText: 'Cancel'
        }).then(result => result !== null);
    }

    /**
     * Show alert dialog
     */
    alert(message, title = 'Alert') {
        return this.open({
            title,
            body: `<p>${escapeHtml(message)}</p>`,
            confirmText: 'OK',
            showCancel: false
        });
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export singleton
export const modal = new Modal();
