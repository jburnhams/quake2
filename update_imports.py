import os
import re
import sys

MAPPINGS = {
    # game/helpers
    'createTestContext': 'game/helpers',
    'createSpawnTestContext': 'game/helpers',
    'createCombatTestContext': 'game/helpers',
    'createPhysicsTestContext': 'game/helpers',
    'createEntity': 'game/helpers',
    'spawnEntity': 'game/helpers',
    'createGameImportsAndEngine': 'game/helpers',
    'createMockGameExports': 'game/helpers',
    'TestContext': 'game/helpers',
    'createMockGame': 'game/helpers',

    # game/factories
    'createPlayerEntityFactory': 'game/factories',
    'createMonsterEntityFactory': 'game/factories',
    'createItemEntityFactory': 'game/factories',
    'createWeaponEntityFactory': 'game/factories',

    # shared/bsp
    'makeBrushFromMinsMaxs': 'shared/bsp',
    'makeLeafModel': 'shared/bsp',
    'makePlane': 'shared/bsp',
    'makeNode': 'shared/bsp',
    'makeLeaf': 'shared/bsp',
    'makeBspModel': 'shared/bsp',
    'makeAxisBrush': 'shared/bsp',
    'createTestBspMap': 'shared/bsp',

    # shared/collision
    'createTraceMock': 'shared/collision',

    # game/mocks/ai
    'createMockAI': 'game/mocks/ai',

    # game/mocks/combat
    'createMockCombat': 'game/mocks/combat',
}

IMPORT_REGEX = re.compile(r"import\s+\{\s*([^}]+)\s*\}\s+from\s+'@quake2ts/test-utils';")

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    if '@quake2ts/test-utils' not in content:
        return False

    new_lines = []
    modified = False

    for line in content.splitlines():
        match = IMPORT_REGEX.match(line)
        if match:
            imports_str = match.group(1)
            imports = [i.strip() for i in imports_str.split(',') if i.strip()]
            buckets = {}

            for imp in imports:
                key = imp.split(' as ')[0]
                module = MAPPINGS.get(key)
                if not module:
                    print(f"Warning: Unknown symbol '{key}' in {filepath}")
                    module = 'root'

                if module not in buckets:
                    buckets[module] = []
                buckets[module].append(imp)

            for module, imps in buckets.items():
                if module == 'root':
                    src = '@quake2ts/test-utils'
                else:
                    src = f'@quake2ts/test-utils/{module}'
                new_lines.append(f"import {{ {', '.join(imps)} }} from '{src}';")

            modified = True
        else:
            if "'@quake2ts/test-utils';" in line and not match:
                 print(f"Skipping potential multiline import in {filepath}")
                 new_lines.append(line)
            else:
                 new_lines.append(line)

    if modified:
        with open(filepath, 'w') as f:
            f.write('\n'.join(new_lines) + '\n')
        print(f"Updated {filepath}")
        return True
    return False

def main():
    start_dir = 'quake2ts/packages/game/tests/entities/monsters'
    limit = 10
    count = 0

    for root, dirs, files in os.walk(start_dir):
        for file in files:
            if file.endswith('.ts'):
                if process_file(os.path.join(root, file)):
                    count += 1
                    if count >= limit:
                        print(f"Reached limit of {limit} files. Stopping.")
                        return

if __name__ == '__main__':
    main()
