/**
 * Full-text search for AA Literature Study
 */

import { saveSearchIndex, getSearchIndex } from './db.js';

class Search {
    constructor() {
        this.indices = new Map(); // bookId -> searchable text index
        this.books = new Map(); // bookId -> book data
    }

    /**
     * Build search index for a book
     */
    async buildIndex(book) {
        const bookId = book.metadata.id;
        const entries = [];

        if (book.reflections) {
            // Daily Reflections format
            book.reflections.forEach((reflection, idx) => {
                const quoteText = Array.isArray(reflection.quote)
                    ? reflection.quote.join(' ')
                    : reflection.quote;
                const reflectionText = Array.isArray(reflection.reflection)
                    ? reflection.reflection.join(' ')
                    : reflection.reflection;

                entries.push({
                    id: `dr-${reflection.dateKey}`,
                    type: 'reflection',
                    title: reflection.title,
                    text: `${reflection.title} ${quoteText} ${reflectionText}`.toLowerCase(),
                    location: {
                        month: reflection.month,
                        day: reflection.day,
                        dateKey: reflection.dateKey
                    },
                    snippet: quoteText.slice(0, 150)
                });
            });
        } else if (book.entries) {
            // As Bill Sees It format
            book.entries.forEach(entry => {
                // Combine all section paragraphs (with null check)
                const allText = entry.sections ? entry.sections.map(section =>
                    section.paragraphs ? section.paragraphs.map(p => p.text).join(' ') : ''
                ).join(' ') : '';

                const sources = entry.all_sources ?
                    entry.all_sources.map(s => s.citation).join(', ') : '';

                entries.push({
                    id: `absit-${entry.entry_number}`,
                    type: 'entry',
                    title: entry.title,
                    entryNumber: entry.entry_number,
                    page: entry.page,
                    text: `${entry.title} ${allText} ${sources}`.toLowerCase(),
                    location: {
                        entry: entry.entry_number,
                        page: entry.page
                    },
                    snippet: allText.slice(0, 150) || entry.title
                });
            });
        } else if (book.theSteps && book.theTraditions) {
            // Twelve Steps and Twelve Traditions format (new structure)
            const indexItems = (items, type) => {
                const typeLabel = type === 'step' ? 'Step' : 'Tradition';
                items.forEach(item => {
                    // Combine all paragraph texts from content array
                    const paragraphTexts = item.content ? item.content.map(para => {
                        return para.text || '';
                    }).join(' ') : '';

                    entries.push({
                        id: `${type}-${item.number}`,
                        type: type,
                        title: `${typeLabel} ${item.number}`,
                        chapterTitle: item.title || `${typeLabel} ${item.number}`,
                        chapterNumber: item.number,
                        text: `${typeLabel} ${item.number} ${item.officialText || ''} ${paragraphTexts}`.toLowerCase(),
                        location: {
                            chapter: item.number,
                            type: type,
                            page: item.pageRange?.start
                        },
                        snippet: item.officialText ? item.officialText.slice(0, 150) : `${typeLabel} ${item.number}`
                    });
                });
            };

            indexItems(book.theSteps, 'step');
            indexItems(book.theTraditions, 'tradition');
        } else if (book.content && book.content.frontMatter) {
            // Big Book format
            const extractParagraphText = (paragraphs) => {
                if (!paragraphs) return '';
                return paragraphs.map(p => p.plainText || '').join(' ');
            };

            // Index front matter
            const fm = book.content.frontMatter;
            if (fm.preface) {
                entries.push({
                    id: 'preface',
                    type: 'frontMatter',
                    title: 'Preface',
                    text: `preface ${extractParagraphText(fm.preface.paragraphs)}`.toLowerCase(),
                    location: { section: 'Front Matter' },
                    snippet: extractParagraphText(fm.preface.paragraphs).slice(0, 150)
                });
            }

            if (fm.forewords) {
                fm.forewords.forEach(fw => {
                    entries.push({
                        id: `foreword-${fw.year}`,
                        type: 'frontMatter',
                        title: `Foreword (${fw.edition})`,
                        text: `foreword ${fw.edition} ${extractParagraphText(fw.paragraphs)}`.toLowerCase(),
                        location: { section: 'Front Matter', year: fw.year },
                        snippet: extractParagraphText(fw.paragraphs).slice(0, 150)
                    });
                });
            }

            if (fm.doctorsOpinion) {
                entries.push({
                    id: 'doctors-opinion',
                    type: 'frontMatter',
                    title: "The Doctor's Opinion",
                    text: `doctor's opinion ${fm.doctorsOpinion.author || ''} ${extractParagraphText(fm.doctorsOpinion.paragraphs)}`.toLowerCase(),
                    location: { section: 'Front Matter' },
                    snippet: extractParagraphText(fm.doctorsOpinion.paragraphs).slice(0, 150)
                });
            }

            // Index main chapters
            if (book.content.mainText && book.content.mainText.chapters) {
                book.content.mainText.chapters.forEach(ch => {
                    entries.push({
                        id: `chapter-${ch.chapterNumber}`,
                        type: 'chapter',
                        title: ch.title,
                        chapterNumber: ch.chapterNumber,
                        text: `chapter ${ch.chapterNumber} ${ch.title} ${extractParagraphText(ch.paragraphs)}`.toLowerCase(),
                        location: { chapter: ch.chapterNumber, page: ch.pageStart },
                        snippet: extractParagraphText(ch.paragraphs).slice(0, 150)
                    });
                });
            }

            // Index personal stories
            if (book.content.personalStories && book.content.personalStories.parts) {
                book.content.personalStories.parts.forEach(part => {
                    part.stories.forEach(story => {
                        entries.push({
                            id: `story-${part.partNumber}-${story.storyNumber}`,
                            type: 'story',
                            title: story.title,
                            text: `${story.title} ${story.subtitle || ''} ${extractParagraphText(story.paragraphs)}`.toLowerCase(),
                            location: { part: part.partNumber, story: story.storyNumber, page: story.pageStart },
                            snippet: (story.subtitle || extractParagraphText(story.paragraphs)).slice(0, 150)
                        });
                    });
                });
            }

            // Index appendices
            if (book.content.appendices) {
                book.content.appendices.forEach(app => {
                    entries.push({
                        id: `appendix-${app.appendixNumber}`,
                        type: 'appendix',
                        title: `Appendix ${app.appendixNumber}: ${app.title}`,
                        text: `appendix ${app.appendixNumber} ${app.title} ${extractParagraphText(app.paragraphs)}`.toLowerCase(),
                        location: { appendix: app.appendixNumber, page: app.pageStart },
                        snippet: extractParagraphText(app.paragraphs).slice(0, 150)
                    });
                });
            }
        } else if (book.structure && book.structure.chapters) {
            // AA Comes of Age format
            const extractParagraphText = (paragraphs) => {
                if (!paragraphs) return '';
                return paragraphs.map(p => p.plainText || '').join(' ');
            };

            // Index chapters
            book.structure.chapters.forEach(ch => {
                entries.push({
                    id: `chapter-${ch.number}`,
                    type: 'chapter',
                    title: ch.title,
                    chapterNumber: ch.number,
                    romanNumeral: ch.romanNumeral,
                    text: `chapter ${ch.number} ${ch.romanNumeral} ${ch.title} ${extractParagraphText(ch.content)}`.toLowerCase(),
                    location: { chapter: ch.number, page: ch.startPage },
                    snippet: extractParagraphText(ch.content).slice(0, 150)
                });
            });

            // Index appendices
            if (book.structure.appendices) {
                book.structure.appendices.forEach(app => {
                    entries.push({
                        id: `appendix-${app.letter}`,
                        type: 'appendix',
                        title: `Appendix ${app.letter}: ${app.title}`,
                        text: `appendix ${app.letter} ${app.title} ${extractParagraphText(app.content)}`.toLowerCase(),
                        location: { appendix: app.letter, page: app.startPage },
                        snippet: extractParagraphText(app.content).slice(0, 150)
                    });
                });
            }
        } else if (book.articles && Array.isArray(book.articles)) {
            // Language of the Heart format
            book.articles.forEach(article => {
                // Extract text from paragraph elements
                const paragraphTexts = article.paragraphs ? article.paragraphs.map(para => {
                    if (para.elements && Array.isArray(para.elements)) {
                        return para.elements.map(el => el.content || '').join('');
                    }
                    return '';
                }).join(' ') : '';

                entries.push({
                    id: article.id,
                    type: 'article',
                    title: article.title,
                    articleId: article.id,
                    publicationDate: article.publication_date,
                    text: `${article.title} ${article.publication_date || ''} ${paragraphTexts}`.toLowerCase(),
                    location: {
                        articleId: article.id,
                        page: article.page_number
                    },
                    snippet: paragraphTexts.slice(0, 150) || article.title
                });
            });
        } else if (book.content) {
            // Standard book format
            book.content.forEach(chapter => {
                if (chapter.paragraphs) {
                    chapter.paragraphs.forEach(para => {
                        entries.push({
                            id: para.id,
                            type: 'paragraph',
                            chapterTitle: chapter.title,
                            chapterNumber: chapter.number,
                            pageNumber: para.pageNumber,
                            text: para.text.toLowerCase(),
                            location: {
                                chapter: chapter.number,
                                page: para.pageNumber
                            },
                            snippet: para.text.slice(0, 150)
                        });
                    });
                }
            });
        }

        this.indices.set(bookId, entries);
        this.books.set(bookId, book);

        // Cache in IndexedDB
        await saveSearchIndex(bookId, entries);

        return entries;
    }

