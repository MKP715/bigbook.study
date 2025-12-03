/**
 * Index Builder for AA Literature Study
 * Generates tables of contents and indexes from book data
 */

class IndexBuilder {
    /**
     * Build table of contents for a book
     */
    buildTableOfContents(book) {
        const toc = [];

        if (book.reflections) {
            // Daily Reflections - group by month
            const byMonth = {};
            book.reflections.forEach(r => {
                if (!byMonth[r.month]) {
                    byMonth[r.month] = [];
                }
                byMonth[r.month].push({
                    id: r.dateKey,
                    day: r.day,
                    title: r.title
                });
            });

            Object.entries(byMonth).forEach(([month, entries]) => {
                toc.push({
                    type: 'section',
                    title: month,
                    children: entries.map(e => ({
                        type: 'entry',
                        id: e.id,
                        title: `${e.day}. ${e.title}`,
                        link: `#/book/daily-reflections?date=${e.id}`
                    }))
                });
            });
        } else if (book.content) {
            // Standard book format
            book.content.forEach(chapter => {
                const entry = {
                    type: 'chapter',
                    id: chapter.number || chapter.id,
                    title: chapter.title,
                    pageStart: chapter.pageStart,
                    pageEnd: chapter.pageEnd,
                    link: `#/book/${book.metadata.id}/chapter/${chapter.number || chapter.id}`
                };

                // Add sections if present
                if (chapter.sections) {
                    entry.children = chapter.sections.map(s => ({
                        type: 'section',
                        title: s.title,
                        page: s.pageStart
                    }));
                }

                toc.push(entry);
            });
        }

        return toc;
    }

    /**
     * Build topic index from book content
     */
    buildTopicIndex(book) {
        const topics = new Map();

        const addTopic = (topic, location) => {
            const normalizedTopic = topic.toLowerCase().trim();
            if (!topics.has(normalizedTopic)) {
                topics.set(normalizedTopic, {
                    topic: topic.trim(),
                    locations: []
                });
            }
            topics.get(normalizedTopic).locations.push(location);
        };

        // Extract topics from existing index if present
        if (book.index && book.index.topics) {
            book.index.topics.forEach(t => {
                t.references.forEach(ref => {
                    addTopic(t.topic, ref);
                });
            });
        }

        // Could also auto-extract topics from content using NLP
        // For now, just return existing index topics

        // Convert to sorted array
        return Array.from(topics.values())
            .sort((a, b) => a.topic.localeCompare(b.topic));
    }

    /**
     * Generate HTML for table of contents
     */
    renderTableOfContents(toc, options = {}) {
        const { showPages = true, collapsible = true } = options;

        const renderEntry = (entry, depth = 0) => {
            const indent = depth * 16;
            let html = '';

            if (entry.type === 'section' && entry.children) {
                html += `
                    <div class="toc-section" style="margin-left: ${indent}px;">
                        <div class="toc-section-title ${collapsible ? 'collapsible' : ''}" data-depth="${depth}">
                            ${collapsible ? '<span class="toc-expand">+</span>' : ''}
                            ${entry.title}
                        </div>
                        <div class="toc-children ${collapsible ? 'collapsed' : ''}">
                            ${entry.children.map(child => renderEntry(child, depth + 1)).join('')}
                        </div>
                    </div>
                `;
            } else {
                const pageInfo = showPages && entry.pageStart
                    ? `<span class="toc-page">p. ${entry.pageStart}${entry.pageEnd ? '-' + entry.pageEnd : ''}</span>`
                    : '';

                html += `
                    <a class="toc-entry" href="${entry.link || '#'}" style="margin-left: ${indent}px;">
                        <span class="toc-entry-title">${entry.title}</span>
                        ${pageInfo}
                    </a>
                `;
            }

            return html;
        };

        return `
            <div class="table-of-contents">
                ${toc.map(entry => renderEntry(entry)).join('')}
            </div>
        `;
    }

    /**
     * Generate HTML for topic index
     */
    renderTopicIndex(topics) {
        // Group by first letter
        const byLetter = {};
        topics.forEach(t => {
            const letter = t.topic.charAt(0).toUpperCase();
            if (!byLetter[letter]) {
                byLetter[letter] = [];
            }
            byLetter[letter].push(t);
        });

        const letters = Object.keys(byLetter).sort();

        return `
            <div class="topic-index">
                <div class="index-letters">
                    ${letters.map(l => `<a href="#index-${l}" class="index-letter">${l}</a>`).join('')}
                </div>

                ${letters.map(letter => `
                    <div class="index-section" id="index-${letter}">
                        <h3 class="index-letter-heading">${letter}</h3>
                        <div class="index-entries">
                            ${byLetter[letter].map(topic => `
                                <div class="index-entry">
                                    <span class="index-topic">${topic.topic}</span>
                                    <span class="index-locations">
                                        ${topic.locations.map(loc => {
                                            if (typeof loc === 'string') {
                                                return loc;
                                            }
                                            return loc.page ? `p. ${loc.page}` : loc.chapter || '';
                                        }).join(', ')}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Build a reading plan
     */
    buildReadingPlan(book, options = {}) {
        const {
            daysPerWeek = 7,
            startDate = new Date(),
            pagesPerDay = 5
        } = options;

        const plan = [];
        let currentDate = new Date(startDate);
        let dayCount = 0;

        if (book.content) {
            let pageBuffer = [];
            let currentPage = 0;

            book.content.forEach(chapter => {
                const chapterPages = chapter.pageEnd - chapter.pageStart + 1;
                const startPage = chapter.pageStart;

                for (let i = 0; i < chapterPages; i++) {
                    pageBuffer.push({
                        chapter: chapter.title,
                        page: startPage + i
                    });

                    if (pageBuffer.length >= pagesPerDay) {
                        // Skip non-reading days if less than 7 days/week
                        while (dayCount % 7 >= daysPerWeek) {
                            currentDate.setDate(currentDate.getDate() + 1);
                            dayCount++;
                        }

                        plan.push({
                            date: new Date(currentDate),
                            pages: [...pageBuffer],
                            dayNumber: dayCount + 1
                        });

                        pageBuffer = [];
                        currentDate.setDate(currentDate.getDate() + 1);
                        dayCount++;
                    }
                }
            });

            // Don't forget remaining pages
            if (pageBuffer.length > 0) {
                plan.push({
                    date: new Date(currentDate),
                    pages: pageBuffer,
                    dayNumber: dayCount + 1
                });
            }
        }

        return plan;
    }
}

// Export singleton
export const indexBuilder = new IndexBuilder();
