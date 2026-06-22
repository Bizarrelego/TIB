with open('src/empire/PowerManager.js', 'r') as f:
    content = f.read()

content = content.replace("/* global POWER_CLASS, PWR_GENERATE_OPS, PWR_OPERATE_FACTORY, RESOURCE_OPS, POWER_INFO, PWR_OPERATE_EXTENSION */\n", "")

with open('src/empire/PowerManager.js', 'w') as f:
    f.write(content)

with open('src/state/RoomStateScanner.js', 'r') as f:
    content = f.read()

content = content.replace("/* global STRUCTURE_INVADER_CORE */\n", "")

with open('src/state/RoomStateScanner.js', 'w') as f:
    f.write(content)
