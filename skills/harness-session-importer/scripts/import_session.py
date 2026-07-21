#!/usr/bin/env python3
"""Convert one external harness session into an Obsidian Harness v2 session."""

import argparse
import json
import sys
from pathlib import Path

from importer import ImportFailure, import_session


def parser():
    command = argparse.ArgumentParser()
    command.add_argument(
        "--harness", choices=("claude", "codex", "pi", "kimi"), required=True
    )
    command.add_argument("--session", type=Path, required=True)
    command.add_argument("--vault", type=Path, required=True)
    command.add_argument("--entry-dir", required=True)
    command.add_argument("--branch")
    command.add_argument("--title")
    command.add_argument("--cwd")
    return command


def main():
    args = parser().parse_args()
    try:
        result = import_session(
            args.harness,
            args.session,
            args.vault,
            args.entry_dir,
            args.branch,
            args.title,
            args.cwd,
        )
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    except ImportFailure as error:
        print(
            json.dumps(error.as_dict(), ensure_ascii=False, separators=(",", ":")),
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
