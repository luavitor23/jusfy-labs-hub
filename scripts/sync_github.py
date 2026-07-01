"""
Jusfy · GitHub Sync — Inteligência Competitiva e JusfySEO
Lê o último dataset da Apify (Intel) e o Notion via Make OAuth (SEO)
"""
import os, json, base64, time, requests
from collections import Counter

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
APIFY_TOKEN = os.environ["APIFY_TOKEN"]
GITHUB_TOKEN = os.environ["JUSFY_GITHUB_TOKEN"]
NOTION_TOKEN = os.environ["NOTION_TOKEN"]
GITHUB_REPO = "luavitor23/jusfy-labs-hub"
NOTION_SEO_DB = "92b513a4-c0f4-47db-83de-afdd3f30c1b6"

# Mapeamento de Page ID para concorrente
PAGE_ID_MAP = {
    "1421020664852459": "Cálculo Jurídico",
    "177645512265295": "JusBrasil",
    "810603572129759": "SeguroCred",
    "492864047399400": "Astrea",
}

def get_latest_apify_dataset():
    print("📦 Buscando último dataset da Apify...")
    resp = requests.get(
        f"https://api.apify.com/v2/acts/automation-lab~facebook-ads-library/runs?token={APIFY_TOKEN}&limit=5&desc=1",
        timeout=30
    )
    resp.raise_for_status()
    runs = resp.json()["data"]["items"]
    
    for run in runs:
        if run["status"] == "SUCCEEDED" and run.get("defaultDatasetId"):
            dataset_id = run["defaultDatasetId"]
            print(f"  Dataset: {dataset_id} ({run['createdAt'][:10]})")
            
            items_resp = requests.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={APIFY_TOKEN}&limit=200",
                timeout=60
            )
            items_resp.raise_for_status()
            items = items_resp.json()
            print(f"  ✅ {len(items)} anúncios encontrados")
            return items
    
    print("  ⚠️ Nenhum dataset encontrado")
    return []

def map_competitor(ad):
    page_id = str(ad.get("pageId", ""))
    if page_id in PAGE_ID_MAP:
        return PAGE_ID_MAP[page_id]
    page_name = str(ad.get("pageName", "")).lower()
    if "calculo" in page_name or "cálculo" in page_name or "calculojuridico" in page_name:
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

