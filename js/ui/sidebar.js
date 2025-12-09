/**
 * Sidebar component for AA Literature Study
 */

import { navigateTo } from '../router.js';

class Sidebar {
    constructor() {
        this.element = document.getElementById('sidebar');
        this.toggleBtn = document.getElementById('sidebar-toggle');
        this.booksList = document.getElementById('books-list');
        this.books = [];
        this.currentBookId = null;
        this.currentChapterId = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Toggle sidebar (with null check)
        this.toggleBtn?.addEventListener('click', () => this.toggle());

        // Close sidebar on mobile when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && this.element && this.toggleBtn) {
                if (!this.element.contains(e.target) &&
                    !this.toggleBtn.contains(e.target) &&
                    this.element.classList.contains('visible')) {
                    this.hide();
                }
            }
        });
    }

    /**
     * Toggle sidebar visibility
     */
    toggle() {
        if (!this.element) return;
        if (window.innerWidth <= 768) {
            this.element.classList.toggle('visible');
        } else {
            this.element.classList.toggle('collapsed');
        }
    }

    /**
     * Show sidebar
     */
    show() {
        if (!this.element) return;
        if (window.innerWidth <= 768) {
            this.element.classList.add('visible');
        } else {
            this.element.classList.remove('collapsed');
        }
    }

    /**
     * Hide sidebar
     */
    hide() {
        if (!this.element) return;
        if (window.innerWidth <= 768) {
            this.element.classList.remove('visible');
        }
    }

    /**
     * Load books into sidebar
     */
    loadBooks(books) {
        console.log('Sidebar: Loading books:', books.map(b => ({ id: b.id, chapters: b.chapters?.length || 0 })));
        this.books = books;
        this.render();
    }

    /**
     * Render the books list
     */
    render() {
        console.log('Sidebar: Rendering books...', this.books);
        if (!this.booksList) {
            console.error('Sidebar: booksList element not found');
            return;
        }
        this.booksList.innerHTML = this.books.map(book => this.renderBook(book)).join('');

        // Add event listeners for book headers
        this.booksList.querySelectorAll('.book-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const bookId = header.getAttribute('data-book-id');
                console.log('Book header clicked, bookId:', bookId);
                console.log('Book header raw attribute:', header.getAttribute('data-book-id'));

                if (!bookId || bookId === 'undefined' || bookId === 'null') {
                    console.error('Book header has invalid bookId:', bookId);
                    console.error('Header element:', header.outerHTML);
                    return;
                }

                this.toggleBook(bookId);
            });
        });

        // Add event listeners for chapters
        this.booksList.querySelectorAll('.chapter-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookId = item.getAttribute('data-book-id');
                const chapterId = item.getAttribute('data-chapter-id');
                console.log('Chapter clicked, element:', item);
                console.log('Chapter clicked, raw attributes:', {
                    'data-book-id': item.getAttribute('data-book-id'),
                    'data-chapter-id': item.getAttribute('data-chapter-id')
                });
                console.log('Chapter clicked, bookId:', bookId, 'chapterId:', chapterId);

                if (!bookId || !chapterId) {
                    console.error('Missing bookId or chapterId from element:', item.outerHTML);
                    return;
                }

                this.selectChapter(bookId, chapterId);
            });
        });
    }

    /**
     * Get book icon class based on book ID
     */
    getBookIconClass(bookId) {
        const iconMap = {
            'big-book': 'big-book',
            'twelve-and-twelve': 'twelve-twelve',
            'daily-reflections': 'daily-reflections',
            'as-bill-sees-it': 'as-bill-sees-it',
            'aa-comes-of-age': 'aa-comes-of-age',
            'language-of-the-heart': 'language-heart'
        };
        return iconMap[bookId] || 'big-book';
    }

    /**
     * Get book icon content (SVG or text)
     */
    getBookIconContent(bookId) {
        const icons = {
            'big-book': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
            'twelve-and-twelve': '12',
            'daily-reflections': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
            'as-bill-sees-it': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
            'aa-comes-of-age': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 8v4l3 3"></path><circle cx="12" cy="12" r="10"></circle></svg>',
            'language-of-the-heart': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>'
        };
        return icons[bookId] || icons['big-book'];
    }

    /**
     * Render a single book
     */
    renderBook(book) {
        console.log('Sidebar: renderBook called with:', book);

        // Validate book has required id (check for actual undefined and string "undefined")
        if (!book || !book.id || book.id === 'undefined' || book.id === 'null') {
            console.error('Sidebar: Invalid book data - missing or invalid id:', book);
            console.error('Sidebar: book.id value:', book?.id, 'type:', typeof book?.id);
            return '';
        }

        const isExpanded = this.currentBookId === book.id;
        const iconClass = this.getBookIconClass(book.id);
        const iconContent = this.getBookIconContent(book.id);

        const chaptersHtml = book.chapters ? book.chapters.map(chapter => {
            // Validate chapter has required id
            if (!chapter || !chapter.id) {
                console.error(`Sidebar: Invalid chapter data for book ${book.id}:`, chapter);
                return '';
            }

            // Handle section headers (non-clickable dividers)
            if (chapter.isSection) {
                return `
                    <div class="chapter-section-header">
                        ${chapter.title || 'Untitled'}
                    </div>
                `;
            }

            // Handle subsection headers
            if (chapter.isSubSection) {
                return `
                    <div class="chapter-subsection-header">
                        ${chapter.title || 'Untitled'}
                    </div>
                `;
            }

            console.log(`  Rendering chapter: bookId=${book.id}, chapterId=${chapter.id}`);
            return `
                <div class="chapter-item ${this.currentChapterId === chapter.id ? 'active' : ''}"
                     data-book-id="${book.id}"
                     data-chapter-id="${chapter.id}">
                    ${chapter.title || 'Untitled'}
                </div>
            `;
        }).join('') : '';

        return `
            <li class="book-item">
                <div class="book-header ${isExpanded ? 'expanded' : ''}" data-book-id="${book.id}">
                    <div class="book-icon ${iconClass}">${iconContent}</div>
                    <span class="book-title">${book.shortTitle || book.title}</span>
                    <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
                <div class="book-chapters ${isExpanded ? 'visible' : ''}">
                    ${chaptersHtml}
                </div>
            </li>
        `;
    }

    /**
     * Toggle a book's chapter list
     */
    toggleBook(bookId) {
        console.log('toggleBook called with bookId:', bookId);

        // Validate bookId
        if (!bookId || bookId === 'undefined' || bookId === 'null') {
            console.error('toggleBook: Invalid bookId:', bookId);
            return;
        }

        const header = this.booksList.querySelector(`[data-book-id="${bookId}"].book-header`);
        if (!header) {
            console.error('toggleBook: Could not find header for bookId:', bookId);
            return;
        }

        const chapters = header.nextElementSibling;

        if (header.classList.contains('expanded')) {
            header.classList.remove('expanded');
            chapters.classList.remove('visible');
        } else {
            // Close other books
            this.booksList.querySelectorAll('.book-header.expanded').forEach(h => {
                h.classList.remove('expanded');
                h.nextElementSibling.classList.remove('visible');
            });

            header.classList.add('expanded');
            chapters.classList.add('visible');

            // Navigate to book if it has no chapters (like Daily Reflections)
            const book = this.books.find(b => b.id === bookId);
            console.log('toggleBook: Found book:', book?.id, 'chapters:', book?.chapters?.length);
            if (book && (!book.chapters || book.chapters.length === 0)) {
                console.log('toggleBook: Navigating to book (no chapters)');
                navigateTo(`/book/${bookId}`);
            }
        }
    }

    /**
     * Select a chapter
     */
    selectChapter(bookId, chapterId) {
        console.log(`Sidebar: selectChapter called with bookId="${bookId}", chapterId="${chapterId}"`);

        // Validate parameters
        if (!bookId || bookId === 'undefined' || bookId === 'null') {
            console.error('Sidebar: Invalid bookId in selectChapter:', bookId);
            return;
        }
        if (!chapterId || chapterId === 'undefined' || chapterId === 'null') {
            console.error('Sidebar: Invalid chapterId in selectChapter:', chapterId);
            return;
        }

        this.currentBookId = bookId;
        this.currentChapterId = chapterId;

        // Update UI
        this.booksList.querySelectorAll('.chapter-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = this.booksList.querySelector(
            `[data-book-id="${bookId}"][data-chapter-id="${chapterId}"]`
        );
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // Navigate
        const path = `/book/${bookId}/chapter/${chapterId}`;
        console.log(`Sidebar: Navigating to ${path}`);
        navigateTo(path);

        // Hide sidebar on mobile
        if (window.innerWidth <= 768) {
            this.hide();
        }
    }

    /**
     * Set active book/chapter without navigation
     */
    setActive(bookId, chapterId = null) {
        this.currentBookId = bookId;
        this.currentChapterId = chapterId;

        // Expand book
        const header = this.booksList.querySelector(`[data-book-id="${bookId}"].book-header`);
        if (header && !header.classList.contains('expanded')) {
            header.classList.add('expanded');
            header.nextElementSibling.classList.add('visible');
        }

        // Highlight chapter
        this.booksList.querySelectorAll('.chapter-item').forEach(item => {
            item.classList.remove('active');
        });

        if (chapterId) {
            const activeItem = this.booksList.querySelector(
                `[data-book-id="${bookId}"][data-chapter-id="${chapterId}"]`
            );
            if (activeItem) {
                activeItem.classList.add('active');
            }
        }
    }

    /**
     * Update nav item active state
     */
    setActiveNav(path) {
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('href') === `#${path}`) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

// Export singleton
export const sidebar = new Sidebar();
