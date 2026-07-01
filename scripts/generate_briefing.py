"""
Jusfy · JusfySEO — Gerador Automático de Briefing
Substitui o cenário Make 5490596
Fluxo: Claude (keyword) → Claude (título) → Claude (briefing) → Claude (keywords sec) → Notion
"""
import os, requests, time

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NOTION_SEO_DB = "92b513a4-c0f4-47db-83de-afdd3f30c1b6"
NOTION_DATA_SOURCE = "adb246e6-22e2-4aa1-8f37-aef3090e2dcb"

KEYWORDS = """prova digital | 9900 | KD 30
astreintes | 9900 | KD 21
dosimetria da pena | 9900 | KD 22
recurso inominado | 9900 | KD 20
substabelecimento com reserva | 2400 | KD 15
recurso especial | 6600 | KD 27
procuracao ad judicia | 320 | KD 13
polo ativo | 1300 | KD 16
juizo de retratacao | 720 | KD 21
aditamento da inicial | 1300 | KD 16
calculadora pensao alimenticia | 110 | KD 14
intimacao eletronica | 590 | KD 16
correspondente juridico | 6600 | KD 39
ia juridica | 2400 | KD 67
software juridico | 1300 | KD 55"""

def claude(prompt, max_tokens=300):
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json={"model": "claude-sonnet-4-6", "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]},
        timeout=60
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"].strip()

def get_existing_keywords():
    """Busca keywords já usadas no Notion para evitar repetição"""
    resp = requests.post(
        f"https://api.notion.com/v1/databases/{NOTION_SEO_DB}/query",
        headers={"Authorization": f"Bearer {NOTION_TOKEN}", "Notion-Version": "2022-06-28", "Content-Type": "application/json"},
        json={"page_size": 100},
        timeout=30
    )
    if resp.status_code != 200:
        return []
    results = resp.json().get("results", [])
    keywords = []
    for page in results:
        props = page.get("properties", {})
        kw_prop = props.get("Keyword Principal", {})
        items = kw_prop.get("rich_text", [])
        kw = "".join(i.get("text", {}).get("content", "") for i in items)
        if kw:
            keywords.append(kw.lower())
    return keywords

def main():
    print("=== GERADOR DE BRIEFING ===")

    existing = get_existing_keywords()
    print(f"Keywords já usadas: {len(existing)}")

    # Selecionar keyword
    keyword = claude(
        f"""Escolha UMA keyword da lista com maior volume E menor KD que ainda não foi usada.
Keywords já usadas (EVITAR): {', '.join(existing) if existing else 'nenhuma'}

Lista disponível:
{KEYWORDS}

Responda APENAS a keyword escolhida, exatamente como na lista, sem texto adicional.""",
        max_tokens=60
    )
    print(f"✅ Keyword selecionada: {keyword}")

    # Gerar título
    titulo = claude(
        f"Crie um titulo de artigo juridico sobre: {keyword}\nResponda APENAS o titulo em portugues, sem aspas, sem explicacao.",
        max_tokens=80
    )
    print(f"✅ Título: {titulo}")

    # Gerar briefing
    briefing = claude(
        f"Escreva um briefing de 2-3 frases para artigo juridico sobre: {keyword}\nIndique o que cobrir, qual lei citar e CTA para advogado ou plataforma Jusfy.\nUse APENAS texto simples sem caracteres especiais como aspas duplas, chaves ou colchetes.",
        max_tokens=300
    )
    briefing = briefing[:1950]
    print(f"✅ Briefing gerado ({len(briefing)} chars)")

    # Gerar keywords secundárias
    keywords_sec = claude(
        f"Liste 3 keywords secundarias sobre: {keyword}\nResponda APENAS as keywords separadas por virgula, sem aspas.",
        max_tokens=60
    )
    print(f"✅ Keywords secundárias: {keywords_sec}")

    # Criar página no Notion
    print("\n📝 Criando página no Notion...")
    create_resp = requests.post(
        "https://api.notion.com/v1/pages",
        headers={"Authorization": f"Bearer {NOTION_TOKEN}", "Notion-Version": "2022-06-28", "Content-Type": "application/json"},
        json={
            "parent": {"database_id": NOTION_SEO_DB},
            "properties": {
                "Título do Artigo": {"title": [{"text": {"content": titulo}}]},
                "Keyword Principal": {"rich_text": [{"text": {"content": keyword}}]},
                "Intenção de Busca": {"select": {"name": "Informacional"}},
                "Contexto / Briefing": {"rich_text": [{"text": {"content": briefing}}]},
                "Palavras-chave Secundárias": {"rich_text": [{"text": {"content": keywords_sec}}]},
                "Status": {"select": {"name": "📝 Briefing"}},
            }
        },
        timeout=30
    )
    print(f"Notion status: {create_resp.status_code}")
    if create_resp.status_code == 200:
        page_id = create_resp.json()["id"]
        print(f"✅ Briefing criado: {page_id}")
        print(f"\n📊 Resumo:")
        print(f"  Keyword: {keyword}")
        print(f"  Título: {titulo}")
        print(f"  Briefing: {briefing[:100]}...")
    else:
        print(f"❌ Erro: {create_resp.text[:300]}")
        exit(1)

if __name__ == "__main__":
    main()
