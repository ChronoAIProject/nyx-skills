import os
import sys

text = os.environ.get("INPUT_TEXT", "")
if text == "":
    print("ERROR: INPUT_TEXT is empty")
    sys.exit(1)

lines = 0 if text == "" else text.count("\n") + 1
words = len(text.split())
chars = len(text)
print(f"lines={lines}")
print(f"words={words}")
print(f"chars={chars}")
