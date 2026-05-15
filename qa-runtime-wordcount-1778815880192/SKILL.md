---
name: qa-runtime-wordcount-1778815880192
description: Count lines, words, and characters from INPUT_TEXT in the sandbox.
version: "0.1"
metadata:
  category: runtime-based
  output-type: text
  runtime:
    - python
  runtime-env-var:
    - INPUT_TEXT
  tag:
    - qa
    - runtime
    - wordcount
---

# QA Runtime Wordcount

## Overview

This runtime-based test skill verifies that Playground passes the required INPUT_TEXT environment variable into the sandbox.

## Usage

Before running, set the required environment variable:

- INPUT_TEXT: text to count

Then execute the Python script:

```bash
python3 scripts/wordcount.py
```

The script prints line, word, and character counts.

## Expected Example

For INPUT_TEXT set to `hello world from ornn`, stdout should be:

```text
lines=1
words=4
chars=21
```
