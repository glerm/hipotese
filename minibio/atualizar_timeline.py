import json
import shutil
from datetime import datetime
from pathlib import Path
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).resolve().parent
HTML_PATH = BASE_DIR / "index.html"
JSON_PATH = BASE_DIR / "timeline.json"
BACKUP_DIR = BASE_DIR / "backups"

SECTION_IDS = {
    "publicacoes": "publicacoes",
    "projetos": "projetos",
    "rascunhos": "rascunhos",
}

def carregar_dados():
    with JSON_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)

def criar_backup():
    BACKUP_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = BACKUP_DIR / f"index-{ts}.html"
    shutil.copy2(HTML_PATH, dest)
    return dest

def criar_entrada(soup, e):
    article = soup.new_tag("article", attrs={"class": "timeline-entry"})

    time_tag = soup.new_tag(
        "time",
        attrs={"class": "timeline-date", "datetime": e["date"]}
    )

    m = soup.new_tag("span", attrs={"class": "timeline-month"})
    m.string = e["month"]

    y = soup.new_tag("span", attrs={"class": "timeline-year"})
    y.string = str(e["year"])

    time_tag.append(m)
    time_tag.append(y)

    content = soup.new_tag("div", attrs={"class": "timeline-content"})
    text = soup.new_tag("div", attrs={"class": "timeline-text"})

    h3 = soup.new_tag("h3")

    link = e.get("link", "").strip()
    if link:
        a = soup.new_tag("a", href=link)
        a.string = e["title"]
        if link.startswith(("http://", "https://")):
            a["target"] = "_blank"
            a["rel"] = "noopener"
        h3.append(a)
    else:
        h3.string = e["title"]

    p = soup.new_tag("p")
    p.string = e["description"]

    text.append(h3)
    text.append(p)

    figure = soup.new_tag("figure", attrs={"class": "timeline-image"})
    img = soup.new_tag(
        "img",
        src=e["image"],
        alt=e.get("alt", e["title"])
    )
    figure.append(img)

    content.append(text)
    content.append(figure)

    article.append(time_tag)
    article.append(content)

    return article

def atualizar_secao(soup, section_id, entradas):
    section = soup.find("section", id=section_id)
    timeline = section.find("div", class_="timeline")
    timeline.clear()

    entradas = sorted(
        entradas,
        key=lambda x: x.get("date", ""),
        reverse=True
    )

    for e in entradas:
        timeline.append(criar_entrada(soup, e))

def main():
    dados = carregar_dados()
    soup = BeautifulSoup(
        HTML_PATH.read_text(encoding="utf-8"),
        "html.parser"
    )

    for chave, secao in SECTION_IDS.items():
        atualizar_secao(
            soup,
            secao,
            dados.get(chave, [])
        )

    backup = criar_backup()

    HTML_PATH.write_text(
        str(soup),
        encoding="utf-8"
    )

    print("Timeline atualizada.")
    print("Backup:", backup)

if __name__ == "__main__":
    main()
