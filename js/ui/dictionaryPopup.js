/**
 * Dictionary Popup UI Component
 * Shows word definitions from API and allows custom definitions
 */

import { dictionary } from '../dictionary.js';

class DictionaryPopup {
    constructor() {
        this.popup = null;
        this.currentWord = null;
        this.isVisible = false;
        this.createPopup();
        this.setupEventListeners();
    }

    /**
     * Create the popup DOM element
     */
    createPopup() {
        this.popup = document.createElement('div');
        this.popup.className = 'dictionary-popup hidden';
        this.popup.innerHTML = `
            <div class="dictionary-popup-header">
                <div class="dictionary-word-info">
                    <span class="dictionary-word"></span>
                    <span class="dictionary-phonetic"></span>
                    <button class="dictionary-audio-btn hidden" title="Play pronunciation">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    </button>
                </div>
                <button class="dictionary-close-btn" title="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="dictionary-popup-content">
                <div class="dictionary-loading">
                    <div class="dictionary-spinner"></div>
                    <span>Looking up definition...</span>
                </div>
                <div class="dictionary-results hidden">
                    <div class="dictionary-api-section">
                        <div class="dictionary-section-header">Dictionary Definition</div>
                        <div class="dictionary-meanings"></div>
                        <div class="dictionary-not-found hidden">
                            <p>No definition found in dictionary.</p>
                        </div>
                    </div>
                    <div class="dictionary-custom-section">
                        <div class="dictionary-section-header">
                            <span>My Definition</span>
                            <button class="dictionary-edit-btn" title="Edit custom definition">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="dictionary-custom-content"></div>
                        <div class="dictionary-custom-empty hidden">
                            <button class="dictionary-add-btn">+ Add your own definition</button>
                        </div>
                    </div>
                </div>
                <div class="dictionary-edit-form hidden">
                    <div class="dictionary-form-group">
                        <label>Definition</label>
                        <textarea class="dictionary-definition-input" placeholder="Enter your definition..." rows="3"></textarea>
                    </div>
                    <div class="dictionary-form-group">
                        <label>Notes (optional)</label>
                        <textarea class="dictionary-notes-input" placeholder="Add personal notes..." rows="2"></textarea>
                    </div>
                    <div class="dictionary-form-actions">
                        <button class="dictionary-cancel-btn">Cancel</button>
                        <button class="dictionary-save-btn">Save</button>
                        <button class="dictionary-delete-btn hidden">Delete</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.popup);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button
        this.popup.querySelector('.dictionary-close-btn').addEventListener('click', () => {
            this.hide();
        });

        // Audio button
        this.popup.querySelector('.dictionary-audio-btn').addEventListener('click', () => {
            const audioUrl = this.popup.querySelector('.dictionary-audio-btn').dataset.audio;
            if (audioUrl) {
                dictionary.playAudio(audioUrl);
            }
        });

        // Add definition button
        this.popup.querySelector('.dictionary-add-btn').addEventListener('click', () => {
            this.showEditForm();
        });

        // Edit button
        this.popup.querySelector('.dictionary-edit-btn').addEventListener('click', () => {
            this.showEditForm(true);
        });

        // Cancel button
        this.popup.querySelector('.dictionary-cancel-btn').addEventListener('click', () => {
            this.hideEditForm();
        });

        // Save button
        this.popup.querySelector('.dictionary-save-btn').addEventListener('click', () => {
            this.saveCustomDefinition();
        });

        // Delete button
        this.popup.querySelector('.dictionary-delete-btn').addEventListener('click', () => {
            this.deleteCustomDefinition();
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.popup.contains(e.target)) {
                // Small delay to prevent immediate close after showing
                setTimeout(() => {
                    if (this.isVisible && !this.popup.contains(e.target)) {
                        this.hide();
                    }
                }, 100);
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * Show the popup for a word at a position
     */
    async show(word, x, y) {
        if (!word || word.trim().length === 0) return;

        this.currentWord = word.trim();

        // Reset state
        this.popup.querySelector('.dictionary-loading').classList.remove('hidden');
        this.popup.querySelector('.dictionary-results').classList.add('hidden');
        this.popup.querySelector('.dictionary-edit-form').classList.add('hidden');

        // Set word
        this.popup.querySelector('.dictionary-word').textContent = this.currentWord;
        this.popup.querySelector('.dictionary-phonetic').textContent = '';
        this.popup.querySelector('.dictionary-audio-btn').classList.add('hidden');

        // Position and show popup
        this.positionPopup(x, y);
        this.popup.classList.remove('hidden');
        this.isVisible = true;

        // Fetch definition
        try {
            const result = await dictionary.lookup(this.currentWord);
            this.displayResults(result);
        } catch (error) {
            console.error('Dictionary lookup error:', error);
            this.displayError();
        }
    }

    /**
     * Position the popup near the selection
     */
    positionPopup(x, y) {
        const popupWidth = 360;
        const popupMaxHeight = 400;
        const padding = 10;

        // Adjust x position to stay within viewport
        let left = x;
        if (left + popupWidth > window.innerWidth - padding) {
            left = window.innerWidth - popupWidth - padding;
        }
        if (left < padding) {
            left = padding;
        }

        // Position below selection, but flip to above if needed
        let top = y + 10;
        if (top + popupMaxHeight > window.innerHeight - padding) {
            top = y - popupMaxHeight - 10;
            if (top < padding) {
                top = padding;
            }
        }

        this.popup.style.left = `${left}px`;
        this.popup.style.top = `${top}px`;
    }

    /**
     * Display lookup results
     */
    displayResults(result) {
        this.popup.querySelector('.dictionary-loading').classList.add('hidden');
        this.popup.querySelector('.dictionary-results').classList.remove('hidden');

        // Display API results
        const meaningsContainer = this.popup.querySelector('.dictionary-meanings');
        const notFound = this.popup.querySelector('.dictionary-not-found');

        if (result.api) {
            notFound.classList.add('hidden');
            meaningsContainer.classList.remove('hidden');

            // Set phonetic
            if (result.api.phonetic) {
                this.popup.querySelector('.dictionary-phonetic').textContent = result.api.phonetic;
            }

            // Set audio button
            const audioBtn = this.popup.querySelector('.dictionary-audio-btn');
            const audioPhonetic = result.api.phonetics?.find(p => p.audio);
            if (audioPhonetic?.audio) {
                audioBtn.dataset.audio = audioPhonetic.audio;
                audioBtn.classList.remove('hidden');
            } else {
                audioBtn.classList.add('hidden');
            }

            // Build meanings HTML
            meaningsContainer.innerHTML = result.api.meanings.map(meaning => `
                <div class="dictionary-meaning">
                    <div class="dictionary-pos">${meaning.partOfSpeech}</div>
                    <ol class="dictionary-definitions">
                        ${meaning.definitions.map(def => `
                            <li>
                                <div class="dictionary-def">${this.escapeHtml(def.definition)}</div>
                                ${def.example ? `<div class="dictionary-example">"${this.escapeHtml(def.example)}"</div>` : ''}
                                ${def.synonyms.length > 0 ? `
                                    <div class="dictionary-synonyms">
                                        <span class="dictionary-label">Synonyms:</span>
                                        ${def.synonyms.map(s => `<span class="dictionary-synonym">${this.escapeHtml(s)}</span>`).join(', ')}
                                    </div>
                                ` : ''}
                            </li>
                        `).join('')}
                    </ol>
                    ${meaning.synonyms.length > 0 ? `
                        <div class="dictionary-word-synonyms">
                            <span class="dictionary-label">Related:</span>
                            ${meaning.synonyms.map(s => `<span class="dictionary-synonym clickable" data-word="${this.escapeHtml(s)}">${this.escapeHtml(s)}</span>`).join(', ')}
                        </div>
                    ` : ''}
                </div>
            `).join('');

            // Add click handlers for synonym lookup
            meaningsContainer.querySelectorAll('.dictionary-synonym.clickable').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const word = el.dataset.word;
                    if (word) {
                        this.show(word, parseInt(this.popup.style.left), parseInt(this.popup.style.top));
                    }
                });
            });
        } else {
            meaningsContainer.classList.add('hidden');
            notFound.classList.remove('hidden');
        }

        // Display custom definition
        this.displayCustomDefinition(result.custom);
    }

    /**
     * Display custom definition section
     */
    displayCustomDefinition(custom) {
        const customContent = this.popup.querySelector('.dictionary-custom-content');
        const customEmpty = this.popup.querySelector('.dictionary-custom-empty');
        const editBtn = this.popup.querySelector('.dictionary-edit-btn');
        const deleteBtn = this.popup.querySelector('.dictionary-delete-btn');

        if (custom) {
            customContent.classList.remove('hidden');
            customEmpty.classList.add('hidden');
            editBtn.classList.remove('hidden');
            deleteBtn.classList.remove('hidden');

            customContent.innerHTML = `
                <div class="dictionary-custom-def">${this.escapeHtml(custom.definition)}</div>
                ${custom.notes ? `<div class="dictionary-custom-notes">${this.escapeHtml(custom.notes)}</div>` : ''}
                <div class="dictionary-custom-meta">Added ${this.formatDate(custom.createdAt)}</div>
            `;
        } else {
            customContent.classList.add('hidden');
            customEmpty.classList.remove('hidden');
            editBtn.classList.add('hidden');
            deleteBtn.classList.add('hidden');
        }
    }

    /**
     * Show edit form
     */
    showEditForm(isEdit = false) {
        this.popup.querySelector('.dictionary-results').classList.add('hidden');
        this.popup.querySelector('.dictionary-edit-form').classList.remove('hidden');

        const definitionInput = this.popup.querySelector('.dictionary-definition-input');
        const notesInput = this.popup.querySelector('.dictionary-notes-input');
        const deleteBtn = this.popup.querySelector('.dictionary-delete-btn');

        if (isEdit) {
            const custom = dictionary.getCustomDefinition(this.currentWord);
            if (custom) {
                definitionInput.value = custom.definition;
                notesInput.value = custom.notes || '';
                deleteBtn.classList.remove('hidden');
            }
        } else {
            definitionInput.value = '';
            notesInput.value = '';
            deleteBtn.classList.add('hidden');
        }

        definitionInput.focus();
    }

    /**
     * Hide edit form
     */
    hideEditForm() {
        this.popup.querySelector('.dictionary-edit-form').classList.add('hidden');
        this.popup.querySelector('.dictionary-results').classList.remove('hidden');
    }

    /**
     * Save custom definition
     */
    async saveCustomDefinition() {
        const definition = this.popup.querySelector('.dictionary-definition-input').value.trim();
        const notes = this.popup.querySelector('.dictionary-notes-input').value.trim();

        if (!definition) {
            this.popup.querySelector('.dictionary-definition-input').focus();
            return;
        }

        try {
            await dictionary.saveCustomDefinition(this.currentWord, definition, notes);

            // Refresh display
            const result = await dictionary.lookup(this.currentWord);
            this.hideEditForm();
            this.displayCustomDefinition(result.custom);
        } catch (error) {
            console.error('Failed to save definition:', error);
        }
    }

    /**
     * Delete custom definition
     */
    async deleteCustomDefinition() {
        if (!confirm(`Delete your definition for "${this.currentWord}"?`)) {
            return;
        }

        try {
            await dictionary.deleteCustomDefinition(this.currentWord);

            // Refresh display
            this.hideEditForm();
            this.displayCustomDefinition(null);
        } catch (error) {
            console.error('Failed to delete definition:', error);
        }
    }

    /**
     * Display error state
     */
    displayError() {
        this.popup.querySelector('.dictionary-loading').classList.add('hidden');
        this.popup.querySelector('.dictionary-results').classList.remove('hidden');
        this.popup.querySelector('.dictionary-meanings').classList.add('hidden');
        this.popup.querySelector('.dictionary-not-found').classList.remove('hidden');
        this.popup.querySelector('.dictionary-not-found').innerHTML = `
            <p>Failed to look up definition. Please try again.</p>
        `;
    }

    /**
     * Hide the popup
     */
    hide() {
        this.popup.classList.add('hidden');
        this.isVisible = false;
        this.currentWord = null;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format timestamp to readable date
     */
    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

// Export singleton
export const dictionaryPopup = new DictionaryPopup();
