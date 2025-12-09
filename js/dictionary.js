/**
 * Dictionary feature for AA Literature Study
 * Fetches definitions from Free Dictionary API and manages custom definitions
 */

import { generateId } from './db.js';

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

// In-memory cache for API responses
const apiCache = new Map();

// Custom definitions stored in IndexedDB via settings
let customDefinitions = new Map();

class Dictionary {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize dictionary - load custom definitions from storage
     */
    async initialize() {
        if (this.initialized) return;

        try {
            const stored = await this.getStoredDefinitions();
            if (stored && typeof stored === 'object') {
                customDefinitions = new Map(Object.entries(stored));
            }
            this.initialized = true;
            console.log('Dictionary initialized with', customDefinitions.size, 'custom definitions');
        } catch (error) {
            console.error('Failed to initialize dictionary:', error);
            this.initialized = true;
        }
    }

    /**
     * Get stored custom definitions from IndexedDB
     */
    async getStoredDefinitions() {
        return new Promise((resolve) => {
            const request = indexedDB.open('aa-study-db');
            request.onsuccess = () => {
                const db = request.result;
                try {
                    const transaction = db.transaction(['settings'], 'readonly');
                    const store = transaction.objectStore('settings');
                    const getReq = store.get('customDefinitions');
                    getReq.onsuccess = () => resolve(getReq.result?.value || {});
                    getReq.onerror = () => resolve({});
                } catch (e) {
                    resolve({});
                }
            };
            request.onerror = () => resolve({});
        });
    }

    /**
     * Save custom definitions to IndexedDB
     */
    async saveStoredDefinitions() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('aa-study-db');
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['settings'], 'readwrite');
                const store = transaction.objectStore('settings');
                const obj = Object.fromEntries(customDefinitions);
                const putReq = store.put({ key: 'customDefinitions', value: obj });
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Fetch definition from Free Dictionary API
     */
    async fetchFromAPI(word) {
        const normalizedWord = word.toLowerCase().trim();

        // Check cache first
        if (apiCache.has(normalizedWord)) {
            return apiCache.get(normalizedWord);
        }

        try {
            const response = await fetch(`${API_BASE}/${encodeURIComponent(normalizedWord)}`);

            if (!response.ok) {
                if (response.status === 404) {
                    return null; // Word not found
                }
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const parsed = this.parseAPIResponse(data);

            // Cache the result
            apiCache.set(normalizedWord, parsed);

            return parsed;
        } catch (error) {
            console.error('Dictionary API error:', error);
            return null;
        }
    }

    /**
     * Parse API response into a clean format
     */
    parseAPIResponse(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        const entry = data[0];
        const result = {
            word: entry.word,
            phonetic: entry.phonetic || '',
            phonetics: [],
            meanings: [],
            sourceUrls: entry.sourceUrls || []
        };

        // Extract phonetics with audio
        if (entry.phonetics && Array.isArray(entry.phonetics)) {
            result.phonetics = entry.phonetics
                .filter(p => p.text || p.audio)
                .map(p => ({
                    text: p.text || '',
                    audio: p.audio || ''
                }));
        }

        // Extract meanings
        if (entry.meanings && Array.isArray(entry.meanings)) {
            result.meanings = entry.meanings.map(meaning => ({
                partOfSpeech: meaning.partOfSpeech || '',
                definitions: (meaning.definitions || []).slice(0, 3).map(def => ({
                    definition: def.definition || '',
                    example: def.example || '',
                    synonyms: (def.synonyms || []).slice(0, 5),
                    antonyms: (def.antonyms || []).slice(0, 5)
                })),
                synonyms: (meaning.synonyms || []).slice(0, 5),
                antonyms: (meaning.antonyms || []).slice(0, 5)
            }));
        }

        return result;
    }

    /**
     * Get custom definition for a word
     */
    getCustomDefinition(word) {
        const normalizedWord = word.toLowerCase().trim();
        return customDefinitions.get(normalizedWord) || null;
    }

    /**
     * Save a custom definition
     */
    async saveCustomDefinition(word, definition, notes = '') {
        const normalizedWord = word.toLowerCase().trim();

        const entry = {
            id: generateId(),
            word: normalizedWord,
            definition: definition,
            notes: notes,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        customDefinitions.set(normalizedWord, entry);
        await this.saveStoredDefinitions();

        return entry;
    }

    /**
     * Update a custom definition
     */
    async updateCustomDefinition(word, definition, notes = '') {
        const normalizedWord = word.toLowerCase().trim();
        const existing = customDefinitions.get(normalizedWord);

        const entry = {
            id: existing?.id || generateId(),
            word: normalizedWord,
            definition: definition,
            notes: notes,
            createdAt: existing?.createdAt || Date.now(),
            updatedAt: Date.now()
        };

        customDefinitions.set(normalizedWord, entry);
        await this.saveStoredDefinitions();

        return entry;
    }

    /**
     * Delete a custom definition
     */
    async deleteCustomDefinition(word) {
        const normalizedWord = word.toLowerCase().trim();
        customDefinitions.delete(normalizedWord);
        await this.saveStoredDefinitions();
    }

    /**
     * Get all custom definitions
     */
    getAllCustomDefinitions() {
        return Array.from(customDefinitions.values());
    }

    /**
     * Look up a word - returns both API and custom definitions
     */
    async lookup(word) {
        await this.initialize();

        const normalizedWord = word.toLowerCase().trim();

        // Get both API and custom definitions in parallel
        const [apiResult, customResult] = await Promise.all([
            this.fetchFromAPI(normalizedWord),
            Promise.resolve(this.getCustomDefinition(normalizedWord))
        ]);

        return {
            word: normalizedWord,
            api: apiResult,
            custom: customResult,
            hasResults: !!(apiResult || customResult)
        };
    }

    /**
     * Play pronunciation audio
     */
    playAudio(audioUrl) {
        if (!audioUrl) return;

        const audio = new Audio(audioUrl);
        audio.play().catch(err => console.error('Audio playback failed:', err));
    }
}

// Export singleton
export const dictionary = new Dictionary();
