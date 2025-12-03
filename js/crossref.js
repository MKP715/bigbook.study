/**
 * Cross-reference system for AA Literature Study
 */

import * as db from './db.js';
import { toast } from './ui/toast.js';
import { modal } from './ui/modal.js';

class CrossReferences {
    constructor() {
        this.pendingSource = null; // For two-step cross-reference creation
    }

    /**
     * Start creating a cross-reference (step 1: select source)
     */
    startCrossRef(bookId, paragraphId, selectedText, startOffset, endOffset) {
        this.pendingSource = {
            bookId,
            paragraphId,
            selectedText,
            startOffset,
            endOffset
        };

        toast.info('Now navigate to the target passage and select the text to link to');
    }

    /**
     * Complete the cross-reference (step 2: select target)
     */
    async completeCrossRef(targetBookId, targetParagraphId, targetText, note = '') {
        if (!this.pendingSource) {
            toast.error('No source selected. Start by selecting text in the source passage.');
            return null;
        }

        try {
            const crossRef = await db.addCrossReference({
                sourceBookId: this.pendingSource.bookId,
                sourceParagraphId: this.pendingSource.paragraphId,
                sourceText: this.pendingSource.selectedText,
                sourceStartOffset: this.pendingSource.startOffset,
                sourceEndOffset: this.pendingSource.endOffset,
                targetBookId,
                targetParagraphId,
                targetText,
                note
            });

            this.pendingSource = null;
            toast.success('Cross-reference created');
            return crossRef;
        } catch (error) {
            console.error('Failed to create cross-reference:', error);
            toast.error('Failed to create cross-reference');
            return null;
        }
    }

    /**
     * Cancel pending cross-reference
     */
    cancel() {
        this.pendingSource = null;
        toast.info('Cross-reference cancelled');
    }

    /**
     * Check if there's a pending cross-reference
     */
    hasPending() {
        return this.pendingSource !== null;
    }

    /**
     * Get pending source info
     */
    getPending() {
        return this.pendingSource;
    }

    /**
     * Get all cross-references from a passage
     */
    async getFromPassage(bookId, paragraphId) {
        return db.getCrossReferencesFrom(bookId, paragraphId);
    }

    /**
     * Get all cross-references to a passage
     */
    async getToPassage(bookId, paragraphId) {
        return db.getCrossReferencesTo(bookId, paragraphId);
    }

    /**
     * Delete a cross-reference
     */
    async delete(id) {
        try {
            await db.deleteCrossReference(id);
            toast.success('Cross-reference deleted');
        } catch (error) {
            console.error('Failed to delete cross-reference:', error);
            toast.error('Failed to delete cross-reference');
        }
    }

    /**
     * Show cross-reference creation modal
     */
    async showCreateModal(sourceInfo) {
        const result = await modal.open({
            title: 'Create Cross-Reference',
            body: `
                <div class="crossref-step">
                    <span class="crossref-step-number">1</span>
                    <span class="crossref-step-title">Source Selected</span>
                    <div class="selected-text-preview">"${sourceInfo.selectedText}"</div>
                    <div class="form-hint">${sourceInfo.bookId}</div>
                </div>

                <div class="crossref-step">
                    <span class="crossref-step-number">2</span>
                    <span class="crossref-step-title">Add Note (optional)</span>
                    <div class="form-group">
                        <textarea class="form-textarea" name="note"
                            placeholder="Describe the connection between these passages..."></textarea>
                    </div>
                </div>

                <p class="form-hint" style="margin-top: 16px;">
                    After clicking "Continue", navigate to the target passage and select the text you want to link to.
                </p>
            `,
            confirmText: 'Continue'
        });

        if (result) {
            this.pendingSource = {
                ...sourceInfo,
                note: result.note
            };
            return true;
        }
        return false;
    }

