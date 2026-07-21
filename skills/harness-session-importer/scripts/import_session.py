#!/usr/bin/env python3
"""CLI entry point for the Harness Session Importer skill."""

import argparse
import json
import sys
from pathlib import Path

from importer import ImportFailure, create_bundle, inspect_session


def parser():
    command = argparse.ArgumentParser()
    subcommands = command.add_subparsers(dest="command", required=True)
    for name in ("inspect", "bundle"):
        item = subcommands.add_parser(name)
        item.add_argument("--harness", choices=("claude", "codex", "pi", "kimi"), required=True)
        item.add_argument("--session", type=Path, required=True)
        item.add_argument("--branch")
        item.add_argument("--title")
        item.add_argument("--cwd")
        if name == "bundle":
            item.add_argument("--vault", type=Path, required=True)
            item.add_argument("--entry-dir", required=True)
            item.add_argument("--accept-incomplete", action="store_true")
    return command


def main():
    args = parser().parse_args()
    try:
        if args.command == "inspect":
            result = inspect_session(args.harness, args.session, args.branch, args.title, args.cwd).report
        else:
            result = create_bundle(args.harness, args.session, args.vault, args.entry_dir, args.branch, args.title, args.cwd, args.accept_incomplete)
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    except ImportFailure as error:
        print(json.dumps(error.as_dict(), ensure_ascii=False, separators=(",", ":")), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
