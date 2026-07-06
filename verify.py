import sys

with open('src/managers/TaskAssignmentManager.js', 'r', encoding='utf-8') as f:
    content = f.read()

if "Game.creeps" in content:
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if "Game.creeps" in line:
            print(f"Line {i+1}: {line}")
