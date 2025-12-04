/**
 * Reader component for AA Literature Study
 */

import { annotations } from './annotations.js';
import { pageCrossRef } from './crossref.js';
import { toolbar } from './ui/toolbar.js';
import { modal } from './ui/modal.js';
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
            if (info && info.text) {
                const result = await modal.showDefinitionModal(info.text);
                if (result && result.content) {
                    await annotations.addDefinition(
                        info.bookId,
                        info.paragraphId,
                        info.startOffset,
                        info.endOffset,
                        info.text,
                        result.content,
                        result.source
                    );
                    this.refreshContent();
                }
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

        if (annotation && ['comment', 'question', 'definition'].includes(annotation.type)) {
            event.preventDefault();
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
                            <p class="step-text">${chapter.officialText || ''}</p>
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

        if (paragraph.content && Array.isArray(paragraph.content)) {
            text = paragraph.content.map(segment => {
                let segmentText = segment.text || '';
                if (segment.italic) {
                    segmentText = `<em>${segmentText}</em>`;
                }
                if (segment.bold) {
                    segmentText = `<strong>${segmentText}</strong>`;
                }
                return segmentText;
            }).join('');
        } else if (paragraph.plainText) {
            text = paragraph.plainText;
        }

        // Apply annotations
        text = annotations.applyToContent(text, bookAnnotations, paragraphId);

        // Apply auto cross-references
        text = this.applyAutoCrossReferences(text);

        return text;
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
                const blockClass = para.isBlockQuote ? 'block-quote' : '';
                return `<div class="bb-paragraph paragraph ${blockClass}" data-paragraph-id="${paraId}"><p>${text}</p></div>`;
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
                const blockClass = para.isBlockQuote ? 'block-quote' : '';
                return `<div class="bb-paragraph paragraph ${blockClass}" data-paragraph-id="${paraId}"><p>${text}</p></div>`;
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
                const blockClass = para.isBlockQuote ? 'block-quote' : '';
                return `<div class="bb-paragraph paragraph ${blockClass}" data-paragraph-id="${paraId}" data-page="${para.pageNumber || ''}"><p>${text}</p></div>`;
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
                    <h2 class="bb-title">${doctorsOpinion.title}</h2>
                    <span class="bb-author">by ${doctorsOpinion.author}</span>
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

        for (const pageNum of sortedPages) {
            const pageParagraphs = pageGroups.get(pageNum);
            const pageContent = pageParagraphs.map(({ para, idx }) => {
                const paraId = `bb-ch${chapterNum}-p${idx + 1}`;
                const text = this.formatBigBookParagraph(para, paraId, bookAnnotations);
                const blockClass = para.isBlockQuote ? 'block-quote' : '';
                return `<div class="bb-paragraph paragraph ${blockClass}" data-paragraph-id="${paraId}" data-page="${para.pageNumber || ''}"><p>${text}</p></div>`;
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

        this.contentEl.innerHTML = `
            <div class="bb-content-view with-crossrefs">
                <div class="bb-main-content">
                    <div class="bb-header bb-chapter-header">
                        <div class="bb-chapter-number">Chapter ${chapter.chapterNumber}</div>
                        <h2 class="bb-title">${chapter.title}</h2>
                        ${chapter.pageStart ? `<span class="bb-page-range">Pages ${chapter.pageStart}${chapter.pageEnd ? '-' + chapter.pageEnd : '+'}</span>` : ''}
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

        const story = part.stories.find(s => s.storyNumber === storyNum);
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
                const blockClass = para.isBlockQuote ? 'block-quote' : '';
                return `<div class="bb-paragraph paragraph ${blockClass}" data-paragraph-id="${paraId}" data-page="${para.pageNumber || ''}"><p>${text}</p></div>`;
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
                const blockClass = para.isBlockQuote ? 'block-quote' : '';
                return `<div class="bb-paragraph paragraph ${blockClass}" data-paragraph-id="${paraId}" data-page="${para.pageNumber || ''}"><p>${text}</p></div>`;
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

        // Personal Stories
        if (book.content.personalStories && book.content.personalStories.parts) {
            book.content.personalStories.parts.forEach(part => {
                part.stories.forEach(story => {
                    order.push(`story-${part.partNumber}-${story.storyNumber}`);
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
        const tocHtml = book.tableOfContents.map(section => {
            let itemsHtml = '';

            if (section.items) {
                itemsHtml = section.items.map(item => {
                    if (typeof item === 'string') {
                        // Simple string item (front matter)
                        const itemId = item.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
                        return `<li><a href="#/book/big-book/chapter/${itemId}" class="toc-link">${item}</a></li>`;
                    } else {
                        // Object with num and title
                        return `<li><a href="#/book/big-book/chapter/chapter-${item.num}" class="toc-link">${item.num}. ${item.title}</a></li>`;
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
            ? reflection.quote.join('</p><p>')
            : reflection.quote;

        const reflectionText = Array.isArray(reflection.reflection)
            ? reflection.reflection.join('</p><p>')
            : reflection.reflection;

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
                            `<p class="${para.is_quote ? 'quote-text' : ''}">${this.applyAutoCrossReferences(para.text)}</p>`
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

        // Get recent reading activity
        let recentHtml = '';
        try {
            const recent = await db.getRecentReading(3);
            if (recent && recent.length > 0) {
                recentHtml = `
                    <div class="continue-reading">
                        <h3>Continue Reading</h3>
                        <div class="recent-books">
                            ${recent.map(r => `
                                <a href="#/book/${r.bookId}/chapter/${r.chapterId}" class="recent-book-card">
                                    <div class="recent-book-title">${r.bookTitle || r.bookId}</div>
                                    <div class="recent-book-chapter">${this.formatChapterId(r.chapterId)}</div>
                                    <div class="recent-book-time">${this.formatTimeAgo(r.lastRead)}</div>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.warn('Failed to get recent reading:', error);
        }

        this.contentEl.innerHTML = `
            <div class="welcome-screen">
                <h2>Welcome to AA Literature Study</h2>
                <p>Select a book from the sidebar to begin reading, or use the search to find specific content.</p>
                ${recentHtml}
            </div>
        `;
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
     * Show index view
     */
    async showIndex() {
        const allAnnotations = await annotations.getAll();
        const byType = {
            highlight: allAnnotations.filter(a => a.type === 'highlight'),
            underline: allAnnotations.filter(a => a.type === 'underline'),
            comment: allAnnotations.filter(a => a.type === 'comment'),
            question: allAnnotations.filter(a => a.type === 'question'),
            definition: allAnnotations.filter(a => a.type === 'definition')
        };

        if (this.pageNavEl) this.pageNavEl.classList.add('hidden');

        this.contentEl.innerHTML = `
            <div class="index-view">
                <h2>Index</h2>

                <div class="index-section">
                    <h3 class="index-section-title">Highlights (${byType.highlight.length})</h3>
                    ${byType.highlight.length ? byType.highlight.slice(0, 20).map(a => `
                        <div class="note-card">
                            <div class="note-header">
                                <span class="highlight highlight-${a.color}" style="padding: 2px 8px;">${a.color}</span>
                                <span class="note-location">${a.bookId}</span>
                            </div>
                            <div class="note-selected-text">"${a.selectedText}"</div>
                        </div>
                    `).join('') : '<p style="color: var(--text-muted);">No highlights yet</p>'}
                </div>

                <div class="index-section">
                    <h3 class="index-section-title">Comments (${byType.comment.length})</h3>
                    ${byType.comment.length ? byType.comment.map(a => `
                        <div class="note-card">
                            <div class="note-header">
                                <span class="note-type comment">Comment</span>
                                <span class="note-location">${a.bookId}</span>
                            </div>
                            <div class="note-selected-text">"${a.selectedText}"</div>
                            <div class="note-content">${a.content}</div>
                        </div>
                    `).join('') : '<p style="color: var(--text-muted);">No comments yet</p>'}
                </div>

                <div class="index-section">
                    <h3 class="index-section-title">Questions (${byType.question.length})</h3>
                    ${byType.question.length ? byType.question.map(a => `
                        <div class="note-card">
                            <div class="note-header">
                                <span class="note-type question">Question</span>
                                <span class="note-location">${a.bookId}</span>
                            </div>
                            <div class="note-selected-text">"${a.selectedText}"</div>
                            <div class="note-content">${a.content}</div>
                            ${a.answer ? `<div class="note-content" style="margin-top: 8px;"><strong>Answer:</strong> ${a.answer}</div>` : ''}
                        </div>
                    `).join('') : '<p style="color: var(--text-muted);">No questions yet</p>'}
                </div>

                <div class="index-section">
                    <h3 class="index-section-title">Definitions (${byType.definition.length})</h3>
                    ${byType.definition.length ? byType.definition.map(a => `
                        <div class="note-card">
                            <div class="note-header">
                                <span class="note-type definition">Definition</span>
                                <span class="note-location">${a.bookId}</span>
                            </div>
                            <div class="note-selected-text">"${a.selectedText}"</div>
                            <div class="note-content">${a.content}</div>
                        </div>
                    `).join('') : '<p style="color: var(--text-muted);">No definitions yet</p>'}
                </div>
            </div>
        `;
    }

    /**
     * Show search results
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
                const bookId = el.dataset.bookId;
                const entryId = el.dataset.entryId;

                // Navigate to the specific location based on entry type
                if (entryId) {
                    if (bookId === 'daily-reflections' && entryId.startsWith('dr-')) {
                        // For Daily Reflections, navigate to book and set date
                        const dateKey = entryId.replace('dr-', '');
                        sessionStorage.setItem('navigateToDate', dateKey);
                        window.location.hash = `/book/${bookId}`;
                    } else if (bookId === 'as-bill-sees-it' && entryId.startsWith('absit-')) {
                        // For As Bill Sees It, navigate to book and set entry
                        const entryNum = entryId.replace('absit-', '');
                        sessionStorage.setItem('navigateToEntry', entryNum);
                        window.location.hash = `/book/${bookId}`;
                    } else if (bookId === 'language-of-the-heart' && entryId.startsWith('article_')) {
                        // For Language of the Heart, navigate to book and set article
                        sessionStorage.setItem('navigateToArticle', entryId);
                        window.location.hash = `/book/${bookId}`;
                    } else if (entryId.startsWith('step-') || entryId.startsWith('tradition-') ||
                               entryId.startsWith('chapter-') || entryId.startsWith('story-') ||
                               entryId.startsWith('appendix-') || entryId.startsWith('foreword-') ||
                               entryId === 'preface' || entryId === 'doctors-opinion') {
                        // For structured content, navigate to specific chapter
                        window.location.hash = `/book/${bookId}/chapter/${entryId}`;
                    } else {
                        // Default: just go to the book
                        window.location.hash = `/book/${bookId}`;
                    }
                } else {
                    window.location.hash = `/book/${bookId}`;
                }
            });
        });
    }
}

// Export singleton
export const reader = new Reader();

// Make available globally for onclick handlers
window.reader = reader;
