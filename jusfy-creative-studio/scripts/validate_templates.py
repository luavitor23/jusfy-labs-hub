from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from template_catalog import TemplateCatalogError, load_template_catalog


if __name__ == "__main__":
    try:
        catalog = load_template_catalog(ROOT)
    except TemplateCatalogError as error:
        print(f"ERRO: {error}")
        raise SystemExit(1)
    print(f"OK: {len(catalog['models'])} modelos e {len(catalog['models']) * 2} formatos validados.")
