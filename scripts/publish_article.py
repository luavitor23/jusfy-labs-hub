"""
Jusfy · JusfySEO — Publicar no WordPress
Substitui o cenário Make 5483757
Fluxo: Notion (watch "Pronto para publicar") → Google Drive → WordPress → Notion (atualiza status)
"""
import os, requests, re, time

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
GOOGLE_TOKEN = os.environ["GOOGLE_TOKEN"]
WP_URL = os.environ["WP_URL"]
WP_USER = os.environ["WP_USER"]
WP_PASSWORD = os.environ["WP_PASSWORD"]
NOTION_SEO_DB = "92b513a4-c0f4-47db-83de-afdd3f30c1b6"

CTA_BANNER = '\n\n<div style="text-align:center;margin:32px 0"><a href="https://jusfy.com.br/?blog-cta=geral/#planos" target="_blank"><img src="https://jusfy.com.br/wp-content/uploads/2024/07/Solucoes-Jusfy-CTA-Geral-Blog.webp" alt="Soluções Jusfy para advogados" style="max-width:100%;height:auto;border-radius:8px" /></a></div>'

def get_articles_ready():
    """Busca artigos com status Pronto para publicar"""
    resp = requests.post(
        f"https://api.notion.com/v1/databases/{NOTION_SEO_DB}/query",
        headers={"Authorization": f"Bearer {NOTION_TOKEN}", "Notion-Version": "2022-06-28", "Content-Type": "application/json"},
        json={"page_size": 10, "filter": {"property": "Status", "select": {"equals": "✅ Pronto para publicar"}}},
        timeout=30
    )
    resp.raise_for_status()
    return resp.json().get("results", [])

def get_prop_text(props, key):
    prop = props.get(key, {})
    ptype = prop.get("type", "")
    if ptype == "title":
        return "".join(i.get("text", {}).get("content", "") for i in prop.get("title", []))
    elif ptype == "rich_text":
        return "".join(i.get("text", {}).get("content", "") for i in prop.get("rich_text", []))
    elif ptype == "url":
        return prop.get("url", "")
    return ""

def extract_doc_id(url):
    match = re.search(r'/d/([a-zA-Z0-9_-]+)', url)
    return match.group(1) if match else None

def get_google_doc_content(doc_id):
    resp = requests.get(
        f"https://www.googleapis.com/drive/v3/files/{doc_id}/export",
        params={"mimeType": "text/html"},
        headers={"Authorization": f"Bearer {GOOGLE_TOKEN}"},
        timeout=30
    )
    resp.raise_for_status()
    return resp.text

def publish_to_wordpress(titulo, slug, content, meta_title, meta_desc, keyword):
    payload = {
        "title": titulo,
        "slug": slug,
        "status": "publish",
        "content": content + CTA_BANNER,
        "excerpt": meta_desc,
        "meta": {
            "_yoast_wpseo_title": meta_title,
            "_yoast_wpseo_metadesc": meta_desc,
            "rank_math_title": meta_title,
            "rank_math_description": meta_desc,
            "rank_math_focus_keyword": keyword,
        }
    }
    resp = requests.post(
        f"{WP_URL}/wp-json/wp/v2/posts",
        auth=(WP_USER, WP_PASSWORD),
        json=payload,
        timeout=60
    )
    resp.raise_for_status()
    return resp.json()

def update_notion_status(page_id, status):
    requests.patch(
        f"https://api.notion.com/v1/pages/{page_id}",
        headers={"Authorization": f"Bearer {NOTION_TOKEN}", "Notion-Version": "2022-06-28", "Content-Type": "application/json"},
        json={"properties": {"Status": {"select": {"name": status}}}},
        timeout=30
    )

def main():
    print("=== PUBLICADOR DE ARTIGOS ===")
    articles = get_articles_ready()
    print(f"Artigos prontos para publicar: {len(articles)}")

    if not articles:
        print("Nenhum artigo para publicar.")
        return

    for article in articles:
        props = article["properties"]
        page_id = article["id"]
        titulo = get_prop_text(props, "Título do Artigo")
        slug = get_prop_text(props, "Slug")
        doc_url = get_prop_text(props, "Artigo (Google Doc)")
        meta_title = get_prop_text(props, "Meta Title")
        meta_desc = get_prop_text(props, "Meta Description")
        keyword = get_prop_text(props, "Keyword Principal")

        print(f"\n📄 Publicando: {titulo}")

        try:
            doc_id = extract_doc_id(doc_url)
            if not doc_id:
                print(f"  ❌ URL do Google Doc inválida: {doc_url}")
                continue

            content = get_google_doc_content(doc_id)
            wp_post = publish_to_wordpress(titulo, slug, content, meta_title, meta_desc, keyword)
            wp_url = wp_post.get("link", "")
            print(f"  ✅ Publicado: {wp_url}")

            update_notion_status(page_id, "🚀 Publicado")
            print(f"  ✅ Status Notion atualizado")

        except Exception as e:
            print(f"  ❌ Erro: {e}")
            update_notion_status(page_id, "⚠️ Erro na publicação")

    print("\n🎉 Publicação concluída!")

if __name__ == "__main__":
    main()