    /**
     * Load cached index
     */
    async loadIndex(bookId) {
        const cached = await getSearchIndex(bookId);
        if (cached) {
            this.indices.set(bookId, cached);
            return true;
        }
        return false;
    }

    /**
     * Search across all indexed books
     */
    search(query, options = {}) {
        const {
            bookId = null,
            limit = 50,
            caseSensitive = false
        } = options;

        const searchQuery = caseSensitive ? query : query.toLowerCase();
        const words = searchQuery.split(/\s+/).filter(w => w.length > 0);

        if (words.length === 0) return [];

        const results = [];
        const indicesToSearch = bookId
            ? [[bookId, this.indices.get(bookId)]]
            : Array.from(this.indices.entries());

        for (const [bId, entries] of indicesToSearch) {
            if (!entries) continue;

            const book = this.books.get(bId);
            const bookTitle = book?.metadata?.shortTitle || book?.metadata?.title || bId;

            for (const entry of entries) {
                // Check if all words are present
                const matches = words.every(word => entry.text.includes(word));

                if (matches) {
                    // Find context around first match
                    const firstWordIndex = entry.text.indexOf(words[0]);
                    const start = Math.max(0, firstWordIndex - 40);
                    const end = Math.min(entry.text.length, firstWordIndex + words[0].length + 100);

                    let snippet = entry.text.slice(start, end);
                    if (start > 0) snippet = '...' + snippet;
                    if (end < entry.text.length) snippet = snippet + '...';

                    results.push({
                        bookId: bId,
                        bookTitle,
                        entryId: entry.id,
                        type: entry.type,
                        title: entry.title || entry.chapterTitle,
                        location: entry.location,
                        snippet,
                        relevance: this.calculateRelevance(entry.text, words)
                    });

                    if (results.length >= limit) break;
                }
            }

            if (results.length >= limit) break;
        }

        // Sort by relevance
        results.sort((a, b) => b.relevance - a.relevance);

        return results;
    }

