/**
 * IndexedDB wrapper for AA Literature Study
 * Handles all local storage for annotations, cross-references, and settings
 */

const DB_NAME = 'aa-study-db';
const DB_VERSION = 1;

let db = null;

/**
 * Initialize the database
 */
export async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('Database opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Annotations store
            if (!database.objectStoreNames.contains('annotations')) {
                const annotationStore = database.createObjectStore('annotations', { keyPath: 'id' });
                annotationStore.createIndex('bookId', 'bookId', { unique: false });
                annotationStore.createIndex('paragraphId', 'paragraphId', { unique: false });
                annotationStore.createIndex('type', 'type', { unique: false });
                annotationStore.createIndex('bookParagraph', ['bookId', 'paragraphId'], { unique: false });
                annotationStore.createIndex('createdAt', 'createdAt', { unique: false });
            }

            // Cross-references store
            if (!database.objectStoreNames.contains('crossReferences')) {
                const crossRefStore = database.createObjectStore('crossReferences', { keyPath: 'id' });
                crossRefStore.createIndex('sourceBookId', 'sourceBookId', { unique: false });
                crossRefStore.createIndex('sourceParagraphId', 'sourceParagraphId', { unique: false });
                crossRefStore.createIndex('targetBookId', 'targetBookId', { unique: false });
                crossRefStore.createIndex('targetParagraphId', 'targetParagraphId', { unique: false });
            }

            // User settings store
            if (!database.objectStoreNames.contains('settings')) {
                database.createObjectStore('settings', { keyPath: 'key' });
            }

            // Search index cache
            if (!database.objectStoreNames.contains('searchIndex')) {
                database.createObjectStore('searchIndex', { keyPath: 'bookId' });
            }

            // Reading progress
            if (!database.objectStoreNames.contains('readingProgress')) {
                const progressStore = database.createObjectStore('readingProgress', { keyPath: 'bookId' });
                progressStore.createIndex('lastRead', 'lastRead', { unique: false });
            }

            console.log('Database schema created/updated');
        };
    });
}

/**
 * Generate a UUID
 */
export function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============ Annotations ============

/**
 * Add an annotation
 */
export async function addAnnotation(annotation) {
    const record = {
        id: generateId(),
        ...annotation,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['annotations'], 'readwrite');
        const store = transaction.objectStore('annotations');
        const request = store.add(record);

        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Update an annotation
 */
export async function updateAnnotation(id, updates) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['annotations'], 'readwrite');
        const store = transaction.objectStore('annotations');
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const record = getRequest.result;
            if (!record) {
                reject(new Error('Annotation not found'));
                return;
            }

            const updated = {
                ...record,
                ...updates,
                updatedAt: Date.now()
            };

            const putRequest = store.put(updated);
            putRequest.onsuccess = () => resolve(updated);
            putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
}

/**
 * Delete an annotation
 */
export async function deleteAnnotation(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['annotations'], 'readwrite');
        const store = transaction.objectStore('annotations');
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all annotations for a book
 */
export async function getAnnotationsByBook(bookId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['annotations'], 'readonly');
        const store = transaction.objectStore('annotations');
        const index = store.index('bookId');
        const request = index.getAll(bookId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get annotations for a specific paragraph
 */
export async function getAnnotationsByParagraph(bookId, paragraphId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['annotations'], 'readonly');
        const store = transaction.objectStore('annotations');
        const index = store.index('bookParagraph');
        const request = index.getAll([bookId, paragraphId]);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all annotations
 */
export async function getAllAnnotations() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['annotations'], 'readonly');
        const store = transaction.objectStore('annotations');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get annotations by type
 */
export async function getAnnotationsByType(type) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['annotations'], 'readonly');
        const store = transaction.objectStore('annotations');
        const index = store.index('type');
        const request = index.getAll(type);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ============ Cross References ============

/**
 * Add a cross-reference
 */
export async function addCrossReference(crossRef) {
    const record = {
        id: generateId(),
        ...crossRef,
        createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['crossReferences'], 'readwrite');
        const store = transaction.objectStore('crossReferences');
        const request = store.add(record);

        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete a cross-reference
 */
export async function deleteCrossReference(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['crossReferences'], 'readwrite');
        const store = transaction.objectStore('crossReferences');
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get cross-references from a paragraph
 */
export async function getCrossReferencesFrom(bookId, paragraphId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['crossReferences'], 'readonly');
        const store = transaction.objectStore('crossReferences');
        const results = [];

        store.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (cursor.value.sourceBookId === bookId &&
                    cursor.value.sourceParagraphId === paragraphId) {
                    results.push(cursor.value);
                }
                cursor.continue();
            } else {
                resolve(results);
            }
        };
    });
}