def build_intel_json(ads):
    print("🔨 Consolidando dados Intel...")
    
    processed = []
    for ad in ads:
        concorrente = map_competitor(ad)
        start_date = ad.get("startDate", "")
        if start_date:
            start_date = start_date[:10]
        else:
            start_date = time.strftime("%Y-%m-%d")
        
        processed.append({
            "id": str(ad.get("adArchiveId", "")),
            "concorrente": concorrente,
            "titulo": str(ad.get("title", "Sem título"))[:200],
            "mensagem": str(ad.get("bodyText", ""))[:300],
            "cta": str(ad.get("ctaText", "Não identificado"))[:100],
            "status": "Ativo" if ad.get("isActive") else "Inativo",
            "data": start_date,
            "link": ad.get("adLibraryUrl", "https://www.facebook.com/ads/library"),
            "page_id": str(ad.get("pageId", "")),
            "page_name": str(ad.get("pageName", "")),
        })
    
    # Classificar com Claude em batch
    print("🤖 Claude classificando categorias e tons...")
    sample = processed[:30]  # Classificar amostra para métricas
    
    prompt = f"""Analise estes {len(sample)} anúncios e retorne SOMENTE um JSON com categorias e tons.

Anúncios:
{json.dumps([{"id": a["id"], "titulo": a["titulo"], "mensagem": a["mensagem"][:150], "cta": a["cta"]} for a in sample], ensure_ascii=False)}

Retorne EXATAMENTE este formato:
{{
  "classifications": [
    {{"id": "ID", "categoria": "CATEGORIA", "tom": "TOM"}}
  ]
}}

Categorias válidas: Aquisição, Branding, Conversão, Educação, Produto, Institucional, Oferta/Desconto, Outro
Tons válidos: Urgência, Autoridade, Educativo, Emocional, Direto/Comercial, Outro"""

    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": "claude-sonnet-4-6", "max_tokens": 2000, "messages": [{"role": "user", "content": prompt}]},
            timeout=60
        )
        result = resp.json()["content"][0]["text"].strip()
        if result.startswith("```"):
            result = result.split("```")[1]
            if result.startswith("json"): result = result[4:]
        classifications = {c["id"]: c for c in json.loads(result.strip()).get("classifications", [])}
    except Exception as e:
        print(f"  ⚠️ Claude error: {e} — usando defaults")
        classifications = {}
    
    # Aplicar classificações
    for ad in processed:
        clf = classifications.get(ad["id"], {})
        ad["categoria"] = clf.get("categoria", "Outro")
        ad["tom"] = clf.get("tom", "Direto/Comercial")
        ad["objetivo"] = ""
    
    # Contar métricas
    by_competitor = dict(Counter(a["concorrente"] for a in processed))
    by_category = dict(Counter(a["categoria"] for a in processed))
    by_tom = dict(Counter(a["tom"] for a in processed))
    by_cta = dict(Counter(a["cta"] for a in processed if a["cta"] != "Não identificado"))
    
    # Remover zeros e ordenar
    by_competitor = {k: v for k, v in sorted(by_competitor.items(), key=lambda x: -x[1])}
    by_category = {k: v for k, v in sorted(by_category.items(), key=lambda x: -x[1])}
    by_tom = {k: v for k, v in sorted(by_tom.items(), key=lambda x: -x[1])}
    by_cta = dict(sorted(by_cta.items(), key=lambda x: -x[1])[:8])
    
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
    print("📖 Lendo Notion SEO...")
    try:
        resp = requests.post(
            f"https://api.notion.com/v1/databases/{NOTION_SEO_DB}/query",
            headers={"Authorization": f"Bearer {NOTION_TOKEN}", "Notion-Version": "2022-06-28", "Content-Type": "application/json"},
            json={"page_size": 100},
            timeout=30
        )
        if resp.status_code != 200:
            print(f"  ⚠️ Notion SEO inacessível: {resp.status_code}")
            return {"updated_at": time.strftime("%Y-%m-%d"), "total_artigos": 0, "by_status": {}, "by_area": {}, "by_intencao": {}, "artigos": []}
        
        results = resp.json().get("results", [])
        print(f"  ✅ {len(results)} artigos")
        
        artigos = []
        for page in results:
            props = page.get("properties", {})
            def get_text(prop_name):
                prop = props.get(prop_name, {})
                if prop.get("type") == "title":
                    items = prop.get("title", [])
                elif prop.get("type") == "rich_text":
                    items = prop.get("rich_text", [])
                else:
                    return ""
                return "".join(i.get("text", {}).get("content", "") for i in items)
            
            def get_select(prop_name):
                prop = props.get(prop_name, {})
                sel = prop.get("select")
                return sel.get("name", "") if sel else ""
            
            artigos.append({
                "titulo": get_text("Título") or get_text("Title") or get_text("Nome"),
                "keyword": get_text("Keyword Principal") or get_text("Keyword"),
                "status": get_select("Status"),
                "area": get_select("Área Jurídica") or get_select("Area"),
                "intencao": get_select("Intenção de Busca") or get_select("Intencao"),
                "data_criacao": page.get("created_time", "")[:10],
            })
        
        from collections import Counter
        return {
            "updated_at": time.strftime("%Y-%m-%d"),
            "total_artigos": len(artigos),
            "by_status": dict(Counter(a["status"] for a in artigos if a["status"])),
            "by_area": dict(Counter(a["area"] for a in artigos if a["area"])),
            "by_intencao": dict(Counter(a["intencao"] for a in artigos if a["intencao"])),
            "artigos": artigos
        }
    except Exception as e:
        print(f"  ❌ Erro SEO: {e}")
        return {"updated_at": time.strftime("%Y-%m-%d"), "total_artigos": 0, "by_status": {}, "by_area": {}, "by_intencao": {}, "artigos": []}

def get_sha(filename):
    resp = requests.get(
        f"https://api.github.com/repos/{GITHUB_REPO}/contents/{filename}",
        headers={"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
        timeout=30
    )
    return resp.json().get("sha") if resp.status_code == 200 else None

def update_file(filename, content_str, sha=None):
    print(f"📤 Atualizando {filename}...")
    payload = {
        "message": f"sync: {filename} {time.strftime('%Y-%m-%d')}",
        "content": base64.b64encode(content_str.encode("utf-8")).decode("ascii"),
    }
    if sha:
        payload["sha"] = sha
    resp = requests.put(
        f"https://api.github.com/repos/{GITHUB_REPO}/contents/{filename}",
        headers={"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
        json=payload,
        timeout=30
    )
    resp.raise_for_status()
    print(f"  ✅ {filename} atualizado")

def main():
    # Intel — lê direto da Apify
    ads = get_latest_apify_dataset()
    intel_json = build_intel_json(ads)
    print(f"\n📊 Intel: {intel_json['total_ads']} ads, concorrentes: {intel_json['by_competitor']}")
    update_file("data-intel.json", json.dumps(intel_json, ensure_ascii=False, indent=2), get_sha("data-intel.json"))

    time.sleep(2)

    # SEO — tenta Notion
    seo_json = build_seo_json()
    update_file("data-seo.json", json.dumps(seo_json, ensure_ascii=False, indent=2), get_sha("data-seo.json"))

    print("\n🎉 Sync concluído!")

if __name__ == "__main__":
    main()
