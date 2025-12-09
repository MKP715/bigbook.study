/**
 * Main Application - AA Literature Study
 */
console.log('=== app.js module loading ===');

import { initDB, getSetting, setSetting, exportData, importData, getAllCrossReferences } from './db.js';
import { router, navigateTo } from './router.js';
import { reader } from './reader.js';
import { search } from './search.js';
import { annotations } from './annotations.js';
import { pageCrossRef } from './crossref.js';
import { sidebar } from './ui/sidebar.js';
import { modal } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { dictionary } from './dictionary.js';
import { dictionaryPopup } from './ui/dictionaryPopup.js';

console.log('=== All imports loaded successfully ===');

// Module-level reference to app instance for reliable access in route handlers
let appInstance = null;

class App {
    constructor() {
        this.books = new Map();
        this.initialized = false;
        // Store module-level reference
        appInstance = this;
    }

    /**
     * Get a book by ID (helper for debugging)
     */
    getBook(bookId) {
        return this.books.get(bookId);
    }

    /**
     * List all loaded book IDs
     */
    getBookIds() {
        return Array.from(this.books.keys());
    }

    /**
     * Diagnostic function - call from console: window.app.diagnose()
     */
    diagnose() {
        console.log('=== APP DIAGNOSTIC ===');
        console.log('Initialized:', this.initialized);
        console.log('Books Map size:', this.books.size);
        console.log('Books in Map:', Array.from(this.books.keys()));
        console.log('appInstance === this:', appInstance === this);

        // Check each book
        for (const [id, book] of this.books) {
            console.log(`Book "${id}":`, {
                title: book.metadata?.title,
                hasSteps: !!book.theSteps,
                hasTraditions: !!book.theTraditions,
                stepsCount: book.theSteps?.length || 0,
                traditionsCount: book.theTraditions?.length || 0
            });
        }

        return {
            initialized: this.initialized,
            bookCount: this.books.size,
            bookIds: Array.from(this.books.keys())
        };
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('=== App Init Started ===');

        // Check if running from file:// protocol
        if (window.location.protocol === 'file:') {
            console.warn('Running from file:// protocol - fetch may not work due to CORS');
            console.warn('Consider using a local web server (e.g., Live Server in VS Code)');
        }

        // Initialize database
        try {
            await initDB();
            console.log('1. Database initialized');
        } catch (dbError) {
            console.error('Database init failed:', dbError);
            // Continue anyway - we can work without IndexedDB
        }

        // Load settings
        try {
            await this.loadSettings();
            console.log('2. Settings loaded');
        } catch (settingsError) {
            console.error('Settings load failed:', settingsError);
            // Continue with defaults
        }

        // Load books
        try {
            console.log('3. Loading books...');
            await this.loadBooks();
            console.log('3. Books loaded. Count:', this.books.size);
        } catch (booksError) {
            console.error('Books load failed:', booksError);
            toast.error('Failed to load books: ' + booksError.message);
        }

        // Setup router
        try {
            console.log('4. Setting up router...');
            this.setupRouter();
            console.log('4. Router setup complete');
        } catch (routerError) {
            console.error('Router setup failed:', routerError);
        }

        // Setup event listeners
        try {
            this.setupEventListeners();
            console.log('5. Event listeners setup complete');
        } catch (eventsError) {
            console.error('Event listeners setup failed:', eventsError);
        }

        // Initialize dictionary
        try {
            await dictionary.initialize();
            this.setupDictionaryHandlers();
            console.log('6. Dictionary initialized');
        } catch (dictError) {
            console.error('Dictionary init failed:', dictError);
        }

        // Mark as initialized
        this.initialized = true;
        console.log('=== App Init Complete ===');
        console.log('Books available:', this.getBookIds());

        // Run diagnostic and display result
        const diag = this.diagnose();
        console.log('%c=== DIAGNOSTIC RESULT ===', 'background: blue; color: white; padding: 4px;');
        console.log('Books loaded:', diag.bookIds);
        if (diag.bookCount === 0) {
            console.error('%cNO BOOKS LOADED!', 'background: red; color: white; padding: 4px;');
        }

        // Mark router as ready now that everything is set up
        router.setReady();

        // Handle initial route now that all books are loaded
        console.log('6. Handling initial route...');
        router.handleRoute();
    }

    /**
     * Load user settings
     */
    async loadSettings() {
        // Theme
        const theme = await getSetting('theme', 'light');
        document.documentElement.dataset.theme = theme;

        // Font size
        const fontSize = await getSetting('fontSize', 16);
        document.documentElement.style.fontSize = `${fontSize}px`;
    }