/**
 * Get cross-references to a paragraph
 */
export async function getCrossReferencesTo(bookId, paragraphId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['crossReferences'], 'readonly');
        const store = transaction.objectStore('crossReferences');
        const results = [];

        store.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (cursor.value.targetBookId === bookId &&
                    cursor.value.targetParagraphId === paragraphId) {
                    results.push(cursor.value);
                }
                cursor.continue();
            } else {
                resolve(results);
            }
        };
    });
}

/**
 * Get all cross-references
 */
export async function getAllCrossReferences() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['crossReferences'], 'readonly');
        const store = transaction.objectStore('crossReferences');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ============ Settings ============

/**
 * Get a setting
 */
export async function getSetting(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result ? request.result.value : defaultValue);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Set a setting
 */
export async function setSetting(key, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        const request = store.put({ key, value });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all settings
 */
export async function getAllSettings() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const request = store.getAll();

        request.onsuccess = () => {
            const settings = {};
            request.result.forEach(item => {
                settings[item.key] = item.value;
            });
            resolve(settings);
        };
        request.onerror = () => reject(request.error);
    });
}

// ============ Reading Progress ============

/**
 * Save reading progress
 */
export async function saveReadingProgress(bookId, progress) {
    const record = {
        bookId,
        ...progress,
        lastRead: Date.now()
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['readingProgress'], 'readwrite');
        const store = transaction.objectStore('readingProgress');
        const request = store.put(record);

        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get reading progress for a book
 */
export async function getReadingProgress(bookId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['readingProgress'], 'readonly');
        const store = transaction.objectStore('readingProgress');
        const request = store.get(bookId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get recent reading activity
 */
export async function getRecentReading(limit = 5) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['readingProgress'], 'readonly');
        const store = transaction.objectStore('readingProgress');
        const index = store.index('lastRead');
        const results = [];

        index.openCursor(null, 'prev').onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && results.length < limit) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
    });
}

// ============ Search Index ============

/**
 * Save search index for a book
 */
export async function saveSearchIndex(bookId, index) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['searchIndex'], 'readwrite');
        const store = transaction.objectStore('searchIndex');
        const request = store.put({ bookId, index, updatedAt: Date.now() });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get search index for a book
 */
export async function getSearchIndex(bookId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['searchIndex'], 'readonly');
        const store = transaction.objectStore('searchIndex');
        const request = store.get(bookId);

        request.onsuccess = () => resolve(request.result?.index);
        request.onerror = () => reject(request.error);
    });
}

// ============ Export/Import ============

/**
 * Export all user data
 */
export async function exportData() {
    const annotations = await getAllAnnotations();
    const crossReferences = await getAllCrossReferences();
    const settings = await getAllSettings();

    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        annotations,
        crossReferences,
        settings
    };
}

/**
 * Import user data
 */
export async function importData(data) {
    if (!data || data.version !== 1) {
        throw new Error('Invalid import data format');
    }

    // Clear existing data
    const clearStore = (storeName) => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    };

    await clearStore('annotations');
    await clearStore('crossReferences');
    await clearStore('settings');

    // Import annotations
    for (const annotation of data.annotations) {
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(['annotations'], 'readwrite');
            const store = transaction.objectStore('annotations');
            const request = store.add(annotation);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Import cross-references
    for (const crossRef of data.crossReferences) {
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(['crossReferences'], 'readwrite');
            const store = transaction.objectStore('crossReferences');
            const request = store.add(crossRef);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Import settings
    for (const [key, value] of Object.entries(data.settings)) {
        await setSetting(key, value);
    }

    return true;
}

// ============ Bookmarks ============

/**
 * Get all bookmarks
 */
export async function getBookmarks() {
    return await getSetting('bookmarks', []);
}

/**
 * Add a bookmark
 */
export async function addBookmark(bookmark) {
    const bookmarks = await getBookmarks();
    const newBookmark = {
        id: generateId(),
        ...bookmark,
        createdAt: Date.now()
    };
    bookmarks.push(newBookmark);
    await setSetting('bookmarks', bookmarks);
    return newBookmark;
}

/**
 * Remove a bookmark
 */
export async function removeBookmark(bookmarkId) {
    const bookmarks = await getBookmarks();
    const filtered = bookmarks.filter(b => b.id !== bookmarkId);
    await setSetting('bookmarks', filtered);
    return filtered;
}

/**
 * Check if paragraph is bookmarked
 */
export async function isBookmarked(bookId, chapterId) {
    const bookmarks = await getBookmarks();
    return bookmarks.find(b => b.bookId === bookId && b.chapterId === chapterId);
}
