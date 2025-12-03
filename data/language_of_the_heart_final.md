# The Language of the Heart - JSON Schema Documentation

## Overview

This JSON file contains a fully normalized extraction of "The Language of the Heart" by Bill W., capturing all content and formatting for proper frontend rendering as a digital book.

## File Statistics

- **Total Articles**: 105
- **Total Paragraphs**: 1,938
- **Index Entries**: 106
- **Date Range**: 1944-1970

---

## Schema Structure

### Top-Level Properties

```json
{
  "$schema": "language_of_the_heart_v1.0",
  "schema_version": "1.0.0",
  "extraction_timestamp": "ISO-8601 timestamp",
  "source_file": "original filename",
  "metadata": {...},
  "permissions": [...],
  "front_matter": {...},
  "table_of_contents": {...},
  "structure": {...},
  "articles": [...],
  "lookup": {...},
  "index": {...},
  "media": {...},
  "rendering": {...}
}
```

---

## Key Sections

### 1. Metadata

Contains book information for display:

```json
{
  "title": "The Language of the Heart",
  "subtitle": "Bill W.'s Grapevine Writings",
  "author": {
    "pen_name": "Bill W.",
    "full_name": "William Griffith Wilson",
    "role": "Cofounder of Alcoholics Anonymous"
  },
  "publisher": {...},
  "publication": {
    "year": 1988,
    "isbn": "978-0-933685-91-8"
  }
}
```

### 2. Table of Contents

Hierarchical structure for navigation:

```json
{
  "page": "v",
  "sections": [
    {
      "title": "PART ONE: 1944-1950",
      "page": 1,
      "type": "part",
      "segments": [
        {
          "title": "Segment 1: The Shaping of the Traditions",
          "articles": [
            {
              "title": "Modesty One Plank for Good Public Relations",
              "date": "August 1945",
              "page": 3,
              "article_id": "article_001"  // Links to full article
            }
          ]
        }
      ]
    }
  ]
}
```

### 3. Articles Array

Each article contains:

```json
{
  "id": "article_001",
  "title": "Modesty One Plank for Good Public Relations",
  "publication_date": "August 1945",
  "page_number": null,
  "paragraphs": [
    {
      "type": "paragraph|blockquote",
      "elements": [
        {"type": "text", "content": "Regular text..."},
        {"type": "bold", "content": "Bold text"},
        {"type": "italic", "content": "Italic text"},
        {"type": "underline", "content": "Underlined text"}
      ]
    }
  ]
}
```

### 4. Index

Alphabetized index entries with page references:

```json
{
  "page_start": 397,
  "entry_count": 106,
  "entries": [
    {
      "term": "Alcoholics Anonymous",
      "pages": [
        {"type": "single", "page": 9},
        {"type": "range", "start": 20, "end": 21}
      ],
      "subentries": [
        {"term": "Big Book", "pages": [...]}
      ]
    }
  ]
}
```

---

## Frontend Rendering Guide

### Paragraph Types

| Type | Rendering Suggestion |
|------|---------------------|
| `paragraph` | Normal body text |
| `blockquote` | Indented, possibly different background |
| `salutation` | Opening greeting (e.g., "Dear Friends,") |
| `closing` | Sign-off text (e.g., "Gratefully,") |

### Inline Formatting Elements

| Type | HTML Equivalent |
|------|-----------------|
| `text` | Plain text, no wrapper needed |
| `bold` | `<strong>` or `<b>` |
| `italic` | `<em>` or `<i>` |
| `underline` | `<u>` or CSS `text-decoration: underline` |

### Example React Component

```jsx
function Paragraph({ paragraph }) {
  return (
    <p className={paragraph.type === 'blockquote' ? 'blockquote' : ''}>
      {paragraph.elements.map((el, i) => {
        switch (el.type) {
          case 'bold':
            return <strong key={i}>{el.content}</strong>;
          case 'italic':
            return <em key={i}>{el.content}</em>;
          case 'underline':
            return <u key={i}>{el.content}</u>;
          default:
            return <span key={i}>{el.content}</span>;
        }
      })}
    </p>
  );
}

function Article({ article }) {
  return (
    <article>
      <h1>{article.title}</h1>
      {article.publication_date && (
        <p className="date"><em>{article.publication_date}</em></p>
      )}
      {article.paragraphs.map((para, i) => (
        <Paragraph key={i} paragraph={para} />
      ))}
    </article>
  );
}
```

---

## Lookup Tables

For quick article retrieval:

```json
{
  "lookup": {
    "by_title": {
      "modesty one plank for good public relations": "article_001"
    },
    "by_date": {
      "August 1945": ["article_001"],
      "September 1945": ["article_002"]
    }
  }
}
```

---

## Media Files

Referenced images (extract from original DOCX):

| ID | Filename | Purpose |
|----|----------|---------|
| `cover_image` | image1.jpg | Book cover |
| `cover_alt` | image2.jpeg | Alternate cover |
| `signature_lois` | image3.png | Lois W. signature |

---

## Book Structure Summary

```
THE LANGUAGE OF THE HEART
├── Front Matter
│   ├── Cover (image1.jpg)
│   ├── Title Page
│   ├── Copyright
│   ├── Table of Contents (page v)
│   ├── Foreword by Lois W. (page xi)
│   └── Introduction (page xiii)
├── PART ONE: 1944-1950 (pages 1-113)
│   ├── Segment 1: The Shaping of the Traditions (32 articles)
│   └── Segment 2: Additional Writings (6 articles)
├── PART TWO: 1950-1958 (pages 115-231)
│   ├── Segment 1: AA Grows to Maturity (14 articles)
│   ├── Segment 2: Let's Be Friendly with Our Friends (5 articles)
│   └── Segment 3: Additional Writings (9 articles)
├── PART THREE: 1958-1970 (pages 233-351)
│   ├── Segment 1: In All Our Affairs (13 articles)
│   ├── Segment 2: Looking Toward the Future (14 articles)
│   └── Segment 3: Additional Writings (5 articles)
├── Memorial Articles (pages 353-381) - 10 articles
├── Articles About Grapevine (pages 383-396) - 7 articles
└── Index (page 397+)
```

---

## Notes

1. **Page Numbers**: Page numbers in the TOC refer to the original print edition. The `page_number` field in articles is `null` as exact page breaks weren't extracted from the PDF-converted document.

2. **Dates**: Publication dates are in "Month Year" format (e.g., "August 1945").

3. **Article IDs**: Format is `article_XXX` where XXX is a zero-padded sequential number.

4. **Paragraph Separation**: Paragraphs were separated based on double-space patterns after sentence endings.
