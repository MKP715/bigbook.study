import json
from datetime import datetime
import re

def transform_readings():
    """
    Reads the content of new_readings.js, transforms the dailyReadings object
    to the format expected by the application, and writes it to a new file.
    """
    with open('new_readings.js', 'r', encoding='utf-8') as f:
        js_content = f.read()

    # This is a crude way to convert the JS object to a JSON string,
    # but it works for this specific file structure.
    # It removes the variable declaration and handles the backticked template literals.
    json_str = (js_content
                .replace('const dailyReadings = ', '', 1)
                .strip()
                .rstrip(';'))

    # Use a more robust regex to handle replacement of backticks
    # This finds `...` and replaces the outer backticks with double quotes,
    # while escaping inner double quotes and newlines.
    def repl(m):
        inner_content = m.group(1)
        escaped_content = inner_content.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
        return '"' + escaped_content + '"'

    json_str_fixed = re.sub(r'`([\s\S]*?)`', repl, json_str)

    try:
        data = json.loads(json_str_fixed)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        # Find the problematic part of the string
        line = json_str_fixed.splitlines()[e.lineno - 1]
        print(f"Problematic line: {line}")
        # Print context around the error
        context_start = max(0, e.pos - 40)
        context_end = min(len(json_str_fixed), e.pos + 40)
        print(f"Context: ...{json_str_fixed[context_start:context_end]}...")
        return

    transformed_data = {}
    for date_str, readings in data.items():
        # Convert date format from "Month Day" to "MM-DD"
        try:
            # Handle the special case of a leap day
            if "February 29" in date_str:
                month_day = "02-29"
            else:
                dt_obj = datetime.strptime(date_str, '%B %d')
                month_day = dt_obj.strftime('%m-%d')
        except ValueError:
            print(f"Could not parse date: {date_str}")
            continue

        # Combine morning and evening readings
        morning = readings.get('morning', {})
        evening = readings.get('evening', {})

        # Create a combined source and text
        source_parts = []
        text_parts = []
        if morning:
            source_parts.append(f'{morning.get("title", "")} {morning.get("verse", "")}')
            text_parts.append(f'Morning:\n{morning.get("text", "")}')
        if evening:
            source_parts.append(f'{evening.get("title", "")} {evening.get("verse", "")}')
            text_parts.append(f'Evening:\n{evening.get("text", "")}')

        source = ' & '.join(source_parts)
        text = '\n\n'.join(text_parts)


        transformed_data[month_day] = {
            "source": source.strip(),
            "text": text.strip()
        }

    # Write the transformed data to a new JS file
    output_js = 'const dailyReadings = ' + json.dumps(transformed_data, indent=4) + ';'
    # The line that caused the error was here. It has been removed.

    with open('transformed_readings.js', 'w', encoding='utf-8') as f:
        f.write(output_js)

    print("Transformed readings saved to transformed_readings.js")


if __name__ == '__main__':
    transform_readings()
