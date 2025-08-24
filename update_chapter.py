import re
import json

def clean_text(text, chapter_title):
    # Remove header/footer noise
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        # Remove page numbers and "ALCOHOLICS ANONYMOUS"
        line = re.sub(r'^\d+\s*ALCOHOLICS ANONYMOUS\s*$', '', line)
        line = re.sub(r'^\s*ALCOHOLICS ANONYMOUS\s*\d+\s*$', '', line)
        # Remove chapter title and page number
        line = re.sub(r'^\s*' + re.escape(chapter_title.upper()) + r'\s*\d+\s*$', '', line)
        # Remove simple page numbers
        line = re.sub(r'^\s*\d+\s*$', '', line)
        if line.strip():
            cleaned_lines.append(line)

    # Rejoin and handle paragraph breaks
    full_text = ' '.join(cleaned_lines)
    # This is a simple approach; a more sophisticated one might be needed if formatting is complex.
    # It replaces weird newlines from the PDF extraction with spaces, then splits into paragraphs.
    paragraphs = full_text.split('  ') # Assuming double space separates paragraphs

    # Further cleaning on paragraphs
    cleaned_paragraphs = []
    for p in paragraphs:
        # Join lines that were incorrectly split
        p = p.replace('-\n', '').replace('\n', ' ').strip()
        if p:
            cleaned_paragraphs.append(p)

    return cleaned_paragraphs

def update_content_file(chapter_id, new_content, filepath='data/content.js'):
    with open(filepath, 'r') as f:
        js_content = f.read()

    # This is a hacky way to work with the JS object.
    # A proper solution would use a JS parser, but for this task, string manipulation will suffice.
    # It assumes the file starts with "const siteContent = {" and ends with "};"

    # Extract the JSON-like part of the string
    json_str_match = re.search(r'const siteContent = (\{.*?\});', js_content, re.DOTALL)
    if not json_str_match:
        raise ValueError("Could not find siteContent object in the JS file.")

    json_str = json_str_match.group(1)

    # Replace single quotes with double quotes for valid JSON, being careful of escaped quotes
    json_str = re.sub(r"(?<!\\)'", '"', json_str)

    # It's still not perfect JSON because of unquoted keys. Let's fix that.
    json_str = re.sub(r'(\w+):', r'"\1":', json_str)

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        # If it fails, it's likely due to a complex structure I haven't accounted for.
        # For this specific file structure, I will proceed with more targeted regex.
        print(f"Failed to parse as JSON: {e}. Falling back to regex.")

        # This is highly specific to the current file structure and very brittle.
        # It finds the chapter by its id and replaces its content array.
        new_content_json = json.dumps(new_content, indent=16).replace('"', "'")

        pattern = re.compile(f"(id: '{chapter_id}',.*?content: \[)(.*?)(],)", re.DOTALL)

        def replacement(match):
            # We are replacing the content between the brackets
            return f"{match.group(1)}\n{new_content_json[1:-1]}\n            {match.group(3)}"

        new_js_content, count = pattern.subn(replacement, js_content)

        if count == 0:
            raise ValueError(f"Could not find chapter with id '{chapter_id}' to update.")

        with open(filepath, 'w') as f:
            f.write(new_js_content)
        return


    # Find the chapter and update it
    chapter_found = False
    for chapter in data['study']['chapters']:
        if chapter['id'] == chapter_id:
            chapter['content'] = new_content
            chapter_found = True
            break

    if not chapter_found:
        raise ValueError(f"Chapter with id '{chapter_id}' not found.")

    # Convert back to JS object string
    # This is tricky because we want to maintain the original format as much as possible.
    # A full AST parser/generator would be best, but again, overkill for this task.
    # We will just dump the whole thing back, which will change formatting.

    new_json_str = json.dumps(data, indent=4)
    # Revert to JS-style single quotes and no quotes on keys if desired, but for now, double quotes are fine for JS objects.
    new_json_str = new_json_str.replace('"', "'") # a bit simplistic, but might work for this data

    # Let's stick to the regex method as it preserves formatting better.

def main():
    chapter_id_to_update = 'bills-story'
    text_file_path = 'bills_story.txt'

    with open(text_file_path, 'r') as f:
        raw_text = f.read()

    # The title in the PDF is just "BILL'S STORY"
    cleaned_paragraphs = clean_text(raw_text, "BILL'S STORY")

    # We need to manually fix the paragraphs from the simple split
    # For now, let's just join everything and split by known paragraph breaks.
    # The PDF text extraction is messy. Let's try a different cleaning strategy.

    with open(text_file_path, 'r') as f:
        lines = f.readlines()

    # Clean headers, footers, and leading/trailing whitespace
    cleaned_lines = []
    for line in lines:
        if "ALCOHOLICS ANONYMOUS" in line or "BILL'S STORY" in re.sub(r'\d', '', line):
            continue
        cleaned_lines.append(line.strip())

    full_text = " ".join(cleaned_lines)

    # The paragraphs in the source text seem to be indented.
    # Let's assume a new paragraph starts after a sentence-ending punctuation followed by a space and an uppercase letter.
    # This is still heuristic. A better way is to find a more reliable paragraph delimiter.
    # The original PDF seems to have a larger space between paragraphs.
    # Let's try splitting by double newlines in the original text if possible, but the extraction lost that.

    # Let's just create one big block of text for now and split it manually in the code.
    # No, that's not good.
    # Let's refine the cleaning. The text has weird line breaks.

    text = raw_text.replace('-\n', '').replace('ﬁ ', 'fi').replace('ﬂ ', 'fl')
    text = re.sub(r'\s*\d+\s*ALCOHOLICS ANONYMOUS\s*', '', text)
    text = re.sub(r'\s*BILL’S STORY\s*\d+\s*', '', text)
    text = re.sub(r'Chapter 1\s*BILL’S STORY\s*', '', text, flags=re.IGNORECASE)
    text = text.strip()

    # Split into paragraphs. Paragraphs seem to be separated by a line break and then some spaces.
    # The PDF extraction is making this hard. Let's just use the text as is and split by newline, then filter.
    paragraphs = [p.strip().replace('\n', ' ') for p in text.split('\n\n') if p.strip()]

    # A final pass to merge lines that are clearly part of the same paragraph.
    final_paragraphs = []
    current_paragraph = ""
    for p in paragraphs:
        if p:
            if current_paragraph:
                current_paragraph += " " + p
            else:
                current_paragraph = p
            # Heuristic: if a line doesn't end with punctuation, it's likely continued.
            if p.endswith('.') or p.endswith('?"') or p.endswith('."') or p.endswith('!’'):
                final_paragraphs.append(current_paragraph)
                current_paragraph = ""
    if current_paragraph:
        final_paragraphs.append(current_paragraph)

    update_content_file(chapter_id_to_update, final_paragraphs)
    print(f"Successfully updated chapter '{chapter_id_to_update}' in data/content.js")


if __name__ == "__main__":
    main()
