with open('src/managers/TrafficManager.js', 'r') as f:
    content = f.read()

content = content.replace(
    'baseMatrix = PathFinder.CostMatrix.deserialize(cached.matrix);',
    'baseMatrix = cached.matrix;'
)

content = content.replace(
    'matrix: baseMatrix.serialize(),',
    'matrix: baseMatrix,'
)

with open('src/managers/TrafficManager.js', 'w') as f:
    f.write(content)