    /**
     * Auto-detect potential cross-references in text
     * Looks for patterns like "p. 25", "page 25", "Big Book", etc.
     */
    detectReferences(text) {
        const patterns = [
            // Page references
            { regex: /p\.\s*(\d+)/gi, type: 'page' },
            { regex: /page\s*(\d+)/gi, type: 'page' },
            { regex: /pages\s*(\d+)(?:\s*-\s*(\d+))?/gi, type: 'page' },

            // Book references
            { regex: /Big Book/gi, type: 'book', bookId: 'big-book' },
            { regex: /Twelve and Twelve/gi, type: 'book', bookId: 'twelve-and-twelve' },
            { regex: /12\s*&\s*12/gi, type: 'book', bookId: 'twelve-and-twelve' },
            { regex: /As Bill Sees It/gi, type: 'book', bookId: 'as-bill-sees-it' },
            { regex: /Daily Reflections/gi, type: 'book', bookId: 'daily-reflections' },

            // Step references
            { regex: /Step\s+(\d+)/gi, type: 'step' },
            { regex: /Steps?\s+(\d+)\s*(?:and|&|-)\s*(\d+)/gi, type: 'steps' },

            // Tradition references
            { regex: /Tradition\s+(\d+)/gi, type: 'tradition' }
        ];

        const references = [];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                references.push({
                    type: pattern.type,
                    match: match[0],
                    index: match.index,
                    bookId: pattern.bookId,
                    number: match[1] ? parseInt(match[1], 10) : null,
                    endNumber: match[2] ? parseInt(match[2], 10) : null
                });
            }
        }

        return references;
    }
}

// Export singleton
export const crossReferences = new CrossReferences();


/**
 * Page-Based Cross-Reference Index
 * Automatically links Daily Reflections and As Bill Sees It to Big Book, 12&12, and AA Comes of Age pages
 */
class PageCrossRefIndex {
    constructor() {
        // Index structure: { pageNumber: [references] }
        this.bigBookIndex = new Map();
        this.twelveAndTwelveIndex = new Map();
        this.aaComesOfAgeIndex = new Map();
        this.books = new Map();
        this.initialized = false;
    }

    /**
     * Initialize cross-references from loaded books
     */
    async initialize(books) {
        this.books = books;

        const dailyReflections = books.get('daily-reflections');
        const asBillSeesIt = books.get('as-bill-sees-it');

        if (dailyReflections) {
            this.indexDailyReflections(dailyReflections);
        }

        if (asBillSeesIt) {
            this.indexAsBillSeesIt(asBillSeesIt);
        }

        this.initialized = true;
        console.log('Page cross-reference index built:', {
            bigBookPages: this.bigBookIndex.size,
            twelveAndTwelvePages: this.twelveAndTwelveIndex.size,
            aaComesOfAgePages: this.aaComesOfAgeIndex.size
        });
    }

    /**
     * Index Daily Reflections sources
     */
    indexDailyReflections(book) {
        if (!book.reflections) return;

        book.reflections.forEach(reflection => {
            if (!reflection.source) return;

            const sourceBook = reflection.source.book?.toUpperCase() || '';
            const pages = this.parsePages(reflection.source.pages);

            const refEntry = {
                type: 'daily-reflection',
                bookId: 'daily-reflections',
                title: reflection.title,
                dateKey: reflection.dateKey,
                month: reflection.month,
                day: reflection.day,
                quote: Array.isArray(reflection.quote) ? reflection.quote[0]?.slice(0, 100) : reflection.quote?.slice(0, 100),
                sourceBook: sourceBook,
                sourcePages: reflection.source.pages
            };

            // Determine which index to use
            if (sourceBook.includes('COMES OF AGE')) {
                pages.forEach(page => {
                    this.addToIndex(this.aaComesOfAgeIndex, page, refEntry);
                });
            } else if (sourceBook.includes('ALCOHOLICS ANONYMOUS')) {
                pages.forEach(page => {
                    this.addToIndex(this.bigBookIndex, page, refEntry);
                });
            } else if (sourceBook.includes('TWELVE STEPS AND TWELVE TRADITIONS') ||
                       sourceBook.includes('TWELVE AND TWELVE')) {
                pages.forEach(page => {
                    this.addToIndex(this.twelveAndTwelveIndex, page, refEntry);
                });
            }
        });
    }

    /**
     * Index As Bill Sees It sources
     */
    indexAsBillSeesIt(book) {
        if (!book.entries) return;

        book.entries.forEach(entry => {
            if (!entry.sections) return;

            entry.sections.forEach(section => {
                if (!section.source) return;

                const sourceStr = section.source.toUpperCase();
                const pages = this.parseSourceString(section.source);

                const refEntry = {
                    type: 'as-bill-sees-it',
                    bookId: 'as-bill-sees-it',
                    title: entry.title,
                    entryNumber: entry.entry_number,
                    page: entry.page,
                    sectionTitle: section.title,
                    sourceString: section.source,
                    paragraphPreview: section.paragraphs?.[0]?.text?.slice(0, 100) || ''
                };

                // Determine which index based on source
                if (sourceStr.includes('COMES OF AGE')) {
                    pages.forEach(page => {
                        this.addToIndex(this.aaComesOfAgeIndex, page, refEntry);
                    });
                } else if (sourceStr.includes('ALCOHOLICS ANONYMOUS')) {
                    pages.forEach(page => {
                        this.addToIndex(this.bigBookIndex, page, refEntry);
                    });
                } else if (sourceStr.includes('TWELVE AND TWELVE') || sourceStr.includes('12 AND 12')) {
                    pages.forEach(page => {
                        this.addToIndex(this.twelveAndTwelveIndex, page, refEntry);
                    });
                }
            });
        });
    }

