from collections import defaultdict
import re

# Read the file with UTF-8 encoding
with open("list.txt", "r", encoding="utf-8") as file:
    lines = file.readlines()

# Process each line: Replace multiple spaces with a single comma
formatted_list = []
for line in lines:
    formatted_line = re.sub(r"\s{2,}", ",", line.strip())  # Two or more spaces → Single comma
    formatted_list.append(formatted_line)

# Create a dictionary to group software items by their first word
grouped_software = defaultdict(list)

for item in formatted_list:
    first_word = item.split(",")[0]  # Get the first word
    grouped_software[first_word].append(item)  # Append to the corresponding group

# Separate grouped and ungrouped items
filtered_groups = {key: values for key, values in grouped_software.items() if len(values) >= 4}
ungrouped_items = [item for key, values in grouped_software.items() if len(values) < 4 for item in values]

# Format output as Python dictionary with ungrouped items first
output_content = "grouped_software = {\n"

# Add ungrouped items at the top
if ungrouped_items:
    output_content += '    "Ungrouped": [\n        ' + ",\n        ".join(f'"{v}"' for v in ungrouped_items) + "\n    ],\n"

# Add grouped items
for key, values in filtered_groups.items():
    output_content += f'    "{key}": [\n        ' + ",\n        ".join(f'"{v}"' for v in values) + "\n    ],\n"

output_content += "}\n"

# Save to a new file
with open("grouped_software.py", "w", encoding="utf-8") as file:
    file.write(output_content)

print("Grouped software list (including ungrouped items) saved as 'grouped_software.py'!")