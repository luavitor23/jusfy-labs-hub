from copy import deepcopy
from pathlib import Path
import html
import json
import re
import xml.etree.ElementTree as ET


COMMERCIAL_NOTE = "*Válido no primeiro mês para assinantes no plano degustação."
REQUIRED_FORMATS = {"square", "story"}


class TemplateCatalogError(ValueError):
    pass


def _svg_dimensions(path):
    root = ET.parse(path).getroot()
    view_box = re.split(r"[ ,]+", (root.attrib.get("viewBox") or "").strip())
    width = float(re.sub(r"[^0-9.+-]", "", root.attrib.get("width", "")) or 0)
    height = float(re.sub(r"[^0-9.+-]", "", root.attrib.get("height", "")) or 0)
    if (not width or not height) and len(view_box) == 4:
        width, height = float(view_box[2]), float(view_box[3])
    return width, height


def _asset_url(root, model_dir, relative_path):
    path = (model_dir / relative_path).resolve()
    if root.resolve() not in path.parents or not path.is_file():
        raise TemplateCatalogError(f"Asset ausente ou fora da pasta de templates: {relative_path}")
    version = path.stat().st_mtime_ns
    return f"/{path.relative_to(root).as_posix()}?v={version}"


def load_template_catalog(root):
    root = Path(root).resolve()
    templates_dir = root / "templates"
    models = []
    ids = set()
    keys = set()

    for manifest_path in sorted(templates_dir.glob("modelo-*/manifest.json")):
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as error:
            raise TemplateCatalogError(f"Manifesto inválido em {manifest_path}: {error}") from error

        model_id = manifest.get("id")
        if not model_id or model_id in ids:
            raise TemplateCatalogError(f"ID ausente ou duplicado em {manifest_path}")
        ids.add(model_id)
        formats = manifest.get("formats") or {}
        if set(formats) != REQUIRED_FORMATS:
            raise TemplateCatalogError(f"{model_id} precisa ter exatamente os formatos square e story")
        defaults = manifest.get("defaults") or {}
        if not all(field in defaults for field in ("category", "headline", "support", "cta")):
            raise TemplateCatalogError(f"{model_id} não define todos os textos padrão")
        copy_fields = manifest.get("copyFields")
        if copy_fields is not None:
            allowed_copy_fields = {"headline", "support", "cta"}
            if (
                not isinstance(copy_fields, list)
                or not copy_fields
                or any(field not in allowed_copy_fields for field in copy_fields)
            ):
                raise TemplateCatalogError(
                    f"copyFields inválido em {model_id}: use uma lista não vazia com valores entre headline, support e cta"
                )

        cobranding = manifest.get("cobranding", True)
        if not isinstance(cobranding, bool):
            raise TemplateCatalogError(f"cobranding inválido em {model_id}: use true ou false")
        copy_scopes = manifest.get("copyScopes")
        if copy_scopes is not None and (
            not isinstance(copy_scopes, list)
            or any(not isinstance(scope, str) or not scope.strip() for scope in copy_scopes)
        ):
            raise TemplateCatalogError(
                f"copyScopes inválido em {model_id}: use uma lista de textos não vazios"
            )

        hydrated = deepcopy(manifest)
        if "copyFields" not in hydrated:
            hydrated["copyFields"] = ["headline", "support", "cta"]
        hydrated["cobranding"] = cobranding
        if "copyScopes" not in hydrated:
            hydrated["copyScopes"] = []
        hydrated["directory"] = manifest_path.parent.name
        for format_id, spec in hydrated["formats"].items():
            template_key = spec.get("key") or f"{model_id}-{format_id}"
            if template_key in keys:
                raise TemplateCatalogError(f"Chave de template duplicada: {template_key}")
            keys.add(template_key)
            spec["key"] = template_key
            for field in ("width", "height", "source", "patches", "headline", "support", "cta", "logos"):
                if field not in spec:
                    raise TemplateCatalogError(f"{model_id}/{format_id} não define {field}")
            logos_anchor = spec["logos"].get("anchor")
            if logos_anchor is not None and logos_anchor not in {"left", "right", "center"}:
                raise TemplateCatalogError(
                    f"anchor inválido em {model_id}/{format_id}: use left, right ou center"
                )
            source_path = manifest_path.parent / spec["source"]
            actual_width, actual_height = _svg_dimensions(source_path)
            expected_width, expected_height = float(spec["width"]), float(spec["height"])
            if actual_width and actual_height:
                actual_ratio = actual_width / actual_height
                expected_ratio = expected_width / expected_height
                if abs(actual_ratio - expected_ratio) > 0.025:
                    raise TemplateCatalogError(f"{model_id}/{format_id} tem proporção diferente do manifesto")
            spec["source"] = _asset_url(root, manifest_path.parent, spec["source"])
            assets = spec.get("commercialAssets") or {}
            spec["commercialAssets"] = {
                name: _asset_url(root, manifest_path.parent, path)
                for name, path in assets.items()
            }
            note_mode = spec.get("commercialNoteMode", "none")
            if note_mode not in {"none", "runtime", "embedded"}:
                raise TemplateCatalogError(f"commercialNoteMode inválido em {model_id}/{format_id}")
            if note_mode == "embedded":
                source_text = html.unescape(source_path.read_text(encoding="utf-8"))
                if COMMERCIAL_NOTE not in source_text:
                    raise TemplateCatalogError(f"Nota comercial obrigatória ausente em {model_id}/{format_id}")

            free_elements = spec.get("freeElements")
            if free_elements is not None:
                if not isinstance(free_elements, dict):
                    raise TemplateCatalogError(f"freeElements inválido em {model_id}/{format_id}: use um objeto")
                for element_key, element_spec in free_elements.items():
                    if not isinstance(element_spec, dict):
                        raise TemplateCatalogError(f"freeElements.{element_key} inválido em {model_id}/{format_id}")
                    bounds = element_spec.get("bounds")
                    if not (isinstance(bounds, list) and len(bounds) == 4 and all(isinstance(v, (int, float)) for v in bounds)):
                        raise TemplateCatalogError(
                            f"freeElements.{element_key} em {model_id}/{format_id} precisa de bounds com 4 números [x,y,largura,altura]"
                        )
                    if not element_spec.get("label"):
                        raise TemplateCatalogError(f"freeElements.{element_key} em {model_id}/{format_id} precisa de label")

        models.append(hydrated)

    if not models:
        raise TemplateCatalogError("Nenhum modelo foi encontrado em templates/modelo-*/manifest.json")
    models.sort(key=lambda model: (model.get("order", 9999), model.get("label", "")))
    return {"schemaVersion": 1, "commercialNote": COMMERCIAL_NOTE, "models": models}
