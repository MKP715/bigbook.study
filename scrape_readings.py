import requests
from bs4 import BeautifulSoup
import re
import json
import argparse

def get_reading(day_of_year):
    # The URL for the morning devotional for a given day of the year
    url = f"https://www.blueletterbible.org/devotionals/me/view.cfm?doy={day_of_year}&Time=am"
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None

    soup = BeautifulSoup(response.content, 'html.parser')

    devotional_content = soup.find('div', class_='devotional-content')
    if not devotional_content:
        print(f"Could not find devotional content for day {day_of_year}")
        return None

    date_str_tag = devotional_content.find('h3')
    if not date_str_tag:
        # Fallback for Feb 29 which might have a different structure
        date_str_tag = soup.find('h2', class_='toolsSubhead')
        if not date_str_tag:
             print(f"Could not find date for day {day_of_year}")
             return None

    date_str = date_str_tag.text.strip()

    try:
        # Attempt to parse dates like "January 1"
        match = re.search(r'(\w+)\s+(\d+)', date_str)
        month_name = match.group(1)
        day = int(match.group(2))

        month_map = {
            'January': '01', 'February': '02', 'March': '03', 'April': '04',
            'May': '05', 'June': '06', 'July': '07', 'August': '08',
            'September': '09', 'October': '10', 'November': '11', 'December': '12'
        }
        month = month_map[month_name]
        date_key = f"{month}-{day:02d}"
    except (AttributeError, KeyError):
        # Handle leap day case specifically
        if "February 29" in date_str:
            date_key = "02-29"
        else:
            print(f"Could not parse date '{date_str}' for day {day_of_year}")
            return None

    # The source is in a <strong> tag within a <h4>
    source_tag = devotional_content.find('h4')
    if not source_tag or not source_tag.find('strong'):
        print(f"Could not find source for {date_key}")
        return None
    source_text = source_tag.find('strong').text.strip()

    # The main text is in the <p> tag immediately following the <h4>
    text_tag = source_tag.find_next_sibling('p')
    if not text_tag:
        # Sometimes there can be other tags in between
        text_tag = source_tag.find_next('p')

    if not text_tag:
        print(f"Could not find text for {date_key}")
        return None

    # Join paragraphs, preserving line breaks within them
    main_text = '\n'.join(p.strip() for p in text_tag.get_text(separator='\n').split('\n') if p.strip())


    return {
        "date": date_key,
        "source": source_text,
        "text": main_text
    }

def main(start_day, end_day, output_file):
    all_readings = {}
    for doy in range(start_day, end_day + 1):
        print(f"Fetching reading for day {doy}...")
        reading = get_reading(doy)
        if reading:
            all_readings[reading['date']] = {
                'source': reading['source'],
                'text': reading['text']
            }
        else:
            print(f"Skipping day {doy}")

    # Append to the output file
    with open(output_file, 'a', encoding='utf-8') as f:
        sorted_keys = sorted(all_readings.keys())
        for key in sorted_keys:
            reading = all_readings[key]
            # Escape backticks, single quotes, backslashes, and newlines
            source = reading['source'].replace('\\', '\\\\').replace('`', '\\`').replace("'", "\\'")
            text = reading['text'].replace('\\', '\\\\').replace('`', '\\`').replace("'", "\\'").replace('\n', '\\n')

            f.write(f"'{key}': {{ source: `{source}`, text: `{text}` }},\n")

    print(f"Successfully processed days {start_day}-{end_day} into {output_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape daily devotionals.")
    parser.add_argument("--start", type=int, required=True, help="Start day of the year.")
    parser.add_argument("--end", type=int, required=True, help="End day of the year.")
    parser.add_argument("--output", type=str, default="readings_part.js", help="Output file.")
    args = parser.parse_args()

    main(args.start, args.end, args.output)