    /**
     * Calculate relevance score
     */
    calculateRelevance(text, words) {
        let score = 0;

        for (const word of words) {
            // Count occurrences
            const regex = new RegExp(word, 'gi');
            const matches = text.match(regex);
            if (matches) {
                score += matches.length;
            }
        }

        // Bonus for exact phrase match
        const phrase = words.join(' ');
        if (text.includes(phrase)) {
            score += 10;
        }

        return score;
    }

    /**
     * Get search suggestions (autocomplete)
     */
    getSuggestions(query, limit = 5) {
        const suggestions = new Set();
        const lowerQuery = query.toLowerCase();

        for (const [bookId, entries] of this.indices) {
            for (const entry of entries) {
                // Find words that start with query
                const words = entry.text.split(/\s+/);
                for (const word of words) {
                    if (word.startsWith(lowerQuery) && word !== lowerQuery) {
                        suggestions.add(word);
                        if (suggestions.size >= limit) break;
                    }
                }
                if (suggestions.size >= limit) break;
            }
            if (suggestions.size >= limit) break;
        }

        return Array.from(suggestions);
    }

    /**
     * Check if a book is indexed
     */
    isIndexed(bookId) {
        return this.indices.has(bookId);
    }

    /**
     * Get index stats
     */
    getStats() {
        let totalEntries = 0;
        for (const entries of this.indices.values()) {
            totalEntries += entries.length;
        }

        return {
            booksIndexed: this.indices.size,
            totalEntries
        };
    }
}

// Export singleton
export const search = new Search();
