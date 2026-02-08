#!/usr/bin/env python3
"""Script to update hardcoded route prefixes to use constants from app.api.routes.

Run this once to migrate all route files to use centralized constants.
"""

import re
from pathlib import Path

# Mapping of hardcoded prefixes to constant names
REPLACEMENTS = {
    'prefix="/onboarding"': 'prefix=ONBOARDING_PREFIX',
    'prefix="/course-map"': 'prefix=COURSE_MAP_PREFIX',
    'prefix="/node-content"': 'prefix=NODE_CONTENT_PREFIX',
    'prefix="/node-progress"': 'prefix=NODE_PROGRESS_PREFIX',
    'prefix="/quiz"': 'prefix=QUIZ_PREFIX',
    'prefix="/learning"': 'prefix=LEARNING_PREFIX',
    'prefix="/game"': 'prefix=GAME_PREFIX',
    'prefix="/shop"': 'prefix=SHOP_PREFIX',
    'prefix="/inventory"': 'prefix=INVENTORY_PREFIX',
    'prefix="/invite"': 'prefix=INVITE_PREFIX',
    'prefix="/discovery"': 'prefix=DISCOVERY_PREFIX',
}

# Mapping of files to required imports
IMPORTS = {
    'onboarding.py': 'from app.api.routes import ONBOARDING_PREFIX',
    'course_map.py': 'from app.api.routes import COURSE_MAP_PREFIX',
    'node_content.py': 'from app.api.routes import NODE_CONTENT_PREFIX',
    'node_progress.py': 'from app.api.routes import NODE_PROGRESS_PREFIX',
    'quiz.py': 'from app.api.routes import QUIZ_PREFIX',
    'learning_session.py': 'from app.api.routes import LEARNING_PREFIX',
    'game.py': 'from app.api.routes import GAME_PREFIX',
    'shop.py': 'from app.api.routes import SHOP_PREFIX',
    'inventory.py': 'from app.api.routes import INVENTORY_PREFIX',
    'invite.py': 'from app.api.routes import INVITE_PREFIX',
    'discovery.py': 'from app.api.routes import DISCOVERY_PREFIX',
}


def update_file(file_path: Path) -> bool:
    """Update a single file with constant imports and replacements.
    
    Returns True if file was modified, False otherwise.
    """
    content = file_path.read_text()
    original_content = content
    
    # Add import if needed
    filename = file_path.name
    if filename in IMPORTS:
        import_line = IMPORTS[filename]
        
        # Check if import already exists
        if import_line not in content:
            # Find the last import line
            import_pattern = r'^from .+ import .+$'
            matches = list(re.finditer(import_pattern, content, re.MULTILINE))
            
            if matches:
                # Insert after the last import
                last_import = matches[-1]
                insert_pos = last_import.end()
                content = content[:insert_pos] + '\n' + import_line + content[insert_pos:]
    
    # Replace hardcoded prefixes with constants
    for old, new in REPLACEMENTS.items():
        content = content.replace(old, new)
    
    # Write back if changed
    if content != original_content:
        file_path.write_text(content)
        print(f"✅ Updated: {file_path.relative_to(Path.cwd())}")
        return True
    else:
        print(f"⏭️  Skipped: {file_path.relative_to(Path.cwd())} (no changes)")
        return False


def main():
    """Update all route files in app/api/v1/."""
    api_dir = Path(__file__).parent.parent / "app" / "api" / "v1"
    
    if not api_dir.exists():
        print(f"❌ Error: Directory not found: {api_dir}")
        return
    
    updated_count = 0
    
    # Process all Python files except __init__.py and health.py
    for file_path in sorted(api_dir.glob("*.py")):
        if file_path.name in ["__init__.py", "health.py", "profile.py"]:
            continue  # Skip already updated or special files
        
        if update_file(file_path):
            updated_count += 1
    
    print(f"\n🎉 Migration complete! Updated {updated_count} files.")


if __name__ == "__main__":
    main()
