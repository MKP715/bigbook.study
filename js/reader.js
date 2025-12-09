/**
 * Reader component for AA Literature Study
 */

import { annotations } from './annotations.js';
import { pageCrossRef } from './crossref.js';
import { toolbar } from './ui/toolbar.js';
import { modal } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { dictionaryPopup } from './ui/dictionaryPopup.js';
import * as db from './db.js';

class Reader {
    constructor() {
        this.contentEl = document.getElementById('reader-content');
        this.pageNavEl = document.getElementById('page-nav');
        this.pageInput = document.getElementById('page-input');
        this.totalPagesEl = document.getElementById('total-pages');
        this.prevBtn = document.getElementById('prev-page');
        this.nextBtn = document.getElementById('next-page');

        this.currentBook = null;
        this.currentChapter = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.pageMap = new Map(); // page number -> paragraph ids

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Page navigation (with null checks)
        this.prevBtn?.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.nextBtn?.addEventListener('click', () => this.goToPage(this.currentPage + 1));

        this.pageInput?.addEventListener('change', (e) => {
            const page = parseInt(e.target.value, 10);
            if (page >= 1 && page <= this.totalPages) {
                this.goToPage(page);
            }
        });

        // Text selection for annotations (with null check)
        this.contentEl?.addEventListener('mouseup', (e) => this.handleTextSelection(e));

        // Click on annotation (with null check)
        this.contentEl?.addEventListener('click', (e) => {
            const annotationEl = e.target.closest('[data-annotation-id]');
            if (annotationEl) {
                this.handleAnnotationClick(annotationEl, e);
                return;
            }

            // Handle auto cross-reference clicks
            const autoRefEl = e.target.closest('.auto-ref');
            if (autoRefEl) {
                this.handleAutoRefClick(autoRefEl, e);
            }
        });

        // Setup annotation toolbar callbacks
        toolbar.on('highlight', async (color, info) => {
            if (info && info.text) {
                await annotations.addHighlight(
                    info.bookId,
                    info.paragraphId,
                    info.startOffset,
                    info.endOffset,
                    info.text,
                    color
                );
                this.refreshContent();
            }
        });

        toolbar.on('underline', async (style, info) => {
            if (info && info.text) {
                await annotations.addUnderline(
                    info.bookId,
                    info.paragraphId,
                    info.startOffset,
                    info.endOffset,
                    info.text,
                    style
                );
                this.refreshContent();
            }
        });

        toolbar.on('comment', async (info) => {
            if (info && info.text) {
                const result = await modal.showCommentModal(info.text);
                if (result && result.content) {
                    await annotations.addComment(
                        info.bookId,
                        info.paragraphId,
                        info.startOffset,
                        info.endOffset,
                        info.text,
                        result.content
                    );
                    this.refreshContent();
                }
            }
        });

        toolbar.on('question', async (info) => {
            if (info && info.text) {
                const result = await modal.showQuestionModal(info.text);
                if (result && result.content) {
                    await annotations.addQuestion(
                        info.bookId,
                        info.paragraphId,
                        info.startOffset,
                        info.endOffset,
                        info.text,
                        result.content,
                        result.answer
                    );
                    this.refreshContent();
                }
            }
        });

        toolbar.on('definition', async (info) => {
            if (info && info.text && info.range) {
                // Get first word if multiple words selected
                const word = info.text.split(/\s+/)[0];
                const rect = info.range.getBoundingClientRect();

                // Show dictionary popup with API lookup + custom definition
                dictionaryPopup.show(word, rect.left, rect.bottom + window.scrollY);
            }
        });
    }