    /**
     * Load available books
     */
    async loadBooks() {
        const bookConfigs = [
            {
                id: 'big-book',
                path: 'data/BigBook_AA.json',
                shortTitle: 'Big Book'
            },
            {
                id: 'daily-reflections',
                path: 'data/daily-reflections.json',
                shortTitle: 'Daily Reflections'
            },
            {
                id: 'as-bill-sees-it',
                path: 'data/as-bill-sees-it.json',
                shortTitle: 'As Bill Sees It'
            },
            {
                id: 'twelve-and-twelve',
                path: 'data/twelve-and-twelve.json',
                shortTitle: '12 & 12'
            },
            {
                id: 'aa-comes-of-age',
                path: 'data/aa_comes_of_age.json',
                shortTitle: 'AA Comes of Age'
            },
            {
                id: 'language-of-the-heart',
                path: 'data/language_of_the_heart_final.json',
                shortTitle: 'Language of the Heart'
            },
            {
                id: 'study-guide',
                path: 'data/BigBook_StudyGuide.json',
                shortTitle: 'Study Guide'
            }
        ];

        const loadedBooks = [];

        for (const config of bookConfigs) {
            try {
                console.log(`Loading book: ${config.id} from ${config.path}`);
                // Add cache-busting to ensure fresh data
                const cacheBuster = `?v=${Date.now()}`;
                const response = await fetch(config.path + cacheBuster);

                if (!response.ok) {
                    console.error(`Failed to fetch ${config.id}: HTTP ${response.status}`);
                    continue;
                }

                const book = await response.json();
                console.log(`Parsed JSON for ${config.id}:`, book.metadata?.title || 'No title');

                // Ensure metadata has ID
                if (!book.metadata) book.metadata = {};
                book.metadata.id = config.id;
                book.metadata.shortTitle = config.shortTitle || book.metadata.title;

                // Store in books Map FIRST
                this.books.set(config.id, book);
                console.log(`Added ${config.id} to books Map. Map size: ${this.books.size}`);

                // Build search index (don't let errors here prevent book from loading)
                try {
                    await search.buildIndex(book);
                } catch (searchError) {
                    console.warn(`Search index failed for ${config.id}:`, searchError);
                }

                // Add to loaded books for sidebar
                let chapters = [];
                if (book.theSteps && book.theTraditions) {
                    // 12&12 format - combine steps and traditions
                    console.log(`12&12 format detected: ${book.theSteps.length} steps, ${book.theTraditions.length} traditions`);

                    // Build chapters with validation
                    const stepChapters = book.theSteps.map(s => {
                        const chapterId = `step-${s.number}`;
                        console.log(`  Creating step chapter: id=${chapterId}, number=${s.number}`);
                        return {
                            id: chapterId,
                            title: `Step ${s.number}`
                        };
                    });

                    const traditionChapters = book.theTraditions.map(t => {
                        const chapterId = `tradition-${t.number}`;
                        console.log(`  Creating tradition chapter: id=${chapterId}, number=${t.number}`);
                        return {
                            id: chapterId,
                            title: `Tradition ${t.number}`
                        };
                    });

                    chapters = [...stepChapters, ...traditionChapters];
                    console.log(`12&12 chapters built: ${chapters.length} total`);
                } else if (book.content && book.content.frontMatter) {
                    // Big Book format - has frontMatter, theProgram, personalStories, appendices
                    console.log('Big Book format detected');

                    // Front Matter section
                    chapters.push({ id: 'front-matter', title: '── Front Matter ──', isSection: true });
                    if (book.content.frontMatter.preface) {
                        chapters.push({ id: 'preface', title: 'Preface' });
                    }
                    if (book.content.frontMatter.forewords) {
                        book.content.frontMatter.forewords.forEach(fw => {
                            chapters.push({ id: `foreword-${fw.year}`, title: `Foreword (${fw.edition})` });
                        });
                    }
                    if (book.content.frontMatter.doctorsOpinion) {
                        chapters.push({ id: 'doctors-opinion', title: "The Doctor's Opinion" });
                    }

                    // The Program (main chapters)
                    if (book.content.mainText && book.content.mainText.chapters) {
                        chapters.push({ id: 'the-program', title: '── The Program ──', isSection: true });
                        book.content.mainText.chapters.forEach(ch => {
                            chapters.push({
                                id: `chapter-${ch.chapterNumber}`,
                                title: `${ch.chapterNumber}. ${ch.title}`
                            });
                        });
                    }

                    // Personal Stories
                    if (book.content.personalStories && book.content.personalStories.parts) {
                        chapters.push({ id: 'personal-stories', title: '── Personal Stories ──', isSection: true });
                        book.content.personalStories.parts.forEach(part => {
                            chapters.push({ id: `stories-part-${part.partNumber}`, title: `Part ${part.partNumber}: ${part.title}`, isSubSection: true });
                            part.stories.forEach(story => {
                                chapters.push({
                                    id: `story-${part.partNumber}-${story.storyNumber}`,
                                    title: story.title
                                });
                            });
                        });
                    }

                    // Appendices
                    if (book.content.appendices) {
                        chapters.push({ id: 'appendices', title: '── Appendices ──', isSection: true });
                        book.content.appendices.forEach(app => {
                            chapters.push({
                                id: `appendix-${app.appendixNumber}`,
                                title: `${app.appendixNumber}. ${app.title}`
                            });
                        });
                    }

                    // Study Tools (if available)
                    if (book.commonlyReadPassages || book.stepStudyGuide || book.glossary) {
                        chapters.push({ id: 'study-tools', title: '── Study Tools ──', isSection: true });

                        if (book.commonlyReadPassages) {
                            chapters.push({ id: 'study-passages', title: 'Commonly Read Passages' });
                        }
                        if (book.stepStudyGuide) {
                            chapters.push({ id: 'study-steps', title: 'Step Study Guide' });
                        }
                        if (book.glossary) {
                            chapters.push({ id: 'study-glossary', title: 'Glossary' });
                        }
                        if (book.topicIndex) {
                            chapters.push({ id: 'study-topics', title: 'Topic Index' });
                        }
                        if (book.readingPlans) {
                            chapters.push({ id: 'study-reading-plans', title: 'Reading Plans' });
                        }
                        if (book.inventoryGuide) {
                            chapters.push({ id: 'study-inventory', title: 'Inventory Guide' });
                        }
                        if (book.historicalContext) {
                            chapters.push({ id: 'study-history', title: 'Historical Context' });
                        }
                    }

                    console.log(`Big Book chapters built: ${chapters.length} total`);
                } else if (book.structure && book.structure.chapters) {
                    // AA Comes of Age format - has structure.chapters and structure.appendices
                    console.log('AA Comes of Age format detected');

                    // Chapters section
                    chapters.push({ id: 'chapters-section', title: '── Chapters ──', isSection: true });
                    book.structure.chapters.forEach(ch => {
                        chapters.push({
                            id: `chapter-${ch.number}`,
                            title: `${ch.romanNumeral}. ${ch.title}`
                        });
                    });

                    // Appendices section
                    if (book.structure.appendices && book.structure.appendices.length > 0) {
                        chapters.push({ id: 'appendices-section', title: '── Appendices ──', isSection: true });
                        book.structure.appendices.forEach(app => {
                            chapters.push({
                                id: `appendix-${app.letter}`,
                                title: `${app.letter}. ${app.title}`
                            });
                        });
                    }

                    console.log(`AA Comes of Age chapters built: ${chapters.length} total`);
                } else if (book.table_of_contents && book.articles) {
                    // Language of the Heart format - has table_of_contents with parts/segments and articles array
                    console.log('Language of the Heart format detected');

                    // Build chapters from table of contents sections (Parts)
                    book.table_of_contents.sections.forEach(section => {
                        if (section.type === 'part') {
                            // Add part as a section header
                            chapters.push({
                                id: `part-${section.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
                                title: `── ${section.title} ──`,
                                isSection: true
                            });

                            // Add segments and articles
                            if (section.segments) {
                                section.segments.forEach(segment => {
                                    // Add segment as subsection
                                    chapters.push({
                                        id: `segment-${segment.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
                                        title: segment.title,
                                        isSubSection: true
                                    });

                                    // Add articles from this segment
                                    if (segment.articles) {
                                        segment.articles.forEach(article => {
                                            const articleId = article.article_id || `article-page-${article.page}`;
                                            chapters.push({
                                                id: articleId,
                                                title: article.title,
                                                date: article.date,
                                                page: article.page
                                            });
                                        });
                                    }
                                });
                            }

                            // Handle parts without segments but with direct articles
                            if (section.articles && !section.segments) {
                                section.articles.forEach(article => {
                                    const articleId = article.article_id || `article-page-${article.page}`;
                                    chapters.push({
                                        id: articleId,
                                        title: article.title,
                                        date: article.date,
                                        page: article.page
                                    });
                                });
                            }
                        }
                    });

                    console.log(`Language of the Heart chapters built: ${chapters.length} total`);
                } else if (book.tableOfContents && book.content && book.content.sections) {
                    // Big Book Study Guide format - has tableOfContents and content.sections
                    console.log('Big Book Study Guide format detected');

                    book.tableOfContents.forEach(section => {
                        chapters.push({
                            id: section.id,
                            title: section.title,
                            bigBookPages: section.bigBookPages,
                            questionCount: section.questionCount,
                            commentCount: section.commentCount
                        });
                    });

                    console.log(`Big Book Study Guide chapters built: ${chapters.length} total`);
                } else if (book.content) {
                    chapters = book.content.map(c => ({
                        id: c.number || c.id,
                        title: c.title
                    }));
                }

                const bookEntry = {
                    id: config.id,
                    title: book.metadata.title,
                    shortTitle: book.metadata.shortTitle,
                    chapters
                };

                console.log(`Pushing book to loadedBooks:`, {
                    id: bookEntry.id,
                    title: bookEntry.title,
                    chaptersCount: bookEntry.chapters.length,
                    firstChapter: bookEntry.chapters[0],
                    lastChapter: bookEntry.chapters[bookEntry.chapters.length - 1]
                });

                loadedBooks.push(bookEntry);

                console.log(`Successfully loaded book: ${config.id} with ${chapters.length} chapters`);
            } catch (error) {
                console.error(`Failed to load book ${config.id}:`, error);
            }
        }

        // Update sidebar
        sidebar.loadBooks(loadedBooks);

        // Initialize page-based cross-reference index
        try {
            await pageCrossRef.initialize(this.books);
            const stats = pageCrossRef.getStats();
            console.log('Cross-reference index initialized:', stats);
        } catch (crossRefError) {
            console.warn('Cross-reference index failed:', crossRefError);
        }

        // Debug: Log final state
        console.log('=== Book Loading Complete ===');
        console.log('Books in Map:', Array.from(this.books.keys()));
        console.log('Books for sidebar:', loadedBooks.map(b => b.id));

        // Show visual confirmation
        if (this.books.size > 0) {
            console.log(`%c✓ ${this.books.size} books loaded successfully`, 'color: green; font-weight: bold');
        } else {
            console.error('%c✗ No books loaded!', 'color: red; font-weight: bold');
            toast.error('Failed to load books. Check console for details.');

            // Show a clear message in the reader area
            const readerContent = document.getElementById('reader-content');
            if (readerContent) {
                readerContent.innerHTML = `
                    <div style="padding: 40px; text-align: center;">
                        <h2 style="color: #d32f2f;">Failed to Load Books</h2>
                        <p style="margin: 20px 0;">The JSON data files could not be loaded.</p>
                        <div style="background: #fff3e0; padding: 20px; border-radius: 8px; text-align: left; max-width: 500px; margin: 0 auto;">
                            <h3 style="margin-top: 0;">Common Causes:</h3>
                            <ol style="line-height: 1.8;">
                                <li><strong>Running from file:// protocol</strong><br>
                                    <span style="color: #666;">Your URL starts with: <code>${window.location.protocol}</code></span><br>
                                    <span style="color: #666;">If it says "file:", you need a web server.</span>
                                </li>
                                <li><strong>Solution:</strong> Use VS Code's "Live Server" extension<br>
                                    <span style="color: #666;">Right-click index.html → "Open with Live Server"</span>
                                </li>
                                <li><strong>Or run:</strong> <code>npx serve .</code> in terminal</li>
                            </ol>
                        </div>
                        <p style="margin-top: 20px; color: #666;">Check browser console (F12) for detailed errors.</p>
                    </div>
                `;
            }
        }
    }

    /**
     * Setup router
     */
    setupRouter() {
        // Home route
        router.on('/', () => {
            reader.showWelcome();
            sidebar.setActiveNav('/');
        });

        // Book chapter route (more specific - register BEFORE book route)
        // Using appInstance instead of this for reliable access
        router.on('/book/:bookId/chapter/:chapterId', async (params) => {
            const bookId = params?.bookId;
            const chapterId = params?.chapterId;
            console.log(`Route: /book/${bookId}/chapter/${chapterId}`);
            console.log('Route params received:', JSON.stringify(params));
            console.log('bookId type:', typeof bookId, 'value:', bookId);
            console.log('chapterId type:', typeof chapterId, 'value:', chapterId);

            // Check if app is initialized
            if (!appInstance?.initialized) {
                console.error('App not initialized yet!');
                toast.error('App still loading, please wait...');
                return;
            }

            // Validate bookId with specific error messages
            if (bookId === undefined || bookId === null) {
                console.error('bookId is undefined/null:', params);
                toast.error('Book ID is missing from URL');
                window.location.hash = '/';
                return;
            }
            if (bookId === 'undefined' || bookId === 'null' || bookId === '') {
                console.error('bookId is invalid string:', bookId);
                toast.error('Invalid book ID in URL');
                window.location.hash = '/';
                return;
            }

            // Use module-level appInstance for reliable book access
            const books = appInstance.books;
            console.log('Books Map size:', books.size);
            console.log('Available books:', Array.from(books.keys()));

            const book = books.get(bookId);
            if (!book) {
                console.error(`Book not found: "${bookId}"`);
                console.error('Requested bookId:', bookId, 'Type:', typeof bookId);
                console.error('Available books:', Array.from(books.keys()));
                toast.error(`Book "${bookId}" not found. Available: ${Array.from(books.keys()).join(', ')}`);
                navigateTo('/');
                return;
            }

            console.log(`Found book: ${book.metadata?.title}`);

            // Handle 12&12 format (step-1, tradition-3, etc.)
            if (book.theSteps && book.theTraditions) {
                console.log('Handling 12&12 format');
                const match = chapterId.match(/^(step|tradition)-(\d+)$/);
                if (match) {
                    const type = match[1];
                    const num = parseInt(match[2], 10);
                    console.log(`Looking for ${type} ${num}`);
                    const targetArray = type === 'step' ? book.theSteps : book.theTraditions;
                    const chapter = targetArray.find(item => item.number === num);
                    if (chapter) {
                        console.log(`Found chapter: ${chapter.title || `${type} ${num}`}`);
                        reader.showLoading();
                        reader.currentBook = book;
                        await reader.displayStepOrTradition(book, chapter, type);
                        sidebar.setActive(bookId, chapterId);
                        reader.saveProgress(bookId, chapterId);
                        return;
                    }
                }
                console.error(`Step/Tradition not found: ${chapterId}`);
                toast.error('Step/Tradition not found');
                return;
            }

            // Handle Big Book format
            if (book.content && book.content.frontMatter) {
                console.log('Handling Big Book format, chapterId:', chapterId);
                reader.showLoading();
                reader.currentBook = book;
                await reader.displayBigBookContent(book, chapterId);
                sidebar.setActive(bookId, chapterId);
                reader.saveProgress(bookId, chapterId);
                return;
            }

            // Handle AA Comes of Age format
            if (book.structure && book.structure.chapters) {
                console.log('Handling AA Comes of Age format, chapterId:', chapterId);
                reader.showLoading();
                reader.currentBook = book;
                await reader.displayAAComesOfAgeContent(book, chapterId);
                sidebar.setActive(bookId, chapterId);
                reader.saveProgress(bookId, chapterId);
                return;
            }

            // Handle Language of the Heart format (articles)
            if (book.articles && Array.isArray(book.articles)) {
                console.log('Handling Language of the Heart format, chapterId:', chapterId);
                const article = book.articles.find(a => a.id === chapterId);
                if (article) {
                    reader.showLoading();
                    reader.currentBook = book;
                    await reader.displayArticle(book, article);
                    sidebar.setActive(bookId, chapterId);
                    reader.saveProgress(bookId, chapterId);
                    return;
                }
                // Article not found in data - show graceful error in reader
                console.warn(`Article not found in data: ${chapterId}`);
                reader.currentBook = book;
                reader.showArticleNotFound(chapterId, book);
                sidebar.setActive(bookId, chapterId);
                return;
            }

            // Handle Big Book Study Guide format
            if (book.tableOfContents && book.content && book.content.sections) {
                console.log('Handling Study Guide format, chapterId:', chapterId);
                reader.showLoading();
                reader.currentBook = book;
                await reader.displayStudyGuideSection(book, chapterId);
                sidebar.setActive(bookId, chapterId);
                reader.saveProgress(bookId, chapterId);
                return;
            }

            // Standard book format
            if (book.content) {
                const chapter = book.content.find(c =>
                    String(c.number) === chapterId || c.id === chapterId
                );
                if (chapter) {
                    reader.showLoading();
                    reader.currentBook = book;
                    await reader.displayChapter(book, chapter);
                    sidebar.setActive(bookId, chapterId);
                } else {
                    toast.error('Chapter not found');
                }
            }
        });

        // Book route
        router.on('/book/:bookId', async (params) => {
            const bookId = params?.bookId;
            console.log(`Route: /book/${bookId}`);
            console.log('Route params received:', JSON.stringify(params));
            console.log('bookId type:', typeof bookId, 'value:', bookId);

            // Check if app is initialized
            if (!appInstance?.initialized) {
                console.error('App not initialized yet!');
                toast.error('App still loading, please wait...');
                return;
            }

            // Validate bookId with specific error messages
            if (bookId === undefined || bookId === null) {
                console.error('bookId is undefined/null:', params);
                toast.error('Book ID is missing from URL');
                window.location.hash = '/';
                return;
            }
            if (bookId === 'undefined' || bookId === 'null' || bookId === '') {
                console.error('bookId is invalid string:', bookId);
                toast.error('Invalid book ID in URL');
                window.location.hash = '/';
                return;
            }

            // Use module-level appInstance for reliable book access
            const books = appInstance.books;
            console.log('Books Map size:', books.size);
            console.log('Available books:', Array.from(books.keys()));

            const book = books.get(bookId);
            if (book) {
                console.log(`Found book: ${book.metadata?.title}`);
                reader.showLoading();
                reader.currentBook = book;
                await reader.displayBook(book);
                sidebar.setActive(bookId);
            } else {
                console.error(`Book not found: "${bookId}"`);
                console.error('Requested bookId:', bookId, 'Type:', typeof bookId);
                console.error('Available books:', Array.from(books.keys()));
                toast.error(`Book "${bookId}" not found. Available: ${Array.from(books.keys()).join(', ')}`);
                navigateTo('/');
            }
        });

        // Search route - show advanced search view
        router.on('/search', () => {
            const query = router.getQuery().q || '';
            // Pass available books from app for filtering (search may not have all books indexed)
            const availableBooks = Array.from(appInstance.books.values()).map(book => ({
                id: book.metadata?.id || book.id,
                title: book.metadata?.shortTitle || book.metadata?.title || book.id
            }));
            reader.showSearchView(query, search, availableBooks);
            sidebar.setActiveNav('/search');
        });

        // Index route - topic index of AA literature
        router.on('/index', () => {
            reader.showIndex();
            sidebar.setActiveNav('/index');
        });

        // Notes route - user annotations (highlights, comments, questions, etc.)
        router.on('/annotations', () => {
            reader.showNotes();
            sidebar.setActiveNav('/annotations');
        });

        // Bookmarks route
        router.on('/bookmarks', () => {
            reader.showBookmarks();
            sidebar.setActiveNav('/bookmarks');
        });

        // Cross references route
        router.on('/crossrefs', async () => {
            await appInstance.showCrossReferences();
            sidebar.setActiveNav('/crossrefs');
        });

        // Default route
        router.on('*', () => {
            navigateTo('/');
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        const searchPanel = document.getElementById('search-panel');
        const closeSearch = document.getElementById('close-search');

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(searchInput.value);
            }
        });

        searchBtn?.addEventListener('click', () => {
            this.performSearch(searchInput.value);
        });

        closeSearch?.addEventListener('click', () => {
            searchPanel.classList.remove('visible');
        });

        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.addEventListener('click', async () => {
            const current = document.documentElement.dataset.theme || 'light';
            const themes = ['light', 'dark', 'sepia'];
            const nextIndex = (themes.indexOf(current) + 1) % themes.length;
            const next = themes[nextIndex];

            document.documentElement.dataset.theme = next;
            await setSetting('theme', next);
            toast.info(`Theme: ${next}`);
        });

        // Settings
        const settingsBtn = document.getElementById('settings-btn');
        settingsBtn?.addEventListener('click', async () => {
            // Get current settings including highlight and underline colors
            const highlightColors = await getSetting('highlightColors', [
                { id: 'yellow', color: '#fef08a', label: 'Important' },
                { id: 'green', color: '#bbf7d0', label: 'Action Item' },
                { id: 'blue', color: '#bfdbfe', label: 'Question' },
                { id: 'pink', color: '#fbcfe8', label: 'Personal' },
                { id: 'orange', color: '#fed7aa', label: 'Reference' },
                { id: 'purple', color: '#ddd6fe', label: 'Insight' }
            ]);

            const underlineColors = await getSetting('underlineColors', [
                { id: 'solid', color: '#2563eb', label: 'Key Point' },
                { id: 'dashed', color: '#16a34a', label: 'To Review' },
                { id: 'wavy', color: '#dc2626', label: 'Question' },
                { id: 'double', color: '#7c3aed', label: 'Definition' }
            ]);

            const currentSettings = {
                theme: await getSetting('theme', 'light'),
                fontSize: await getSetting('fontSize', 16),
                highlightColors,
                underlineColors
            };

            const result = await modal.showSettingsModal(currentSettings);

            if (result) {
                // Apply settings
                document.documentElement.dataset.theme = result.theme;
                document.documentElement.style.fontSize = `${result.fontSize}px`;

                await setSetting('theme', result.theme);
                await setSetting('fontSize', parseInt(result.fontSize, 10));

                // Save highlight colors and labels
                const updatedHighlightColors = highlightColors.map(c => ({
                    id: c.id,
                    color: result[`highlight-color-${c.id}`] || c.color,
                    label: result[`highlight-label-${c.id}`] || c.label
                }));
                await setSetting('highlightColors', updatedHighlightColors);

                // Save underline colors and labels
                const updatedUnderlineColors = underlineColors.map(c => ({
                    id: c.id,
                    color: result[`underline-color-${c.id}`] || c.color,
                    label: result[`underline-label-${c.id}`] || c.label
                }));
                await setSetting('underlineColors', updatedUnderlineColors);

                // Apply colors to CSS and update toolbar
                this.applyColorScheme(updatedHighlightColors, updatedUnderlineColors);

                toast.success('Settings saved');
            }
        });

        // Initialize color scheme and toolbar tooltips
        this.initColorScheme();

        // Export/Import data (in settings modal)
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'export-data-btn') {
                try {
                    const data = await exportData();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `aa-study-backup-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Data exported');
                } catch (error) {
                    toast.error('Failed to export data');
                }
            }

            if (e.target.id === 'import-data-btn') {
                document.getElementById('import-file-input')?.click();
            }

            if (e.target.id === 'reset-all-btn') {
                const confirmed = await modal.confirm(
                    'This will permanently delete ALL your annotations, bookmarks, highlights, and settings. This action cannot be undone. Are you sure?',
                    'Reset All Data'
                );
                if (confirmed) {
                    try {
                        const { resetAllData } = await import('./db.js');
                        await resetAllData();
                        toast.success('All data has been reset');
                        // Close modal and refresh
                        modal.close(null);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    } catch (error) {
                        toast.error('Failed to reset data: ' + error.message);
                    }
                }
            }
        });

        // File input for import
        document.addEventListener('change', async (e) => {
            if (e.target.id === 'import-file-input') {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        await importData(data);
                        toast.success('Data imported successfully');
                        // Refresh current view
                        router.handleRoute();
                    } catch (error) {
                        toast.error('Failed to import data: ' + error.message);
                    }
                }
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts if typing in an input
            const activeEl = document.activeElement;
            const isTyping = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable;

            // Ctrl/Cmd + K for search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }

            // / to focus search (when not typing)
            if (e.key === '/' && !isTyping) {
                e.preventDefault();
                searchInput.focus();
            }

            // Escape to close modals/popovers
            if (e.key === 'Escape') {
                const popover = document.querySelector('.annotation-popover');
                if (popover) popover.remove();

                // Collapse any expanded cross-reference items
                document.querySelectorAll('.crossref-item.expanded').forEach(item => {
                    const btn = item.querySelector('.crossref-expand-btn');
                    const content = item.querySelector('.crossref-expanded-content');
                    if (content) content.style.display = 'none';
                    if (btn) btn.classList.remove('expanded');
                    item.classList.remove('expanded');
                });

                // Clear search input focus
                if (activeEl === searchInput) {
                    searchInput.blur();
                }
            }

            // Left/Right arrows for navigation (when not typing)
            if (!isTyping && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                const prevBtn = document.querySelector('#prev-step, #prev-reflection, #prev-entry, #aacoa-prev, #bb-prev');
                const nextBtn = document.querySelector('#next-step, #next-reflection, #next-entry, #aacoa-next, #bb-next');

                if (e.key === 'ArrowLeft' && prevBtn && !prevBtn.disabled) {
                    prevBtn.click();
                } else if (e.key === 'ArrowRight' && nextBtn && !nextBtn.disabled) {
                    nextBtn.click();
                }
            }

            // ? to show keyboard shortcuts help (when not typing)
            if (e.key === '?' && !isTyping) {
                this.showKeyboardShortcuts();
            }
        });
    }

    /**
     * Show keyboard shortcuts help
     */
    showKeyboardShortcuts() {
        modal.open({
            title: 'Keyboard Shortcuts',
            body: `
                <div class="shortcuts-list">
                    <div class="shortcut-item">
                        <kbd>/</kbd> or <kbd>Ctrl+K</kbd>
                        <span>Focus search</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>←</kbd> / <kbd>→</kbd>
                        <span>Previous / Next chapter</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Esc</kbd>
                        <span>Close modals, collapse expanded items</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>?</kbd>
                        <span>Show this help</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl+D</kbd>
                        <span>Look up selected word in dictionary</span>
                    </div>
                </div>
            `,
            confirmText: 'Got it',
            showCancel: false
        });
    }

    /**
     * Setup dictionary event handlers
     */
    setupDictionaryHandlers() {
        // Keyboard shortcut: Ctrl/Cmd + D to look up selected word
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();

                if (selectedText) {
                    e.preventDefault();
                    const word = selectedText.split(/\s+/)[0];
                    const rect = selection.getRangeAt(0).getBoundingClientRect();
                    dictionaryPopup.show(word, rect.left, rect.bottom + window.scrollY);
                }
            }
        });
    }

    /**
     * Perform search
     */
    performSearch(query) {
        if (!query.trim()) return;

        const results = search.search(query);
        reader.showSearchResults(results, query);

        // Update URL
        window.location.hash = `/search?q=${encodeURIComponent(query)}`;
    }

    /**
     * Initialize color scheme from saved settings
     */
    async initColorScheme() {
        try {
            const highlightColors = await getSetting('highlightColors', [
                { id: 'yellow', color: '#fef08a', label: 'Important' },
                { id: 'green', color: '#bbf7d0', label: 'Action Item' },
                { id: 'blue', color: '#bfdbfe', label: 'Question' },
                { id: 'pink', color: '#fbcfe8', label: 'Personal' },
                { id: 'orange', color: '#fed7aa', label: 'Reference' },
                { id: 'purple', color: '#ddd6fe', label: 'Insight' }
            ]);

            const underlineColors = await getSetting('underlineColors', [
                { id: 'solid', color: '#2563eb', label: 'Key Point' },
                { id: 'dashed', color: '#16a34a', label: 'To Review' },
                { id: 'wavy', color: '#dc2626', label: 'Question' },
                { id: 'double', color: '#7c3aed', label: 'Definition' }
            ]);

            this.applyColorScheme(highlightColors, underlineColors);
        } catch (error) {
            console.warn('Failed to init color scheme:', error);
        }
    }

    /**
     * Apply color scheme to CSS variables and update toolbar tooltips
     */
    applyColorScheme(highlightColors, underlineColors) {
        const root = document.documentElement;

        // Apply highlight colors to CSS variables and toolbar buttons
        highlightColors.forEach(c => {
            root.style.setProperty(`--highlight-${c.id}`, c.color);

            const btn = document.querySelector(`.color-btn[data-color="${c.id}"]`);
            if (btn) {
                btn.style.backgroundColor = c.color;
                btn.title = c.label;
                btn.setAttribute('aria-label', `${c.label} highlight`);
            }
        });

        // Apply underline colors to CSS variables and toolbar buttons
        underlineColors.forEach(c => {
            root.style.setProperty(`--underline-${c.id}`, c.color);

            const btn = document.querySelector(`.underline-btn[data-style="${c.id}"]`);
            if (btn) {
                btn.title = c.label;
                btn.setAttribute('aria-label', `${c.label} underline`);
                const preview = btn.querySelector('.underline-preview');
                if (preview) {
                    preview.style.textDecorationColor = c.color;
                }
            }
        });
    }

    /**
     * Show cross references view
     */
    async showCrossReferences() {
        const crossRefs = await getAllCrossReferences();

        const readerContent = document.getElementById('reader-content');
        readerContent.innerHTML = `
            <div class="index-view">
                <h2>Cross References</h2>
                ${crossRefs.length === 0 ? `
                    <p style="color: var(--text-muted); margin-top: 16px;">
                        No cross references yet. Select text and click the Link button to create references between passages.
                    </p>
                ` : `
                    <div class="index-section">
                        ${crossRefs.map(ref => `
                            <div class="note-card">
                                <div class="note-header">
                                    <span>${ref.sourceBookId}</span>
                                    <span>→</span>
                                    <span>${ref.targetBookId}</span>
                                </div>
                                ${ref.note ? `<div class="note-content">${ref.note}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
    }
}

// Initialize app when DOM is ready
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());

// Export for debugging
window.app = app;
