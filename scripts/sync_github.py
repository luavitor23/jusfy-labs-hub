"""
Jusfy · GitHub Sync — Inteligência Competitiva e JusfySEO
Substitui os cenários Make 5539389 e 5539391
Fluxo: Notion → Claude → GitHub
"""
import os
import json
import base64
import time
import requests

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
NOTION_TOKEN = os.environ["NOTION_TOKEN"]
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
GITHUB_REPO = "luavitor23/jusfy-labs-hub"

NOTION_INTEL_DB = "dc746418-1dd8-4651-98c7-5c3f4666528c"
NOTION_SEO_DB = "92b513a4-c0f4-47db-83de-afdd3f30c1b6"


def query_notion(database_id):
    print(f"📖 Lendo Notion DB {database_id[:8]}...")
    all_results = []
    has_more = True
    start_cursor = None

    while has_more:
        payload = {"page_size": 100}
        if start_cursor:
            payload["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{database_id}/query",
            headers={
                "Authorization": f"Bearer {NOTION_TOKEN}",
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        all_results.extend(data.get("results", []))
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    print(f"  ✅ {len(all_results)} registros encontrados")
    return all_results


def consolidate_intel_with_claude(notion_data):
    print("🤖 Claude consolidando dados Intel...")
    data_str = json.dumps(notion_data, ensure_ascii=False)[:8000]

    prompt = f"""Analise os dados do Notion e retorne SOMENTE um JSON valido sem markdown.

Mapeamento de Page ID Meta para Concorrente (use como fallback se campo Concorrente estiver vazio):
- 1421020664852459 = Calculo Juridico
- 177645512265295 = JusBrasil
- 810603572129759 = SeguroCred
- 492864047399400 = Astrea

Dados do Notion:
{data_str}

Retorne este JSON consolidado:
{{
  "updated_at": "{time.strftime('%Y-%m-%d')}",
  "total_ads": NUMERO_TOTAL,
  "by_competitor": {{}},
  "by_category": {{}},
  "by_tom": {{}},
  "by_cta": {{}},
  "ads": [
    {{"id": "ID", "concorrente": "NOME", "categoria": "CAT", "titulo": "TITULO", "mensagem": "MSG", "objetivo": "OBJ", "cta": "CTA", "tom": "TOM", "status": "STATUS", "data": "YYYY-MM-DD", "link": "URL"}}
  ]
}}

Instrucoes:
- Extraia os dados das properties do Notion de cada pagina
- Preencha by_competitor, by_category, by_tom, by_cta com contagens
- Omita campos com valor 0
- Inclua todos os registros no array ads (maximo 100)
- Se banco vazio retorne total_ads 0 e arrays vazios"""

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": 4000,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120,
    )
    resp.raise_for_status()
    result = resp.json()["content"][0]["text"].strip()
    if result.startswith("```"):
        result = result.split("```")[1]
        if result.startswith("json"):
            result = result[4:]
    return result.strip()


def consolidate_seo_with_claude(notion_data):
    print("🤖 Claude consolidando dados SEO...")
    data_str = json.dumps(notion_data, ensure_ascii=False)[:8000]

    prompt = f"""Analise os dados do Notion e retorne SOMENTE um JSON valido sem markdown.

Dados do Notion:
{data_str}

Retorne este JSON consolidado:
{{
  "updated_at": "{time.strftime('%Y-%m-%d')}",
  "total_artigos": NUMERO_TOTAL,
  "by_status": {{}},
  "by_area": {{}},
  "by_intencao": {{}},
  "artigos": [
    {{"titulo": "TITULO", "keyword": "KW", "status": "STATUS", "area": "AREA", "intencao": "INTENCAO", "meta_title": "MT", "slug": "SLUG", "data_criacao": "YYYY-MM-DD"}}
  ]
}}

Instrucoes:
- Extraia os dados das properties do Notion
- Preencha by_status, by_area, by_intencao com contagens
- Inclua todos os artigos
- Se banco vazio retorne total_artigos 0"""

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": 4000,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120,
    )
    resp.raise_for_status()
    result = resp.json()["content"][0]["text"].strip()
    if result.startswith("```"):
        result = result.split("```")[1]
        if result.startswith("json"):
            result = result[4:]
    return result.strip()


def get_github_sha(filename):
    resp = requests.get(
        f"https://api.github.com/repos/{GITHUB_REPO}/contents/{filename}",
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=30,
    )
    if resp.status_code == 200:
        return resp.json()["sha"]
    return None


def update_github_file(filename, content_str, sha=None):
    print(f"📤 Atualizando {filename} no GitHub...")
    content_b64 = base64.b64encode(content_str.encode("utf-8")).decode("ascii")
    payload = {
        "message": f"sync: {filename} {time.strftime('%Y-%m-%d')}",
        "content": content_b64,
    }
    if sha:
        payload["sha"] = sha

    resp = requests.put(
        f"https://api.github.com/repos/{GITHUB_REPO}/contents/{filename}",
        headers={
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    print(f"  ✅ {filename} atualizado")


def main():
    # Sync Intel
    intel_records = query_notion(NOTION_INTEL_DB)
    intel_json = consolidate_intel_with_claude(intel_records)
    intel_sha = get_github_sha("data-intel.json")
    update_github_file("data-intel.json", intel_json, intel_sha)

    time.sleep(2)

    # Sync SEO
    seo_records = query_notion(NOTION_SEO_DB)
    seo_json = consolidate_seo_with_claude(seo_records)
    seo_sha = get_github_sha("data-seo.json")
    update_github_file("data-seo.json", seo_json, seo_sha)

    print("\n🎉 Sync concluído com sucesso!")


if __name__ == "__main__":
    main()
