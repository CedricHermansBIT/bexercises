#!/usr/bin/env python3
"""
Script to convert Dodona exercises to JavaScript format for the web app
"""
import os
import json
import yaml
import re

def read_file_safe(filepath):
    """Safely read a file, return empty string if file doesn't exist"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except (FileNotFoundError, UnicodeDecodeError):
        return ""

def convert_markdown_to_js_string(markdown_content):
    """Convert markdown content to a JavaScript string literal"""
    # Escape backslashes and quotes
    escaped = markdown_content.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
    return escaped

def folder_name_to_id(folder_name):
    """Convert folder name to a URL-friendly ID"""
    return re.sub(r'[^a-z0-9]+', '-', folder_name.lower()).strip('-')

def convert_exercise(exercise_dir):
    """Convert a single exercise directory to JavaScript format"""
    folder_name = os.path.basename(exercise_dir)
    exercise_id = folder_name_to_id(folder_name)

    # Read config.json
    config_path = os.path.join(exercise_dir, 'config.json')
    config = {}
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

    # Get title from config or use folder name
    title = config.get('description', {}).get('names', {}).get('en', folder_name)

    # Read description
    description_path = os.path.join(exercise_dir, 'description', 'description.en.md')
    description = read_file_safe(description_path)

    # Read solution
    solution_path = os.path.join(exercise_dir, 'solution', 'solution.en.txt')
    solution = read_file_safe(solution_path)

    # Read test cases from suite.yaml
    suite_path = os.path.join(exercise_dir, 'evaluation', 'suite.yaml')
    test_cases = []

    if os.path.exists(suite_path):
        try:
            with open(suite_path, 'r', encoding='utf-8') as f:
                suite_data = yaml.safe_load(f)

            if suite_data and isinstance(suite_data, list):
                for tab in suite_data:
                    if 'testcases' in tab:
                        for test_case in tab['testcases']:
                            # Handle stdin input for interactive exercises
                            input_lines = []
                            if 'stdin' in test_case and test_case['stdin']:
                                input_lines = test_case['stdin'].strip().split('\n')

                            test_cases.append({
                                'arguments': test_case.get('arguments', []),
                                'expectedOutput': test_case.get('stdout', ''),
                                'expectedExitCode': test_case.get('exit_code', 0),
                                'input': input_lines
                            })
        except yaml.YAMLError as e:
            print(f"Warning: Could not parse YAML for {folder_name}: {e}")

    return {
        'id': exercise_id,
        'title': title,
        'description': description,
        'solution': solution,
        'testCases': test_cases
    }

def generate_exercises_js(base_dir):
    """Generate the exercises-data.js file from all exercise directories"""
    exercises = []

    # Get all directories that contain config.json
    for item in os.listdir(base_dir):
        item_path = os.path.join(base_dir, item)
        if os.path.isdir(item_path) and os.path.exists(os.path.join(item_path, 'config.json')):
            try:
                exercise = convert_exercise(item_path)
                exercises.append(exercise)
                print(f"Converted: {exercise['title']} ({len(exercise['testCases'])} test cases)")
            except Exception as e:
                print(f"Error converting {item}: {e}")

    # Sort exercises by title
    exercises.sort(key=lambda x: x['title'])

    # Generate JavaScript file content
    js_content = "// Exercise data converted from Dodona format\nconst exercises = [\n"

    for i, exercise in enumerate(exercises):
        js_content += "    {\n"
        js_content += f'        id: "{exercise["id"]}",\n'
        js_content += f'        title: "{exercise["title"]}",\n'
        js_content += f'        description: `{convert_markdown_to_js_string(exercise["description"])}`,\n'
        js_content += f'        solution: `{convert_markdown_to_js_string(exercise["solution"])}`,\n'
        js_content += "        testCases: [\n"

        for test_case in exercise["testCases"]:
            js_content += "            {\n"
            js_content += f'                arguments: {json.dumps(test_case["arguments"])},\n'
            js_content += f'                expectedOutput: {json.dumps(test_case["expectedOutput"])},\n'
            js_content += f'                expectedExitCode: {test_case["expectedExitCode"]}'

            # Add input data if present
            if test_case.get('input'):
                js_content += f',\n                input: {json.dumps(test_case["input"])}'

            js_content += "\n            },\n"

        js_content += "        ]\n"
        js_content += "    }"

        if i < len(exercises) - 1:
            js_content += ","
        js_content += "\n"

    js_content += "];"

    # Write to file
    output_path = os.path.join(base_dir, 'exercises-data.js')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(js_content)

    print(f"\nGenerated exercises-data.js with {len(exercises)} exercises")
    return exercises

if __name__ == "__main__":
    base_directory = os.path.dirname(os.path.abspath(__file__))
    exercises = generate_exercises_js(base_directory)

    print("\nSummary:")
    for exercise in exercises:
        test_count = len(exercise['testCases'])
        has_input = any('input' in tc for tc in exercise['testCases'])
        input_note = " (with input)" if has_input else ""
        print(f"- {exercise['title']}: {test_count} test cases{input_note}")
