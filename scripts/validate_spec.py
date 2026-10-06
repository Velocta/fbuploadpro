#!/usr/bin/env python3
"""
Spec Validator Script for Spec-Driven Development (SDD)
Validates frontmatter, mandatory sections, and formatting of all specs in `specs/`.
"""

import os
import re
import sys
from pathlib import Path

REQUIRED_FRONTMATTER_FIELDS = {
    "id": r"^SPEC-\d{4}$",
    "title": r".+",
    "status": r"^(draft|in-review|approved|in-implementation|completed|deprecated)$",
    "type": r"^(architecture|api|feature|refactor|standard|workflow)$",
    "ai_readiness": r"^(not-ready|drafting|ready|executing|verified)$",
}

MANDATORY_HEADINGS = [
    "Problem Statement",
    "Scope",
    "Acceptance Criteria",
    "Verification",
]


def strip_yaml_comment(val: str) -> str:
    """Safely strip inline YAML comments without corrupting quoted strings."""
    val = val.strip()
    if not val or val.startswith("#"):
        return ""
    # If quoted string: "..." or '...'
    if (val.startswith('"') and '"' in val[1:]) or (val.startswith("'") and "'" in val[1:]):
        quote_char = val[0]
        end_quote_idx = val.rfind(quote_char)
        if end_quote_idx > 0:
            after_quote = val[end_quote_idx + 1:].strip()
            if after_quote.startswith("#") or " #" in after_quote:
                return val[:end_quote_idx + 1]
            return val
    # Unquoted: look for ' #'
    if " #" in val:
        val = val.split(" #", 1)[0].strip()
    elif val.startswith("#"):
        val = ""
    return val


def parse_frontmatter(content: str):
    """Robust parser for YAML frontmatter without external dependencies."""
    content = content.lstrip("\ufeff")
    if not content.startswith("---"):
        return None, "File does not start with '---' frontmatter delimiter."

    parts = content.split("---", 2)
    if len(parts) < 3:
        return None, "Frontmatter not properly closed with '---'."

    raw_yaml = parts[1]
    body = parts[2]
    data = {}
    current_key = None

    for line in raw_yaml.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Check for list items under current_key (e.g. - "@user")
        if stripped.startswith("- ") and current_key:
            item_raw = stripped[2:].strip()
            item_val = strip_yaml_comment(item_raw).strip('"').strip("'")
            if not isinstance(data.get(current_key), list):
                data[current_key] = []
            data[current_key].append(item_val)
            continue

        if ":" in line:
            key, val = line.split(":", 1)
            key = key.strip()
            val = strip_yaml_comment(val)

            # Check for inline list [item1, item2]
            if val.startswith("[") and val.endswith("]"):
                items = [x.strip().strip('"').strip("'") for x in val[1:-1].split(",") if x.strip()]
                data[key] = items
                current_key = key
            elif not val:
                data[key] = ""
                current_key = key
            else:
                data[key] = val.strip().strip('"').strip("'")
                current_key = key

    return data, body


def validate_spec_file(filepath: Path) -> list[str]:
    errors = []
    try:
        content = filepath.read_text(encoding="utf-8")
    except Exception as e:
        return [f"Failed to read file: {e}"]

    # 1. Parse frontmatter
    data, body_or_err = parse_frontmatter(content)
    if data is None:
        errors.append(f"Frontmatter Error: {body_or_err}")
        return errors

    body = body_or_err

    # 2. Validate required frontmatter keys & patterns
    for field, pattern in REQUIRED_FRONTMATTER_FIELDS.items():
        if field not in data or data[field] == "" or data[field] == []:
            errors.append(f"Missing required frontmatter field: '{field}'")
        else:
            val = data[field]
            if not isinstance(val, str):
                errors.append(
                    f"Invalid type for '{field}': expected string, got {type(val).__name__}"
                )
            elif not re.match(pattern, val):
                errors.append(
                    f"Invalid value for '{field}': '{val}' (must match {pattern})"
                )

    # 3. Check filename matches spec ID
    spec_id = data.get("id", "")
    if spec_id and isinstance(spec_id, str):
        num = spec_id.split("-")[-1]
        filename = filepath.name
        if not (filename.startswith(num) or filename.startswith(spec_id.lower()) or filename.startswith(spec_id)):
            errors.append(
                f"Filename '{filename}' does not start with spec number or id '{spec_id}'"
            )

    # 4. Check mandatory headings in body
    for heading in MANDATORY_HEADINGS:
        pattern = re.compile(rf"#+\s+.*{re.escape(heading)}.*", re.IGNORECASE)
        if not pattern.search(body):
            errors.append(f"Missing mandatory section containing: '{heading}'")

    return errors


def main():
    target_path = Path("specs")
    if len(sys.argv) > 1:
        target_path = Path(sys.argv[1])

    if not target_path.exists():
        print(f"Error: Path '{target_path}' not found.")
        sys.exit(1)

    if target_path.is_file():
        print(f"🔍 Validating specification: {target_path.resolve()}\n")
        spec_files = [target_path]
    elif target_path.is_dir():
        print(f"🔍 Validating specifications in: {target_path.resolve()}\n")
        spec_files = sorted(target_path.glob("*.md"))
        # Filter out README, index, and task breakdown files
        spec_files = [
            f for f in spec_files if f.name.lower() not in ["readme.md", "index.md"] and not f.name.lower().startswith("task")
        ]
    else:
        print(f"Error: Path '{target_path}' is neither a file nor a directory.")
        sys.exit(1)

    if not spec_files:
        print("⚠️  No specification files found to validate.")
        sys.exit(0)

    total_specs = len(spec_files)
    failed_specs = 0

    for filepath in spec_files:
        errors = validate_spec_file(filepath)
        if errors:
            failed_specs += 1
            print(f"❌ FAIL: {filepath}")
            for err in errors:
                print(f"   └── {err}")
        else:
            print(f"✅ PASS: {filepath}")

    print("\n" + "=" * 50)
    print(f"Results: {total_specs - failed_specs}/{total_specs} specs valid.")

    if failed_specs > 0:
        print(f"💥 {failed_specs} specification(s) failed validation.")
        sys.exit(1)
    else:
        print("🎉 All specifications conform to SDD standards!")
        sys.exit(0)


if __name__ == "__main__":
    main()
