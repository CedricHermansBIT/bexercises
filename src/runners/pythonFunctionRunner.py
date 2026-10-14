"""Invoke one student function. Expected answers stay outside the container."""
import contextlib
import io
import json
import math
import runpy
import sys


class CapturedOutput(io.TextIOBase):
    """Keep debug prints separate from the return value, with a bounded buffer."""
    def __init__(self):
        self.parts = []
        self.remaining = 8192

    def write(self, text):
        if self.remaining > 0:
            part = text[:self.remaining]
            self.parts.append(part)
            self.remaining -= len(part)
        return len(text)

    def flush(self):
        pass


def validate_return(value, depth=0):
    if depth > 30:
        raise ValueError("Return value nesting exceeds 30 levels")
    if value is None or isinstance(value, (str, bool)):
        return
    if isinstance(value, int):
        if abs(value) > 9007199254740991:
            raise ValueError("Return integer exceeds the supported JSON safe range")
        return
    if isinstance(value, float) and math.isfinite(value):
        return
    if isinstance(value, (list, tuple)):
        for item in value:
            validate_return(item, depth + 1)
        return
    if isinstance(value, dict) and all(isinstance(key, str) for key in value):
        for item in value.values():
            validate_return(item, depth + 1)
        return
    raise TypeError("Return a JSON value: None, boolean, number, string, list, tuple or string-keyed dictionary")


def main():
    script, call_json = sys.argv[1:]
    call = json.loads(call_json)
    printed = CapturedOutput()
    try:
        # A guarded `if __name__ == '__main__'` block is intentionally not run.
        with contextlib.redirect_stdout(printed):
            namespace = runpy.run_path(script, run_name="bitlab_submission")
            function = namespace.get(call["name"])
            if not callable(function):
                raise NameError("Define a function named " + call["name"])
            value = function(*call["args"], **call["kwargs"])
        validate_return(value)
        # JSON types (and tuples as arrays) give stable, inspectable answers.
        report = json.dumps({"value": value, "printedOutput": "".join(printed.parts)},
                            ensure_ascii=True, allow_nan=False, sort_keys=True)
    except (Exception, SystemExit) as error:
        print(type(error).__name__ + ": " + str(error), file=sys.stderr)
        return 1
    print(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
