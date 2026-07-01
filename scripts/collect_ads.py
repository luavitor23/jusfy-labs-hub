"""
Jusfy · Inteligência Competitiva — Coleta de Ads
Substitui o cenário Make 5505992
Fluxo: Apify → Claude → Notion
"""
import os
import json
import time
import requests

APIFY_TOKEN = os.environ["APIFY_TOKEN"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NOTION_DB_ID = "dc746418-1dd8-4651-98c7-5c3f4666528c"

CONCORRENTES_PAGE_URLS = [
    "https://www.facebook.com/calculojuridico",
    "https://www.facebook.com/jusbrasil",
    "https://www.facebook.com/aurum.com.br",
]
SEARCH_QUERIES = ["getenter.ai", "segurocred inteligencia juridica"]


def run_apify():
    print("🔍 Iniciando coleta via Apify...")
    url = f"https://api.apify.com/v2/acts/automation-lab~facebook-ads-library/run-sync-get-dataset-items?token={APIFY_TOKEN}&timeout=300"
    payload = {
        "pageUrls": CONCORRENTES_PAGE_URLS,
        "searchQueries": SEARCH_QUERIES,
        "country": "BR",
        "activeStatus": "all",
        "maxAds": 20,
    }
    resp = requests.post(url, json=payload, timeout=360)
    resp.raise_for_status()
    ads = resp.json()
    print(f"✅ Apify retornou {len(ads)} anúncios")
    return ads


def analyze_with_claude(ad):
    prompt = f"""Analise este anuncio e retorne SOMENTE um JSON valido, sem markdown, sem explicacoes.

Retorne exatamente este JSON preenchido:
{{"parent":{{"database_id":"{NOTION_DB_ID}"}},\"properties\":{{\"Nome do An\\u00fancio\":{{\"title\":[{{\"text\":{{\"content\":\"TITULO\"}}}}]}},\"Concorrente\":{{\"select\":{{\"name\":\"CONCORRENTE\"}}}},\"Categoria IA\":{{\"select\":{{\"name\":\"CATEGORIA\"}}}},\"Tom de Voz\":{{\"select\":{{\"name\":\"TOM\"}}}},\"Status\":{{\"select\":{{\"name\":\"STATUS\"}}}},\"Objetivo\":{{\"rich_text\":[{{\"text\":{{\"content\":\"OBJETIVO\"}}}}]}},\"Mensagem Principal\":{{\"rich_text\":[{{\"text\":{{\"content\":\"MENSAGEM\"}}}}]}},\"CTA Identificado\":{{\"rich_text\":[{{\"text\":{{\"content\":\"CTA\"}}}}]}},\"Headline do Criativo\":{{\"rich_text\":[{{\"text\":{{\"content\":\"HEADLINE\"}}}}]}},\"ID do An\\u00fancio\":{{\"rich_text\":[{{\"text\":{{\"content\":\"ID\"}}}}]}},\"Page ID Meta\":{{\"rich_text\":[{{\"text\":{{\"content\":\"PAGEID\"}}}}]}},\"Link do An\\u00fancio\":{{\"url\":\"URL\"}},\"Data de In\\u00edcio\":{{\"date\":{{\"start\":\"DATA\"}}}},\"Coletado Em\":{{\"date\":{{\"start\":\"HOJE\"}}}}}}}}

Substitua:
- TITULO e HEADLINE: {str(ad.get('title', 'Sem titulo'))[:190]}
- CONCORRENTE: use EXATAMENTE um destes valores: "Calculo Juridico", "JusBrasil", "SeguroCred", "Astrea", "Enter", "Outro"
- CATEGORIA: Aquisicao, Branding, Conversao, Educacao, Produto, Institucional, Oferta/Desconto, Outro
- TOM: Urgencia, Autoridade, Educativo, Emocional, Direto/Comercial, Outro
- STATUS: {"Ativo" if ad.get('isActive') else "Inativo"}
- OBJETIVO: objetivo do anuncio (max 150 chars)
- MENSAGEM: mensagem principal (max 150 chars)
- CTA: {str(ad.get('ctaText', 'Nao identificado'))[:100]}
- ID: {str(ad.get('adArchiveId', 'sem-id'))}
- PAGEID: {str(ad.get('pageId', ''))}
- URL: {ad.get('adLibraryUrl', 'https://www.facebook.com/ads/library')}
- DATA: {ad.get('startDate', '')[:10] if ad.get('startDate') else time.strftime('%Y-%m-%d')}
- HOJE: {time.strftime('%Y-%m-%d')}

Anuncio:
Empresa: {str(ad.get('pageName', 'Outro'))[:100]}
Titulo: {str(ad.get('title', 'sem titulo'))[:200]}
Texto: {str(ad.get('bodyText', 'sem texto'))[:400]}"""

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": 600,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=60,
    )
    resp.raise_for_status()
    result = resp.json()["content"][0]["text"].strip()
    # Remove markdown se vier
    if result.startswith("```"):
        result = result.split("```")[1]
        if result.startswith("json"):
            result = result[4:]
    return result.strip()


def save_to_notion(page_json_str):
    try:
        page_data = json.loads(page_json_str)
    except json.JSONDecodeError as e:
        print(f"  ⚠️ JSON inválido do Claude: {e}")
        return False

    resp = requests.post(
        "https://api.notion.com/v1/pages",
        headers={
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
        json=page_data,
        timeout=30,
    )

    if resp.status_code == 200:
        return True
    else:
        print(f"  ❌ Erro Notion {resp.status_code}: {resp.text[:200]}")
        return False


def main():
    ads = run_apify()
    saved = 0
    failed = 0

    for i, ad in enumerate(ads):
        print(f"  [{i+1}/{len(ads)}] {ad.get('pageName', '?')} — {str(ad.get('title', ''))[:60]}")
        try:
            page_json = analyze_with_claude(ad)
            ok = save_to_notion(page_json)
            if ok:
                saved += 1
                print(f"    ✅ Salvo no Notion")
            else:
                failed += 1
            time.sleep(0.5)  # Evitar rate limit
        except Exception as e:
            print(f"    ❌ Erro: {e}")
            failed += 1

    print(f"\n📊 Resultado: {saved} salvos, {failed} falhas de {len(ads)} anúncios")


if __name__ == "__main__":
    main()
