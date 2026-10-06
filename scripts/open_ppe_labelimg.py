"""Open the local PPE LabelImg reviewer. See private_training/open_labelimg.py."""

from pathlib import Path
import runpy


if __name__ == "__main__":
    target = Path(__file__).resolve().parents[1] / "private_training" / "open_labelimg.py"
    runpy.run_path(str(target), run_name="__main__")
