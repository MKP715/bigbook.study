import re
import json

def parse_devotional(text):
    """
    Parses the plain text of Spurgeon's Morning and Evening devotional
    and returns a dictionary structured for the website.
    """
    readings = {}

    # Split by a long line of underscores, which separates each day's entry
    entries = re.split(r'\n\s*_{20,}\s*\n', text)

    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue

        # Each entry can contain both Morning and Evening parts.
        # Find all reading types and dates within the entry block.
        # This handles cases where morning/evening might be out of order or one is missing.

        morning_match = re.search(r'Morning,\s+([A-Za-z]+\s+\d+)', entry)
        evening_match = re.search(r'Evening,\s+([A-Za-z]+\s+\d+)', entry)

        def extract_reading_data(sub_entry, reading_type, current_date):
            if current_date not in readings:
                readings[current_date] = {}

            lines = sub_entry.split('\n')

            # Find verse and reference
            verse_start_index = -1
            for i, line in enumerate(lines):
                if line.strip().startswith('"'):
                    verse_start_index = i
                    break

            if verse_start_index != -1:
                verse_end_index = verse_start_index
                # Find the end of the quote, which may be on a later line
                while verse_end_index < len(lines) and not lines[verse_end_index].strip().endswith('"'):
                    verse_end_index += 1

                if verse_end_index < len(lines):
                    verse_lines = lines[verse_start_index:verse_end_index+1]
                    verse = ' '.join(l.strip() for l in verse_lines).strip('"')

                    reference = ""
                    text_start_index = verse_end_index + 1

                    # The next non-empty line should be the reference
                    if text_start_index < len(lines):
                        while text_start_index < len(lines) and not lines[text_start_index].strip():
                            text_start_index += 1
                        if text_start_index < len(lines) and len(lines[text_start_index].strip().split()) < 5:
                            reference = lines[text_start_index].strip()
                            text_start_index += 1

                    title = f"{verse} -- {reference}"

                    while text_start_index < len(lines) and not lines[text_start_index].strip():
                        text_start_index += 1

                    text = "\n".join(lines[text_start_index:]).strip()

                    # Clean up any leftover "[Go To...]" links
                    text = re.sub(r'\[\d+\]\s*Go To (Morning|Evening) Reading', '', text).strip()

                    readings[current_date][reading_type] = {
                        "title": title,
                        "verse": reference,
                        "text": text
                    }

        # To correctly parse, we need to split the entry if both morning and evening exist
        if morning_match and evening_match:
            morning_pos = morning_match.start()
            evening_pos = evening_match.start()

            if morning_pos < evening_pos:
                morning_part = entry[morning_pos:evening_pos]
                evening_part = entry[evening_pos:]
                extract_reading_data(morning_part, 'morning', morning_match.group(1))
                extract_reading_data(evening_part, 'evening', evening_match.group(1))
            else:
                evening_part = entry[evening_pos:morning_pos]
                morning_part = entry[morning_pos:]
                extract_reading_data(evening_part, 'evening', evening_match.group(1))
                extract_reading_data(morning_part, 'morning', morning_match.group(1))

        elif morning_match:
            extract_reading_data(entry, 'morning', morning_match.group(1))
        elif evening_match:
            extract_reading_data(entry, 'evening', evening_match.group(1))

    return readings

def main():
    try:
        with open('spurgeon_morning_and_evening.txt', 'r', encoding='utf-8') as f:
            full_text = f.read()
    except FileNotFoundError:
        print("Error: spurgeon_morning_and_evening.txt not found.")
        return

    parsed_data = parse_devotional(full_text)

    # Convert Python dict to JS object string
    js_object_string = "const dailyReadings = {\n"
    month_order = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    try:
        sorted_dates = sorted(parsed_data.keys(), key=lambda d: (month_order.index(d.split()[0]), int(d.split()[1])))
    except (ValueError, IndexError):
        print("Error sorting dates. Some dates might be malformed.")
        sorted_dates = parsed_data.keys()

    for i, date in enumerate(sorted_dates):
        parts = parsed_data.get(date, {})
        if not parts:
            continue

        js_object_string += f'  "{date}": {{\n'

        if 'morning' in parts:
            morning = parts['morning']
            js_object_string += '    "morning": {\n'
            js_object_string += f'      "title": {json.dumps(morning["title"])},\n'
            js_object_string += f'      "verse": {json.dumps(morning["verse"])},\n'
            js_object_string += f'      "text": `{morning["text"].replace("`", "\\`")}`\n'
            js_object_string += '    }'

        if 'morning' in parts and 'evening' in parts:
            js_object_string += ',\n'

        if 'evening' in parts:
            evening = parts['evening']
            js_object_string += '    "evening": {\n'
            js_object_string += f'      "title": {json.dumps(evening["title"])},\n'
            js_object_string += f'      "verse": {json.dumps(evening["verse"])},\n'
            js_object_string += f'      "text": `{evening["text"].replace("`", "\\`")}`\n'
            js_object_string += '    }'

        js_object_string += '\n  }'
        if i < len(sorted_dates) - 1:
            js_object_string += ',\n'
        else:
            js_object_string += '\n'

    js_object_string += "};\n"

    try:
        with open('new_readings.js', 'w', encoding='utf-8') as f:
            f.write(js_object_string)
        print("Successfully created new_readings.js")
    except IOError:
        print("Error writing to new_readings.js")

if __name__ == '__main__':
    main()
