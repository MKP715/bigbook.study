import re

# Read the content of the main file
with open('data/content.js', 'r') as f:
    content_js = f.read()

# Read the content of the new readings file
with open('transformed_readings.js', 'r') as f:
    new_readings_js = f.read()

# Extract the dailyReadings object from new_readings.js
# It starts with 'const dailyReadings = {' and ends with '};'
match = re.search(r'const dailyReadings = (\{.*\});', new_readings_js, re.DOTALL)
if not match:
    print("Could not find dailyReadings object in transformed_readings.js")
    exit(1)

# This is the string representation of the new object, e.g., "{ '01-01': ... }"
new_readings_object_content = match.group(1)

# In content_js, replace the old dailyReadings object with the new one.
# The pattern looks for `dailyReadings:` followed by a javascript object.
# This regex is designed to find the dailyReadings object and replace its contents.
# It looks for `dailyReadings:` followed by an opening brace `{` and matches everything
# until the corresponding closing brace `}`. This is complex with regex, so we'll
# find the start and then programmatically find the balanced braces.

start_index = content_js.find('dailyReadings:')
if start_index == -1:
    print("Could not find 'dailyReadings:' in data/content.js")
    exit(1)

# Find the opening brace after 'dailyReadings:'
open_brace_index = content_js.find('{', start_index)
if open_brace_index == -1:
    print("Could not find opening brace for dailyReadings object.")
    exit(1)

# Find the matching closing brace for the dailyReadings object
brace_count = 0
end_index = -1
for i in range(open_brace_index, len(content_js)):
    if content_js[i] == '{':
        brace_count += 1
    elif content_js[i] == '}':
        brace_count -= 1
        if brace_count == 0:
            end_index = i + 1
            break

if end_index == -1:
    print("Could not find the end of the dailyReadings object in data/content.js")
    exit(1)

# Construct the new content
# We take the part of the file before `dailyReadings:`, add the new object,
# and then add the part of the file that came after the old object.
new_daily_readings_str = "dailyReadings:" + new_readings_object_content
final_content = content_js[:start_index] + new_daily_readings_str + content_js[end_index:]


# Write the new content back to data/content.js
with open('data/content.js', 'w') as f:
    f.write(final_content)

print("data/content.js has been updated successfully.")