    /**
     * Parse page string like "25", "93-94", "52-53, 55"
     */
    parsePages(pageStr) {
        if (!pageStr) return [];

        const pages = [];
        const str = String(pageStr);

        // Handle ranges like "93-94" and lists like "52-53, 55"
        const parts = str.split(/[,;]/);

        parts.forEach(part => {
            part = part.trim();
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(p => parseInt(p.trim(), 10));
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = start; i <= Math.min(end, start + 20); i++) { // Cap range to avoid huge ranges
                        pages.push(i);
                    }
                }
            } else {
                const num = parseInt(part, 10);
                if (!isNaN(num)) {
                    pages.push(num);
                }
            }
        });

        return pages;
    }

    /**
     * Parse source string like "ALCOHOLICS ANONYMOUS, P. 100"
     */
    parseSourceString(sourceStr) {
        if (!sourceStr) return [];

        // Extract page numbers from source string
        const pageMatch = sourceStr.match(/P{1,2}\.?\s*([\d\-,\s]+)/i);
        if (pageMatch) {
            return this.parsePages(pageMatch[1]);
        }

        return [];
    }

    /**
     * Add entry to index
     */
    addToIndex(index, page, entry) {
        if (!index.has(page)) {
            index.set(page, []);
        }
        // Avoid duplicates
        const existing = index.get(page);
        const isDupe = existing.some(e =>
            e.type === entry.type &&
            (e.dateKey === entry.dateKey || e.entryNumber === entry.entryNumber)
        );
        if (!isDupe) {
            existing.push(entry);
        }
    }

    /**
     * Get cross-references for a Big Book page
     */
    getBigBookRefs(pageNumber) {
        return this.bigBookIndex.get(pageNumber) || [];
    }

    /**
     * Get cross-references for a 12&12 page
     */
    getTwelveAndTwelveRefs(pageNumber) {
        return this.twelveAndTwelveIndex.get(pageNumber) || [];
    }

    /**
     * Get cross-references for an AA Comes of Age page
     */
    getAAComesOfAgeRefs(pageNumber) {
        return this.aaComesOfAgeIndex.get(pageNumber) || [];
    }

    /**
     * Get all cross-references for a range of pages
     */
    getRefsForPageRange(bookType, startPage, endPage) {
        let index;
        if (bookType === 'big-book') {
            index = this.bigBookIndex;
        } else if (bookType === 'aa-comes-of-age') {
            index = this.aaComesOfAgeIndex;
        } else {
            index = this.twelveAndTwelveIndex;
        }
        const refs = [];
        const seen = new Set();

        for (let page = startPage; page <= endPage; page++) {
            const pageRefs = index.get(page) || [];
            pageRefs.forEach(ref => {
                const key = `${ref.type}-${ref.dateKey || ref.entryNumber}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    refs.push({ ...ref, referencedPage: page });
                }
            });
        }

        return refs;
    }

    /**
     * Get navigation - find pages with cross-references near current page
     */
    getNavigation(bookType, currentPage) {
        let index;
        if (bookType === 'big-book') {
            index = this.bigBookIndex;
        } else if (bookType === 'aa-comes-of-age') {
            index = this.aaComesOfAgeIndex;
        } else {
            index = this.twelveAndTwelveIndex;
        }
        const pages = Array.from(index.keys()).sort((a, b) => a - b);

        // Find closest pages with refs
        let prevPage = null;
        let nextPage = null;

        for (const page of pages) {
            if (page < currentPage) {
                prevPage = page;
            } else if (page > currentPage && nextPage === null) {
                nextPage = page;
                break;
            }
        }

        return { prevPage, nextPage, totalPages: pages.length };
    }

    /**
     * Get statistics
     */
    getStats() {
        let totalBigBookRefs = 0;
        let total12And12Refs = 0;
        let totalAAComesOfAgeRefs = 0;

        for (const refs of this.bigBookIndex.values()) {
            totalBigBookRefs += refs.length;
        }
        for (const refs of this.twelveAndTwelveIndex.values()) {
            total12And12Refs += refs.length;
        }
        for (const refs of this.aaComesOfAgeIndex.values()) {
            totalAAComesOfAgeRefs += refs.length;
        }

        return {
            bigBookPagesIndexed: this.bigBookIndex.size,
            twelveAndTwelvePagesIndexed: this.twelveAndTwelveIndex.size,
            aaComesOfAgePagesIndexed: this.aaComesOfAgeIndex.size,
            totalBigBookReferences: totalBigBookRefs,
            totalTwelveAndTwelveReferences: total12And12Refs,
            totalAAComesOfAgeReferences: totalAAComesOfAgeRefs
        };
    }

    /**
     * Generate cross-reference panel HTML
     */
    generateCrossRefPanelHtml(refs, bookType, currentPage) {
        const nav = this.getNavigation(bookType, currentPage);

        let html = `
            <div class="crossref-panel">
                <div class="crossref-panel-header">
                    <h3>Cross-References</h3>
                    <span class="crossref-page-indicator">Page ${currentPage}</span>
                </div>
        `;

        if (refs.length === 0) {
            html += '<div class="crossref-empty">No cross-references for this page.</div>';
        } else {
            const dailyRefs = refs.filter(r => r.type === 'daily-reflection');
            const absitRefs = refs.filter(r => r.type === 'as-bill-sees-it');

            if (dailyRefs.length > 0) {
                html += `
                    <div class="crossref-group">
                        <h4 class="crossref-group-title">
                            <span class="crossref-icon">📅</span>
                            Daily Reflections (${dailyRefs.length})
                        </h4>
                        <ul class="crossref-list">
                `;
                dailyRefs.forEach(ref => {
                    html += `
                        <li class="crossref-item dr-item" data-type="daily-reflection" data-date="${ref.dateKey}">
                            <div class="crossref-item-wrapper">
                                <a href="#/book/daily-reflections" class="crossref-link" data-date="${ref.dateKey}">
                                    <div class="crossref-item-header">
                                        <span class="crossref-date">${ref.month} ${ref.day}</span>
                                        <span class="crossref-source-page">p. ${ref.sourcePages}</span>
                                    </div>
                                    <div class="crossref-title">${ref.title}</div>
                                    ${ref.quote ? `<div class="crossref-preview">${ref.quote}...</div>` : ''}
                                </a>
                                <button class="crossref-expand-btn" data-type="daily-reflection" data-date="${ref.dateKey}" title="Expand to read full reflection">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="crossref-expanded-content" style="display: none;"></div>
                        </li>
                    `;
                });
                html += '</ul></div>';
            }

            if (absitRefs.length > 0) {
                html += `
                    <div class="crossref-group">
                        <h4 class="crossref-group-title">
                            <span class="crossref-icon">📖</span>
                            As Bill Sees It (${absitRefs.length})
                        </h4>
                        <ul class="crossref-list">
                `;
                absitRefs.forEach(ref => {
                    html += `
                        <li class="crossref-item absit-item" data-type="as-bill-sees-it" data-entry="${ref.entryNumber}">
                            <div class="crossref-item-wrapper">
                                <a href="#/book/as-bill-sees-it" class="crossref-link" data-entry="${ref.entryNumber}">
                                    <div class="crossref-item-header">
                                        <span class="crossref-entry">#${ref.entryNumber}</span>
                                        <span class="crossref-source-page">${ref.sourceString}</span>
                                    </div>
                                    <div class="crossref-title">${ref.title}</div>
                                    ${ref.paragraphPreview ? `<div class="crossref-preview">${ref.paragraphPreview}...</div>` : ''}
                                </a>
                                <button class="crossref-expand-btn" data-type="as-bill-sees-it" data-entry="${ref.entryNumber}" title="Expand to read full entry">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="crossref-expanded-content" style="display: none;"></div>
                        </li>
                    `;
                });
                html += '</ul></div>';
            }
        }

        // Navigation buttons
        html += `
            <div class="crossref-nav">
                <button class="btn btn-secondary crossref-nav-btn" id="crossref-prev" ${nav.prevPage === null ? 'disabled' : ''} data-page="${nav.prevPage}">
                    ← Prev (p.${nav.prevPage || '-'})
                </button>
                <button class="btn btn-secondary crossref-nav-btn" id="crossref-next" ${nav.nextPage === null ? 'disabled' : ''} data-page="${nav.nextPage}">
                    Next (p.${nav.nextPage || '-'}) →
                </button>
            </div>
        `;

        html += '</div>';
        return html;
    }
}

// Export page-based cross-reference index singleton
export const pageCrossRef = new PageCrossRefIndex();
