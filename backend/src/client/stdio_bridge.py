from __future__ import annotations

import argparse
import subprocess
import sys
import threading
from typing import List


def _forward_stdin(child: subprocess.Popen[bytes]) -> None:
    try:
        while True:
            chunk = sys.stdin.buffer.read(4096)
            if not chunk:
                break
            child.stdin.write(chunk)  # type: ignore[union-attr]
            child.stdin.flush()  # type: ignore[union-attr]
    except BrokenPipeError:
        pass
    finally:
        try:
            child.stdin.close()  # type: ignore[union-attr]
        except Exception:  # pragma: no cover - best effort
            pass


def _forward_stdout(child: subprocess.Popen[bytes], filter_non_json: bool) -> None:
    try:
        for raw_line in iter(child.stdout.readline, b""):
            stripped = raw_line.lstrip()
            if filter_non_json and (not stripped or stripped[:1] not in (b"{", b"[")):
                sys.stderr.buffer.write(raw_line)
                sys.stderr.buffer.flush()
                continue
            sys.stdout.buffer.write(raw_line)
            sys.stdout.buffer.flush()
    finally:
        try:
            child.stdout.close()
        except Exception:  # pragma: no cover - best effort
            pass


def _forward_stderr(child: subprocess.Popen[bytes]) -> None:
    try:
        for chunk in iter(lambda: child.stderr.read(4096), b""):
            if not chunk:
                break
            sys.stderr.buffer.write(chunk)
            sys.stderr.buffer.flush()
    finally:
        try:
            child.stderr.close()
        except Exception:  # pragma: no cover - best effort
            pass


def run_child(command: List[str], filter_non_json: bool) -> int:
    child = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=0,
    )

    threads = [
        threading.Thread(target=_forward_stdin, args=(child,), daemon=True),
        threading.Thread(target=_forward_stdout, args=(child, filter_non_json), daemon=True),
        threading.Thread(target=_forward_stderr, args=(child,), daemon=True),
    ]

    for thread in threads:
        thread.start()

    return_code = 0
    try:
        return_code = child.wait()
    except KeyboardInterrupt:  # pragma: no cover - pass signal through
        child.terminate()
        return_code = child.wait()
    finally:
        for thread in threads:
            thread.join()

    return return_code


def main() -> int:
    parser = argparse.ArgumentParser(description="Wrap an MCP stdio server and filter noisy stdout logs.")
    parser.add_argument(
        "--filter-non-json",
        action="store_true",
        help="Drop stdout lines that do not look like JSON before forwarding to the MCP host.",
    )
    parser.add_argument("command", nargs=argparse.REMAINDER, help="Command to execute after '--'.")

    args = parser.parse_args()
    child_cmd = args.command
    if child_cmd and child_cmd[0] == "--":
        child_cmd = child_cmd[1:]

    if not child_cmd:
        parser.error("A child command to execute is required after '--'.")

    return run_child(child_cmd, args.filter_non_json)


if __name__ == "__main__":
    sys.exit(main())