    /**
     * Handle text selection
     */
    handleTextSelection(e) {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text.length > 0) {
            // Find the paragraph
            let node = selection.anchorNode;
            while (node && !node.classList?.contains('paragraph')) {
                node = node.parentElement;
            }

            if (node && this.currentBook) {
                const paragraphId = node.dataset.paragraphId;
                const rect = selection.getRangeAt(0).getBoundingClientRect();

                toolbar.show(
                    rect.left + rect.width / 2,
                    rect.top + window.scrollY,
                    selection,
                    this.currentBook.metadata.id,
                    paragraphId
                );
            }
        } else {
            toolbar.hide();
        }
    }

    /**
     * Handle click on annotation
     */
    async handleAnnotationClick(element, event) {
        const annotationId = element.dataset.annotationId;
        const allAnnotations = await annotations.getAll();
        const annotation = allAnnotations.find(a => a.id === annotationId);

        if (annotation) {
            event.preventDefault();
            event.stopPropagation();
            const rect = element.getBoundingClientRect();
            annotations.showPopover(annotation, rect.left, rect.bottom + window.scrollY + 5);
        }
    }

    /**
     * Display a book
     */
    async displayBook(book) {
        this.currentBook = book;
        this.currentChapter = null;

        // Load annotations
        await annotations.loadForBook(book.metadata.id);

        if (book.reflections) {
            // Daily Reflections format
            await this.displayDailyReflections(book);
        } else if (book.entries) {
            // As Bill Sees It format
            await this.displayAsBillSeesIt(book);
        } else if (book.theSteps && book.theTraditions) {
            // Twelve Steps and Twelve Traditions format (new structure)
            await this.displayTwelveAndTwelve(book);
        } else if (book.content && book.content.frontMatter) {
            // Big Book format
            await this.displayBigBook(book);
        } else if (book.structure && book.structure.chapters) {
            // AA Comes of Age format
            await this.displayAAComesOfAge(book);
        } else if (book.articles && Array.isArray(book.articles)) {
            // Language of the Heart format
            await this.displayLanguageOfTheHeart(book);
        } else if (book.tableOfContents && book.content && book.content.sections) {
            // Big Book Study Guide format
            await this.displayStudyGuide(book);
        } else if (book.content) {
            // Standard book format
            await this.displayStandardBook(book);
        }
    }

    /**
     * Display Twelve Steps and Twelve Traditions
     */
    async displayTwelveAndTwelve(book) {
        // Show Step 1 by default
        if (book.theSteps && book.theSteps.length > 0) {
            await this.displayStepOrTradition(book, book.theSteps[0], 'step');
        }

        // Hide page navigation
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');
    }

    /**
     * Display a single Step or Tradition
     */
    async displayStepOrTradition(book, chapter, type) {
        this.currentChapter = { ...chapter, itemType: type };
        const bookAnnotations = await annotations.loadForBook(book.metadata.id);
        const isStep = type === 'step';
        const typeLabel = isStep ? 'Step' : 'Tradition';

        // Group paragraphs by page for book-like display
        let paragraphsHtml = '';
        if (chapter.content && chapter.content.length > 0) {
            const pageGroups = new Map();
            chapter.content.forEach((para, idx) => {
                const pageNum = para.pdfPage || 0;
                if (!pageGroups.has(pageNum)) {
                    pageGroups.set(pageNum, []);
                }
                pageGroups.get(pageNum).push({ para, idx });
            });

            const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);

            for (const pageNum of sortedPages) {
                const pageParagraphs = pageGroups.get(pageNum);
                const pageContent = pageParagraphs.map(({ para, idx }) => {
                    const paraId = `${type}-${chapter.number}-p${idx + 1}`;
                    let text = para.text || '';

                    // Normalize quotes (convert curly quotes to straight quotes)
                    text = this.normalizeQuotes(text);

                    // Apply formatting if present
                    if (para.formatting && Array.isArray(para.formatting)) {
                        para.formatting.forEach(fmt => {
                            if (fmt.type === 'bold' && fmt.text) {
                                text = text.replace(fmt.text, `<strong>${fmt.text}</strong>`);
                            }
                            if (fmt.type === 'italic' && fmt.text) {
                                text = text.replace(fmt.text, `<em>${fmt.text}</em>`);
                            }
                        });
                    }

                    // Apply annotations
                    text = annotations.applyToContent(text, bookAnnotations, paraId);

                    // Apply automatic cross-references
                    text = this.applyAutoCrossReferences(text);

                    return `<div class="step-paragraph paragraph" data-paragraph-id="${paraId}" data-page="${para.pdfPage || ''}"><p>${text}</p></div>`;
                }).join('');

                if (pageNum > 0) {
                    paragraphsHtml += `<div class="book-page" data-page="p. ${pageNum}">${pageContent}</div>`;
                } else {
                    paragraphsHtml += pageContent;
                }
            }
        } else {
            paragraphsHtml = '<p class="empty-content">Content not yet available.</p>';
        }

        // Get steps and traditions arrays
        const steps = book.theSteps || [];
        const traditions = book.theTraditions || [];

        // Combined list for navigation
        const allItems = [
            ...steps.map(s => ({ ...s, itemType: 'step' })),
            ...traditions.map(t => ({ ...t, itemType: 'tradition' }))
        ];

        const currentIndex = allItems.findIndex(item =>
            item.number === chapter.number && item.itemType === type
        );

        // Get cross-references for this step/tradition's page range
        const startPage = chapter.pageRange?.start || 1;
        const endPage = chapter.pageRange?.end || (startPage + 15);
        const crossRefs = pageCrossRef.getRefsForPageRange('twelve-and-twelve', startPage, endPage);
        const crossRefHtml = this.generateCrossRefSidebarHtml(crossRefs, 'twelve-and-twelve', startPage);

        this.contentEl.innerHTML = `
            <div class="step-tradition-view with-crossrefs">
                <div class="step-main-content">
                    <div class="step-tradition-header ${isStep ? 'step-header-bg' : 'tradition-header-bg'}">
                        <div class="step-number-badge">${chapter.number}</div>
                        <div class="step-header-content">
                            <h2 class="step-title">${typeLabel} ${chapter.number}</h2>
                            <p class="step-text">${this.normalizeQuotes(chapter.officialText) || ''}</p>
                        </div>
                        <div class="step-pages">pp. ${chapter.pageRange?.start || ''}-${chapter.pageRange?.end || ''}</div>
                    </div>

                    <div class="step-content">
                        ${paragraphsHtml}
                    </div>

                    ${this.getCrossRefLegendHtml()}

                    <div class="step-nav">
                        <button class="btn btn-secondary" id="prev-step">
                            Previous
                        </button>
                        <button class="btn btn-secondary" id="step-picker-btn">
                            Go to Step/Tradition
                        </button>
                        <button class="btn btn-secondary" id="next-step">
                            Next
                        </button>
                    </div>
                </div>
                <aside class="crossref-sidebar">
                    <div class="crossref-sidebar-header">
                        <h3>Study References</h3>
                        <button class="btn-icon crossref-toggle" title="Toggle references">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                    </div>
                    ${crossRefHtml}
                </aside>
            </div>
        `;

        // Navigation buttons
        const prevBtn = this.contentEl.querySelector('#prev-step');
        const nextBtn = this.contentEl.querySelector('#next-step');
        const pickerBtn = this.contentEl.querySelector('#step-picker-btn');

        prevBtn.addEventListener('click', () => {
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : allItems.length - 1;
            const prevItem = allItems[prevIndex];
            this.displayStepOrTradition(book, prevItem, prevItem.itemType);
        });

        nextBtn.addEventListener('click', () => {
            const nextIndex = currentIndex < allItems.length - 1 ? currentIndex + 1 : 0;
            const nextItem = allItems[nextIndex];
            this.displayStepOrTradition(book, nextItem, nextItem.itemType);
        });

        pickerBtn.addEventListener('click', async () => {
            // Store references for use in callbacks
            const bookRef = book;
            const stepsRef = steps;
            const traditionsRef = traditions;
            let quickBtnClicked = false;

            const result = await modal.open({
                title: 'Go to Step or Tradition',
                body: `
                    <div class="form-group">
                        <label class="form-label">Steps</label>
                        <div class="step-tradition-grid" id="step-grid">
                            ${steps.map(s => `
                                <button type="button" class="step-quick-btn" data-type="step" data-num="${s.number}" ${s.number === chapter.number && type === 'step' ? 'style="box-shadow: 0 0 0 3px rgba(156, 39, 176, 0.5);"' : ''}>
                                    ${s.number}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group" style="margin-top: 16px;">
                        <label class="form-label">Traditions</label>
                        <div class="step-tradition-grid" id="tradition-grid">
                            ${traditions.map(t => `
                                <button type="button" class="step-quick-btn tradition-btn" data-type="tradition" data-num="${t.number}" ${t.number === chapter.number && type === 'tradition' ? 'style="box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.5);"' : ''}>
                                    ${t.number}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group" style="margin-top: 16px;">
                        <label class="form-label">Or select from list</label>
                        <select class="form-input" name="selection" id="step-select">
                            <option value="">-- Select --</option>
                            <optgroup label="Steps">
                                ${steps.map(s => `<option value="step-${s.number}">Step ${s.number}</option>`).join('')}
                            </optgroup>
                            <optgroup label="Traditions">
                                ${traditions.map(t => `<option value="tradition-${t.number}">Tradition ${t.number}</option>`).join('')}
                            </optgroup>
                        </select>
                    </div>
                `,
                confirmText: 'Go',
                onOpen: (modalBody) => {
                    // Attach click handlers directly to quick buttons in modal
                    modalBody.querySelectorAll('.step-quick-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const itemType = btn.dataset.type;
                            const num = parseInt(btn.dataset.num, 10);
                            const targetArray = itemType === 'step' ? stepsRef : traditionsRef;
                            const target = targetArray.find(item => item.number === num);
                            if (target) {
                                quickBtnClicked = true;
                                modal.close({ quickNav: true, type: itemType, num: num });
                            }
                        });
                    });
                }
            });

            // Handle navigation
            if (result) {
                if (result.quickNav) {
                    // Quick button was clicked
                    const targetArray = result.type === 'step' ? stepsRef : traditionsRef;
                    const target = targetArray.find(item => item.number === result.num);
                    if (target) {
                        this.displayStepOrTradition(bookRef, target, result.type);
                    }
                } else if (result.selection) {
                    // Dropdown selection
                    const [selType, selNum] = result.selection.split('-');
                    const num = parseInt(selNum, 10);
                    const targetArray = selType === 'step' ? stepsRef : traditionsRef;
                    const target = targetArray.find(item => item.number === num);
                    if (target) {
                        this.displayStepOrTradition(bookRef, target, selType);
                    }
                }
            }
        });

        // Save reading progress
        await db.saveReadingProgress(book.metadata.id, {
            type: type,
            number: chapter.number
        });

        // Setup cross-reference sidebar
        this.setupCrossRefSidebar();
    }

    /**
     * Display Big Book - show first chapter by default
     */
    async displayBigBook(book) {
        // Show Bill's Story (Chapter 1) by default
        await this.displayBigBookContent(book, 'chapter-1');
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');
    }

    /**
     * Display Big Book content based on contentId
     */
    async displayBigBookContent(book, contentId) {
        const bookAnnotations = await annotations.loadForBook(book.metadata.id);

        // Parse the content ID to determine what to display
        if (contentId === 'preface') {
            await this.displayBigBookPreface(book, bookAnnotations);
        } else if (contentId.startsWith('foreword-')) {
            const year = parseInt(contentId.replace('foreword-', ''), 10);
            await this.displayBigBookForeword(book, year, bookAnnotations);
        } else if (contentId === 'doctors-opinion') {
            await this.displayBigBookDoctorsOpinion(book, bookAnnotations);
        } else if (contentId.startsWith('chapter-')) {
            const chapterNum = parseInt(contentId.replace('chapter-', ''), 10);
            await this.displayBigBookChapter(book, chapterNum, bookAnnotations);
        } else if (contentId.startsWith('story-')) {
            const parts = contentId.replace('story-', '').split('-');
            const partNum = parseInt(parts[0], 10);
            const storyNum = parseInt(parts[1], 10);
            await this.displayBigBookStory(book, partNum, storyNum, bookAnnotations);
        } else if (contentId.startsWith('appendix-')) {
            const appendixNum = contentId.replace('appendix-', '');
            await this.displayBigBookAppendix(book, appendixNum, bookAnnotations);
        } else if (contentId === 'study-passages') {
            await this.displayStudyPassages(book);
        } else if (contentId === 'study-steps') {
            await this.displayStudySteps(book);
        } else if (contentId === 'study-glossary') {
            await this.displayStudyGlossary(book);
        } else if (contentId === 'study-topics') {
            await this.displayStudyTopics(book);
        } else if (contentId === 'study-reading-plans') {
            await this.displayStudyReadingPlans(book);
        } else if (contentId === 'study-inventory') {
            await this.displayStudyInventory(book);
        } else if (contentId === 'study-history') {
            await this.displayStudyHistory(book);
        } else {
            // Default to chapter 1
            await this.displayBigBookChapter(book, 1, bookAnnotations);
        }

        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');
    }

    /**
     * Format Big Book paragraph with italic/bold support
     */
    formatBigBookParagraph(paragraph, paragraphId, bookAnnotations) {
        let text = '';

        // Check if this is an ASCII table - use plainText and preserve formatting
        if (this.isAsciiTable(paragraph)) {
            text = paragraph.plainText || '';
            // Escape HTML entities for safe display
            text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            // Don't apply annotations or cross-references to tables
            return text;
        }

        if (paragraph.content && Array.isArray(paragraph.content)) {
            text = paragraph.content.map(segment => {
                let segmentText = segment.text || '';
                // Normalize quotes
                segmentText = this.normalizeQuotes(segmentText);
                if (segment.italic) {
                    segmentText = `<em>${segmentText}</em>`;
                }
                if (segment.bold) {
                    segmentText = `<strong>${segmentText}</strong>`;
                }
                return segmentText;
            }).join('');
        } else if (paragraph.plainText) {
            text = this.normalizeQuotes(paragraph.plainText);
        }

        // Apply annotations
        text = annotations.applyToContent(text, bookAnnotations, paragraphId);

        // Apply auto cross-references
        text = this.applyAutoCrossReferences(text);

        return text;
    }

    /**
     * Get CSS classes for paragraph based on formatting properties
     */
    getParagraphClasses(paragraph) {
        const classes = ['bb-paragraph', 'paragraph'];

        if (paragraph.isBlockQuote) {
            classes.push('block-quote');
        }

        // Detect ASCII tables (start with +-- or contain table borders)
        if (this.isAsciiTable(paragraph)) {
            classes.push('ascii-table');
        }

        if (paragraph.formatting) {
            const fmt = paragraph.formatting;

            if (fmt.isDropCap) {
                classes.push('drop-cap');
            }
            if (fmt.isFootnote) {
                classes.push('footnote');
            }
            if (fmt.isList) {
                classes.push('list-item');
                if (fmt.listType) {
                    classes.push(`list-${fmt.listType.replace('_', '-')}`);
                }
            }
            if (fmt.isStepNumber) {
                classes.push('step-number');
            }
            if (fmt.isTraditionNumber) {
                classes.push('tradition-number');
            }
            if (fmt.isConceptNumber) {
                classes.push('concept-number');
            }
            if (fmt.alignment && fmt.alignment !== 'left') {
                classes.push(`align-${fmt.alignment}`);
            }
            if (fmt.pageBreakBefore) {
                classes.push('page-break-before');
            }
            if (fmt.isPageStart) {
                classes.push('page-start');
            }
        }

        return classes.join(' ');
    }

    /**
     * Check if paragraph contains an ASCII table
     */
    isAsciiTable(paragraph) {
        const plainText = paragraph.plainText || '';
        return plainText.includes('+--') && plainText.includes('|');
    }

    /**
     * Display Big Book Preface
     */
    async displayBigBookPreface(book, bookAnnotations) {
        const preface = book.content.frontMatter.preface;

        // Group paragraphs by page
        const pageGroups = new Map();
        preface.paragraphs.forEach((para, idx) => {
            const pageNum = para.pageNumber || 0;
            if (!pageGroups.has(pageNum)) {
                pageGroups.set(pageNum, []);
            }
            pageGroups.get(pageNum).push({ para, idx });
        });

        let paragraphsHtml = '';
        const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);

        for (const pageNum of sortedPages) {
            const pageParagraphs = pageGroups.get(pageNum);
            const pageContent = pageParagraphs.map(({ para, idx }) => {
                const paraId = `bb-preface-p${idx + 1}`;
                const text = this.formatBigBookParagraph(para, paraId, bookAnnotations);
                const classes = this.getParagraphClasses(para);
                return `<div class="${classes}" data-paragraph-id="${paraId}"><p>${text}</p></div>`;
            }).join('');

            if (pageNum > 0) {
                paragraphsHtml += `<div class="book-page" data-page="p. ${pageNum}">${pageContent}</div>`;
            } else {
                paragraphsHtml += pageContent;
            }
        }

        this.contentEl.innerHTML = `
            <div class="bb-content-view">
                <div class="bb-header">
                    <h2 class="bb-title">${preface.title}</h2>
                </div>
                <div class="bb-content">
                    ${paragraphsHtml}
                </div>
                ${this.getBigBookNavHtml(book, 'preface')}
            </div>
        `;

        this.setupBigBookNavigation(book);
    }

    /**
     * Display Big Book Foreword
     */
    async displayBigBookForeword(book, year, bookAnnotations) {
        const foreword = book.content.frontMatter.forewords.find(fw => fw.year === year);
        if (!foreword) return;

        // Group paragraphs by page
        const pageGroups = new Map();
        foreword.paragraphs.forEach((para, idx) => {
            const pageNum = para.pageNumber || 0;
            if (!pageGroups.has(pageNum)) {
                pageGroups.set(pageNum, []);
            }
            pageGroups.get(pageNum).push({ para, idx });
        });

        let paragraphsHtml = '';
        const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);

        for (const pageNum of sortedPages) {
            const pageParagraphs = pageGroups.get(pageNum);
            const pageContent = pageParagraphs.map(({ para, idx }) => {
                const paraId = `bb-foreword-${year}-p${idx + 1}`;
                const text = this.formatBigBookParagraph(para, paraId, bookAnnotations);
                const classes = this.getParagraphClasses(para);
                return `<div class="${classes}" data-paragraph-id="${paraId}"><p>${text}</p></div>`;
            }).join('');

            if (pageNum > 0) {
                paragraphsHtml += `<div class="book-page" data-page="p. ${pageNum}">${pageContent}</div>`;
            } else {
                paragraphsHtml += pageContent;
            }
        }

        this.contentEl.innerHTML = `
            <div class="bb-content-view">
                <div class="bb-header">
                    <h2 class="bb-title">Foreword to ${foreword.edition}</h2>
                    <span class="bb-year">${foreword.year}</span>
                </div>
                <div class="bb-content">
                    ${paragraphsHtml}
                </div>
                ${this.getBigBookNavHtml(book, `foreword-${year}`)}
            </div>
        `;

        this.setupBigBookNavigation(book);
    }

    /**
     * Display Big Book Doctor's Opinion
     */
    async displayBigBookDoctorsOpinion(book, bookAnnotations) {
        const doctorsOpinion = book.content.frontMatter.doctorsOpinion;

        // Group paragraphs by page
        const pageGroups = new Map();
        doctorsOpinion.paragraphs.forEach((para, idx) => {
            const pageNum = para.pageNumber || 0;
            if (!pageGroups.has(pageNum)) {
                pageGroups.set(pageNum, []);
            }
            pageGroups.get(pageNum).push({ para, idx });
        });

        let paragraphsHtml = '';
        const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);

        for (const pageNum of sortedPages) {
            const pageParagraphs = pageGroups.get(pageNum);
            const pageContent = pageParagraphs.map(({ para, idx }) => {
                const paraId = `bb-doctors-opinion-p${idx + 1}`;
                const text = this.formatBigBookParagraph(para, paraId, bookAnnotations);
                const classes = this.getParagraphClasses(para);
                return `<div class="${classes}" data-paragraph-id="${paraId}" data-page="${para.pageNumber || ''}"><p>${text}</p></div>`;
            }).join('');

            if (pageNum > 0) {
                paragraphsHtml += `<div class="book-page" data-page="p. ${pageNum}">${pageContent}</div>`;
            } else {
                paragraphsHtml += pageContent;
            }
        }

        // Get Study Guide section for Doctor's Opinion
        const studyGuideSection = this.getStudyGuideSectionForBigBookChapter(null, 'doctors-opinion');

        this.contentEl.innerHTML = `
            <div class="bb-content-view">
                <div class="bb-header">
                    <h2 class="bb-title">${doctorsOpinion.title}</h2>
                    <div class="bb-header-meta">
                        <span class="bb-author">by ${doctorsOpinion.author}</span>
                        ${studyGuideSection ? `
                            <a href="#/book/study-guide/chapter/${studyGuideSection}" class="btn btn-accent bb-study-guide-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                                Study Guide
                            </a>
                        ` : ''}
                    </div>
                </div>
                <div class="bb-content">
                    ${paragraphsHtml}
                </div>
                ${this.getBigBookNavHtml(book, 'doctors-opinion')}
            </div>
        `;

        this.setupBigBookNavigation(book);
    }

    /**
     * Display Big Book Chapter
     */
    async displayBigBookChapter(book, chapterNum, bookAnnotations) {
        const chapter = book.content.mainText.chapters.find(ch => ch.chapterNumber === chapterNum);
        if (!chapter) return;

        // Debug: Log chapter page info
        console.log(`[DEBUG] Chapter ${chapterNum}: pageStart=${chapter.pageStart}, pageEnd=${chapter.pageEnd}`);
        console.log(`[DEBUG] First paragraph pageNumber:`, chapter.paragraphs[0]?.pageNumber);

        // Group paragraphs by page for book-like display
        const pageGroups = new Map();
        chapter.paragraphs.forEach((para, idx) => {
            const pageNum = para.pageNumber || 0;
            if (!pageGroups.has(pageNum)) {
                pageGroups.set(pageNum, []);
            }
            pageGroups.get(pageNum).push({ para, idx });
        });

        // Build HTML with paragraphs grouped by page
        let paragraphsHtml = '';
        const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);
        console.log(`[DEBUG] Chapter ${chapterNum} page groups:`, sortedPages);

        for (const pageNum of sortedPages) {
            const pageParagraphs = pageGroups.get(pageNum);
            const pageContent = pageParagraphs.map(({ para, idx }) => {
                const paraId = `bb-ch${chapterNum}-p${idx + 1}`;
                const text = this.formatBigBookParagraph(para, paraId, bookAnnotations);
                const classes = this.getParagraphClasses(para);
                return `<div class="${classes}" data-paragraph-id="${paraId}" data-page="${para.pageNumber || ''}"><p>${text}</p></div>`;
            }).join('');

            if (pageNum > 0) {
                paragraphsHtml += `<div class="book-page" data-page="p. ${pageNum}">${pageContent}</div>`;
            } else {
                paragraphsHtml += pageContent;
            }
        }

        // Get cross-references for this chapter's page range
        const startPage = chapter.pageStart || 1;
        const endPage = chapter.pageEnd || (startPage + 20);
        const crossRefs = pageCrossRef.getRefsForPageRange('big-book', startPage, endPage);
        const crossRefHtml = this.generateCrossRefSidebarHtml(crossRefs, 'big-book', startPage);

        // Get Study Guide section for this chapter
        const studyGuideSection = this.getStudyGuideSectionForBigBookChapter(chapterNum, 'chapter');

        this.contentEl.innerHTML = `
            <div class="bb-content-view with-crossrefs">
                <div class="bb-main-content">
                    <div class="bb-header bb-chapter-header">
                        <div class="bb-chapter-number">Chapter ${chapter.chapterNumber}</div>
                        <h2 class="bb-title">${chapter.title}</h2>
                        <div class="bb-header-meta">
                            ${chapter.pageStart ? `<span class="bb-page-range">Pages ${chapter.pageStart}${chapter.pageEnd ? '-' + chapter.pageEnd : '+'}</span>` : ''}
                            ${studyGuideSection ? `
                                <a href="#/book/study-guide/chapter/${studyGuideSection}" class="btn btn-accent bb-study-guide-btn">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                    </svg>
                                    Study Guide
                                </a>
                            ` : ''}
                        </div>
                    </div>
                    <div class="bb-content">
                        ${paragraphsHtml}
                    </div>
                    ${this.getCrossRefLegendHtml()}
                    ${this.getBigBookNavHtml(book, `chapter-${chapterNum}`)}
                </div>
                <aside class="crossref-sidebar">
                    <div class="crossref-sidebar-header">
                        <h3>Study References</h3>
                        <button class="btn-icon crossref-toggle" title="Toggle references">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                    </div>
                    ${crossRefHtml}
                </aside>
            </div>
        `;

        this.setupBigBookNavigation(book);
        this.setupCrossRefSidebar();
    }

    /**
     * Display Big Book Personal Story
     */
    async displayBigBookStory(book, partNum, storyNum, bookAnnotations) {
        const part = book.content.personalStories.parts.find(p => p.partNumber === partNum);
        if (!part) return;

        // storyNum is 1-indexed position from TOC, convert to 0-indexed array access
        const storyIndex = storyNum - 1;
        const story = part.stories[storyIndex];
        if (!story) return;

        // Group paragraphs by page
        const pageGroups = new Map();
        story.paragraphs.forEach((para, idx) => {
            const pageNum = para.pageNumber || 0;
            if (!pageGroups.has(pageNum)) {
                pageGroups.set(pageNum, []);
            }
            pageGroups.get(pageNum).push({ para, idx });
        });

        let paragraphsHtml = '';
        const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);

        for (const pageNum of sortedPages) {
            const pageParagraphs = pageGroups.get(pageNum);
            const pageContent = pageParagraphs.map(({ para, idx }) => {
                const paraId = `bb-story-${partNum}-${storyNum}-p${idx + 1}`;
                const text = this.formatBigBookParagraph(para, paraId, bookAnnotations);
                const classes = this.getParagraphClasses(para);
                return `<div class="${classes}" data-paragraph-id="${paraId}" data-page="${para.pageNumber || ''}"><p>${text}</p></div>`;
            }).join('');

            if (pageNum > 0) {
                paragraphsHtml += `<div class="book-page" data-page="p. ${pageNum}">${pageContent}</div>`;
            } else {
                paragraphsHtml += pageContent;
            }
        }

        this.contentEl.innerHTML = `
            <div class="bb-content-view">
                <div class="bb-header bb-story-header">
                    <div class="bb-story-part">Part ${part.partNumber}: ${part.title}</div>
                    <h2 class="bb-title">${story.title}</h2>
                    ${story.subtitle ? `<p class="bb-subtitle">${story.subtitle}</p>` : ''}
                    ${story.pageStart ? `<span class="bb-page-range">Starting page ${story.pageStart}</span>` : ''}
                </div>
                <div class="bb-content">
                    ${paragraphsHtml}
                </div>
                ${this.getCrossRefLegendHtml()}
                ${this.getBigBookNavHtml(book, `story-${partNum}-${storyNum}`)}
            </div>
        `;

        this.setupBigBookNavigation(book);
    }

    /**
     * Display Big Book Appendix
     */
    async displayBigBookAppendix(book, appendixNum, bookAnnotations) {
        const appendix = book.content.appendices.find(app => app.appendixNumber === appendixNum);
        if (!appendix) return;

        // Group paragraphs by page
        const pageGroups = new Map();
        appendix.paragraphs.forEach((para, idx) => {
            const pageNum = para.pageNumber || 0;
            if (!pageGroups.has(pageNum)) {
                pageGroups.set(pageNum, []);
            }
            pageGroups.get(pageNum).push({ para, idx });
        });

        let paragraphsHtml = '';
        const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);

        for (const pageNum of sortedPages) {
            const pageParagraphs = pageGroups.get(pageNum);
            const pageContent = pageParagraphs.map(({ para, idx }) => {
                const paraId = `bb-appendix-${appendixNum}-p${idx + 1}`;
                const text = this.formatBigBookParagraph(para, paraId, bookAnnotations);
                const classes = this.getParagraphClasses(para);
                return `<div class="${classes}" data-paragraph-id="${paraId}" data-page="${para.pageNumber || ''}"><p>${text}</p></div>`;
            }).join('');

            if (pageNum > 0) {
                paragraphsHtml += `<div class="book-page" data-page="p. ${pageNum}">${pageContent}</div>`;
            } else {
                paragraphsHtml += pageContent;
            }
        }

        this.contentEl.innerHTML = `
            <div class="bb-content-view">
                <div class="bb-header bb-appendix-header">
                    <div class="bb-appendix-number">Appendix ${appendix.appendixNumber}</div>
                    <h2 class="bb-title">${appendix.title}</h2>
                    ${appendix.pageStart ? `<span class="bb-page-range">Starting page ${appendix.pageStart}</span>` : ''}
                </div>
                <div class="bb-content">
                    ${paragraphsHtml}
                </div>
                ${this.getBigBookNavHtml(book, `appendix-${appendixNum}`)}
            </div>
        `;

        this.setupBigBookNavigation(book);
    }

    /**
     * Get Big Book navigation order
     */
    getBigBookNavOrder(book) {
        const order = [];

        // Front matter
        if (book.content.frontMatter.preface) {
            order.push('preface');
        }
        if (book.content.frontMatter.forewords) {
            book.content.frontMatter.forewords.forEach(fw => {
                order.push(`foreword-${fw.year}`);
            });
        }
        if (book.content.frontMatter.doctorsOpinion) {
            order.push('doctors-opinion');
        }

        // Chapters
        if (book.content.mainText && book.content.mainText.chapters) {
            book.content.mainText.chapters.forEach(ch => {
                order.push(`chapter-${ch.chapterNumber}`);
            });
        }

        // Personal Stories - use 1-indexed array position to match TOC links
        if (book.content.personalStories && book.content.personalStories.parts) {
            book.content.personalStories.parts.forEach(part => {
                part.stories.forEach((_story, idx) => {
                    order.push(`story-${part.partNumber}-${idx + 1}`);
                });
            });
        }

        // Appendices
        if (book.content.appendices) {
            book.content.appendices.forEach(app => {
                order.push(`appendix-${app.appendixNumber}`);
            });
        }

        return order;
    }

    /**
     * Get Big Book navigation HTML
     */
    getBigBookNavHtml(book, currentId) {
        return `
            <div class="bb-nav" style="display: flex; justify-content: space-between; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                <button class="btn btn-secondary" id="bb-prev">Previous</button>
                <button class="btn btn-secondary" id="bb-toc-btn">Table of Contents</button>
                <button class="btn btn-secondary" id="bb-next">Next</button>
            </div>
        `;
    }

    /**
     * Setup Big Book navigation buttons
     */
    setupBigBookNavigation(book) {
        const prevBtn = this.contentEl.querySelector('#bb-prev');
        const nextBtn = this.contentEl.querySelector('#bb-next');
        const tocBtn = this.contentEl.querySelector('#bb-toc-btn');

        if (!prevBtn || !nextBtn) return;

        const navOrder = this.getBigBookNavOrder(book);
        const currentId = this.getCurrentBigBookContentId();
        const currentIndex = navOrder.indexOf(currentId);

        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                const prevId = navOrder[currentIndex - 1];
                window.location.hash = `/book/big-book/chapter/${prevId}`;
            }
        });

        nextBtn.addEventListener('click', () => {
            if (currentIndex < navOrder.length - 1) {
                const nextId = navOrder[currentIndex + 1];
                window.location.hash = `/book/big-book/chapter/${nextId}`;
            }
        });

        prevBtn.disabled = currentIndex <= 0;
        nextBtn.disabled = currentIndex >= navOrder.length - 1;

        tocBtn?.addEventListener('click', () => {
            this.showBigBookTableOfContents(book);
        });
    }

    /**
     * Get current Big Book content ID from URL
     */
    getCurrentBigBookContentId() {
        const hash = window.location.hash;
        const match = hash.match(/\/book\/big-book\/chapter\/(.+)$/);
        return match ? match[1] : 'chapter-1';
    }

    /**
     * Show Big Book Table of Contents
     */
    async showBigBookTableOfContents(book) {
        // Build a map of edition names to foreword years from the book data
        const forewordYearMap = {};
        if (book.content?.frontMatter?.forewords) {
            book.content.frontMatter.forewords.forEach(fw => {
                forewordYearMap[fw.edition] = fw.year;
            });
        }

        const tocHtml = book.tableOfContents.map(section => {
            let itemsHtml = '';

            if (section.items) {
                itemsHtml = section.items.map(item => {
                    if (typeof item === 'string') {
                        // Front matter items need special handling to match displayBigBookContent IDs
                        let itemId;
                        if (item === 'Preface') {
                            itemId = 'preface';
                        } else if (item === "The Doctor's Opinion") {
                            itemId = 'doctors-opinion';
                        } else if (forewordYearMap[item]) {
                            // Forewords use the year format (e.g., "First Edition" → "foreword-1939")
                            itemId = `foreword-${forewordYearMap[item]}`;
                        } else {
                            // Fallback to slugified version
                            itemId = item.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
                        }
                        return `<li><a href="#/book/big-book/chapter/${itemId}" class="toc-link">${item}</a></li>`;
                    } else {
                        // Object with num and title - check if it's an appendix (Roman numerals) or chapter
                        const isAppendix = section.section === 'Appendices' || /^[IVXLCDM]+$/i.test(item.num);
                        const prefix = isAppendix ? 'appendix' : 'chapter';
                        return `<li><a href="#/book/big-book/chapter/${prefix}-${item.num}" class="toc-link">${item.num}. ${item.title}</a></li>`;
                    }
                }).join('');
            }

            if (section.parts) {
                itemsHtml = section.parts.map(part => {
                    const storiesHtml = part.stories.map((story, idx) =>
                        `<li><a href="#/book/big-book/chapter/story-${part.part}-${idx + 1}" class="toc-link">${story}</a></li>`
                    ).join('');
                    return `
                        <li class="toc-part">
                            <strong>Part ${part.part}: ${part.title}</strong>
                            <ul>${storiesHtml}</ul>
                        </li>
                    `;
                }).join('');
            }

            return `
                <div class="toc-section">
                    <h3 class="toc-section-title">${section.section}</h3>
                    <ul class="toc-list">${itemsHtml}</ul>
                </div>
            `;
        }).join('');

        this.contentEl.innerHTML = `
            <div class="bb-toc-view">
                <div class="bb-header">
                    <h2 class="bb-title">Alcoholics Anonymous</h2>
                    <p class="bb-subtitle">${book.metadata.subtitle}</p>
                </div>
                <div class="bb-toc">
                    ${tocHtml}
                </div>
            </div>
        `;
    }

    /**
     * Display AA Comes of Age - show first chapter by default
     */
    async displayAAComesOfAge(book) {
        if (book.structure.chapters && book.structure.chapters.length > 0) {
            await this.displayAAComesOfAgeContent(book, `chapter-${book.structure.chapters[0].number}`);
        }
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');
    }

    /**
     * Display AA Comes of Age content based on contentId
     */
    async displayAAComesOfAgeContent(book, contentId) {
        const bookAnnotations = await annotations.loadForBook(book.metadata.id);

        if (contentId.startsWith('chapter-')) {
            const chapterNum = parseInt(contentId.replace('chapter-', ''), 10);
            await this.displayAAComesOfAgeChapter(book, chapterNum, bookAnnotations);
        } else if (contentId.startsWith('appendix-')) {
            const appendixLetter = contentId.replace('appendix-', '');
            await this.displayAAComesOfAgeAppendix(book, appendixLetter, bookAnnotations);
        } else {
            // Default to chapter 1
            await this.displayAAComesOfAgeChapter(book, 1, bookAnnotations);
        }

        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');
    }

    /**
     * Format AA Comes of Age paragraph content
     */
    formatAAComesOfAgeParagraph(paragraph, paragraphId, bookAnnotations) {
        let text = paragraph.plainText || '';

        // Handle runs with formatting
        if (paragraph.runs && paragraph.runs.length > 0) {
            text = paragraph.runs.map(run => {
                let runText = '';
                if (run.content) {
                    run.content.forEach(item => {
                        if (item.type === 'text') {
                            runText += item.value;
                        }
                    });
                }

                // Normalize quotes
                runText = this.normalizeQuotes(runText);

                // Apply formatting
                if (run.formatting) {
                    if (run.formatting.italic) {
                        runText = `<em>${runText}</em>`;
                    }
                    if (run.formatting.bold) {
                        runText = `<strong>${runText}</strong>`;
                    }
                }

                return runText;
            }).join('');
        } else {
            // Normalize quotes in plain text
            text = this.normalizeQuotes(text);
        }

        // Apply annotations
        text = annotations.applyToContent(text, bookAnnotations, paragraphId);

        return text;
    }

    /**
     * Display AA Comes of Age Chapter
     */
    async displayAAComesOfAgeChapter(book, chapterNum, bookAnnotations) {
        const chapter = book.structure.chapters.find(ch => ch.number === chapterNum);
        if (!chapter) return;

        // Calculate approximate page numbers based on paragraph count
        const startPage = chapter.startPage || 1;
        const paragraphsPerPage = 6; // Approximate paragraphs per page

        // Group paragraphs by approximate page
        const pageGroups = new Map();
        const filteredContent = chapter.content.filter(para => para.plainText && para.plainText.trim() !== '');

        filteredContent.forEach((para, idx) => {
            const approxPage = startPage + Math.floor(idx / paragraphsPerPage);
            if (!pageGroups.has(approxPage)) {
                pageGroups.set(approxPage, []);
            }
            pageGroups.get(approxPage).push({ para, idx });
        });

        let paragraphsHtml = '';
        const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);

        for (const pageNum of sortedPages) {
            const pageParagraphs = pageGroups.get(pageNum);
            const pageContent = pageParagraphs.map(({ para, idx }) => {
                const paraId = `aacoa-ch${chapterNum}-p${idx + 1}`;
                const text = this.formatAAComesOfAgeParagraph(para, paraId, bookAnnotations);
                return `<div class="aacoa-paragraph paragraph" data-paragraph-id="${paraId}" data-page="${pageNum}"><p>${text}</p></div>`;
            }).join('');

            paragraphsHtml += `<div class="book-page" data-page="p. ${pageNum}">${pageContent}</div>`;
        }

        // Get cross-references for this chapter's page range
        const endPage = startPage + 30; // Approximate page range
        const crossRefs = pageCrossRef.getRefsForPageRange('aa-comes-of-age', startPage, endPage);
        const hasCrossRefs = crossRefs && crossRefs.length > 0;
        const crossRefHtml = this.generateCrossRefSidebarHtml(crossRefs, 'aa-comes-of-age', startPage);

        this.contentEl.innerHTML = `
            <div class="aacoa-content-view ${hasCrossRefs ? 'with-crossrefs' : ''}">
                <div class="aacoa-main-content">
                    <div class="aacoa-header aacoa-chapter-header">
                        <div class="aacoa-chapter-number">Chapter ${chapter.romanNumeral}</div>
                        <h2 class="aacoa-title">${chapter.title}</h2>
                        ${chapter.startPage ? `<span class="aacoa-page-range">Starting page ${chapter.startPage}</span>` : ''}
                    </div>
                    <div class="aacoa-content">
                        ${paragraphsHtml}
                    </div>
                    ${this.getAAComesOfAgeNavHtml(book, `chapter-${chapterNum}`)}
                </div>
                ${hasCrossRefs ? `
                <aside class="crossref-sidebar">
                    <div class="crossref-sidebar-header">
                        <h3>Cross-References</h3>
                        <button class="btn btn-icon crossref-toggle" title="Toggle sidebar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>
                        </button>
                    </div>
                    ${crossRefHtml}
                </aside>
                ` : ''}
            </div>
        `;

        this.setupAAComesOfAgeNavigation(book);
        this.setupCrossRefSidebar();
    }

    /**
     * Display AA Comes of Age Appendix
     */
    async displayAAComesOfAgeAppendix(book, appendixLetter, bookAnnotations) {
        const appendix = book.structure.appendices.find(app => app.letter === appendixLetter);
        if (!appendix) return;

        // Calculate approximate page numbers based on paragraph count
        const startPage = appendix.startPage || 250;
        const paragraphsPerPage = 6; // Approximate paragraphs per page

        // Group paragraphs by approximate page
        const pageGroups = new Map();
        const filteredContent = appendix.content.filter(para => para.plainText && para.plainText.trim() !== '');

        filteredContent.forEach((para, idx) => {
            const approxPage = startPage + Math.floor(idx / paragraphsPerPage);
            if (!pageGroups.has(approxPage)) {
                pageGroups.set(approxPage, []);
            }
            pageGroups.get(approxPage).push({ para, idx });
        });

        let paragraphsHtml = '';
        const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);

        for (const pageNum of sortedPages) {
            const pageParagraphs = pageGroups.get(pageNum);
            const pageContent = pageParagraphs.map(({ para, idx }) => {
                const paraId = `aacoa-app${appendixLetter}-p${idx + 1}`;
                const text = this.formatAAComesOfAgeParagraph(para, paraId, bookAnnotations);
                return `<div class="aacoa-paragraph paragraph" data-paragraph-id="${paraId}"><p>${text}</p></div>`;
            }).join('');

            paragraphsHtml += `<div class="book-page" data-page="p. ${pageNum}">${pageContent}</div>`;
        }

        // Get cross-references for this appendix's page range
        const endPage = startPage + 30; // Approximate page range
        const crossRefs = pageCrossRef.getRefsForPageRange('aa-comes-of-age', startPage, endPage);
        const hasCrossRefs = crossRefs && crossRefs.length > 0;
        const crossRefHtml = this.generateCrossRefSidebarHtml(crossRefs, 'aa-comes-of-age', startPage);

        this.contentEl.innerHTML = `
            <div class="aacoa-content-view ${hasCrossRefs ? 'with-crossrefs' : ''}">
                <div class="aacoa-main-content">
                    <div class="aacoa-header aacoa-appendix-header">
                        <div class="aacoa-appendix-letter">Appendix ${appendix.letter}</div>
                        <h2 class="aacoa-title">${appendix.title}</h2>
                        ${appendix.startPage ? `<span class="aacoa-page-range">Starting page ${appendix.startPage}</span>` : ''}
                    </div>
                    <div class="aacoa-content">
                        ${paragraphsHtml}
                    </div>
                    ${this.getAAComesOfAgeNavHtml(book, `appendix-${appendixLetter}`)}
                </div>
                ${hasCrossRefs ? `
                <aside class="crossref-sidebar">
                    <div class="crossref-sidebar-header">
                        <h3>Cross-References</h3>
                        <button class="btn btn-icon crossref-toggle" title="Toggle sidebar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>
                        </button>
                    </div>
                    ${crossRefHtml}
                </aside>
                ` : ''}
            </div>
        `;

        this.setupAAComesOfAgeNavigation(book);
        this.setupCrossRefSidebar();
    }

    /**
     * Get AA Comes of Age navigation order
     */
    getAAComesOfAgeNavOrder(book) {
        const order = [];

        // Chapters
        if (book.structure.chapters) {
            book.structure.chapters.forEach(ch => {
                order.push(`chapter-${ch.number}`);
            });
        }

        // Appendices
        if (book.structure.appendices) {
            book.structure.appendices.forEach(app => {
                order.push(`appendix-${app.letter}`);
            });
        }

        return order;
    }

    /**
     * Get AA Comes of Age navigation HTML
     */
    getAAComesOfAgeNavHtml(book, currentId) {
        const navOrder = this.getAAComesOfAgeNavOrder(book);
        const currentIndex = navOrder.indexOf(currentId);

        return `
            <div class="aacoa-nav bb-nav">
                <button class="btn btn-secondary" id="aacoa-prev" ${currentIndex <= 0 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <button class="btn btn-secondary" id="aacoa-toc-btn">
                    Table of Contents
                </button>
                <button class="btn btn-secondary" id="aacoa-next" ${currentIndex >= navOrder.length - 1 ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
        `;
    }

    /**
     * Setup AA Comes of Age navigation
     */
    setupAAComesOfAgeNavigation(book) {
        const prevBtn = this.contentEl.querySelector('#aacoa-prev');
        const nextBtn = this.contentEl.querySelector('#aacoa-next');
        const tocBtn = this.contentEl.querySelector('#aacoa-toc-btn');

        if (!prevBtn || !nextBtn) return;

        const navOrder = this.getAAComesOfAgeNavOrder(book);
        const currentId = this.getCurrentAAComesOfAgeContentId();
        const currentIndex = navOrder.indexOf(currentId);

        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                const prevId = navOrder[currentIndex - 1];
                window.location.hash = `/book/aa-comes-of-age/chapter/${prevId}`;
            }
        });

        nextBtn.addEventListener('click', () => {
            if (currentIndex < navOrder.length - 1) {
                const nextId = navOrder[currentIndex + 1];
                window.location.hash = `/book/aa-comes-of-age/chapter/${nextId}`;
            }
        });

        prevBtn.disabled = currentIndex <= 0;
        nextBtn.disabled = currentIndex >= navOrder.length - 1;

        tocBtn?.addEventListener('click', () => {
            this.showAAComesOfAgeTableOfContents(book);
        });
    }

    /**
     * Get current AA Comes of Age content ID from URL
     */
    getCurrentAAComesOfAgeContentId() {
        const hash = window.location.hash;
        const match = hash.match(/\/book\/aa-comes-of-age\/chapter\/(.+)$/);
        return match ? match[1] : 'chapter-1';
    }

    /**
     * Show AA Comes of Age Table of Contents
     */
    async showAAComesOfAgeTableOfContents(book) {
        // Build chapters list
        const chaptersHtml = book.structure.chapters.map(ch => `
            <li>
                <a href="#/book/aa-comes-of-age/chapter/chapter-${ch.number}" class="toc-link">
                    ${ch.romanNumeral}. ${ch.title}
                </a>
            </li>
        `).join('');

        // Build appendices list
        const appendicesHtml = book.structure.appendices.map(app => `
            <li>
                <a href="#/book/aa-comes-of-age/chapter/appendix-${app.letter}" class="toc-link">
                    ${app.letter}. ${app.title}
                </a>
            </li>
        `).join('');

        this.contentEl.innerHTML = `
            <div class="aacoa-toc-view bb-toc-view">
                <div class="aacoa-header bb-header">
                    <h2 class="aacoa-title bb-title">${book.metadata.title}</h2>
                    <p class="aacoa-subtitle bb-subtitle">${book.metadata.subtitle}</p>
                </div>
                <div class="aacoa-toc bb-toc">
                    <div class="toc-section">
                        <h3 class="toc-section-title">Chapters</h3>
                        <ul class="toc-list">${chaptersHtml}</ul>
                    </div>
                    <div class="toc-section">
                        <h3 class="toc-section-title">Appendices</h3>
                        <ul class="toc-list">${appendicesHtml}</ul>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate cross-reference sidebar HTML
     */
    generateCrossRefSidebarHtml(refs, bookType, currentPage) {
        if (!refs || refs.length === 0) {
            return `
                <div class="crossref-empty">
                    <p>No cross-references found for these pages.</p>
                    <p class="crossref-hint">Daily Reflections and As Bill Sees It entries that cite these pages will appear here.</p>
                </div>
            `;
        }

        const dailyRefs = refs.filter(r => r.type === 'daily-reflection');
        const absitRefs = refs.filter(r => r.type === 'as-bill-sees-it');

        let html = '<div class="crossref-content">';

        if (dailyRefs.length > 0) {
            html += `
                <div class="crossref-group">
                    <h4 class="crossref-group-title">
                        <span class="crossref-badge dr-badge">${dailyRefs.length}</span>
                        Daily Reflections
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
                                    <span class="crossref-page">p. ${ref.sourcePages}</span>
                                </div>
                                <div class="crossref-title">${ref.title}</div>
                                ${ref.quote ? `<div class="crossref-preview">"${ref.quote}..."</div>` : ''}
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
                        <span class="crossref-badge absit-badge">${absitRefs.length}</span>
                        As Bill Sees It
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
                                    <span class="crossref-page">${ref.sourceString}</span>
                                </div>
                                <div class="crossref-title">${ref.title}</div>
                                ${ref.paragraphPreview ? `<div class="crossref-preview">"${ref.paragraphPreview}..."</div>` : ''}
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

        html += '</div>';

        // Add page navigation
        const nav = pageCrossRef.getNavigation(bookType, currentPage);
        html += `
            <div class="crossref-page-nav">
                <button class="btn btn-sm crossref-page-btn" id="crossref-prev-page"
                    ${nav.prevPage === null ? 'disabled' : ''}
                    data-page="${nav.prevPage}" data-book="${bookType}">
                    ← p.${nav.prevPage || '-'}
                </button>
                <span class="crossref-page-count">${refs.length} refs</span>
                <button class="btn btn-sm crossref-page-btn" id="crossref-next-page"
                    ${nav.nextPage === null ? 'disabled' : ''}
                    data-page="${nav.nextPage}" data-book="${bookType}">
                    p.${nav.nextPage || '-'} →
                </button>
            </div>
        `;

        return html;
    }

    /**
     * Generate reverse cross-reference sidebar HTML for Daily Reflections/As Bill Sees It
     * Shows the actual content from the Big Book or 12&12 pages being referenced
     */
    generateSourceRefSidebarHtml(sourceInfo) {
        if (!sourceInfo) {
            return `
                <div class="crossref-empty">
                    <p>No source reference available.</p>
                </div>
            `;
        }

        const { bookName, pages, bookType, pageNumbers } = sourceInfo;
        const isBigBook = bookType === 'big-book';
        const badgeClass = isBigBook ? 'bb-badge' : 'tt-badge';
        const displayName = isBigBook ? 'Big Book' : '12 Steps & 12 Traditions';

        // Get the first page number to display
        const currentPage = pageNumbers[0] || 1;

        let html = '<div class="crossref-content">';

        // Header with source info
        html += `
            <div class="crossref-group source-header-group">
                <h4 class="crossref-group-title">
                    <span class="crossref-badge ${badgeClass}">📚</span>
                    ${displayName}
                </h4>
                <div class="source-ref-info">
                    <div class="source-ref-pages">Page ${currentPage}</div>
                </div>
            </div>
        `;

        // Content area - will be populated dynamically
        html += `
            <div class="source-content-area"
                 data-book-type="${bookType}"
                 data-current-page="${currentPage}"
                 data-all-pages="${pageNumbers.join(',')}">
                <div class="source-content-loading">Loading content...</div>
            </div>
        `;

        // Page navigation within sidebar
        html += `
            <div class="source-page-nav">
                <button class="btn btn-sm source-nav-btn" id="source-prev-page" title="Previous page">
                    ← Prev
                </button>
                <span class="source-current-page">p. ${currentPage}</span>
                <button class="btn btn-sm source-nav-btn" id="source-next-page" title="Next page">
                    Next →
                </button>
            </div>
        `;

        // Open in full reader button
        html += `
            <div class="source-open-full">
                <button class="btn btn-secondary btn-sm" id="open-source-full"
                        data-book="${bookType}" data-page="${currentPage}">
                    Open in Full Reader
                </button>
            </div>
        `;

        html += '</div>';
        return html;
    }

    /**
     * Get content for a specific page from Big Book or 12&12
     */
    getPageContent(bookType, pageNumber) {
        if (bookType === 'big-book') {
            return this.getBigBookPageContent(pageNumber);
        } else if (bookType === 'twelve-and-twelve') {
            return this.getTwelveAndTwelvePageContent(pageNumber);
        } else if (bookType === 'aa-comes-of-age') {
            return this.getAAComesOfAgePageContent(pageNumber);
        } else if (bookType === 'language-of-the-heart') {
            return this.getLanguageOfTheHeartContent(pageNumber);
        }
        return null;
    }

    /**
     * Get AA Comes of Age content for a specific page
     */
    getAAComesOfAgePageContent(pageNumber) {
        const book = window.app?.books?.get('aa-comes-of-age');
        if (!book) return null;

        const paragraphs = [];
        let contextTitle = '';
        let contextType = '';

        // Search through chapters
        if (book.chapters) {
            for (const ch of book.chapters) {
                const start = ch.pageStart || 0;
                const end = ch.pageEnd || start + 30;
                if (pageNumber >= start && pageNumber <= end) {
                    contextTitle = ch.title || `Chapter ${ch.chapterNumber}`;
                    contextType = 'chapter';
                    if (ch.paragraphs) {
                        ch.paragraphs.forEach(para => {
                            if (para.pageNumber === pageNumber) {
                                paragraphs.push(para.text || para.plainText || '');
                            }
                        });
                        // If no exact match, get first few paragraphs
                        if (paragraphs.length === 0) {
                            ch.paragraphs.slice(0, 3).forEach(para => {
                                paragraphs.push(para.text || para.plainText || '');
                            });
                        }
                    }
                    break;
                }
            }
        }

        // Search through appendices if not found
        if (paragraphs.length === 0 && book.appendices) {
            for (const app of book.appendices) {
                const start = app.pageStart || 0;
                const end = app.pageEnd || start + 20;
                if (pageNumber >= start && pageNumber <= end) {
                    contextTitle = app.title || 'Appendix';
                    contextType = 'appendix';
                    if (app.paragraphs) {
                        app.paragraphs.slice(0, 3).forEach(para => {
                            paragraphs.push(para.text || para.plainText || '');
                        });
                    }
                    break;
                }
            }
        }

        return {
            title: contextTitle || `Page ${pageNumber}`,
            type: contextType,
            pageNumber,
            paragraphs
        };
    }

    /**
     * Get Language of the Heart article content
     * Since LOTH uses articles, we try to find by page number from table of contents
     */
    getLanguageOfTheHeartContent(pageNumber) {
        const book = window.app?.books?.get('language-of-the-heart');
        if (!book?.articles) return null;

        let article = null;
        let contextTitle = '';

        // First, try to find article by page number in table_of_contents
        if (book.table_of_contents && book.table_of_contents.sections) {
            for (const section of book.table_of_contents.sections) {
                if (section.type === 'part' && section.segments) {
                    for (const segment of section.segments) {
                        if (segment.articles) {
                            for (const tocArticle of segment.articles) {
                                if (tocArticle.page === pageNumber ||
                                    (tocArticle.page && pageNumber >= tocArticle.page && pageNumber <= tocArticle.page + 5)) {
                                    article = book.articles.find(a => a.id === tocArticle.article_id);
                                    if (article) break;
                                }
                            }
                        }
                        if (article) break;
                    }
                }
                if (article) break;
            }
        }

        // If no match found, return first article as fallback
        if (!article && book.articles.length > 0) {
            article = book.articles[0];
        }

        if (!article) return null;

        // Extract paragraph text
        const paragraphs = [];
        if (article.paragraphs) {
            article.paragraphs.slice(0, 3).forEach(para => {
                if (para.elements && Array.isArray(para.elements)) {
                    const text = para.elements.map(el => el.content || '').join('');
                    if (text) paragraphs.push(text);
                }
            });
        }

        return {
            title: article.title,
            type: 'article',
            articleId: article.id,
            publicationDate: article.publication_date,
            pageNumber,
            paragraphs
        };
    }

    /**
     * Get Big Book content for a specific page
     */
    getBigBookPageContent(pageNumber) {
        const book = window.app?.books?.get('big-book');
        if (!book?.content) return null;

        const paragraphs = [];
        let contextTitle = '';
        let contextType = '';

        // Search through chapters
        if (book.content.mainText?.chapters) {
            for (const ch of book.content.mainText.chapters) {
                const start = ch.pageStart || 0;
                const end = ch.pageEnd || start + 50;
                if (pageNumber >= start && pageNumber <= end) {
                    contextTitle = `Chapter ${ch.chapterNumber}: ${ch.title}`;
                    contextType = 'chapter';
                    // Get paragraphs for this page
                    if (ch.paragraphs) {
                        ch.paragraphs.forEach(para => {
                            if (para.pageNumber === pageNumber ||
                                (!para.pageNumber && pageNumber >= start && pageNumber <= end)) {
                                paragraphs.push(para.plainText || para.content?.map(c => c.text).join('') || '');
                            }
                        });
                    }
                    break;
                }
            }
        }

        // If no paragraphs found with exact page match, get context from chapter
        if (paragraphs.length === 0 && book.content.mainText?.chapters) {
            for (const ch of book.content.mainText.chapters) {
                const start = ch.pageStart || 0;
                const end = ch.pageEnd || start + 50;
                if (pageNumber >= start && pageNumber <= end) {
                    contextTitle = `Chapter ${ch.chapterNumber}: ${ch.title}`;
                    contextType = 'chapter';
                    // Get first few paragraphs of the chapter as context
                    if (ch.paragraphs && ch.paragraphs.length > 0) {
                        const contextParas = ch.paragraphs.slice(0, 3);
                        contextParas.forEach(para => {
                            paragraphs.push(para.plainText || para.content?.map(c => c.text).join('') || '');
                        });
                    }
                    break;
                }
            }
        }

        // Search Doctor's Opinion (pages around xxv-xxxii or 1-12 depending on edition)
        if (paragraphs.length === 0 && book.content.frontMatter?.doctorsOpinion) {
            const doc = book.content.frontMatter.doctorsOpinion;
            contextTitle = "The Doctor's Opinion";
            contextType = 'frontMatter';
            if (doc.paragraphs && doc.paragraphs.length > 0) {
                doc.paragraphs.slice(0, 3).forEach(para => {
                    paragraphs.push(para.plainText || para.content?.map(c => c.text).join('') || '');
                });
            }
        }

        return {
            title: contextTitle,
            type: contextType,
            pageNumber,
            paragraphs,
            chapterNumber: contextType === 'chapter' ? parseInt(contextTitle.match(/Chapter (\d+)/)?.[1]) : null
        };
    }

    /**
     * Get 12&12 content for a specific page
     */
    getTwelveAndTwelvePageContent(pageNumber) {
        const book = window.app?.books?.get('twelve-and-twelve');
        if (!book) return null;

        const paragraphs = [];
        let contextTitle = '';
        let contextType = '';
        let itemNumber = null;

        // Search through steps
        if (book.theSteps) {
            for (const step of book.theSteps) {
                const start = step.pageRange?.start || 0;
                const end = step.pageRange?.end || start + 15;
                if (pageNumber >= start && pageNumber <= end) {
                    contextTitle = `Step ${step.number}`;
                    contextType = 'step';
                    itemNumber = step.number;
                    // Get content for this page
                    if (step.content) {
                        step.content.forEach(para => {
                            if (para.pdfPage === pageNumber) {
                                paragraphs.push(para.text);
                            }
                        });
                        // If no exact match, get paragraphs from this step
                        if (paragraphs.length === 0) {
                            step.content.slice(0, 4).forEach(para => {
                                paragraphs.push(para.text);
                            });
                        }
                    }
                    break;
                }
            }
        }

        // Search through traditions if not found in steps
        if (paragraphs.length === 0 && book.theTraditions) {
            for (const tradition of book.theTraditions) {
                const start = tradition.pageRange?.start || 0;
                const end = tradition.pageRange?.end || start + 15;
                if (pageNumber >= start && pageNumber <= end) {
                    contextTitle = `Tradition ${tradition.number}`;
                    contextType = 'tradition';
                    itemNumber = tradition.number;
                    if (tradition.content) {
                        tradition.content.forEach(para => {
                            if (para.pdfPage === pageNumber) {
                                paragraphs.push(para.text);
                            }
                        });
                        if (paragraphs.length === 0) {
                            tradition.content.slice(0, 4).forEach(para => {
                                paragraphs.push(para.text);
                            });
                        }
                    }
                    break;
                }
            }
        }

        // Search through front matter (foreword, contents, etc.) if not found in steps/traditions
        if (paragraphs.length === 0 && book.frontMatter) {
            for (const section of book.frontMatter) {
                const start = section.pageRange?.start || 0;
                const end = section.pageRange?.end || start + 10;
                if (pageNumber >= start && pageNumber <= end) {
                    contextTitle = section.sectionName ?
                        section.sectionName.charAt(0).toUpperCase() + section.sectionName.slice(1) :
                        'Front Matter';
                    contextType = 'frontMatter';
                    if (section.content) {
                        section.content.forEach(para => {
                            if (para.pdfPage === pageNumber) {
                                paragraphs.push(para.text);
                            }
                        });
                        if (paragraphs.length === 0) {
                            section.content.slice(0, 4).forEach(para => {
                                paragraphs.push(para.text);
                            });
                        }
                    }
                    break;
                }
            }
        }

        return {
            title: contextTitle,
            type: contextType,
            pageNumber,
            paragraphs,
            itemNumber
        };
    }

    /**
     * Load and display source content in the sidebar
     */
    loadSourceContentInSidebar() {
        const contentArea = this.contentEl.querySelector('.source-content-area');
        if (!contentArea) return;

        const bookType = contentArea.dataset.bookType;
        const currentPage = parseInt(contentArea.dataset.currentPage, 10);
        const allPages = contentArea.dataset.allPages?.split(',').map(p => parseInt(p, 10)) || [];

        const content = this.getPageContent(bookType, currentPage);

        if (!content || content.paragraphs.length === 0) {
            contentArea.innerHTML = `
                <div class="source-content-empty">
                    <p>Content not available for page ${currentPage}.</p>
                    <p class="hint">Try the "Open in Full Reader" button below.</p>
                </div>
            `;
            return;
        }

        // Apply auto cross-references to the content
        const paragraphsHtml = content.paragraphs.map((text, idx) => `
            <p class="source-paragraph">${this.applyAutoCrossReferences(text)}</p>
        `).join('');

        // Determine chapter route for "View Chapter" button
        let chapterRoute = '';
        if (bookType === 'big-book' && content.chapterNumber) {
            chapterRoute = `/book/big-book/chapter/chapter-${content.chapterNumber}`;
        } else if (bookType === 'twelve-and-twelve' && content.itemNumber) {
            if (content.type === 'step') {
                chapterRoute = `/book/twelve-and-twelve/chapter/step-${content.itemNumber}`;
            } else if (content.type === 'tradition') {
                chapterRoute = `/book/twelve-and-twelve/chapter/tradition-${content.itemNumber}`;
            }
        } else if (bookType === 'aa-comes-of-age' && content.chapterNumber) {
            chapterRoute = `/book/aa-comes-of-age/chapter/chapter-${content.chapterNumber}`;
        }

        // Find prev/next pages in the referenced pages
        const currentIdx = allPages.indexOf(currentPage);
        const prevPage = currentIdx > 0 ? allPages[currentIdx - 1] : null;
        const nextPage = currentIdx < allPages.length - 1 ? allPages[currentIdx + 1] : null;

        contentArea.innerHTML = `
            <div class="source-content-header">
                <strong>${content.title}</strong>
                <span class="source-page-indicator">p. ${currentPage}</span>
            </div>
            <div class="source-content-text">
                ${paragraphsHtml}
            </div>
            <div class="source-inline-nav">
                <button class="btn btn-sm source-inline-prev" ${!prevPage ? 'disabled' : ''} data-page="${prevPage || ''}">
                    ← Prev
                </button>
                <span class="source-page-label">Page ${currentPage}</span>
                <button class="btn btn-sm source-inline-next" ${!nextPage ? 'disabled' : ''} data-page="${nextPage || ''}">
                    Next →
                </button>
            </div>
            ${chapterRoute ? `
                <div class="source-view-chapter">
                    <button class="btn btn-primary btn-sm source-view-chapter-btn" data-route="${chapterRoute}">
                        View Full Chapter
                    </button>
                </div>
            ` : ''}
        `;

        // Add event listeners for inline nav
        const prevBtn = contentArea.querySelector('.source-inline-prev');
        const nextBtn = contentArea.querySelector('.source-inline-next');
        const viewChapterBtn = contentArea.querySelector('.source-view-chapter-btn');

        prevBtn?.addEventListener('click', () => {
            const page = parseInt(prevBtn.dataset.page, 10);
            if (page) this.updateSourceSidebarPage(page);
        });

        nextBtn?.addEventListener('click', () => {
            const page = parseInt(nextBtn.dataset.page, 10);
            if (page) this.updateSourceSidebarPage(page);
        });

        viewChapterBtn?.addEventListener('click', () => {
            const route = viewChapterBtn.dataset.route;
            if (route) window.location.hash = route;
        });
    }

    /**
     * Generate sidebar HTML for multiple source references (used by As Bill Sees It)
     * Shows actual content from the first source reference
     */
    generateMultiSourceRefSidebarHtml(sourceRefs) {
        if (!sourceRefs || sourceRefs.length === 0) {
            return `
                <div class="crossref-empty">
                    <p>No source references to Big Book or 12&12.</p>
                </div>
            `;
        }

        // Use the first source reference for display
        const primarySource = sourceRefs[0];
        const { bookName, pages, bookType, pageNumbers } = primarySource;

        // Determine badge class and display name based on book type
        let badgeClass, displayName;
        if (bookType === 'big-book') {
            badgeClass = 'bb-badge';
            displayName = 'Big Book';
        } else if (bookType === 'twelve-and-twelve') {
            badgeClass = 'tt-badge';
            displayName = '12 Steps & 12 Traditions';
        } else if (bookType === 'aa-comes-of-age') {
            badgeClass = 'aacoa-badge';
            displayName = 'AA Comes of Age';
        } else if (bookType === 'language-of-the-heart') {
            badgeClass = 'loth-badge';
            displayName = 'Language of the Heart';
        } else {
            badgeClass = 'default-badge';
            displayName = bookName || 'Unknown';
        }
        const currentPage = pageNumbers[0] || 1;

        let html = '<div class="crossref-content">';

        // Header with source info
        html += `
            <div class="crossref-group source-header-group">
                <h4 class="crossref-group-title">
                    <span class="crossref-badge ${badgeClass}">📚</span>
                    ${displayName}
                </h4>
                <div class="source-ref-info">
                    <div class="source-ref-pages">Page ${currentPage}</div>
                </div>
            </div>
        `;

        // Content area
        html += `
            <div class="source-content-area"
                 data-book-type="${bookType}"
                 data-current-page="${currentPage}"
                 data-all-pages="${pageNumbers.join(',')}">
                <div class="source-content-loading">Loading content...</div>
            </div>
        `;

        // Page navigation
        html += `
            <div class="source-page-nav">
                <button class="btn btn-sm source-nav-btn" id="source-prev-page" title="Previous page">
                    ← Prev
                </button>
                <span class="source-current-page">p. ${currentPage}</span>
                <button class="btn btn-sm source-nav-btn" id="source-next-page" title="Next page">
                    Next →
                </button>
            </div>
        `;

        // Page quick-select buttons if there are multiple pages
        if (pageNumbers.length > 1) {
            html += '<div class="source-page-links">';
            pageNumbers.slice(0, 8).forEach(page => {
                html += `
                    <button class="btn btn-sm source-page-btn ${page === currentPage ? 'active' : ''}"
                            data-page="${page}" data-book="${bookType}">
                        p. ${page}
                    </button>
                `;
            });
            if (pageNumbers.length > 8) {
                html += `<span class="more-pages">+${pageNumbers.length - 8} more</span>`;
            }
            html += '</div>';
        }

        // Open in full reader button
        html += `
            <div class="source-open-full">
                <button class="btn btn-secondary btn-sm" id="open-source-full"
                        data-book="${bookType}" data-page="${currentPage}">
                    Open in Full Reader
                </button>
            </div>
        `;

        // If there are multiple source types (e.g., both Big Book and 12&12 refs)
        if (sourceRefs.length > 1) {
            html += '<div class="multi-source-list">';
            sourceRefs.slice(1).forEach(src => {
                let otherBadgeClass, otherDisplayName;
                if (src.bookType === 'big-book') {
                    otherBadgeClass = 'bb-badge';
                    otherDisplayName = 'Big Book';
                } else if (src.bookType === 'twelve-and-twelve') {
                    otherBadgeClass = 'tt-badge';
                    otherDisplayName = '12&12';
                } else if (src.bookType === 'aa-comes-of-age') {
                    otherBadgeClass = 'aacoa-badge';
                    otherDisplayName = 'AA Comes of Age';
                } else {
                    otherBadgeClass = 'default-badge';
                    otherDisplayName = src.bookName || 'Other';
                }
                html += `
                    <div class="other-source-ref">
                        <span class="crossref-badge ${otherBadgeClass}" style="font-size: 10px; padding: 2px 6px;">📚</span>
                        <span>Also: ${otherDisplayName} pp. ${src.pageNumbers.join(', ')}</span>
                        <button class="btn btn-sm" onclick="window.reader?.navigateToSourcePage('${src.bookType}', ${src.pageNumbers[0] || 1})">
                            View
                        </button>
                    </div>
                `;
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Parse source reference and determine book type and pages
     */
    parseSourceReference(source) {
        if (!source) return null;

        let bookName, pages, bookType, pageNumbers = [];

        // Handle Daily Reflections format (source object)
        if (typeof source === 'object' && source.book) {
            bookName = source.book;
            pages = source.pages;
        }
        // Handle As Bill Sees It format (source string)
        else if (typeof source === 'string') {
            bookName = source;
            // Extract page numbers from string like "ALCOHOLICS ANONYMOUS, P. 100"
            const pageMatch = source.match(/P{1,2}\.?\s*([\d\-,\s]+)/i);
            if (pageMatch) {
                pages = pageMatch[1].trim();
            }
        }

        if (!bookName) return null;

        const upperName = bookName.toUpperCase();

        // Determine book type
        if (upperName.includes('ALCOHOLICS ANONYMOUS') && !upperName.includes('COMES OF AGE')) {
            bookType = 'big-book';
        } else if (upperName.includes('TWELVE STEPS AND TWELVE TRADITIONS') ||
                   upperName.includes('TWELVE AND TWELVE') ||
                   upperName.includes('12 AND 12')) {
            bookType = 'twelve-and-twelve';
        } else if (upperName.includes('COMES OF AGE') || upperName.includes('A.A. COMES OF AGE')) {
            bookType = 'aa-comes-of-age';
        } else if (upperName.includes('GRAPEVINE') || upperName.includes('LANGUAGE OF THE HEART') ||
                   upperName.includes('GV') || upperName.includes('AA GRAPEVINE')) {
            bookType = 'language-of-the-heart';
        } else {
            // Not a recognized book reference
            return null;
        }

        // Parse page numbers
        if (pages) {
            const parts = String(pages).split(/[,;]/);
            parts.forEach(part => {
                part = part.trim();
                if (part.includes('-')) {
                    const [start, end] = part.split('-').map(p => parseInt(p.trim(), 10));
                    if (!isNaN(start) && !isNaN(end)) {
                        for (let i = start; i <= Math.min(end, start + 10); i++) {
                            pageNumbers.push(i);
                        }
                    }
                } else {
                    const num = parseInt(part, 10);
                    if (!isNaN(num)) {
                        pageNumbers.push(num);
                    }
                }
            });
        }

        return { bookName, pages, bookType, pageNumbers };
    }

    /**
     * Setup source reference sidebar interactions
     */
    setupSourceRefSidebar() {
        // Load content into sidebar
        this.loadSourceContentInSidebar();

        const contentArea = this.contentEl.querySelector('.source-content-area');
        if (!contentArea) return;

        const bookType = contentArea.dataset.bookType;
        const allPages = contentArea.dataset.allPages?.split(',').map(p => parseInt(p, 10)) || [];

        // Handle prev page button
        const prevBtn = this.contentEl.querySelector('#source-prev-page');
        prevBtn?.addEventListener('click', () => {
            const currentPage = parseInt(contentArea.dataset.currentPage, 10);
            const newPage = currentPage - 1;
            if (newPage >= 1) {
                this.updateSourceSidebarPage(newPage);
            }
        });

        // Handle next page button
        const nextBtn = this.contentEl.querySelector('#source-next-page');
        nextBtn?.addEventListener('click', () => {
            const currentPage = parseInt(contentArea.dataset.currentPage, 10);
            const newPage = currentPage + 1;
            this.updateSourceSidebarPage(newPage);
        });

        // Handle "Open in Full Reader" button
        const openFullBtn = this.contentEl.querySelector('#open-source-full');
        openFullBtn?.addEventListener('click', () => {
            const book = openFullBtn.dataset.book;
            const page = parseInt(contentArea.dataset.currentPage, 10);
            if (book && page) {
                this.navigateToSourcePage(book, page);
            }
        });

        // Handle page button clicks (for multi-source sidebar)
        this.contentEl.querySelectorAll('.source-page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page, 10);
                const bType = btn.dataset.book;
                if (page && bType) {
                    // If same book type, update sidebar; otherwise navigate
                    if (bType === bookType) {
                        this.updateSourceSidebarPage(page);
                    } else {
                        this.navigateToSourcePage(bType, page);
                    }
                }
            });
        });

        // Toggle sidebar collapse
        const toggleBtn = this.contentEl.querySelector('.crossref-toggle');
        const sidebar = this.contentEl.querySelector('.crossref-sidebar');

        toggleBtn?.addEventListener('click', () => {
            sidebar?.classList.toggle('collapsed');
            toggleBtn.querySelector('svg')?.classList.toggle('rotated');
        });
    }

    /**
     * Update the source sidebar to show a different page
     */
    updateSourceSidebarPage(newPage) {
        const contentArea = this.contentEl.querySelector('.source-content-area');
        if (!contentArea) return;

        const bookType = contentArea.dataset.bookType;

        // Update the current page data
        contentArea.dataset.currentPage = newPage;

        // Update the page indicator
        const pageIndicator = this.contentEl.querySelector('.source-current-page');
        if (pageIndicator) {
            pageIndicator.textContent = `p. ${newPage}`;
        }

        // Update the page info in header
        const pageInfo = this.contentEl.querySelector('.source-ref-pages');
        if (pageInfo) {
            pageInfo.textContent = `Page ${newPage}`;
        }

        // Update the "Open in Full Reader" button
        const openFullBtn = this.contentEl.querySelector('#open-source-full');
        if (openFullBtn) {
            openFullBtn.dataset.page = newPage;
        }

        // Update page button active states
        this.contentEl.querySelectorAll('.source-page-btn').forEach(btn => {
            const btnPage = parseInt(btn.dataset.page, 10);
            if (btnPage === newPage) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Reload the content
        this.loadSourceContentInSidebar();
    }

    /**
     * Navigate to a source page in Big Book or 12&12
     */
    navigateToSourcePage(bookType, pageNumber) {
        if (bookType === 'big-book') {
            // Find the chapter containing this page
            const bbBook = window.app?.books?.get('big-book');
            if (bbBook?.content?.mainText?.chapters) {
                for (const ch of bbBook.content.mainText.chapters) {
                    const start = ch.pageStart || 0;
                    const end = ch.pageEnd || start + 20;
                    if (pageNumber >= start && pageNumber <= end) {
                        // Use correct route format: /book/:bookId/chapter/:chapterId
                        window.location.hash = `/book/big-book/chapter/chapter-${ch.chapterNumber}`;
                        return;
                    }
                }
                // If no chapter found, go to chapter 1
                window.location.hash = '/book/big-book/chapter/chapter-1';
            }
        } else if (bookType === 'twelve-and-twelve') {
            // Find the step or tradition containing this page
            const ttBook = window.app?.books?.get('twelve-and-twelve');
            if (ttBook) {
                // Check steps first
                if (ttBook.theSteps) {
                    for (const step of ttBook.theSteps) {
                        const start = step.pageRange?.start || 0;
                        const end = step.pageRange?.end || start + 15;
                        if (pageNumber >= start && pageNumber <= end) {
                            // Use correct route format: /book/:bookId/chapter/step-N
                            window.location.hash = `/book/twelve-and-twelve/chapter/step-${step.number}`;
                            return;
                        }
                    }
                }
                // Check traditions
                if (ttBook.theTraditions) {
                    for (const tradition of ttBook.theTraditions) {
                        const start = tradition.pageRange?.start || 0;
                        const end = tradition.pageRange?.end || start + 15;
                        if (pageNumber >= start && pageNumber <= end) {
                            // Use correct route format: /book/:bookId/chapter/tradition-N
                            window.location.hash = `/book/twelve-and-twelve/chapter/tradition-${tradition.number}`;
                            return;
                        }
                    }
                }
                // For front matter pages (before step 1 starts at page 21), find the closest step
                // Steps and traditions have no front matter routes, so navigate to step 1
                // which is the first available content section
                if (ttBook.theSteps && ttBook.theSteps.length > 0) {
                    const firstStep = ttBook.theSteps[0];
                    window.location.hash = `/book/twelve-and-twelve/chapter/step-${firstStep.number}`;
                } else {
                    // Fallback to book overview if no steps available
                    window.location.hash = '/book/twelve-and-twelve';
                }
            }
        } else if (bookType === 'aa-comes-of-age') {
            // Find the chapter containing this page
            const aacoaBook = window.app?.books?.get('aa-comes-of-age');
            if (aacoaBook?.chapters) {
                for (const ch of aacoaBook.chapters) {
                    const start = ch.pageStart || 0;
                    const end = ch.pageEnd || start + 30;
                    if (pageNumber >= start && pageNumber <= end) {
                        window.location.hash = `/book/aa-comes-of-age/chapter/chapter-${ch.chapterNumber || ch.number || 1}`;
                        return;
                    }
                }
                // Default to first chapter
                window.location.hash = '/book/aa-comes-of-age/chapter/chapter-1';
            } else {
                window.location.hash = '/book/aa-comes-of-age';
            }
        } else if (bookType === 'language-of-the-heart') {
            // Find the article by page number
            const lothBook = window.app?.books?.get('language-of-the-heart');
            if (lothBook?.table_of_contents?.sections) {
                for (const section of lothBook.table_of_contents.sections) {
                    if (section.type === 'part' && section.segments) {
                        for (const segment of section.segments) {
                            if (segment.articles) {
                                for (const tocArticle of segment.articles) {
                                    if (tocArticle.page === pageNumber ||
                                        (tocArticle.page && pageNumber >= tocArticle.page && pageNumber <= tocArticle.page + 5)) {
                                        sessionStorage.setItem('navigateToArticle', tocArticle.article_id);
                                        window.location.hash = '/book/language-of-the-heart';
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // Default: go to book
            window.location.hash = '/book/language-of-the-heart';
        }
    }

    /**
     * Setup cross-reference sidebar interactions
     */
    setupCrossRefSidebar() {
        // Toggle sidebar collapse
        const toggleBtn = this.contentEl.querySelector('.crossref-toggle');
        const sidebar = this.contentEl.querySelector('.crossref-sidebar');

        toggleBtn?.addEventListener('click', () => {
            sidebar?.classList.toggle('collapsed');
            toggleBtn.querySelector('svg')?.classList.toggle('rotated');
        });

        // Handle cross-reference link clicks (navigate to specific entry)
        this.contentEl.querySelectorAll('.crossref-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const dateKey = link.dataset.date;
                const entryNum = link.dataset.entry;

                if (dateKey) {
                    // Navigate to Daily Reflections with specific date
                    sessionStorage.setItem('navigateToDate', dateKey);
                    window.location.hash = '/book/daily-reflections';
                } else if (entryNum) {
                    // Navigate to As Bill Sees It with specific entry
                    sessionStorage.setItem('navigateToEntry', entryNum);
                    window.location.hash = '/book/as-bill-sees-it';
                }
            });
        });

        // Handle expand button clicks
        this.contentEl.querySelectorAll('.crossref-expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const type = btn.dataset.type;
                const dateKey = btn.dataset.date;
                const entryNum = btn.dataset.entry;
                const listItem = btn.closest('.crossref-item');
                const expandedContent = listItem?.querySelector('.crossref-expanded-content');

                if (!expandedContent) return;

                // Toggle expansion
                const isExpanded = expandedContent.style.display !== 'none';

                if (isExpanded) {
                    // Collapse
                    expandedContent.style.display = 'none';
                    btn.classList.remove('expanded');
                    listItem.classList.remove('expanded');
                } else {
                    // Expand and load content
                    expandedContent.style.display = 'block';
                    btn.classList.add('expanded');
                    listItem.classList.add('expanded');

                    // Load content if not already loaded
                    if (!expandedContent.dataset.loaded) {
                        this.loadExpandedCrossRefContent(type, dateKey, entryNum, expandedContent);
                    }
                }
            });
        });

        // Page navigation buttons
        const prevPageBtn = this.contentEl.querySelector('#crossref-prev-page');
        const nextPageBtn = this.contentEl.querySelector('#crossref-next-page');

        prevPageBtn?.addEventListener('click', () => {
            const page = parseInt(prevPageBtn.dataset.page, 10);
            const bookType = prevPageBtn.dataset.book;
            if (page && bookType) {
                this.navigateToCrossRefPage(bookType, page);
            }
        });

        nextPageBtn?.addEventListener('click', () => {
            const page = parseInt(nextPageBtn.dataset.page, 10);
            const bookType = nextPageBtn.dataset.book;
            if (page && bookType) {
                this.navigateToCrossRefPage(bookType, page);
            }
        });
    }

    /**
     * Load expanded content for a cross-reference item
     */
    loadExpandedCrossRefContent(type, dateKey, entryNum, container) {
        container.innerHTML = '<div class="crossref-loading">Loading...</div>';

        if (type === 'daily-reflection' && dateKey) {
            const content = this.getDailyReflectionContent(dateKey);
            if (content) {
                container.innerHTML = this.renderExpandedReflection(content, dateKey);
                container.dataset.loaded = 'true';
            } else {
                container.innerHTML = '<div class="crossref-error">Content not available</div>';
            }
        } else if (type === 'as-bill-sees-it' && entryNum) {
            const content = this.getAsBillSeesItContent(parseInt(entryNum, 10));
            if (content) {
                container.innerHTML = this.renderExpandedEntry(content, entryNum);
                container.dataset.loaded = 'true';
            } else {
                container.innerHTML = '<div class="crossref-error">Content not available</div>';
            }
        }
    }

    /**
     * Get Daily Reflection content by date key
     */
    getDailyReflectionContent(dateKey) {
        const book = window.app?.books?.get('daily-reflections');
        if (!book?.reflections) return null;

        return book.reflections.find(r => r.dateKey === dateKey);
    }

    /**
     * Get As Bill Sees It entry content by entry number
     */
    getAsBillSeesItContent(entryNumber) {
        const book = window.app?.books?.get('as-bill-sees-it');
        if (!book?.entries) return null;

        return book.entries.find(e => e.entry_number === entryNumber);
    }

    /**
     * Render expanded Daily Reflection content
     */
    renderExpandedReflection(reflection, dateKey) {
        const quoteHtml = Array.isArray(reflection.quote)
            ? reflection.quote.map(q => `<p class="expanded-quote">${q}</p>`).join('')
            : `<p class="expanded-quote">${reflection.quote || ''}</p>`;

        const reflectionHtml = Array.isArray(reflection.reflection)
            ? reflection.reflection.map(r => `<p class="expanded-reflection-text">${r}</p>`).join('')
            : `<p class="expanded-reflection-text">${reflection.reflection || ''}</p>`;

        return `
            <div class="expanded-reflection">
                <div class="expanded-header">
                    <h4>${reflection.title}</h4>
                    <span class="expanded-date">${reflection.month} ${reflection.day}</span>
                </div>
                <div class="expanded-quote-section">
                    ${quoteHtml}
                </div>
                <div class="expanded-body">
                    ${reflectionHtml}
                </div>
                ${reflection.source ? `
                    <div class="expanded-source">
                        <em>${reflection.source.book || ''}, p. ${reflection.source.pages || ''}</em>
                    </div>
                ` : ''}
                <div class="expanded-actions">
                    <button class="btn btn-secondary btn-sm" onclick="sessionStorage.setItem('navigateToDate', '${dateKey}'); window.location.hash = '/book/daily-reflections';">
                        Open Full Page
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render expanded As Bill Sees It entry content
     */
    renderExpandedEntry(entry, entryNum) {
        const sectionsHtml = entry.sections ? entry.sections.map(section => {
            const paragraphs = section.paragraphs
                ? section.paragraphs.map(p => `<p class="expanded-para">${p.text}</p>`).join('')
                : '';

            return `
                <div class="expanded-section">
                    ${section.title ? `<h5 class="expanded-section-title">${section.title}</h5>` : ''}
                    ${paragraphs}
                    ${section.source ? `<div class="expanded-section-source"><em>${section.source}</em></div>` : ''}
                </div>
            `;
        }).join('') : '';

        return `
            <div class="expanded-entry">
                <div class="expanded-header">
                    <h4>${entry.title}</h4>
                    <span class="expanded-entry-num">#${entry.entry_number}</span>
                </div>
                <div class="expanded-body">
                    ${sectionsHtml}
                </div>
                <div class="expanded-actions">
                    <button class="btn btn-secondary btn-sm" onclick="sessionStorage.setItem('navigateToEntry', '${entryNum}'); window.location.hash = '/book/as-bill-sees-it';">
                        Open Full Page
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Navigate to a specific cross-referenced page
     */
    navigateToCrossRefPage(bookType, pageNumber) {
        // For Big Book, find the chapter that contains this page
        if (bookType === 'big-book' && this.currentBook) {
            const chapters = this.currentBook.content?.mainText?.chapters || [];
            for (const ch of chapters) {
                const start = ch.pageStart || 0;
                const end = ch.pageEnd || start + 20;
                if (pageNumber >= start && pageNumber <= end) {
                    window.location.hash = `/book/big-book/chapter/chapter-${ch.chapterNumber}`;
                    return;
                }
            }
        }
        // For 12&12, similar logic would apply
    }

    /**
     * Display Daily Reflections
     */
    async displayDailyReflections(book) {
        // Check if we're navigating to a specific date from search
        const navigateToDate = sessionStorage.getItem('navigateToDate');
        let reflection;

        if (navigateToDate) {
            // Clear the navigation flag
            sessionStorage.removeItem('navigateToDate');
            reflection = book.reflections.find(r => r.dateKey === navigateToDate);
        }

        if (!reflection) {
            // Show today's reflection by default
            const today = new Date();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const todayKey = `${month}-${day}`;
            reflection = book.reflections.find(r => r.dateKey === todayKey) || book.reflections[0];
        }

        await this.displayReflection(book, reflection);

        // Hide page navigation, show date navigation
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');
    }

    /**
     * Display a single reflection
     */
    async displayReflection(book, reflection) {
        const bookAnnotations = await annotations.loadForBook(book.metadata.id);
        const paragraphId = `dr-${reflection.dateKey}`;

        const quoteText = Array.isArray(reflection.quote)
            ? reflection.quote.map(q => this.normalizeQuotes(q)).join('</p><p>')
            : this.normalizeQuotes(reflection.quote);

        const reflectionText = Array.isArray(reflection.reflection)
            ? reflection.reflection.map(r => this.normalizeQuotes(r)).join('</p><p>')
            : this.normalizeQuotes(reflection.reflection);

        // Apply annotations to the text
        let annotatedQuote = annotations.applyToContent(quoteText, bookAnnotations, `${paragraphId}-quote`);
        let annotatedReflection = annotations.applyToContent(reflectionText, bookAnnotations, `${paragraphId}-text`);

        // Apply automatic cross-references
        annotatedQuote = this.applyAutoCrossReferences(annotatedQuote);
        annotatedReflection = this.applyAutoCrossReferences(annotatedReflection);

        // Check if source is As Bill Sees It and get the linked entry
        const linkedEntryHtml = this.getLinkedSourceHtml(reflection.source, book);

        // Parse source reference for cross-reference sidebar
        const sourceInfo = this.parseSourceReference(reflection.source);
        const sourceRefHtml = sourceInfo ? this.generateSourceRefSidebarHtml(sourceInfo) : '';
        const hasSidebar = sourceInfo !== null;

        this.contentEl.innerHTML = `
            <div class="reflection-view ${hasSidebar ? 'with-crossrefs' : ''}">
                <div class="reflection-main-content">
                    <div class="reflection-entry">
                        <div class="reflection-date">${reflection.month} ${reflection.day}</div>
                        <h2 class="reflection-title">${reflection.title}</h2>

                        <div class="reflection-quote paragraph" data-paragraph-id="${paragraphId}-quote">
                            <p>${annotatedQuote}</p>
                            <div class="reflection-source">
                                - ${reflection.source.book}, p. ${reflection.source.pages}
                            </div>
                        </div>

                        <div class="reflection-text paragraph" data-paragraph-id="${paragraphId}-text">
                            <p>${annotatedReflection}</p>
                        </div>
                    </div>

                    ${linkedEntryHtml}

                    ${this.getCrossRefLegendHtml()}

                    <div class="reflection-nav" style="display: flex; justify-content: space-between; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                        <button class="btn btn-secondary" id="prev-reflection">Previous Day</button>
                        <button class="btn btn-secondary" id="date-picker-btn">Go to Date</button>
                        <button class="btn btn-secondary" id="next-reflection">Next Day</button>
                    </div>
                </div>
                ${hasSidebar ? `
                <aside class="crossref-sidebar source-ref-sidebar">
                    <div class="crossref-sidebar-header">
                        <h3>Source Reference</h3>
                        <button class="btn-icon crossref-toggle" title="Toggle references">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                    </div>
                    ${sourceRefHtml}
                </aside>
                ` : ''}
            </div>
        `;

        // Navigation buttons
        const prevBtn = this.contentEl.querySelector('#prev-reflection');
        const nextBtn = this.contentEl.querySelector('#next-reflection');
        const dateBtn = this.contentEl.querySelector('#date-picker-btn');

        const currentIndex = book.reflections.findIndex(r => r.dateKey === reflection.dateKey);

        prevBtn.addEventListener('click', () => {
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : book.reflections.length - 1;
            this.displayReflection(book, book.reflections[prevIndex]);
        });

        nextBtn.addEventListener('click', () => {
            const nextIndex = currentIndex < book.reflections.length - 1 ? currentIndex + 1 : 0;
            this.displayReflection(book, book.reflections[nextIndex]);
        });

        dateBtn.addEventListener('click', async () => {
            const result = await modal.open({
                title: 'Go to Date',
                body: `
                    <div class="form-group">
                        <label class="form-label">Select Month</label>
                        <select class="form-input" name="month" id="month-select">
                            ${['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December']
                              .map((m, i) => `<option value="${i + 1}" ${reflection.monthNumber === i + 1 ? 'selected' : ''}>${m}</option>`)
                              .join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Day</label>
                        <input type="number" class="form-input" name="day" min="1" max="31" value="${reflection.day}">
                    </div>
                `,
                confirmText: 'Go'
            });

            if (result) {
                const dateKey = `${String(result.month).padStart(2, '0')}-${String(result.day).padStart(2, '0')}`;
                const target = book.reflections.find(r => r.dateKey === dateKey);
                if (target) {
                    this.displayReflection(book, target);
                }
            }
        });

        // View As Bill Sees It entry button
        const viewAbsitBtn = this.contentEl.querySelector('#view-absit-entry');
        if (viewAbsitBtn) {
            viewAbsitBtn.addEventListener('click', () => {
                const entryNum = parseInt(viewAbsitBtn.dataset.entry, 10);
                const absitBook = window.app?.books?.get('as-bill-sees-it');
                if (absitBook && absitBook.entries) {
                    const entry = absitBook.entries.find(e => e.entry_number === entryNum);
                    if (entry) {
                        this.currentBook = absitBook;
                        this.displayEntry(absitBook, entry);
                        // Update URL hash
                        window.location.hash = `/book/as-bill-sees-it`;
                    }
                }
            });
        }

        // Save reading progress
        this.saveProgress('daily-reflections', `reflection-${reflection.dateKey}`);

        // Setup source reference sidebar
        this.setupSourceRefSidebar();
    }

    /**
     * Display As Bill Sees It
     */
    async displayAsBillSeesIt(book) {
        // Check if we're navigating to a specific entry from search
        const navigateToEntry = sessionStorage.getItem('navigateToEntry');
        let entry;

        if (navigateToEntry) {
            // Clear the navigation flag
            sessionStorage.removeItem('navigateToEntry');
            const entryNum = parseInt(navigateToEntry, 10);
            entry = book.entries.find(e => e.entry_number === entryNum);
        }

        if (!entry && book.entries && book.entries.length > 0) {
            // Show first entry by default
            entry = book.entries[0];
        }

        if (entry) {
            await this.displayEntry(book, entry);
        }

        // Hide page navigation
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');
    }

    /**
     * Display a single As Bill Sees It entry
     */
    async displayEntry(book, entry) {
        const bookAnnotations = await annotations.loadForBook(book.metadata.id);
        const paragraphId = `absit-${entry.entry_number}`;

        // Collect all source references from sections for the sidebar
        const sourceRefs = [];
        entry.sections.forEach((section, idx) => {
            if (section.source) {
                const parsed = this.parseSourceReference(section.source);
                if (parsed) {
                    // Check if we already have this source
                    const existing = sourceRefs.find(s => s.bookType === parsed.bookType);
                    if (existing) {
                        // Merge page numbers
                        parsed.pageNumbers.forEach(p => {
                            if (!existing.pageNumbers.includes(p)) {
                                existing.pageNumbers.push(p);
                            }
                        });
                        existing.pageNumbers.sort((a, b) => a - b);
                    } else {
                        sourceRefs.push(parsed);
                    }
                }
            }
        });

        // Build sections HTML with auto cross-references
        const sectionsHtml = entry.sections.map((section, sIdx) => {
            const sectionParagraphId = `${paragraphId}-s${section.section_number}`;
            const paragraphsHtml = section.paragraphs.map((para, pIdx) => {
                const paraParagraphId = `${sectionParagraphId}-p${pIdx}`;
                let text = para.text;

                // Normalize quotes
                text = this.normalizeQuotes(text);

                // Apply annotations
                text = annotations.applyToContent(text, bookAnnotations, paraParagraphId);

                // Apply automatic cross-references (highlight references to other books)
                text = this.applyAutoCrossReferences(text);

                return `<p class="${para.is_quote ? 'quote-text' : ''}" data-paragraph-id="${paraParagraphId}">${text}</p>`;
            }).join('');

            return `
                <div class="entry-section paragraph" data-paragraph-id="${sectionParagraphId}">
                    ${paragraphsHtml}
                    <div class="entry-source">- ${section.source}</div>
                </div>
            `;
        }).join('');

        // Generate sidebar HTML for all source references
        const hasSidebar = sourceRefs.length > 0;
        const sidebarHtml = hasSidebar ? this.generateMultiSourceRefSidebarHtml(sourceRefs) : '';

        this.contentEl.innerHTML = `
            <div class="entry-view ${hasSidebar ? 'with-crossrefs' : ''}">
                <div class="entry-main-content">
                    <div class="entry-header">
                        <span class="entry-number">${entry.entry_number}</span>
                        <h2 class="entry-title">${entry.title}</h2>
                        <span class="entry-page">p. ${entry.page}</span>
                    </div>

                    <div class="entry-content">
                        ${sectionsHtml}
                    </div>

                    ${entry.all_sources && entry.all_sources.length > 1 ? `
                        <div class="entry-all-sources">
                            <strong>Sources:</strong>
                            ${entry.all_sources.map(s => `<span class="source-citation">${s.citation}</span>`).join(', ')}
                        </div>
                    ` : ''}

                    ${this.getCrossRefLegendHtml()}

                    <div class="entry-nav" style="display: flex; justify-content: space-between; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                        <button class="btn btn-secondary" id="prev-entry">Previous Entry</button>
                        <button class="btn btn-secondary" id="entry-picker-btn">Go to Entry</button>
                        <button class="btn btn-secondary" id="next-entry">Next Entry</button>
                    </div>
                </div>
                ${hasSidebar ? `
                <aside class="crossref-sidebar source-ref-sidebar">
                    <div class="crossref-sidebar-header">
                        <h3>Source References</h3>
                        <button class="btn-icon crossref-toggle" title="Toggle references">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                    </div>
                    ${sidebarHtml}
                </aside>
                ` : ''}
            </div>
        `;

        // Navigation buttons
        const prevBtn = this.contentEl.querySelector('#prev-entry');
        const nextBtn = this.contentEl.querySelector('#next-entry');
        const entryBtn = this.contentEl.querySelector('#entry-picker-btn');

        const currentIndex = book.entries.findIndex(e => e.entry_number === entry.entry_number);

        prevBtn.addEventListener('click', () => {
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : book.entries.length - 1;
            this.displayEntry(book, book.entries[prevIndex]);
        });

        nextBtn.addEventListener('click', () => {
            const nextIndex = currentIndex < book.entries.length - 1 ? currentIndex + 1 : 0;
            this.displayEntry(book, book.entries[nextIndex]);
        });

        entryBtn.addEventListener('click', async () => {
            const result = await modal.open({
                title: 'Go to Entry',
                body: `
                    <div class="form-group">
                        <label class="form-label">Entry Number (1-${book.entries.length})</label>
                        <input type="number" class="form-input" name="entryNumber" min="1" max="${book.entries.length}" value="${entry.entry_number}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Or search by title</label>
                        <select class="form-input" name="entrySelect" style="max-height: 200px;">
                            <option value="">-- Select Entry --</option>
                            ${book.entries.map(e => `<option value="${e.entry_number}" ${e.entry_number === entry.entry_number ? 'selected' : ''}>${e.entry_number}. ${e.title}</option>`).join('')}
                        </select>
                    </div>
                `,
                confirmText: 'Go'
            });

            if (result) {
                const targetNum = parseInt(result.entrySelect || result.entryNumber, 10);
                const target = book.entries.find(e => e.entry_number === targetNum);
                if (target) {
                    this.displayEntry(book, target);
                }
            }
        });

        // Save reading progress
        this.saveProgress('as-bill-sees-it', `entry-${entry.entry_number}`);

        // Setup source reference sidebar
        this.setupSourceRefSidebar();
    }

    /**
     * Display Language of the Heart book
     */
    async displayLanguageOfTheHeart(book) {
        // Check if we're navigating to a specific article from search
        const navigateToArticle = sessionStorage.getItem('navigateToArticle');
        let article;

        if (navigateToArticle) {
            sessionStorage.removeItem('navigateToArticle');
            article = book.articles.find(a => a.id === navigateToArticle);
        }

        if (!article && book.articles && book.articles.length > 0) {
            // Show first article by default
            article = book.articles[0];
        }

        if (article) {
            await this.displayArticle(book, article);
        }

        // Hide page navigation
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');
    }

    /**
     * Show "Article not found" message for missing articles
     */
    showArticleNotFound(articleId, book) {
        // Try to find article info from TOC
        let articleTitle = 'Unknown Article';
        let articlePage = '';

        if (book.table_of_contents && book.table_of_contents.sections) {
            for (const section of book.table_of_contents.sections) {
                if (section.segments) {
                    for (const segment of section.segments) {
                        if (segment.articles) {
                            const found = segment.articles.find(a =>
                                a.article_id === articleId ||
                                `article-page-${a.page}` === articleId
                            );
                            if (found) {
                                articleTitle = found.title;
                                articlePage = found.page ? `p. ${found.page}` : '';
                                break;
                            }
                        }
                    }
                }
                if (section.articles) {
                    const found = section.articles.find(a =>
                        a.article_id === articleId ||
                        `article-page-${a.page}` === articleId
                    );
                    if (found) {
                        articleTitle = found.title;
                        articlePage = found.page ? `p. ${found.page}` : '';
                    }
                }
            }
        }

        this.contentEl.innerHTML = `
            <div class="article-view">
                <div class="article-main-content">
                    <div class="article-header">
                        <h2 class="article-title">${articleTitle}</h2>
                        ${articlePage ? `<div class="article-info"><span class="article-page">${articlePage}</span></div>` : ''}
                    </div>

                    <div class="article-not-found">
                        <div class="not-found-icon">📖</div>
                        <h3>Article Content Not Available</h3>
                        <p>The full text for this article is not yet available in the digital edition.</p>
                        <p class="not-found-hint">This article can be found in the printed edition of "Language of the Heart"${articlePage ? ` on ${articlePage}` : ''}.</p>
                    </div>

                    <div class="article-nav">
                        <button class="btn btn-secondary" id="prev-article">Previous Article</button>
                        <button class="btn btn-secondary" id="article-picker-btn">Go to Article</button>
                        <button class="btn btn-secondary" id="next-article">Next Article</button>
                    </div>
                </div>
            </div>
        `;

        // Navigation buttons still work
        const prevBtn = this.contentEl.querySelector('#prev-article');
        const nextBtn = this.contentEl.querySelector('#next-article');
        const pickerBtn = this.contentEl.querySelector('#article-picker-btn');

        prevBtn?.addEventListener('click', () => {
            // Find current position in articles list and go to previous
            if (book.articles && book.articles.length > 0) {
                this.displayArticle(book, book.articles[book.articles.length - 1]);
            }
        });

        nextBtn?.addEventListener('click', () => {
            // Go to first available article
            if (book.articles && book.articles.length > 0) {
                this.displayArticle(book, book.articles[0]);
            }
        });

        pickerBtn?.addEventListener('click', async () => {
            // Build article list grouped by part/segment
            let groupedOptions = '';
            if (book.table_of_contents && book.table_of_contents.sections) {
                for (const section of book.table_of_contents.sections) {
                    if (section.type === 'part' && section.segments) {
                        groupedOptions += `<optgroup label="${section.title}">`;
                        for (const segment of section.segments) {
                            if (segment.articles) {
                                for (const tocArticle of segment.articles) {
                                    const fullArticle = book.articles.find(a => a.id === tocArticle.article_id);
                                    if (fullArticle) {
                                        groupedOptions += `<option value="${fullArticle.id}">${tocArticle.title}</option>`;
                                    }
                                }
                            }
                        }
                        groupedOptions += '</optgroup>';
                    }
                }
            }

            const result = await modal.open({
                title: 'Go to Article',
                body: `
                    <div class="form-group">
                        <label class="form-label">Select Article</label>
                        <select class="form-input" name="articleSelect" style="max-height: 300px;">
                            <option value="">-- Select Article --</option>
                            ${groupedOptions}
                        </select>
                    </div>
                `,
                confirmText: 'Go'
            });

            if (result && result.articleSelect) {
                const target = book.articles.find(a => a.id === result.articleSelect);
                if (target) {
                    this.displayArticle(book, target);
                }
            }
        });
    }

    /**
     * Display a single Language of the Heart article
     */
    async displayArticle(book, article) {
        const bookAnnotations = await annotations.loadForBook(book.metadata.id);
        const articleIndex = book.articles.findIndex(a => a.id === article.id);

        // Build paragraphs HTML with proper formatting
        const paragraphsHtml = article.paragraphs.map((para, idx) => {
            const paraId = `loth-${article.id}-p${idx + 1}`;
            let text = this.formatArticleParagraph(para);

            // Apply annotations
            text = annotations.applyToContent(text, bookAnnotations, paraId);

            // Apply automatic cross-references
            text = this.applyAutoCrossReferences(text);

            const isBlockquote = para.type === 'blockquote';
            return `
                <div class="article-paragraph paragraph ${isBlockquote ? 'blockquote' : ''}" data-paragraph-id="${paraId}">
                    <span class="paragraph-number">${idx + 1}</span>
                    <p>${text}</p>
                </div>
            `;
        }).join('');

        // Find the part/segment this article belongs to (for context)
        let partInfo = '';
        let segmentInfo = '';
        if (book.table_of_contents && book.table_of_contents.sections) {
            for (const section of book.table_of_contents.sections) {
                if (section.type === 'part' && section.segments) {
                    for (const segment of section.segments) {
                        if (segment.articles) {
                            const found = segment.articles.find(a => a.article_id === article.id);
                            if (found) {
                                partInfo = section.title;
                                segmentInfo = segment.title;
                                break;
                            }
                        }
                    }
                }
            }
        }

        this.contentEl.innerHTML = `
            <div class="article-view">
                <div class="article-main-content">
                    <div class="article-header">
                        <div class="article-meta">
                            ${partInfo ? `<span class="article-part">${partInfo}</span>` : ''}
                            ${segmentInfo ? `<span class="article-segment">${segmentInfo}</span>` : ''}
                        </div>
                        <h2 class="article-title">${article.title}</h2>
                        <div class="article-info">
                            <span class="article-date">${article.publication_date || ''}</span>
                            ${article.page_number ? `<span class="article-page">p. ${article.page_number}</span>` : ''}
                        </div>
                    </div>

                    <div class="article-content">
                        ${paragraphsHtml}
                    </div>

                    ${this.getCrossRefLegendHtml()}

                    <div class="article-nav">
                        <button class="btn btn-secondary" id="prev-article">Previous Article</button>
                        <button class="btn btn-secondary" id="article-picker-btn">Go to Article</button>
                        <button class="btn btn-secondary" id="next-article">Next Article</button>
                    </div>
                </div>
            </div>
        `;

        // Navigation buttons
        const prevBtn = this.contentEl.querySelector('#prev-article');
        const nextBtn = this.contentEl.querySelector('#next-article');
        const pickerBtn = this.contentEl.querySelector('#article-picker-btn');

        prevBtn.addEventListener('click', () => {
            const prevIndex = articleIndex > 0 ? articleIndex - 1 : book.articles.length - 1;
            this.displayArticle(book, book.articles[prevIndex]);
        });

        nextBtn.addEventListener('click', () => {
            const nextIndex = articleIndex < book.articles.length - 1 ? articleIndex + 1 : 0;
            this.displayArticle(book, book.articles[nextIndex]);
        });

        pickerBtn.addEventListener('click', async () => {
            // Build article list grouped by part/segment
            let groupedOptions = '';
            if (book.table_of_contents && book.table_of_contents.sections) {
                for (const section of book.table_of_contents.sections) {
                    if (section.type === 'part' && section.segments) {
                        groupedOptions += `<optgroup label="${section.title}">`;
                        for (const segment of section.segments) {
                            if (segment.articles) {
                                for (const tocArticle of segment.articles) {
                                    const fullArticle = book.articles.find(a => a.id === tocArticle.article_id);
                                    if (fullArticle) {
                                        const selected = fullArticle.id === article.id ? 'selected' : '';
                                        groupedOptions += `<option value="${fullArticle.id}" ${selected}>${tocArticle.title}</option>`;
                                    }
                                }
                            }
                        }
                        groupedOptions += '</optgroup>';
                    }
                }
            }

            const result = await modal.open({
                title: 'Go to Article',
                body: `
                    <div class="form-group">
                        <label class="form-label">Select Article</label>
                        <select class="form-input" name="articleSelect" style="max-height: 300px;">
                            <option value="">-- Select Article --</option>
                            ${groupedOptions}
                        </select>
                    </div>
                `,
                confirmText: 'Go'
            });

            if (result && result.articleSelect) {
                const target = book.articles.find(a => a.id === result.articleSelect);
                if (target) {
                    this.displayArticle(book, target);
                }
            }
        });

        // Save reading progress
        this.saveProgress('language-of-the-heart', article.id);
    }

    /**
     * Format article paragraph with text formatting (italic, bold, etc.)
     */
    formatArticleParagraph(paragraph) {
        if (!paragraph.elements || !Array.isArray(paragraph.elements)) {
            return '';
        }

        return paragraph.elements.map(element => {
            let text = element.content || '';
            // Normalize quotes
            text = this.normalizeQuotes(text);

            switch (element.type) {
                case 'italic':
                    return `<em>${text}</em>`;
                case 'bold':
                    return `<strong>${text}</strong>`;
                case 'underline':
                    return `<u>${text}</u>`;
                case 'text':
                default:
                    return text;
            }
        }).join('');
    }

    /**
     * Display Big Book Study Guide - show first section by default
     */
    async displayStudyGuide(book) {
        // Show first section by default
        if (book.content.sections && book.content.sections.length > 0) {
            await this.displayStudyGuideSection(book, book.content.sections[0].id);
        }

        // Hide page navigation
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');
    }

    /**
     * Display a Study Guide section
     */
    async displayStudyGuideSection(book, sectionId) {
        console.log('[StudyGuide] Loading section:', sectionId);
        const section = book.content.sections.find(s => s.id === sectionId);
        if (!section) {
            toast.error('Section not found');
            console.error('[StudyGuide] Section not found:', sectionId);
            return;
        }

        console.log('[StudyGuide] Section found:', section.title, '- Pages:', section.pages?.length);

        const bookAnnotations = await annotations.loadForBook(book.metadata.id);
        this.currentChapter = section;

        // Find section info from table of contents
        const tocEntry = book.tableOfContents.find(t => t.id === sectionId);

        // Build content HTML from pages
        let contentHtml = '';
        let introHtml = '';
        const seenPages = new Set(); // Track pages to prevent duplicates

        // Render section-level introduction if present
        if (section.introduction) {
            const introText = this.formatStudyGuideText(section.introduction);
            if (introText) {
                introHtml += `<div class="sg-section-intro">${introText}</div>`;
            }
        }

        if (section.pages && section.pages.length > 0) {
            for (const page of section.pages) {
                const pageLabel = page.bigBookPage || '';
                const pageVariant = page.pageVariant || '';
                const pageKey = `${pageLabel}|${pageVariant}`; // Include variant to prevent false duplicates

                // Skip if we've already processed this exact page+variant (prevent duplicates)
                if (seenPages.has(pageKey)) continue;
                seenPages.add(pageKey);

                // Separate intro entries from Q&A entries
                const introEntries = [];
                const qaEntries = [];

                for (const entry of page.entries) {
                    // Only treat as intro if it's the intro page or purely text without questions
                    // Notes and comments with Q&A should go to qaEntries
                    if (pageLabel === 'intro' && entry.entryType === 'text') {
                        introEntries.push(entry);
                    } else {
                        qaEntries.push(entry);
                    }
                }

                // Render intro entries in a compact format
                if (introEntries.length > 0) {
                    const introContent = introEntries.map(entry =>
                        this.renderStudyGuideIntroEntry(entry, sectionId)
                    ).join('');
                    introHtml += introContent;
                }

                // Render Q&A entries normally
                if (qaEntries.length > 0) {
                    const pageContent = qaEntries.map(entry =>
                        this.renderStudyGuideEntry(entry, sectionId, bookAnnotations)
                    ).join('');

                    if (pageLabel && pageLabel !== 'intro') {
                        const pageMarkerText = pageVariant
                            ? `Big Book p. ${pageLabel} – ${pageVariant}`
                            : `Big Book p. ${pageLabel}`;
                        contentHtml += `
                            <div class="sg-page" data-bb-page="${pageLabel}" data-variant="${pageVariant}">
                                <div class="sg-page-marker">${pageMarkerText}</div>
                                ${pageContent}
                            </div>
                        `;
                    } else {
                        contentHtml += pageContent;
                    }
                }
            }
        }

        // Combine intro and Q&A content
        let fullContentHtml = '';
        if (introHtml) {
            fullContentHtml = `
                <div class="sg-intro-section">
                    <div class="sg-intro-header">Introduction</div>
                    <div class="sg-intro-content">${introHtml}</div>
                </div>
            `;
        }
        fullContentHtml += contentHtml;

        console.log('[StudyGuide] Content built - intro length:', introHtml.length, 'content length:', contentHtml.length);

        // Get navigation info
        const sections = book.content.sections;
        const currentIndex = sections.findIndex(s => s.id === sectionId);
        const prevSection = currentIndex > 0 ? sections[currentIndex - 1] : null;
        const nextSection = currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;

        // Get Big Book pages for side-by-side view
        const bigBookPages = tocEntry?.bigBookPages || '';

        // Get the corresponding Big Book chapter ID
        const bigBookChapterId = this.getBigBookChapterForStudyGuideSection(sectionId);

        this.contentEl.innerHTML = `
            <div class="sg-view">
                <div class="sg-header">
                    <h2 class="sg-title">${section.title}</h2>
                    <div class="sg-meta">
                        ${bigBookPages ? `<span class="sg-bb-pages">Big Book pp. ${bigBookPages}</span>` : ''}
                        ${tocEntry?.questionCount ? `<span class="sg-stat">${tocEntry.questionCount} Questions</span>` : ''}
                        ${tocEntry?.commentCount ? `<span class="sg-stat">${tocEntry.commentCount} Comments</span>` : ''}
                    </div>
                    <div class="sg-actions">
                        ${bigBookChapterId ? `
                            <a href="#/book/big-book/chapter/${bigBookChapterId}" class="btn btn-primary sg-open-bb-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                </svg>
                                Open in Big Book
                            </a>
                        ` : ''}
                        <div class="sg-view-toggle">
                            <button class="btn btn-secondary sg-toggle-btn active" data-view="study">Study View</button>
                            <button class="btn btn-secondary sg-toggle-btn" data-view="sidebyside">Side by Side</button>
                            <button class="btn btn-secondary sg-toggle-btn" data-view="crossrefs">Cross Refs</button>
                        </div>
                    </div>
                </div>

                <div class="sg-legend">
                    <div class="sg-legend-item">
                        <span class="sg-legend-color sg-blue"></span>
                        <span>Big Book Quote</span>
                    </div>
                    <div class="sg-legend-item">
                        <span class="sg-legend-color sg-teal"></span>
                        <span>Study Comment</span>
                    </div>
                    <div class="sg-legend-item">
                        <span class="sg-legend-color sg-red"></span>
                        <span>Note/Attribution</span>
                    </div>
                    <div class="sg-legend-item">
                        <span class="sg-legend-marker">(P)</span>
                        <span>New Paragraph</span>
                    </div>
                </div>

                <div class="sg-content-wrapper">
                    <div class="sg-content">
                        ${fullContentHtml}
                    </div>
                    <div class="sg-bigbook-panel hidden" id="sg-bigbook-panel">
                        <div class="sg-bigbook-header">
                            <h3>Big Book Text</h3>
                            <button class="btn-icon sg-bigbook-close" title="Close side panel">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div class="sg-bigbook-content" id="sg-bigbook-content">
                            <!-- Loaded dynamically -->
                        </div>
                    </div>
                    <aside class="crossref-sidebar sg-crossref-sidebar hidden" id="sg-crossref-panel">
                        <div class="crossref-sidebar-header">
                            <h3>Study References</h3>
                            <button class="btn-icon sg-crossref-close" title="Close references">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div class="sg-crossref-content" id="sg-crossref-content">
                            <!-- Loaded dynamically -->
                        </div>
                    </aside>
                </div>

                <div class="sg-nav">
                    <button class="btn btn-secondary" id="sg-prev" ${!prevSection ? 'disabled' : ''}>
                        ${prevSection ? `← ${prevSection.title.substring(0, 20)}...` : 'Previous'}
                    </button>
                    <button class="btn btn-secondary" id="sg-toc-btn">Table of Contents</button>
                    <button class="btn btn-secondary" id="sg-next" ${!nextSection ? 'disabled' : ''}>
                        ${nextSection ? `${nextSection.title.substring(0, 20)}... →` : 'Next'}
                    </button>
                </div>
            </div>
        `;

        // Setup navigation
        this.setupStudyGuideNavigation(book, section);

        // Setup view toggle
        this.setupStudyGuideViewToggle(book, tocEntry, sectionId);
    }

    /**
     * Render a single study guide entry
     */
    renderStudyGuideEntry(entry, sectionId, bookAnnotations) {
        const paraId = `sg-${sectionId}-${entry.id}`;

        if (entry.entryType === 'question') {
            const questionNum = entry.questionNumber || '';
            const isParagraphStart = entry.isParagraphStart;
            const questionText = this.formatStudyGuideText(entry.question);
            const answerText = this.formatStudyGuideText(entry.answer);
            const hasComment = entry.comment && entry.comment.plainText;

            return `
                <div class="sg-entry sg-question paragraph" data-paragraph-id="${paraId}">
                    <div class="sg-question-header">
                        ${isParagraphStart ? '<span class="sg-para-marker">(P)</span>' : ''}
                        <span class="sg-question-num">${questionNum}</span>
                        <span class="sg-question-text">${questionText}</span>
                    </div>
                    <div class="sg-answer">${answerText}</div>
                    ${hasComment ? `<div class="sg-comment">${this.formatStudyGuideText(entry.comment)}</div>` : ''}
                </div>
            `;
        } else if (entry.entryType === 'comment') {
            const commentText = this.formatStudyGuideText(entry.comment);
            return `
                <div class="sg-entry sg-standalone-comment paragraph" data-paragraph-id="${paraId}">
                    <div class="sg-comment">${commentText}</div>
                </div>
            `;
        } else if (entry.entryType === 'note') {
            const noteText = entry.note ? this.formatStudyGuideText(entry.note) : (entry.text ? this.formatStudyGuideText(entry.text) : '');
            return `
                <div class="sg-entry sg-note paragraph" data-paragraph-id="${paraId}">
                    <div class="sg-note-content">${noteText}</div>
                </div>
            `;
        } else if (entry.entryType === 'text' || !entry.entryType) {
            const text = entry.text ? this.formatStudyGuideText(entry.text) : '';
            return `
                <div class="sg-entry sg-text paragraph" data-paragraph-id="${paraId}">
                    <div class="sg-text-content">${text}</div>
                </div>
            `;
        }

        return '';
    }

    /**
     * Render intro/text entry in compact format for Study Guide
     */
    renderStudyGuideIntroEntry(entry, sectionId) {
        const paraId = `sg-${sectionId}-${entry.id}`;
        let text = '';

        if (entry.text) {
            text = this.formatStudyGuideText(entry.text);
        } else if (entry.comment) {
            text = this.formatStudyGuideText(entry.comment);
        } else if (entry.note) {
            text = this.formatStudyGuideText(entry.note);
        }

        // Filter out header/footer artifacts like "Big Book Study Guide12"
        if (text && text.match(/^Big Book Study Guide\d*$/)) {
            return '';
        }

        if (!text || text.trim().length === 0) {
            return '';
        }

        return `<p class="sg-intro-para" data-paragraph-id="${paraId}">${text}</p>`;
    }

    /**
     * Format study guide text with colors and formatting
     */
    formatStudyGuideText(textObj) {
        if (!textObj) return '';

        // If it has segments, use them for color formatting
        if (textObj.segments && textObj.segments.length > 0) {
            return textObj.segments.map(seg => {
                let text = seg.text || '';
                text = this.normalizeQuotes(text);

                // Filter out page artifacts
                if (text.match(/^Big Book Study Guide\d*$/)) {
                    return '';
                }

                // Apply formatting
                if (seg.italic) text = `<em>${text}</em>`;
                if (seg.bold) text = `<strong>${text}</strong>`;
                if (seg.underline) text = `<u>${text}</u>`;

                // Apply color class
                const color = seg.color || 'black';
                if (color === 'blue') {
                    return `<span class="sg-text-blue">${text}</span>`;
                } else if (color === 'teal') {
                    return `<span class="sg-text-teal">${text}</span>`;
                } else if (color === 'red') {
                    return `<span class="sg-text-red">${text}</span>`;
                }

                return text;
            }).join('');
        }

        // Fall back to plain text
        return this.normalizeQuotes(textObj.plainText || '');
    }

    /**
     * Setup study guide navigation
     */
    setupStudyGuideNavigation(book, currentSection) {
        const sections = book.content.sections;
        const currentIndex = sections.findIndex(s => s.id === currentSection.id);

        const prevBtn = this.contentEl.querySelector('#sg-prev');
        const nextBtn = this.contentEl.querySelector('#sg-next');
        const tocBtn = this.contentEl.querySelector('#sg-toc-btn');

        prevBtn?.addEventListener('click', () => {
            if (currentIndex > 0) {
                const prevSection = sections[currentIndex - 1];
                window.location.hash = `/book/study-guide/chapter/${prevSection.id}`;
            }
        });

        nextBtn?.addEventListener('click', () => {
            if (currentIndex < sections.length - 1) {
                const nextSection = sections[currentIndex + 1];
                window.location.hash = `/book/study-guide/chapter/${nextSection.id}`;
            }
        });

        tocBtn?.addEventListener('click', () => {
            this.showStudyGuideTOC(book);
        });
    }

    /**
     * Setup study guide view toggle (study view vs side-by-side vs cross-refs)
     */
    setupStudyGuideViewToggle(book, tocEntry, sectionId) {
        const toggleBtns = this.contentEl.querySelectorAll('.sg-toggle-btn');
        const sgContent = this.contentEl.querySelector('.sg-content-wrapper');
        const bigBookPanel = this.contentEl.querySelector('#sg-bigbook-panel');
        const crossRefPanel = this.contentEl.querySelector('#sg-crossref-panel');
        const closeBtn = this.contentEl.querySelector('.sg-bigbook-close');
        const crossRefCloseBtn = this.contentEl.querySelector('.sg-crossref-close');

        const resetPanels = () => {
            sgContent.classList.remove('side-by-side', 'with-crossrefs');
            bigBookPanel?.classList.add('hidden');
            crossRefPanel?.classList.add('hidden');
        };

        toggleBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const view = btn.dataset.view;
                resetPanels();

                if (view === 'sidebyside') {
                    sgContent.classList.add('side-by-side');
                    bigBookPanel?.classList.remove('hidden');

                    // Load Big Book content for this section
                    if (tocEntry?.bigBookPages) {
                        await this.loadBigBookForStudyGuide(tocEntry.bigBookPages, sectionId);
                    }
                } else if (view === 'crossrefs') {
                    sgContent.classList.add('with-crossrefs');
                    crossRefPanel?.classList.remove('hidden');

                    // Load cross-references for this section
                    if (tocEntry?.bigBookPages) {
                        await this.loadCrossRefsForStudyGuide(tocEntry.bigBookPages);
                    }
                }
            });
        });

        closeBtn?.addEventListener('click', () => {
            resetPanels();
            toggleBtns.forEach(b => {
                b.classList.toggle('active', b.dataset.view === 'study');
            });
        });

        crossRefCloseBtn?.addEventListener('click', () => {
            resetPanels();
            toggleBtns.forEach(b => {
                b.classList.toggle('active', b.dataset.view === 'study');
            });
        });
    }

    /**
     * Load cross-references for study guide section
     */
    async loadCrossRefsForStudyGuide(pageRange) {
        const contentEl = document.getElementById('sg-crossref-content');
        if (!contentEl) return;

        contentEl.innerHTML = '<div class="crossref-loading">Loading references...</div>';

        // Parse page range
        const pageMatch = pageRange.match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
        if (!pageMatch) {
            contentEl.innerHTML = '<div class="crossref-empty"><p>No page range available.</p></div>';
            return;
        }

        const startPage = parseInt(pageMatch[1]);
        const endPage = pageMatch[2] ? parseInt(pageMatch[2]) : startPage;

        // Get cross-references for this page range
        const crossRefs = pageCrossRef.getRefsForPageRange('big-book', startPage, endPage);
        const crossRefHtml = this.generateCrossRefSidebarHtml(crossRefs, 'big-book', startPage);

        contentEl.innerHTML = crossRefHtml;

        // Setup cross-reference expand buttons
        this.setupStudyGuideCrossRefInteractions();
    }

    /**
     * Setup cross-reference interactions for study guide
     */
    setupStudyGuideCrossRefInteractions() {
        const panel = this.contentEl.querySelector('#sg-crossref-panel');
        if (!panel) return;

        // Handle cross-reference link clicks
        panel.querySelectorAll('.crossref-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const dateKey = link.dataset.date;
                const entryNum = link.dataset.entry;

                if (dateKey) {
                    window.location.hash = `/book/daily-reflections`;
                    setTimeout(() => {
                        window.app?.reader?.navigateToDailyReflection(dateKey);
                    }, 100);
                } else if (entryNum) {
                    window.location.hash = `/book/as-bill-sees-it`;
                    setTimeout(() => {
                        window.app?.reader?.navigateToAbsitEntry(parseInt(entryNum));
                    }, 100);
                }
            });
        });

        // Handle expand buttons
        panel.querySelectorAll('.crossref-expand-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const type = btn.dataset.type;
                const dateKey = btn.dataset.date;
                const entryNum = btn.dataset.entry;
                const listItem = btn.closest('.crossref-item');
                const expandedContent = listItem?.querySelector('.crossref-expanded-content');

                if (!expandedContent) return;

                const isExpanded = expandedContent.style.display !== 'none';

                if (isExpanded) {
                    expandedContent.style.display = 'none';
                    btn.classList.remove('expanded');
                } else {
                    expandedContent.style.display = 'block';
                    btn.classList.add('expanded');
                    if (!expandedContent.innerHTML || expandedContent.innerHTML.includes('Loading')) {
                        this.loadExpandedCrossRefContent(type, dateKey, entryNum, expandedContent);
                    }
                }
            });
        });
    }

    /**
     * Load Big Book content for side-by-side view
     */
    async loadBigBookForStudyGuide(pageRange, sectionId) {
        const contentEl = document.getElementById('sg-bigbook-content');
        if (!contentEl) return;

        contentEl.innerHTML = '<div class="sg-loading">Loading Big Book text...</div>';

        const bigBook = window.app?.books?.get('big-book');
        if (!bigBook) {
            contentEl.innerHTML = '<div class="sg-error">Big Book not loaded</div>';
            return;
        }

        // Get content based on section type
        const content = this.getBigBookContentForSection(bigBook, pageRange, sectionId);

        if (content && content.length > 0) {
            // Sort paragraphs by page order to ensure continuous flow
            const romanToNum = { 'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10,
                'xi': 11, 'xii': 12, 'xiii': 13, 'xiv': 14, 'xv': 15, 'xvi': 16, 'xvii': 17, 'xviii': 18, 'xix': 19, 'xx': 20,
                'xxi': 21, 'xxii': 22, 'xxiii': 23, 'xxiv': 24, 'xxv': 25, 'xxvi': 26, 'xxvii': 27, 'xxviii': 28, 'xxix': 29, 'xxx': 30 };

            const getPageOrder = (p) => {
                if (!p) return 9999;
                const cleanPage = String(p).toLowerCase().split('-')[0].trim();
                if (romanToNum[cleanPage]) return romanToNum[cleanPage];
                const num = parseInt(p, 10);
                return isNaN(num) ? 1000 : num + 100;
            };

            // Sort content by page number while preserving paragraph order within pages
            const sortedContent = [...content].sort((a, b) => {
                const pageA = a.pageNumber || a.page;
                const pageB = b.pageNumber || b.page;
                return getPageOrder(pageA) - getPageOrder(pageB);
            });

            // Build continuous HTML with inline page markers
            let html = '<div class="sg-bb-continuous">';
            let currentPage = null;

            for (const para of sortedContent) {
                const page = para.pageNumber || para.page || '';

                // Add page marker when page changes
                if (page && page !== currentPage) {
                    if (currentPage !== null) {
                        // Add a subtle page break marker between pages
                        html += `<div class="sg-bb-page-break"><span class="sg-bb-page-marker">— Page ${page} —</span></div>`;
                    } else {
                        // First page - add header
                        html += `<div class="sg-bb-page-start"><span class="sg-bb-page-marker">Page ${page}</span></div>`;
                    }
                    currentPage = page;
                }

                // Add paragraph
                html += `<p class="sg-bb-para" data-page="${page}">${para.text}</p>`;
            }

            html += '</div>';
            contentEl.innerHTML = html;
        } else {
            // Provide a link to open the Big Book section
            const bbChapterId = this.getBigBookChapterForStudyGuideSection(sectionId);
            contentEl.innerHTML = `
                <div class="sg-bb-placeholder">
                    <p><strong>Big Book pages ${pageRange}</strong></p>
                    <p class="sg-hint">Open the Big Book to read the full text for this section.</p>
                    ${bbChapterId ? `<a href="#/book/big-book/chapter/${bbChapterId}" class="btn btn-primary" style="margin-top: 12px;">Open in Big Book</a>` : ''}
                </div>
            `;
        }
    }

    /**
     * Get Big Book content for a specific Study Guide section
     */
    getBigBookContentForSection(book, pageRange, sectionId) {
        const content = [];

        // Helper to extract paragraph text with formatting
        const extractParagraph = (para, pageNum) => {
            let text = '';
            if (para.content && Array.isArray(para.content)) {
                text = para.content.map(seg => {
                    let t = seg.text || '';
                    if (seg.italic) t = `<em>${t}</em>`;
                    if (seg.bold) t = `<strong>${t}</strong>`;
                    return t;
                }).join('');
            } else {
                text = para.plainText || '';
            }
            if (text.trim()) {
                // Support both pageNumber and page fields
                const paragraphPage = para.pageNumber || para.page || pageNum;
                content.push({
                    text: this.normalizeQuotes(text),
                    pageNumber: paragraphPage
                });
            }
        };

        // Determine section type from sectionId
        if (sectionId?.includes('doctors-opinion')) {
            // Doctor's Opinion
            if (book.content.frontMatter?.doctorsOpinion?.paragraphs) {
                book.content.frontMatter.doctorsOpinion.paragraphs.forEach(para => {
                    extractParagraph(para, para.pageNumber);
                });
            }
        } else if (sectionId === 'bb-preface') {
            // Preface to Fourth Edition ONLY (not forewords)
            if (book.content.frontMatter?.preface?.paragraphs) {
                book.content.frontMatter.preface.paragraphs.forEach(para => {
                    extractParagraph(para, para.pageNumber);
                });
            }
        } else if (sectionId?.includes('foreword-first')) {
            // Foreword to First Edition
            const fw = book.content.frontMatter?.forewords?.find(f =>
                f.title?.toLowerCase().includes('first') || f.edition?.toLowerCase().includes('first')
            );
            if (fw?.paragraphs) {
                fw.paragraphs.forEach(para => extractParagraph(para, para.pageNumber));
            }
        } else if (sectionId?.includes('foreword-second')) {
            // Foreword to Second Edition
            const fw = book.content.frontMatter?.forewords?.find(f =>
                f.title?.toLowerCase().includes('second') || f.edition?.toLowerCase().includes('second')
            );
            if (fw?.paragraphs) {
                fw.paragraphs.forEach(para => extractParagraph(para, para.pageNumber));
            }
        } else if (sectionId?.includes('foreword-third')) {
            // Foreword to Third Edition
            const fw = book.content.frontMatter?.forewords?.find(f =>
                f.title?.toLowerCase().includes('third') || f.edition?.toLowerCase().includes('third')
            );
            if (fw?.paragraphs) {
                fw.paragraphs.forEach(para => extractParagraph(para, para.pageNumber));
            }
        } else if (sectionId?.includes('foreword-fourth')) {
            // Foreword to Fourth Edition
            const fw = book.content.frontMatter?.forewords?.find(f =>
                f.title?.toLowerCase().includes('fourth') || f.edition?.toLowerCase().includes('fourth')
            );
            if (fw?.paragraphs) {
                fw.paragraphs.forEach(para => extractParagraph(para, para.pageNumber));
            }
        } else if (sectionId?.startsWith('ch')) {
            // Chapter - extract chapter number
            const match = sectionId.match(/ch(\d+)/);
            if (match) {
                const chapterNum = parseInt(match[1], 10);
                const chapter = book.content.mainText?.chapters?.find(ch => ch.chapterNumber === chapterNum);
                if (chapter?.paragraphs) {
                    chapter.paragraphs.forEach(para => {
                        extractParagraph(para, para.pageNumber);
                    });
                }
            }
        } else if (sectionId === 'dr-bobs-nightmare') {
            // Doctor Bob's Nightmare - Personal Story from Part 1
            const stories = book.content.personalStories;
            if (stories?.parts?.[0]?.stories?.[0]?.paragraphs) {
                const story = stories.parts[0].stories[0];
                story.paragraphs.forEach(para => {
                    extractParagraph(para, para.pageNumber);
                });
            }
        } else if (sectionId === 'twelve-traditions') {
            // Twelve Traditions - Appendix I
            const appendix = book.content.appendices?.find(app =>
                app.appendixNumber === 'I' || app.title?.toLowerCase().includes('tradition')
            );
            if (appendix?.paragraphs) {
                appendix.paragraphs.forEach(para => {
                    extractParagraph(para, para.pageNumber);
                });
            }
        } else {
            // Try to find by page range - check personal stories and appendices too
            const pages = this.parsePageRange(pageRange);
            if (pages.length > 0) {
                const startPage = parseInt(pages[0], 10);
                const endPage = parseInt(pages[pages.length - 1], 10);

                // Check main chapters
                if (book.content.mainText?.chapters) {
                    for (const chapter of book.content.mainText.chapters) {
                        if (chapter.paragraphs) {
                            chapter.paragraphs.forEach(para => {
                                const pn = para.pageNumber;
                                if (pn && pn >= startPage && pn <= endPage) {
                                    extractParagraph(para, pn);
                                }
                            });
                        }
                    }
                }

                // Check personal stories
                if (content.length === 0 && book.content.personalStories?.parts) {
                    for (const part of book.content.personalStories.parts) {
                        for (const story of part.stories || []) {
                            if (story.paragraphs) {
                                story.paragraphs.forEach(para => {
                                    const pn = para.pageNumber;
                                    if (pn && pn >= startPage && pn <= endPage) {
                                        extractParagraph(para, pn);
                                    }
                                });
                            }
                        }
                    }
                }

                // Check appendices
                if (content.length === 0 && book.content.appendices) {
                    for (const appendix of book.content.appendices) {
                        if (appendix.paragraphs) {
                            appendix.paragraphs.forEach(para => {
                                const pn = para.pageNumber;
                                if (pn && pn >= startPage && pn <= endPage) {
                                    extractParagraph(para, pn);
                                }
                            });
                        }
                    }
                }
            }
        }

        return content;
    }

    /**
     * Parse page range string into array of page numbers/numerals
     */
    parsePageRange(pageRange) {
        if (!pageRange) return [];

        // Handle ranges like "xi-xii", "1-16", "xxiii-xxx"
        const parts = pageRange.split('-');
        const pages = [];

        if (parts.length === 2) {
            const start = parts[0].trim();
            const end = parts[1].trim();

            // Check if Roman numerals or Arabic numbers
            if (/^[ivxlcdm]+$/i.test(start)) {
                // Roman numerals - expand common ranges
                const romanToNum = { 'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10,
                    'xi': 11, 'xii': 12, 'xiii': 13, 'xiv': 14, 'xv': 15, 'xvi': 16, 'xvii': 17, 'xviii': 18, 'xix': 19, 'xx': 20,
                    'xxi': 21, 'xxii': 22, 'xxiii': 23, 'xxiv': 24, 'xxv': 25, 'xxvi': 26, 'xxvii': 27, 'xxviii': 28, 'xxix': 29, 'xxx': 30 };
                const numToRoman = Object.fromEntries(Object.entries(romanToNum).map(([k, v]) => [v, k]));
                const startNum = romanToNum[start.toLowerCase()];
                const endNum = romanToNum[end.toLowerCase()];
                if (startNum && endNum) {
                    for (let i = startNum; i <= endNum; i++) {
                        pages.push(numToRoman[i] || i.toString());
                    }
                } else {
                    pages.push(start, end);
                }
            } else {
                // Arabic numbers
                const startNum = parseInt(start, 10);
                const endNum = parseInt(end, 10);
                for (let i = startNum; i <= endNum; i++) {
                    pages.push(i.toString());
                }
            }
        } else {
            pages.push(pageRange.trim());
        }

        return pages;
    }

    /**
     * Get Big Book page content for study guide side-by-side view
     */
    getBigBookPageContentForStudyGuide(book, pageNum) {
        const paragraphs = [];
        const numericPage = parseInt(pageNum, 10);
        const isRoman = /^[ivxlcdm]+$/i.test(pageNum);

        // Helper to extract paragraph text
        const extractText = (para) => {
            if (para.content && Array.isArray(para.content)) {
                return para.content.map(seg => {
                    let text = seg.text || '';
                    if (seg.italic) text = `<em>${text}</em>`;
                    if (seg.bold) text = `<strong>${text}</strong>`;
                    return text;
                }).join('');
            }
            return para.plainText || '';
        };

        // Search through chapters for numeric pages
        if (!isRoman && book.content.mainText?.chapters) {
            for (const ch of book.content.mainText.chapters) {
                if (ch.paragraphs) {
                    ch.paragraphs.forEach(para => {
                        if (para.pageNumber === numericPage) {
                            const text = extractText(para);
                            if (text.trim()) {
                                paragraphs.push(`<p>${this.normalizeQuotes(text)}</p>`);
                            }
                        }
                    });
                }
            }
        }

        // Search front matter for Roman numeral pages
        if (isRoman && book.content.frontMatter) {
            const fm = book.content.frontMatter;

            // Check preface
            if (fm.preface?.paragraphs) {
                fm.preface.paragraphs.forEach(para => {
                    const text = extractText(para);
                    if (text.trim()) {
                        paragraphs.push(`<p>${this.normalizeQuotes(text)}</p>`);
                    }
                });
            }

            // Check forewords
            if (fm.forewords) {
                fm.forewords.forEach(fw => {
                    if (fw.paragraphs) {
                        fw.paragraphs.forEach(para => {
                            const text = extractText(para);
                            if (text.trim()) {
                                paragraphs.push(`<p>${this.normalizeQuotes(text)}</p>`);
                            }
                        });
                    }
                });
            }

            // Check Doctor's Opinion
            if (fm.doctorsOpinion?.paragraphs) {
                fm.doctorsOpinion.paragraphs.forEach(para => {
                    const text = extractText(para);
                    if (text.trim()) {
                        paragraphs.push(`<p>${this.normalizeQuotes(text)}</p>`);
                    }
                });
            }
        }

        return paragraphs.join('');
    }

    /**
     * Get Study Guide section ID for a given Big Book chapter
     */
    getStudyGuideSectionForBigBookChapter(chapterNum, contentType = 'chapter') {
        // Mapping of Big Book chapters to Study Guide section IDs
        const chapterMapping = {
            1: 'ch1-bills-story',
            2: 'ch2-there-is-a-solution',
            3: 'ch3-more-about-alcoholism',
            4: 'ch4-we-agnostics',
            5: 'ch5-how-it-works',
            6: 'ch6-into-action',
            7: 'ch7-working-with-others',
            8: 'ch8-to-wives',
            9: 'ch9-the-family-afterward',
            10: 'ch10-to-employers',
            11: 'ch11-a-vision-for-you'
        };

        const frontMatterMapping = {
            'preface': 'bb-preface',
            'foreword-1939': 'foreword-first',
            'foreword-1955': 'foreword-second',
            'foreword-1976': 'foreword-third',
            'foreword-2001': 'foreword-fourth',
            'doctors-opinion': 'doctors-opinion'
        };

        if (contentType === 'chapter' && chapterMapping[chapterNum]) {
            return chapterMapping[chapterNum];
        }

        if (frontMatterMapping[contentType]) {
            return frontMatterMapping[contentType];
        }

        return null;
    }

    /**
     * Get Big Book chapter ID for a given Study Guide section
     */
    getBigBookChapterForStudyGuideSection(sectionId) {
        const mapping = {
            'bb-preface': 'preface',
            'foreword-first': 'foreword-1939',
            'foreword-second': 'foreword-1955',
            'foreword-third': 'foreword-1976',
            'foreword-fourth': 'foreword-2001',
            'doctors-opinion': 'doctors-opinion',
            'ch1-bills-story': 'chapter-1',
            'ch2-there-is-a-solution': 'chapter-2',
            'ch3-more-about-alcoholism': 'chapter-3',
            'ch4-we-agnostics': 'chapter-4',
            'ch5-how-it-works': 'chapter-5',
            'ch6-into-action': 'chapter-6',
            'ch7-working-with-others': 'chapter-7',
            'ch8-to-wives': 'chapter-8',
            'ch9-family-afterward': 'chapter-9',
            'ch10-to-employers': 'chapter-10',
            'ch11-vision-for-you': 'chapter-11',
            'dr-bobs-nightmare': 'story-1-1',
            'twelve-traditions': 'appendix-I'
        };

        return mapping[sectionId] || null;
    }

    /**
     * Show Study Guide Table of Contents
     */
    async showStudyGuideTOC(book) {
        const tocHtml = book.tableOfContents.map((section, idx) => {
            const isChapter = section.sectionType === 'chapter';
            const chapterNum = isChapter ? section.title.match(/Chapter (\d+)/i)?.[1] : null;

            return `
                <div class="sg-toc-item ${isChapter ? 'sg-toc-chapter' : ''}">
                    <a href="#/book/study-guide/chapter/${section.id}" class="sg-toc-link">
                        ${chapterNum ? `<span class="sg-toc-num">${chapterNum}</span>` : ''}
                        <span class="sg-toc-title">${section.title}</span>
                        ${section.bigBookPages ? `<span class="sg-toc-pages">pp. ${section.bigBookPages}</span>` : ''}
                    </a>
                    <div class="sg-toc-stats">
                        ${section.questionCount ? `<span>${section.questionCount} Q</span>` : ''}
                        ${section.commentCount ? `<span>${section.commentCount} C</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        this.contentEl.innerHTML = `
            <div class="sg-toc-view">
                <div class="sg-toc-header">
                    <h2>Big Book Study Guide</h2>
                    <p class="sg-toc-subtitle">${book.metadata.title}</p>
                </div>

                <div class="sg-stats-bar">
                    <div class="sg-stat-item">
                        <span class="sg-stat-num">${book.metadata.statistics?.totalQuestions || 0}</span>
                        <span class="sg-stat-label">Questions</span>
                    </div>
                    <div class="sg-stat-item">
                        <span class="sg-stat-num">${book.metadata.statistics?.totalComments || 0}</span>
                        <span class="sg-stat-label">Comments</span>
                    </div>
                    <div class="sg-stat-item">
                        <span class="sg-stat-num">${book.metadata.statistics?.totalSections || 0}</span>
                        <span class="sg-stat-label">Sections</span>
                    </div>
                </div>

                <div class="sg-toc-list">
                    ${tocHtml}
                </div>
            </div>
        `;
    }

    /**
     * Get linked source HTML - shows corresponding entry from As Bill Sees It
     * when the source references that book
     */
    getLinkedSourceHtml(source, currentBook) {
        if (!source || !source.book) return '';

        const bookName = source.book.toUpperCase();
        const refNum = parseInt(source.pages, 10);

        // Check if source is As Bill Sees It
        if (bookName === 'AS BILL SEES IT' && !isNaN(refNum)) {
            // Find As Bill Sees It book from loaded books
            const absitBook = window.app?.books?.get('as-bill-sees-it');
            if (absitBook && absitBook.entries) {
                // Daily Reflections references entry number, not page number
                // (As Bill Sees It entries start at page 11, so entry 1 = page 11)
                // First try to find by entry number, then fall back to page number
                let entry = absitBook.entries.find(e => e.entry_number === refNum);
                if (!entry) {
                    // Fallback: try by page number
                    entry = absitBook.entries.find(e => e.page === refNum);
                }
                if (entry) {
                    // Build complete entry content with all sections
                    const sectionsHtml = entry.sections ? entry.sections.map(section => {
                        const paragraphsHtml = section.paragraphs ? section.paragraphs.map(para =>
                            `<p class="${para.is_quote ? 'quote-text' : ''}">${this.applyAutoCrossReferences(this.normalizeQuotes(para.text))}</p>`
                        ).join('') : '';

                        return `
                            <div class="linked-source-section">
                                ${paragraphsHtml}
                                ${section.source ? `<div class="linked-source-citation">- ${section.source}</div>` : ''}
                            </div>
                        `;
                    }).join('') : '';

                    return `
                        <div class="linked-source-panel">
                            <div class="linked-source-header">
                                <span class="linked-source-icon">📖</span>
                                <span class="linked-source-title">As Bill Sees It - Entry ${entry.entry_number}: ${entry.title}</span>
                                <span class="linked-source-page">p. ${entry.page}</span>
                                <button class="btn btn-sm btn-secondary" id="view-absit-entry" data-entry="${entry.entry_number}">
                                    Open in Reader
                                </button>
                            </div>
                            <div class="linked-source-content">
                                ${sectionsHtml}
                            </div>
                            ${entry.all_sources && entry.all_sources.length > 1 ? `
                                <div class="linked-source-all-sources">
                                    <strong>Sources:</strong> ${entry.all_sources.map(s => s.citation).join(', ')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }
            }
        }

        return '';
    }

    /**
     * Get cross-reference legend HTML
     */
    getCrossRefLegendHtml() {
        return `
            <div class="crossref-legend">
                <span style="font-weight: 500; margin-right: var(--spacing-sm);">Auto Cross-References:</span>
                <div class="crossref-legend-item">
                    <span class="crossref-legend-color" style="background: rgba(25, 118, 210, 0.15); border: 1px dashed #1976d2;"></span>
                    <span>Page References</span>
                </div>
                <div class="crossref-legend-item">
                    <span class="crossref-legend-color" style="background: rgba(76, 175, 80, 0.15); border: 1px dashed #2e7d32;"></span>
                    <span>Book References</span>
                </div>
                <div class="crossref-legend-item">
                    <span class="crossref-legend-color" style="background: rgba(156, 39, 176, 0.15); border: 1px dashed #7b1fa2;"></span>
                    <span>Steps</span>
                </div>
                <div class="crossref-legend-item">
                    <span class="crossref-legend-color" style="background: rgba(255, 152, 0, 0.15); border: 1px dashed #f57c00;"></span>
                    <span>Traditions</span>
                </div>
            </div>
        `;
    }

    /**
     * Apply automatic cross-references to text
     * Highlights references to other AA literature
     */
    applyAutoCrossReferences(text) {
        const patterns = [
            // Page references
            { regex: /(p\.\s*\d+(?:\s*-\s*\d+)?)/gi, class: 'auto-ref auto-ref-page' },
            { regex: /(pages?\s*\d+(?:\s*-\s*\d+)?)/gi, class: 'auto-ref auto-ref-page' },

            // Book references
            { regex: /(Big Book|Alcoholics Anonymous)/gi, class: 'auto-ref auto-ref-book' },
            { regex: /(Twelve and Twelve|12\s*&\s*12|Twelve Steps and Twelve Traditions)/gi, class: 'auto-ref auto-ref-book' },
            { regex: /(As Bill Sees It)/gi, class: 'auto-ref auto-ref-book' },
            { regex: /(Daily Reflections)/gi, class: 'auto-ref auto-ref-book' },
            { regex: /(A\.A\. Comes of Age)/gi, class: 'auto-ref auto-ref-book' },
            { regex: /(Grapevine)/gi, class: 'auto-ref auto-ref-book' },

            // Step references
            { regex: /(Steps?\s+\d+(?:\s*(?:and|&|-)\s*\d+)?)/gi, class: 'auto-ref auto-ref-step' },

            // Tradition references
            { regex: /(Traditions?\s+\d+(?:\s*(?:and|&|-)\s*\d+)?)/gi, class: 'auto-ref auto-ref-tradition' }
        ];

        let result = text;
        for (const pattern of patterns) {
            result = result.replace(pattern.regex, `<span class="${pattern.class}" title="Cross Reference">$1</span>`);
        }

        return result;
    }

    /**
     * Normalize quotes in text - converts curly/smart quotes to regular quotes
     * and wraps quoted content in italic styling
     */
    normalizeQuotes(text) {
        if (!text) return text;

        // Replace curly double quotes with regular quotes
        let result = text.replace(/[\u201C\u201D]/g, '"');
        // Replace curly single quotes with regular apostrophes
        result = result.replace(/[\u2018\u2019]/g, "'");
        // Replace em-dash with regular dash
        result = result.replace(/[\u2014]/g, '—');
        // Replace en-dash with regular dash
        result = result.replace(/[\u2013]/g, '–');

        return result;
    }

    /**
     * Display a standard book
     */
    async displayStandardBook(book) {
        // Build page map
        this.buildPageMap(book);

        // Show first chapter by default
        if (book.content && book.content.length > 0) {
            await this.displayChapter(book, book.content[0]);
        }

        // Show page navigation (with null checks)
        if (this.pageNavEl) this.pageNavEl.classList.remove('hidden');
        if (this.totalPagesEl) this.totalPagesEl.textContent = this.totalPages;
        if (this.pageInput) this.pageInput.max = this.totalPages;
        this.updatePageNav();
    }

    /**
     * Display a chapter
     */
    async displayChapter(book, chapter) {
        this.currentChapter = chapter;
        const bookAnnotations = await annotations.loadForBook(book.metadata.id);

        // Group paragraphs by page for book-like display
        const pageGroups = new Map();
        chapter.paragraphs.forEach(para => {
            const pageNum = para.pageNumber || 0;
            if (!pageGroups.has(pageNum)) {
                pageGroups.set(pageNum, []);
            }
            pageGroups.get(pageNum).push(para);
        });

        // Build HTML with paragraphs grouped by page
        let contentHtml = '';
        const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);

        for (const pageNum of sortedPages) {
            const pageParagraphs = pageGroups.get(pageNum);
            const paragraphsHtml = pageParagraphs.map(para => {
                const annotatedText = annotations.applyToContent(para.text, bookAnnotations, para.id);
                return `<div class="paragraph" data-paragraph-id="${para.id}" data-page="${para.pageNumber}">${annotatedText}</div>`;
            }).join('');

            if (pageNum > 0) {
                contentHtml += `
                    <div class="book-page" data-page="p. ${pageNum}">
                        ${paragraphsHtml}
                    </div>
                `;
            } else {
                contentHtml += paragraphsHtml;
            }
        }

        this.contentEl.innerHTML = `
            <div class="chapter-header">
                ${chapter.number ? `<div class="chapter-number">Chapter ${chapter.number}</div>` : ''}
                <h2 class="chapter-title">${chapter.title}</h2>
                ${chapter.pageStart ? `<div class="chapter-page-range">Pages ${chapter.pageStart} - ${chapter.pageEnd}</div>` : ''}
            </div>
            <div class="chapter-content">
                ${contentHtml}
            </div>
        `;

        // Update current page
        if (chapter.pageStart) {
            this.currentPage = chapter.pageStart;
            this.updatePageNav();
        }

        // Save reading progress
        await db.saveReadingProgress(book.metadata.id, {
            chapterId: chapter.id || chapter.number,
            pageNumber: chapter.pageStart
        });
    }

    /**
     * Build page map for navigation
     */
    buildPageMap(book) {
        this.pageMap.clear();
        this.totalPages = 0;

        book.content.forEach(chapter => {
            if (chapter.paragraphs) {
                chapter.paragraphs.forEach(para => {
                    if (para.pageNumber) {
                        if (!this.pageMap.has(para.pageNumber)) {
                            this.pageMap.set(para.pageNumber, []);
                        }
                        this.pageMap.get(para.pageNumber).push({
                            chapterId: chapter.id || chapter.number,
                            paragraphId: para.id
                        });

                        if (para.pageNumber > this.totalPages) {
                            this.totalPages = para.pageNumber;
                        }
                    }
                });
            }
        });
    }

    /**
     * Go to a specific page
     */
    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;

        this.currentPage = page;
        this.updatePageNav();

        // Scroll to first paragraph on that page
        const pageData = this.pageMap.get(page);
        if (pageData && pageData.length > 0) {
            const firstPara = this.contentEl.querySelector(`[data-page="${page}"]`);
            if (firstPara) {
                firstPara.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    /**
     * Update page navigation UI
     */
    updatePageNav() {
        if (this.pageInput) this.pageInput.value = this.currentPage;
        if (this.prevBtn) this.prevBtn.disabled = this.currentPage <= 1;
        if (this.nextBtn) this.nextBtn.disabled = this.currentPage >= this.totalPages;
    }

    /**
     * Handle click on auto cross-reference
     */
    handleAutoRefClick(element, event) {
        event.preventDefault();
        event.stopPropagation();

        const text = element.textContent.trim();
        const currentBookId = this.currentBook?.metadata?.id;

        // Page references: "p. 58", "page 58", "pages 58-60"
        if (element.classList.contains('auto-ref-page')) {
            const pageMatch = text.match(/(\d+)/);
            if (pageMatch) {
                const pageNum = parseInt(pageMatch[1], 10);
                // Navigate to page in current book
                if (currentBookId) {
                    this.navigateToSourcePage(currentBookId, pageNum);
                    toast.info(`Navigating to page ${pageNum}`);
                }
            }
            return;
        }

        // Step references: "Step 3", "Steps 4 and 5"
        if (element.classList.contains('auto-ref-step')) {
            const stepMatch = text.match(/(\d+)/);
            if (stepMatch) {
                const stepNum = parseInt(stepMatch[1], 10);
                window.location.hash = `/book/twelve-and-twelve/chapter/step-${stepNum}`;
                toast.info(`Opening Step ${stepNum}`);
            }
            return;
        }

        // Tradition references: "Tradition 5", "Traditions 1 and 2"
        if (element.classList.contains('auto-ref-tradition')) {
            const tradMatch = text.match(/(\d+)/);
            if (tradMatch) {
                const tradNum = parseInt(tradMatch[1], 10);
                window.location.hash = `/book/twelve-and-twelve/chapter/tradition-${tradNum}`;
                toast.info(`Opening Tradition ${tradNum}`);
            }
            return;
        }

        // Book references
        if (element.classList.contains('auto-ref-book')) {
            const lowerText = text.toLowerCase();
            if (lowerText.includes('big book') || lowerText.includes('alcoholics anonymous')) {
                window.location.hash = '/book/big-book';
                toast.info('Opening Big Book');
            } else if (lowerText.includes('twelve and twelve') || lowerText.includes('12') || lowerText.includes('twelve steps')) {
                window.location.hash = '/book/twelve-and-twelve';
                toast.info('Opening Twelve Steps and Twelve Traditions');
            } else if (lowerText.includes('as bill sees it')) {
                window.location.hash = '/book/as-bill-sees-it';
                toast.info('Opening As Bill Sees It');
            } else if (lowerText.includes('daily reflections')) {
                window.location.hash = '/book/daily-reflections';
                toast.info('Opening Daily Reflections');
            } else if (lowerText.includes('comes of age')) {
                window.location.hash = '/book/aa-comes-of-age';
                toast.info('Opening A.A. Comes of Age');
            } else if (lowerText.includes('grapevine')) {
                window.location.hash = '/book/language-of-the-heart';
                toast.info('Opening Language of the Heart');
            }
            return;
        }
    }

    /**
     * Refresh content (re-render with updated annotations)
     */
    async refreshContent() {
        if (this.currentBook) {
            annotations.clearCache(this.currentBook.metadata.id);

            if (this.currentBook.reflections) {
                const dateKey = this.contentEl.querySelector('.reflection-entry .reflection-date')?.textContent;
                if (dateKey) {
                    const parts = dateKey.split(' ');
                    const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'].indexOf(parts[0]);
                    const searchKey = `${String(monthIndex + 1).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
                    const reflection = this.currentBook.reflections.find(r => r.dateKey === searchKey);
                    if (reflection) {
                        await this.displayReflection(this.currentBook, reflection);
                    }
                }
            } else if (this.currentBook.entries) {
                // As Bill Sees It
                const entryNumEl = this.contentEl.querySelector('.entry-number');
                if (entryNumEl) {
                    const entryNum = parseInt(entryNumEl.textContent, 10);
                    const entry = this.currentBook.entries.find(e => e.entry_number === entryNum);
                    if (entry) {
                        await this.displayEntry(this.currentBook, entry);
                    }
                }
            } else if (this.currentBook.theSteps && this.currentBook.theTraditions) {
                // Twelve and Twelve
                if (this.currentChapter) {
                    const type = this.currentChapter.itemType;
                    const num = this.currentChapter.number;
                    const targetArray = type === 'step' ? this.currentBook.theSteps : this.currentBook.theTraditions;
                    const target = targetArray.find(item => item.number === num);
                    if (target) {
                        await this.displayStepOrTradition(this.currentBook, target, type);
                    }
                }
            } else if (this.currentChapter) {
                await this.displayChapter(this.currentBook, this.currentChapter);
            }
        }
    }

    /**
     * Save reading progress for current position
     */
    async saveProgress(bookId, chapterId, scrollPosition = 0) {
        try {
            const book = window.app?.books?.get(bookId);
            const bookTitle = book?.metadata?.title || book?.metadata?.shortTitle || bookId;

            await db.saveReadingProgress(bookId, {
                chapterId,
                scrollPosition,
                bookTitle,
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('Failed to save reading progress:', error);
        }
    }

    /**
     * Show welcome screen with continue reading
     */
    async showWelcome() {
        this.currentBook = null;
        this.currentChapter = null;
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');

        // Show the welcome screen from index.html
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
            // Use the existing welcome screen from HTML
            this.contentEl.innerHTML = '';
            this.contentEl.appendChild(welcomeScreen.cloneNode(true));
            this.contentEl.querySelector('#welcome-screen').style.display = '';
        }

        // Populate continue reading section
        try {
            const recent = await db.getRecentReading(3);
            const continueSection = this.contentEl.querySelector('#continue-reading-section');
            const continueList = this.contentEl.querySelector('#continue-reading-list');

            if (recent && recent.length > 0 && continueSection && continueList) {
                continueSection.style.display = '';
                continueList.innerHTML = recent.map(r => `
                    <a href="#/book/${r.bookId}/chapter/${r.chapterId}" class="quick-start-card">
                        <div class="quick-start-icon" style="background: var(--accent-color);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                        </div>
                        <div class="quick-start-text">
                            <span class="quick-start-title">${r.bookTitle || r.bookId}</span>
                            <span class="quick-start-subtitle">${this.formatChapterId(r.chapterId)} • ${this.formatTimeAgo(r.lastRead)}</span>
                        </div>
                    </a>
                `).join('');
            } else if (continueSection) {
                continueSection.style.display = 'none';
            }
        } catch (error) {
            console.warn('Failed to get recent reading:', error);
        }
    }

    /**
     * Format chapter ID for display
     */
    formatChapterId(chapterId) {
        if (!chapterId) return '';
        if (chapterId.startsWith('step-')) return `Step ${chapterId.replace('step-', '')}`;
        if (chapterId.startsWith('tradition-')) return `Tradition ${chapterId.replace('tradition-', '')}`;
        if (chapterId.startsWith('chapter-')) return `Chapter ${chapterId.replace('chapter-', '')}`;
        if (chapterId.startsWith('appendix-')) return `Appendix ${chapterId.replace('appendix-', '')}`;
        if (chapterId.startsWith('story-')) return 'Personal Story';
        if (chapterId.startsWith('reflection-')) {
            const dateKey = chapterId.replace('reflection-', '');
            const [month, day] = dateKey.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
        }
        if (chapterId.startsWith('entry-')) return `Entry #${chapterId.replace('entry-', '')}`;
        return chapterId;
    }

    /**
     * Format timestamp as relative time
     */
    formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    /**
     * Generate bookmark button HTML
     */
    async getBookmarkButtonHtml(bookId, chapterId, title) {
        const existing = await db.isBookmarked(bookId, chapterId);
        return `
            <button class="btn btn-icon bookmark-btn ${existing ? 'bookmarked' : ''}"
                    data-book-id="${bookId}"
                    data-chapter-id="${chapterId}"
                    data-title="${title}"
                    title="${existing ? 'Remove bookmark' : 'Add bookmark'}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${existing ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
            </button>
        `;
    }

    /**
     * Setup bookmark button click handler
     */
    setupBookmarkButton() {
        const btn = this.contentEl.querySelector('.bookmark-btn');
        if (!btn) return;

        btn.addEventListener('click', async () => {
            const bookId = btn.dataset.bookId;
            const chapterId = btn.dataset.chapterId;
            const title = btn.dataset.title;

            const existing = await db.isBookmarked(bookId, chapterId);

            if (existing) {
                await db.removeBookmark(existing.id);
                btn.classList.remove('bookmarked');
                btn.querySelector('svg').setAttribute('fill', 'none');
                btn.title = 'Add bookmark';
            } else {
                const book = window.app?.books?.get(bookId);
                await db.addBookmark({
                    bookId,
                    chapterId,
                    title,
                    bookTitle: book?.metadata?.title || bookId
                });
                btn.classList.add('bookmarked');
                btn.querySelector('svg').setAttribute('fill', 'currentColor');
                btn.title = 'Remove bookmark';
            }
        });
    }

    /**
     * Show bookmarks view
     */
    async showBookmarks() {
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');
        const bookmarks = await db.getBookmarks();

        const bookmarksHtml = bookmarks.length > 0
            ? bookmarks.sort((a, b) => b.createdAt - a.createdAt).map(b => `
                <div class="bookmark-card">
                    <a href="#/book/${b.bookId}/chapter/${b.chapterId}" class="bookmark-link">
                        <div class="bookmark-title">${b.title || b.chapterId}</div>
                        <div class="bookmark-book">${b.bookTitle || b.bookId}</div>
                        <div class="bookmark-time">${this.formatTimeAgo(b.createdAt)}</div>
                    </a>
                    <button class="btn btn-icon bookmark-delete" data-id="${b.id}" title="Remove bookmark">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `).join('')
            : '<p class="empty-state">No bookmarks yet. Click the bookmark icon when reading to save your place.</p>';

        this.contentEl.innerHTML = `
            <div class="bookmarks-view">
                <h2>My Bookmarks</h2>
                <div class="bookmarks-list">
                    ${bookmarksHtml}
                </div>
            </div>
        `;

        // Setup delete handlers
        this.contentEl.querySelectorAll('.bookmark-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                await db.removeBookmark(btn.dataset.id);
                this.showBookmarks(); // Refresh
            });
        });
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.contentEl.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
            </div>
        `;
    }

    /**
     * Show topic index view - alphabetical listing of AA literature topics
     */
    async showIndex() {
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');

        // Predefined index topics with references
        const indexTopics = [
            { term: 'Acceptance', refs: [{ book: 'big-book', chapter: 'chapter-5', desc: 'How It Works' }, { book: 'twelve-and-twelve', chapter: 'step-1', desc: 'Step One' }] },
            { term: 'Alcoholism as a Disease', refs: [{ book: 'big-book', chapter: 'doctors-opinion', desc: "The Doctor's Opinion" }] },
            { term: 'Amends', refs: [{ book: 'twelve-and-twelve', chapter: 'step-8', desc: 'Step Eight' }, { book: 'twelve-and-twelve', chapter: 'step-9', desc: 'Step Nine' }] },
            { term: 'Character Defects', refs: [{ book: 'twelve-and-twelve', chapter: 'step-6', desc: 'Step Six' }, { book: 'twelve-and-twelve', chapter: 'step-7', desc: 'Step Seven' }] },
            { term: 'Daily Reprieve', refs: [{ book: 'big-book', chapter: 'chapter-6', desc: 'Into Action' }] },
            { term: 'Faith', refs: [{ book: 'twelve-and-twelve', chapter: 'step-2', desc: 'Step Two' }, { book: 'twelve-and-twelve', chapter: 'step-3', desc: 'Step Three' }] },
            { term: 'Fear', refs: [{ book: 'big-book', chapter: 'chapter-5', desc: 'How It Works' }, { book: 'big-book', chapter: 'chapter-4', desc: 'We Agnostics' }] },
            { term: 'Fourth Step Inventory', refs: [{ book: 'big-book', chapter: 'chapter-5', desc: 'How It Works' }, { book: 'twelve-and-twelve', chapter: 'step-4', desc: 'Step Four' }] },
            { term: 'God / Higher Power', refs: [{ book: 'big-book', chapter: 'chapter-4', desc: 'We Agnostics' }, { book: 'twelve-and-twelve', chapter: 'step-2', desc: 'Step Two' }] },
            { term: 'Gratitude', refs: [{ book: 'big-book', chapter: 'chapter-11', desc: 'A Vision For You' }] },
            { term: 'Honesty', refs: [{ book: 'twelve-and-twelve', chapter: 'step-1', desc: 'Step One' }, { book: 'big-book', chapter: 'chapter-5', desc: 'How It Works' }] },
            { term: 'Humility', refs: [{ book: 'twelve-and-twelve', chapter: 'step-7', desc: 'Step Seven' }] },
            { term: 'Inventory', refs: [{ book: 'big-book', chapter: 'chapter-5', desc: 'How It Works' }, { book: 'twelve-and-twelve', chapter: 'step-4', desc: 'Step Four' }, { book: 'twelve-and-twelve', chapter: 'step-10', desc: 'Step Ten' }] },
            { term: 'Meditation', refs: [{ book: 'twelve-and-twelve', chapter: 'step-11', desc: 'Step Eleven' }, { book: 'big-book', chapter: 'chapter-6', desc: 'Into Action' }] },
            { term: 'Moral Inventory', refs: [{ book: 'big-book', chapter: 'chapter-5', desc: 'How It Works' }, { book: 'twelve-and-twelve', chapter: 'step-4', desc: 'Step Four' }] },
            { term: 'Powerlessness', refs: [{ book: 'twelve-and-twelve', chapter: 'step-1', desc: 'Step One' }, { book: 'big-book', chapter: 'chapter-3', desc: 'More About Alcoholism' }] },
            { term: 'Prayer', refs: [{ book: 'twelve-and-twelve', chapter: 'step-11', desc: 'Step Eleven' }, { book: 'big-book', chapter: 'chapter-6', desc: 'Into Action' }] },
            { term: 'Promises (The)', refs: [{ book: 'big-book', chapter: 'chapter-6', desc: 'Into Action', page: '83-84' }] },
            { term: 'Resentment', refs: [{ book: 'big-book', chapter: 'chapter-5', desc: 'How It Works' }, { book: 'twelve-and-twelve', chapter: 'step-4', desc: 'Step Four' }] },
            { term: 'Sanity', refs: [{ book: 'twelve-and-twelve', chapter: 'step-2', desc: 'Step Two' }] },
            { term: 'Self-Centeredness', refs: [{ book: 'big-book', chapter: 'chapter-5', desc: 'How It Works' }] },
            { term: 'Serenity Prayer', refs: [{ book: 'twelve-and-twelve', chapter: 'step-11', desc: 'Step Eleven' }] },
            { term: 'Service', refs: [{ book: 'twelve-and-twelve', chapter: 'step-12', desc: 'Step Twelve' }, { book: 'twelve-and-twelve', chapter: 'tradition-5', desc: 'Tradition Five' }] },
            { term: 'Sponsorship', refs: [{ book: 'big-book', chapter: 'chapter-7', desc: 'Working With Others' }] },
            { term: 'Spiritual Awakening', refs: [{ book: 'twelve-and-twelve', chapter: 'step-12', desc: 'Step Twelve' }, { book: 'big-book', chapter: 'appendix-II', desc: 'Appendix II: Spiritual Experience' }] },
            { term: 'Surrender', refs: [{ book: 'twelve-and-twelve', chapter: 'step-1', desc: 'Step One' }, { book: 'twelve-and-twelve', chapter: 'step-3', desc: 'Step Three' }] },
            { term: 'Third Step Prayer', refs: [{ book: 'big-book', chapter: 'chapter-5', desc: 'How It Works', page: '63' }] },
            { term: 'Traditions (The 12)', refs: [{ book: 'twelve-and-twelve', chapter: 'tradition-1', desc: 'Tradition One' }] },
            { term: 'Trust', refs: [{ book: 'twelve-and-twelve', chapter: 'step-3', desc: 'Step Three' }] },
            { term: 'Willingness', refs: [{ book: 'twelve-and-twelve', chapter: 'step-6', desc: 'Step Six' }, { book: 'big-book', chapter: 'chapter-5', desc: 'How It Works' }] },
            { term: 'Working With Others', refs: [{ book: 'big-book', chapter: 'chapter-7', desc: 'Working With Others' }, { book: 'twelve-and-twelve', chapter: 'step-12', desc: 'Step Twelve' }] }
        ];

        // Group by first letter
        const grouped = {};
        indexTopics.forEach(topic => {
            const letter = topic.term[0].toUpperCase();
            if (!grouped[letter]) grouped[letter] = [];
            grouped[letter].push(topic);
        });

        const letters = Object.keys(grouped).sort();

        this.contentEl.innerHTML = `
            <div class="index-view">
                <h2>Topic Index</h2>
                <p class="index-description">Quick reference to key concepts in AA literature. Click any reference to navigate directly to that section.</p>

                <div class="index-alphabet">
                    ${letters.map(letter => `<a href="#index-${letter}" class="index-letter-link">${letter}</a>`).join('')}
                </div>

                <div class="index-topics">
                    ${letters.map(letter => `
                        <div class="index-letter-group" id="index-${letter}">
                            <h3 class="index-letter-heading">${letter}</h3>
                            ${grouped[letter].map(topic => `
                                <div class="index-topic-item">
                                    <span class="index-topic-term">${topic.term}</span>
                                    <div class="index-topic-refs">
                                        ${topic.refs.map(ref => `
                                            <a href="#/book/${ref.book}/chapter/${ref.chapter}" class="index-ref-link">
                                                <span class="index-ref-desc">${ref.desc}</span>
                                                ${ref.page ? `<span class="index-ref-page">(p. ${ref.page})</span>` : ''}
                                            </a>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Show my notes view - user annotations (highlights, comments, questions, definitions)
     */
    async showNotes() {
        const allAnnotations = await annotations.getAll();
        const byType = {
            highlight: allAnnotations.filter(a => a.type === 'highlight'),
            underline: allAnnotations.filter(a => a.type === 'underline'),
            comment: allAnnotations.filter(a => a.type === 'comment'),
            question: allAnnotations.filter(a => a.type === 'question'),
            definition: allAnnotations.filter(a => a.type === 'definition')
        };

        const totalCount = allAnnotations.length;

        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');

        this.contentEl.innerHTML = `
            <div class="notes-view">
                <h2>My Notes</h2>
                <p class="notes-description">Your personal annotations across all AA literature (${totalCount} total)</p>

                <div class="notes-filter-bar">
                    <button class="notes-filter-btn active" data-filter="all">All (${totalCount})</button>
                    <button class="notes-filter-btn" data-filter="highlight">Highlights (${byType.highlight.length})</button>
                    <button class="notes-filter-btn" data-filter="comment">Comments (${byType.comment.length})</button>
                    <button class="notes-filter-btn" data-filter="question">Questions (${byType.question.length})</button>
                    <button class="notes-filter-btn" data-filter="definition">Definitions (${byType.definition.length})</button>
                    <button class="notes-filter-btn" data-filter="underline">Underlines (${byType.underline.length})</button>
                </div>

                <div class="notes-list" id="notes-list">
                    ${this.renderNotesList(allAnnotations)}
                </div>
            </div>
        `;

        // Filter button handlers
        this.contentEl.querySelectorAll('.notes-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.contentEl.querySelectorAll('.notes-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const filter = btn.dataset.filter;
                const filtered = filter === 'all'
                    ? allAnnotations
                    : allAnnotations.filter(a => a.type === filter);

                document.getElementById('notes-list').innerHTML = this.renderNotesList(filtered);
            });
        });
    }

    /**
     * Render notes list HTML
     */
    renderNotesList(notesList) {
        if (notesList.length === 0) {
            return '<p class="empty-state">No annotations yet. Select text while reading to add highlights, comments, or questions.</p>';
        }

        return notesList.map(a => {
            let typeClass = a.type;
            let typeLabel = a.type.charAt(0).toUpperCase() + a.type.slice(1);
            let colorBadge = '';

            if (a.type === 'highlight') {
                colorBadge = `<span class="note-color-badge" style="background-color: var(--highlight-${a.color});"></span>`;
            } else if (a.type === 'underline') {
                typeLabel = `Underline (${a.underlineStyle})`;
            }

            return `
                <div class="note-card" data-annotation-id="${a.id}">
                    <div class="note-header">
                        <span class="note-type ${typeClass}">${colorBadge}${typeLabel}</span>
                        <span class="note-location">
                            <a href="#/book/${a.bookId}/chapter/${a.paragraphId?.split('-')[0] || ''}">${a.bookId}</a>
                        </span>
                    </div>
                    <div class="note-selected-text">"${this.escapeHtml(a.selectedText)}"</div>
                    ${a.content ? `<div class="note-content">${this.escapeHtml(a.content)}</div>` : ''}
                    ${a.answer ? `<div class="note-answer"><strong>Answer:</strong> ${this.escapeHtml(a.answer)}</div>` : ''}
                    <div class="note-actions">
                        <button class="btn-sm btn-delete-note" data-id="${a.id}" title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Escape HTML helper
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show comprehensive search view with filters
     */
    showSearchView(initialQuery = '', searchModule = null, availableBooks = []) {
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');

        // Use provided books list, fallback to search module
        if (availableBooks.length === 0 && searchModule) {
            availableBooks = searchModule.getAvailableBooks();
        }

        this.contentEl.innerHTML = `
            <div class="search-view">
                <h2>Search</h2>
                <p class="search-description">Search across all AA literature with advanced filtering options</p>

                <!-- Search Input -->
                <div class="search-input-container">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-input-icon">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" id="advanced-search-input" class="advanced-search-input"
                           placeholder="Enter search terms..." value="${this.escapeHtml(initialQuery)}">
                    <button id="advanced-search-btn" class="btn btn-primary">Search</button>
                </div>

                <!-- Search Filters -->
                <div class="search-filters-panel">
                    <div class="search-filter-section">
                        <h4 class="filter-section-title">Search Mode</h4>
                        <div class="search-mode-toggle">
                            <label class="search-mode-option">
                                <input type="radio" name="searchMode" value="indexed" checked>
                                <span class="mode-label">
                                    <span class="mode-name">Keyword Search</span>
                                    <span class="mode-desc">Find results containing all keywords</span>
                                </span>
                            </label>
                            <label class="search-mode-option">
                                <input type="radio" name="searchMode" value="exact">
                                <span class="mode-label">
                                    <span class="mode-name">Exact Phrase</span>
                                    <span class="mode-desc">Find results with exact phrase match</span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div class="search-filter-section">
                        <h4 class="filter-section-title">Filter by Book</h4>
                        <div class="book-filter-grid">
                            <label class="book-filter-option">
                                <input type="checkbox" value="all" id="filter-all-books" checked>
                                <span>All Books</span>
                            </label>
                            ${availableBooks.map(book => `
                                <label class="book-filter-option">
                                    <input type="checkbox" value="${book.id}" class="book-filter-checkbox" checked>
                                    <span>${book.title}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div class="search-filter-section">
                        <h4 class="filter-section-title">Options</h4>
                        <label class="search-option">
                            <input type="checkbox" id="case-sensitive-option">
                            <span>Case sensitive</span>
                        </label>
                    </div>
                </div>

                <!-- Search Results -->
                <div id="search-results-container" class="search-results-container">
                    <p class="search-hint">Enter a search term and click Search to find results</p>
                </div>
            </div>
        `;

        // Setup event handlers
        this.setupSearchViewHandlers(searchModule);

        // If there's an initial query, perform the search
        if (initialQuery) {
            this.performAdvancedSearch(searchModule);
        }
    }

    /**
     * Setup event handlers for search view
     */
    setupSearchViewHandlers(searchModule) {
        const searchInput = document.getElementById('advanced-search-input');
        const searchBtn = document.getElementById('advanced-search-btn');
        const allBooksCheckbox = document.getElementById('filter-all-books');
        const bookCheckboxes = document.querySelectorAll('.book-filter-checkbox');

        // Search on enter or button click
        searchBtn?.addEventListener('click', () => this.performAdvancedSearch(searchModule));
        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performAdvancedSearch(searchModule);
            }
        });

        // "All Books" toggle logic
        allBooksCheckbox?.addEventListener('change', (e) => {
            bookCheckboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
        });

        // Individual book checkbox logic
        bookCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const allChecked = Array.from(bookCheckboxes).every(c => c.checked);
                const noneChecked = Array.from(bookCheckboxes).every(c => !c.checked);

                if (allChecked) {
                    allBooksCheckbox.checked = true;
                    allBooksCheckbox.indeterminate = false;
                } else if (noneChecked) {
                    allBooksCheckbox.checked = false;
                    allBooksCheckbox.indeterminate = false;
                } else {
                    allBooksCheckbox.checked = false;
                    allBooksCheckbox.indeterminate = true;
                }
            });
        });
    }

    /**
     * Perform advanced search with current filter settings
     */
    performAdvancedSearch(searchModule) {
        const query = document.getElementById('advanced-search-input')?.value?.trim();
        if (!query || !searchModule) return;

        // Get search options from UI
        const exactPhrase = document.querySelector('input[name="searchMode"][value="exact"]')?.checked || false;
        const caseSensitive = document.getElementById('case-sensitive-option')?.checked || false;

        // Get selected books
        const allBooksCheckbox = document.getElementById('filter-all-books');
        let bookIds = null; // null means all books

        if (!allBooksCheckbox?.checked) {
            const bookCheckboxes = document.querySelectorAll('.book-filter-checkbox:checked');
            bookIds = Array.from(bookCheckboxes).map(cb => cb.value);
            if (bookIds.length === 0) {
                // No books selected - show message
                document.getElementById('search-results-container').innerHTML = `
                    <div class="search-hint">Please select at least one book to search</div>
                `;
                return;
            }
        }

        // Perform search
        const results = searchModule.search(query, {
            bookIds,
            exactPhrase,
            caseSensitive,
            limit: 100
        });

        // Display results
        this.displaySearchResults(results, query, exactPhrase);
    }

    /**
     * Display search results in the results container
     */
    displaySearchResults(results, query, isExactPhrase) {
        const container = document.getElementById('search-results-container');
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <h4>No results found</h4>
                    <p>Try different keywords, check spelling, or adjust your filters</p>
                </div>
            `;
            return;
        }

        const highlightQuery = (text, query, isExact) => {
            if (isExact) {
                const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                return text.replace(regex, '<mark>$1</mark>');
            } else {
                const words = query.toLowerCase().split(/\s+/);
                let result = text;
                words.forEach(word => {
                    const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    result = result.replace(regex, '<mark>$1</mark>');
                });
                return result;
            }
        };

        container.innerHTML = `
            <div class="search-results-header">
                <span class="results-count">${results.length} result${results.length !== 1 ? 's' : ''}</span>
                <span class="results-query">for "${this.escapeHtml(query)}"</span>
                ${isExactPhrase ? '<span class="results-mode">(exact phrase)</span>' : ''}
            </div>
            <div class="results-list">
                ${results.map(result => `
                    <div class="search-result" data-book-id="${result.bookId}" data-entry-id="${result.entryId}">
                        <div class="search-result-header">
                            <span class="search-result-book">${result.bookTitle}</span>
                            <span class="search-result-location">
                                ${result.location.chapter ? `Ch. ${result.location.chapter}` : ''}
                                ${result.location.page ? `p. ${result.location.page}` : ''}
                                ${result.location.month ? `${result.location.month} ${result.location.day}` : ''}
                                ${result.location.entry ? `Entry ${result.location.entry}` : ''}
                                ${result.location.type === 'step' ? `Step ${result.location.chapter}` : ''}
                                ${result.location.type === 'tradition' ? `Tradition ${result.location.chapter}` : ''}
                            </span>
                        </div>
                        ${result.title ? `<div class="search-result-title">${result.title}</div>` : ''}
                        <div class="search-result-snippet">${highlightQuery(result.snippet, query, isExactPhrase)}</div>
                    </div>
                `).join('')}
            </div>
        `;

        // Setup click handlers
        container.querySelectorAll('.search-result').forEach(el => {
            el.addEventListener('click', () => {
                this.navigateToSearchResult(el.dataset.bookId, el.dataset.entryId);
            });
        });
    }

    /**
     * Navigate to a search result
     */
    navigateToSearchResult(bookId, entryId) {
        if (!entryId) {
            window.location.hash = `/book/${bookId}`;
            return;
        }

        if (bookId === 'daily-reflections' && entryId.startsWith('dr-')) {
            const dateKey = entryId.replace('dr-', '');
            sessionStorage.setItem('navigateToDate', dateKey);
            window.location.hash = `/book/${bookId}`;
        } else if (bookId === 'as-bill-sees-it' && entryId.startsWith('absit-')) {
            const entryNum = entryId.replace('absit-', '');
            sessionStorage.setItem('navigateToEntry', entryNum);
            window.location.hash = `/book/${bookId}`;
        } else if (bookId === 'language-of-the-heart' && entryId.startsWith('article_')) {
            sessionStorage.setItem('navigateToArticle', entryId);
            window.location.hash = `/book/${bookId}`;
        } else if (entryId.startsWith('step-') || entryId.startsWith('tradition-') ||
                   entryId.startsWith('chapter-') || entryId.startsWith('story-') ||
                   entryId.startsWith('appendix-') || entryId.startsWith('foreword-') ||
                   entryId === 'preface' || entryId === 'doctors-opinion') {
            window.location.hash = `/book/${bookId}/chapter/${entryId}`;
        } else {
            window.location.hash = `/book/${bookId}`;
        }
    }

    /**
     * Show search results (legacy method for header search)
     */
    showSearchResults(results, query) {
        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');

        if (results.length === 0) {
            this.contentEl.innerHTML = `
                <div class="no-results">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <h4>No results found</h4>
                    <p>Try different keywords or check your spelling</p>
                </div>
            `;
            return;
        }

        const highlightQuery = (text, query) => {
            const words = query.toLowerCase().split(/\s+/);
            let result = text;
            words.forEach(word => {
                const regex = new RegExp(`(${word})`, 'gi');
                result = result.replace(regex, '<mark>$1</mark>');
            });
            return result;
        };

        this.contentEl.innerHTML = `
            <div class="search-results-view">
                <h2>Search Results</h2>
                <p class="search-stats">${results.length} results for "${query}"</p>
                <p style="margin-bottom: var(--spacing-lg);"><a href="#/search?q=${encodeURIComponent(query)}">Use advanced search for more options</a></p>

                <div class="results-list">
                    ${results.map(result => `
                        <div class="search-result" data-book-id="${result.bookId}" data-entry-id="${result.entryId}">
                            <div class="search-result-header">
                                <span class="search-result-book">${result.bookTitle}</span>
                                <span class="search-result-location">
                                    ${result.location.chapter ? `Ch. ${result.location.chapter}` : ''}
                                    ${result.location.page ? `p. ${result.location.page}` : ''}
                                    ${result.location.month ? `${result.location.month} ${result.location.day}` : ''}
                                    ${result.location.entry ? `Entry ${result.location.entry}` : ''}
                                </span>
                            </div>
                            ${result.title ? `<div class="search-result-title" style="font-weight: 500; margin-bottom: 4px;">${result.title}</div>` : ''}
                            <div class="search-result-snippet">${highlightQuery(result.snippet, query)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Click handlers for results
        this.contentEl.querySelectorAll('.search-result').forEach(el => {
            el.addEventListener('click', () => {
                this.navigateToSearchResult(el.dataset.bookId, el.dataset.entryId);
            });
        });
    }

    // ==================== Study Tools Display Methods ====================

    /**
     * Display Commonly Read Passages
     */
    async displayStudyPassages(book) {
        const passages = book.commonlyReadPassages;
        if (!passages) return;

        const passageCards = Object.entries(passages).map(([key, passage]) => {
            const pageInfo = passage.pageStart && passage.pageEnd
                ? `Pages ${passage.pageStart}-${passage.pageEnd}`
                : passage.page ? `Page ${passage.page}` : '';

            return `
                <div class="study-card passage-card" data-passage-key="${key}">
                    <h3 class="study-card-title">${passage.title}</h3>
                    ${pageInfo ? `<div class="study-card-page">${pageInfo}</div>` : ''}
                    <p class="study-card-description">${passage.description || ''}</p>
                    ${passage.keyQuote ? `<blockquote class="study-card-quote">"${passage.keyQuote}"</blockquote>` : ''}
                    ${passage.startsWithText ? `<div class="study-card-hint">Starts: "${passage.startsWithText.substring(0, 50)}..."</div>` : ''}
                </div>
            `;
        }).join('');

        this.contentEl.innerHTML = `
            <div class="study-tools-view">
                <div class="study-header">
                    <h2>Commonly Read Passages</h2>
                    <p class="study-description">Passages frequently read at AA meetings and in study groups.</p>
                </div>
                <div class="study-cards-grid">
                    ${passageCards}
                </div>
            </div>
        `;
    }

    /**
     * Display Step Study Guide
     */
    async displayStudySteps(book) {
        const guide = book.stepStudyGuide;
        if (!guide) return;

        const stepCards = Object.entries(guide).map(([key, step]) => {
            const stepNum = key.replace('step', '');
            const readings = step.primaryReadings ? step.primaryReadings.map(r =>
                `<li>${r.title || r.section || r.chapter} (${r.pages})</li>`
            ).join('') : '';

            const passages = step.keyPassages ? step.keyPassages.map(p =>
                `<li class="key-passage">p. ${p.page}: "${p.quote}"</li>`
            ).join('') : '';

            const topics = step.focusTopics ? step.focusTopics.map(t =>
                `<span class="topic-tag">${t}</span>`
            ).join('') : '';

            return `
                <div class="study-card step-card">
                    <div class="step-number">Step ${stepNum}</div>
                    <p class="step-text">${step.step}</p>
                    ${readings ? `
                        <div class="step-readings">
                            <h4>Primary Readings</h4>
                            <ul>${readings}</ul>
                        </div>
                    ` : ''}
                    ${passages ? `
                        <div class="step-key-passages">
                            <h4>Key Passages</h4>
                            <ul>${passages}</ul>
                        </div>
                    ` : ''}
                    ${topics ? `
                        <div class="step-topics">
                            <h4>Focus Topics</h4>
                            <div class="topics-list">${topics}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        this.contentEl.innerHTML = `
            <div class="study-tools-view">
                <div class="study-header">
                    <h2>Step Study Guide</h2>
                    <p class="study-description">A comprehensive guide for working through the 12 Steps with Big Book references.</p>
                </div>
                <div class="study-steps-list">
                    ${stepCards}
                </div>
            </div>
        `;
    }

    /**
     * Display Glossary
     */
    async displayStudyGlossary(book) {
        const glossary = book.glossary;
        if (!glossary) return;

        const terms = Object.entries(glossary).map(([key, entry]) => {
            const refs = entry.references ? entry.references.map(r => {
                if (r.page) return `p. ${r.page}`;
                if (r.appendix) return `Appendix ${r.appendix}`;
                if (r.section) return r.section;
                if (r.chapter) return `Chapter ${r.chapter}`;
                return '';
            }).filter(Boolean).join(', ') : '';

            return `
                <div class="glossary-term">
                    <dt>${entry.term || key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                    <dd>
                        <p>${entry.definition}</p>
                        ${refs ? `<div class="glossary-refs">References: ${refs}</div>` : ''}
                    </dd>
                </div>
            `;
        }).join('');

        this.contentEl.innerHTML = `
            <div class="study-tools-view">
                <div class="study-header">
                    <h2>Glossary of AA Terms</h2>
                    <p class="study-description">Definitions of key terms used in the Big Book.</p>
                </div>
                <dl class="glossary-list">
                    ${terms}
                </dl>
            </div>
        `;
    }

    /**
     * Display Topic Index
     */
    async displayStudyTopics(book) {
        const topicIndex = book.topicIndex;
        if (!topicIndex) return;

        const topics = Object.entries(topicIndex)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([topic, data]) => {
                const refs = data.references ? data.references.slice(0, 5).map(r =>
                    `<span class="topic-ref">${r.location} p. ${r.page}</span>`
                ).join('') : '';

                const moreCount = data.references && data.references.length > 5
                    ? `<span class="topic-more">+${data.references.length - 5} more</span>` : '';

                return `
                    <div class="topic-item">
                        <div class="topic-name">${topic.charAt(0).toUpperCase() + topic.slice(1)}</div>
                        <div class="topic-count">${data.occurrences || data.references?.length || 0} references</div>
                        <div class="topic-refs">${refs}${moreCount}</div>
                    </div>
                `;
            }).join('');

        this.contentEl.innerHTML = `
            <div class="study-tools-view">
                <div class="study-header">
                    <h2>Topic Index</h2>
                    <p class="study-description">Find passages by topic throughout the Big Book.</p>
                </div>
                <div class="topic-index-grid">
                    ${topics}
                </div>
            </div>
        `;
    }

    /**
     * Display Reading Plans
     */
    async displayStudyReadingPlans(book) {
        const plans = book.readingPlans;
        if (!plans) return;

        const planCards = Object.entries(plans).map(([key, plan]) => {
            const days = plan.days ? plan.days.map(d =>
                `<div class="reading-day">
                    <span class="day-num">Day ${d.day}</span>
                    <span class="day-reading">${d.reading}</span>
                    ${d.pages ? `<span class="day-pages">${d.pages}</span>` : ''}
                </div>`
            ).join('') : '';

            const weeks = plan.weeks ? plan.weeks.map(w =>
                `<div class="reading-week">
                    <h4>Week ${w.week}: ${w.focus}</h4>
                    <ul>${w.readings.map(r => `<li>${r}</li>`).join('')}</ul>
                </div>`
            ).join('') : '';

            return `
                <div class="study-card reading-plan-card">
                    <h3>${plan.title}</h3>
                    <p class="plan-description">${plan.description}</p>
                    ${days ? `<div class="reading-days">${days}</div>` : ''}
                    ${weeks ? `<div class="reading-weeks">${weeks}</div>` : ''}
                </div>
            `;
        }).join('');

        this.contentEl.innerHTML = `
            <div class="study-tools-view">
                <div class="study-header">
                    <h2>Reading Plans</h2>
                    <p class="study-description">Structured reading plans to guide your Big Book study.</p>
                </div>
                <div class="reading-plans-list">
                    ${planCards}
                </div>
            </div>
        `;
    }

    /**
     * Display Inventory Guide
     */
    async displayStudyInventory(book) {
        const guide = book.inventoryGuide;
        if (!guide) return;

        let html = '<div class="study-tools-view"><div class="study-header"><h2>Inventory Guide</h2><p class="study-description">Guides for taking personal inventory as described in the Big Book.</p></div>';

        // Resentment Inventory
        if (guide.resentmentInventory) {
            const ri = guide.resentmentInventory;
            const columns = ri.columns.map(c =>
                `<div class="inventory-column">
                    <h4>${c.name}</h4>
                    <p>${c.description}</p>
                </div>`
            ).join('');

            html += `
                <div class="inventory-section">
                    <h3>Resentment Inventory (Page ${ri.pageReference})</h3>
                    <p>${ri.description}</p>
                    ${ri.keyQuote ? `<blockquote class="inventory-quote">"${ri.keyQuote}"</blockquote>` : ''}
                    <div class="inventory-columns">${columns}</div>
                </div>
            `;
        }

        // Fear Inventory
        if (guide.fearInventory) {
            const fi = guide.fearInventory;
            const columns = fi.columns.map(c =>
                `<div class="inventory-column">
                    <h4>${c.name}</h4>
                    <p>${c.description}</p>
                </div>`
            ).join('');

            html += `
                <div class="inventory-section">
                    <h3>Fear Inventory (Page ${fi.pageReference})</h3>
                    <p>${fi.description}</p>
                    ${fi.keyQuote ? `<blockquote class="inventory-quote">"${fi.keyQuote}"</blockquote>` : ''}
                    <div class="inventory-columns">${columns}</div>
                </div>
            `;
        }

        // Sex Inventory
        if (guide.sexInventory) {
            const si = guide.sexInventory;
            const questions = si.questions.map(q => `<li>${q}</li>`).join('');

            html += `
                <div class="inventory-section">
                    <h3>Sex/Relationships Inventory (Page ${si.pageReference})</h3>
                    <p>${si.description}</p>
                    <ul class="inventory-questions">${questions}</ul>
                </div>
            `;
        }

        // Character Defects
        if (guide.characterDefects) {
            const cd = guide.characterDefects;
            const defects = cd.defects.map(d =>
                `<div class="defect-item">
                    <span class="defect-name">${d.defect}</span>
                    <span class="defect-pages">p. ${d.pages.join(', ')}</span>
                    ${d.keyQuote ? `<div class="defect-quote">"${d.keyQuote}"</div>` : ''}
                </div>`
            ).join('');

            html += `
                <div class="inventory-section">
                    <h3>Character Defects</h3>
                    <p>${cd.description}</p>
                    <div class="defects-list">${defects}</div>
                </div>
            `;
        }

        // Character Assets
        if (guide.characterAssets) {
            const ca = guide.characterAssets;
            const assets = ca.assets.map(a =>
                `<div class="asset-item">
                    <span class="asset-name">${a.asset}</span>
                    ${a.pages ? `<span class="asset-pages">p. ${a.pages.join(', ')}</span>` : ''}
                </div>`
            ).join('');

            html += `
                <div class="inventory-section">
                    <h3>Character Assets</h3>
                    <p>${ca.description}</p>
                    <div class="assets-list">${assets}</div>
                </div>
            `;
        }

        html += '</div>';
        this.contentEl.innerHTML = html;
    }

    /**
     * Display Historical Context
     */
    async displayStudyHistory(book) {
        const history = book.historicalContext;
        if (!history) return;

        let html = '<div class="study-tools-view"><div class="study-header"><h2>Historical Context</h2><p class="study-description">Background information about the Big Book and AA history.</p></div>';

        // Book History
        if (history.bookHistory) {
            const bh = history.bookHistory;
            html += `
                <div class="history-section">
                    <h3>Book History</h3>
                    <div class="history-facts">
                        <div class="history-fact"><strong>First Published:</strong> ${bh.firstPublished}</div>
                        <div class="history-fact"><strong>Original Title:</strong> ${bh.originalTitle}</div>
                        <div class="history-fact"><strong>Written By:</strong> ${bh.writtenBy}</div>
                        <div class="history-fact"><strong>Original Price:</strong> ${bh.originalPrice}</div>
                        <div class="history-fact"><strong>First Printing:</strong> ${bh.firstPrinting} copies</div>
                    </div>
                </div>
            `;
        }

        // Edition History
        if (history.editionHistory) {
            const editions = Object.entries(history.editionHistory).map(([key, ed]) =>
                `<div class="edition-item">
                    <h4>${ed.name}</h4>
                    <div class="edition-year">Year: ${ed.year}</div>
                    <div class="edition-changes">${ed.changes}</div>
                    <div class="edition-stories">Stories: ${ed.stories}</div>
                </div>`
            ).join('');

            html += `
                <div class="history-section">
                    <h3>Edition History</h3>
                    <div class="editions-list">${editions}</div>
                </div>
            `;
        }

        // Key Dates
        if (history.keyDates) {
            const kd = history.keyDates;
            html += `
                <div class="history-section">
                    <h3>Key Dates</h3>
                    <div class="history-facts">
                        <div class="history-fact"><strong>Bill W. Last Drink:</strong> ${kd.billLastDrink}</div>
                        <div class="history-fact"><strong>Dr. Bob Last Drink:</strong> ${kd.drBobLastDrink}</div>
                        <div class="history-fact"><strong>AA Founded:</strong> ${kd.aaFounded}</div>
                    </div>
                </div>
            `;
        }

        // Personal Stories Context
        if (history.personalStoriesContext) {
            const psc = history.personalStoriesContext;
            html += `
                <div class="history-section">
                    <h3>Personal Stories Context</h3>
                    <div class="stories-context">
                        <div><strong>Pioneers of AA:</strong> ${psc.pioneersOfAA}</div>
                        <div><strong>They Stopped in Time:</strong> ${psc.theyStoppedInTime}</div>
                        <div><strong>They Lost Nearly All:</strong> ${psc.theyLostNearlyAll}</div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        this.contentEl.innerHTML = html;
    }
}

// Export singleton
export const reader = new Reader();

// Make available globally for onclick handlers
window.reader = reader;
