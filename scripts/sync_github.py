"""
Jusfy · GitHub Sync — Inteligência Competitiva e JusfySEO
"""
import os, json, base64, time, requests, sys
from collections import Counter

print("=== INICIANDO SYNC ===")
print(f"Variáveis disponíveis: {[k for k in os.environ.keys() if any(x in k for x in ['APIFY','ANTHROPIC','NOTION','GITHUB'])]}")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")
GITHUB_TOKEN = os.environ.get("JUSFY_GITHUB_TOKEN", "")
NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "")
GITHUB_REPO = "luavitor23/jusfy-labs-hub"
NOTION_SEO_DB = "92b513a4-c0f4-47db-83de-afdd3f30c1b6"

print(f"APIFY_TOKEN presente: {bool(APIFY_TOKEN)}")
print(f"ANTHROPIC_API_KEY presente: {bool(ANTHROPIC_API_KEY)}")
print(f"GITHUB_TOKEN presente: {bool(GITHUB_TOKEN)}")
print(f"NOTION_TOKEN presente: {bool(NOTION_TOKEN)}")

PAGE_ID_MAP = {
    "1421020664852459": "Cálculo Jurídico",
    "177645512265295": "JusBrasil",
    "810603572129759": "SeguroCred",
    "492864047399400": "Astrea",
}

def get_latest_apify_dataset():
    print("\n📦 Buscando último dataset da Apify...")
    try:
        resp = requests.get(
            f"https://api.apify.com/v2/acts/automation-lab~facebook-ads-library/runs?token={APIFY_TOKEN}&limit=5&desc=1",
            timeout=30
        )
        print(f"  Apify runs status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"  Erro: {resp.text[:200]}")
            return []
        
        runs = resp.json().get("data", {}).get("items", [])
        print(f"  Runs encontrados: {len(runs)}")
        
        for run in runs:
            print(f"  Run {run['id']}: status={run['status']}")
            if run["status"] == "SUCCEEDED" and run.get("defaultDatasetId"):
                dataset_id = run["defaultDatasetId"]
                print(f"  Usando dataset: {dataset_id}")
                
                items_resp = requests.get(
                    f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={APIFY_TOKEN}&limit=200",
                    timeout=60
                )
                print(f"  Items status: {items_resp.status_code}")
                if items_resp.status_code == 200:
                    items = items_resp.json()
                    print(f"  ✅ {len(items)} anúncios")
                    return items
        
        print("  ⚠️ Nenhum dataset disponível")
        return []
    except Exception as e:
        print(f"  ❌ Exceção: {e}")
        return []

def map_competitor(ad):
    page_id = str(ad.get("pageId", ""))
    if page_id in PAGE_ID_MAP:
        return PAGE_ID_MAP[page_id]
    page_name = str(ad.get("pageName", "")).lower()
    if "calculo" in page_name or "cálculo" in page_name:
        return "Cálculo Jurídico"
    if "jusbrasil" in page_name:
        return "JusBrasil"
    if "segurocred" in page_name:
        return "SeguroCred"
    if "aurum" in page_name or "astrea" in page_name:
        return "Astrea"
    if "enter" in page_name or "getenter" in page_name:
        return "Enter"
    return "Outro"

def classify_with_claude(ads_sample):
    if not ads_sample or not ANTHROPIC_API_KEY:
        return {}
    try:
        prompt = f"""Classifique estes anúncios. Retorne SOMENTE JSON válido:
{{"classifications": [{{"id": "ID", "categoria": "CATEGORIA", "tom": "TOM"}}]}}

Categorias: Aquisição, Branding, Conversão, Educação, Produto, Institucional, Oferta/Desconto, Outro
Tons: Urgência, Autoridade, Educativo, Emocional, Direto/Comercial, Outro

Anúncios:
{json.dumps([{"id": a["id"], "titulo": a["titulo"][:100], "cta": a["cta"]} for a in ads_sample[:20]], ensure_ascii=False)}"""

        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": "claude-sonnet-4-6", "max_tokens": 2000, "messages": [{"role": "user", "content": prompt}]},
            timeout=60
        )
        result = resp.json()["content"][0]["text"].strip()
        if "```" in result:
            result = result.split("```")[1]
            if result.startswith("json"): result = result[4:]
        return {c["id"]: c for c in json.loads(result.strip()).get("classifications", [])}
    except Exception as e:
        print(f"  ⚠️ Claude erro: {e}")
        return {}

def build_intel_json(ads):
    print(f"\n🔨 Processando {len(ads)} anúncios...")
    processed = []
    for ad in ads:
        start_date = (ad.get("startDate", "") or "")[:10] or time.strftime("%Y-%m-%d")
        processed.append({
            "id": str(ad.get("adArchiveId", "")),
            "concorrente": map_competitor(ad),
            "titulo": str(ad.get("title", "Sem título"))[:200],
            "mensagem": str(ad.get("bodyText", ""))[:300],
            "cta": str(ad.get("ctaText", "Não identificado"))[:100],
            "status": "Ativo" if ad.get("isActive") else "Inativo",
            "data": start_date,
            "link": ad.get("adLibraryUrl", "https://www.facebook.com/ads/library"),
            "categoria": "Outro",
            "tom": "Direto/Comercial",
            "objetivo": "",
        })

    classifications = classify_with_claude(processed)
    for ad in processed:
        clf = classifications.get(ad["id"], {})
        ad["categoria"] = clf.get("categoria", ad["categoria"])
        ad["tom"] = clf.get("tom", ad["tom"])

    by_competitor = dict(sorted(Counter(a["concorrente"] for a in processed).items(), key=lambda x: -x[1]))
    by_category = dict(sorted(Counter(a["categoria"] for a in processed).items(), key=lambda x: -x[1]))
    by_tom = dict(sorted(Counter(a["tom"] for a in processed).items(), key=lambda x: -x[1]))
    by_cta = dict(sorted({k: v for k, v in Counter(a["cta"] for a in processed).items() if k != "Não identificado"}.items(), key=lambda x: -x[1])[:8])

    print(f"  by_competitor: {by_competitor}")
    return {
        "updated_at": time.strftime("%Y-%m-%d"),
        "total_ads": len(processed),
        "by_competitor": by_competitor,
        "by_category": by_category,
        "by_tom": by_tom,
        "by_cta": by_cta,
        "ads": processed[:100]
    }

def build_seo_json():
    print("\n📖 Lendo Notion SEO...")
    try:
        resp = requests.post(
            f"https://api.notion.com/v1/databases/{NOTION_SEO_DB}/query",
            headers={"Authorization": f"Bearer {NOTION_TOKEN}", "Notion-Version": "2022-06-28", "Content-Type": "application/json"},
            json={"page_size": 100}, timeout=30
        )
        print(f"  Notion status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"  Erro: {resp.text[:200]}")
            return {"updated_at": time.strftime("%Y-%m-%d"), "total_artigos": 0, "by_status": {}, "by_area": {}, "by_intencao": {}, "artigos": []}

        results = resp.json().get("results", [])
        print(f"  ✅ {len(results)} artigos")
        artigos = []
        for page in results:
            props = page.get("properties", {})
            def get_text(k):
                p = props.get(k, {})
                items = p.get("title", p.get("rich_text", []))
                return "".join(i.get("text", {}).get("content", "") for i in items)
            def get_select(k):
                p = props.get(k, {})
                s = p.get("select")
                return s.get("name", "") if s else ""
            artigos.append({
                "titulo": get_text("Título") or get_text("Title") or get_text("Nome"),
                "keyword": get_text("Keyword Principal") or get_text("Keyword"),
                "status": get_select("Status"),
                "area": get_select("Área Jurídica") or get_select("Area"),
                "intencao": get_select("Intenção de Busca") or get_select("Intencao"),
                "data_criacao": page.get("created_time", "")[:10],
            })
        return {
            "updated_at": time.strftime("%Y-%m-%d"),
            "total_artigos": len(artigos),
            "by_status": dict(Counter(a["status"] for a in artigos if a["status"])),
            "by_area": dict(Counter(a["area"] for a in artigos if a["area"])),
            "by_intencao": dict(Counter(a["intencao"] for a in artigos if a["intencao"])),
            "artigos": artigos
        }
    except Exception as e:
        print(f"  ❌ Erro: {e}")
        return {"updated_at": time.strftime("%Y-%m-%d"), "total_artigos": 0, "by_status": {}, "by_area": {}, "by_intencao": {}, "artigos": []}

def get_sha(filename):
    resp = requests.get(
        f"https://api.github.com/repos/{GITHUB_REPO}/contents/{filename}",
        headers={"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
        timeout=30
    )
    return resp.json().get("sha") if resp.status_code == 200 else None

def update_file(filename, content_str, sha=None):
    print(f"\n📤 Atualizando {filename}...")
    payload = {
        "message": f"sync: {filename} {time.strftime('%Y-%m-%d')}",
        "content": base64.b64encode(content_str.encode("utf-8")).decode("ascii"),
    }
    if sha:
        payload["sha"] = sha
    resp = requests.put(
        f"https://api.github.com/repos/{GITHUB_REPO}/contents/{filename}",
        headers={"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
        json=payload, timeout=30
    )
    print(f"  Status: {resp.status_code}")
    if resp.status_code not in [200, 201]:
        print(f"  Erro: {resp.text[:200]}")
        sys.exit(1)
    print(f"  ✅ {filename} atualizado")

def main():
    ads = get_latest_apify_dataset()
    intel_json = build_intel_json(ads)
    update_file("data-intel.json", json.dumps(intel_json, ensure_ascii=False, indent=2), get_sha("data-intel.json"))

    time.sleep(2)

    seo_json = build_seo_json()
    update_file("data-seo.json", json.dumps(seo_json, ensure_ascii=False, indent=2), get_sha("data-seo.json"))

    print("\n🎉 Sync concluído com sucesso!")

if __name__ == "__main__":
    main()
