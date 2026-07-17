import json
import re
import shutil
import unicodedata
import uuid
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup
from flask import (
    Flask,
    flash,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)
from werkzeug.utils import secure_filename


# ============================================================
# CAMINHOS E CONFIGURAÇÕES
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

HTML_PATH = BASE_DIR / "index.html"
JSON_PATH = BASE_DIR / "timeline.json"
BACKUP_DIR = BASE_DIR / "backups"
ASSETS_DIR = BASE_DIR / "assets"
THUMB_DIR = ASSETS_DIR / "img" / "thumbs"

ALLOWED_EXTENSIONS = {
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
}

MAX_SLUG_LENGTH = 42
MAX_FILENAME_LENGTH = 85

SECTION_IDS = {
    "publicacoes": "publicacoes",
    "projetos": "projetos",
    "rascunhos": "rascunhos",
}

SECTION_LABELS = {
    "publicacoes": "Publicações",
    "projetos": "Projetos",
    "rascunhos": "Rascunhos",
}

MONTHS = {
    "01": "JAN",
    "02": "FEV",
    "03": "MAR",
    "04": "ABR",
    "05": "MAI",
    "06": "JUN",
    "07": "JUL",
    "08": "AGO",
    "09": "SET",
    "10": "OUT",
    "11": "NOV",
    "12": "DEZ",
}


# ============================================================
# APLICAÇÃO FLASK
# ============================================================

app = Flask(__name__)

app.secret_key = "timeline-editor-local"

# Limite de upload: 10 MB
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


# ============================================================
# ESTRUTURA DE DIRETÓRIOS E JSON
# ============================================================

def ensure_structure():
    """
    Garante que todas as pastas e arquivos básicos existam.
    """

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)

    if not JSON_PATH.exists():
        initial_data = {
            key: []
            for key in SECTION_IDS
        }

        save_data(initial_data)


def load_data():
    """
    Carrega timeline.json.
    """

    ensure_structure()

    try:
        with JSON_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)

    except json.JSONDecodeError as error:
        raise ValueError(
            f"O arquivo timeline.json contém JSON inválido: {error}"
        ) from error

    for key in SECTION_IDS:
        data.setdefault(key, [])

    return data


def save_data(data):
    """
    Salva os dados no timeline.json.
    """

    JSON_PATH.write_text(
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


# ============================================================
# NOMES DE ARQUIVOS
# ============================================================

def slugify(text):
    """
    Converte um título para um nome seguro de arquivo.
    """

    normalized = unicodedata.normalize("NFKD", text)

    ascii_text = (
        normalized
        .encode("ascii", "ignore")
        .decode("ascii")
    )

    slug = re.sub(
        r"[^a-zA-Z0-9]+",
        "-",
        ascii_text,
    )

    slug = slug.strip("-").lower()

    return slug or "entrada"


def short_slug(text, max_length=MAX_SLUG_LENGTH):
    """
    Cria um slug curto, evitando cortar no meio de uma palavra
    sempre que possível.
    """

    slug = slugify(text)

    if len(slug) <= max_length:
        return slug

    shortened = slug[:max_length]

    if "-" in shortened:
        shortened = shortened.rsplit("-", 1)[0]

    shortened = shortened.rstrip("-")

    return shortened or "entrada"


def allowed_file(filename):
    """
    Verifica se o arquivo possui uma extensão permitida.
    """

    if "." not in filename:
        return False

    extension = filename.rsplit(".", 1)[1].lower()

    return extension in ALLOWED_EXTENSIONS


def build_thumbnail_filename(
    title,
    date_value,
    extension,
):
    """
    Gera um nome curto e único para a thumbnail.
    """

    title_slug = short_slug(title)
    unique_code = uuid.uuid4().hex[:8]

    filename = (
        f"{date_value}-"
        f"{title_slug}-"
        f"{unique_code}."
        f"{extension}"
    )

    return filename


def save_thumbnail(
    file_storage,
    title,
    date_value,
):
    """
    Salva a thumbnail em assets/img/thumbs.
    """

    if not file_storage:
        return ""

    if not file_storage.filename:
        return ""

    if not allowed_file(file_storage.filename):
        allowed = ", ".join(
            sorted(ALLOWED_EXTENSIONS)
        )

        raise ValueError(
            f"Formato de imagem não permitido. "
            f"Use: {allowed}."
        )

    safe_original_name = secure_filename(
        file_storage.filename
    )

    if "." not in safe_original_name:
        raise ValueError(
            "Não foi possível identificar a extensão da imagem."
        )

    extension = (
        safe_original_name
        .rsplit(".", 1)[1]
        .lower()
    )

    filename = build_thumbnail_filename(
        title=title,
        date_value=date_value,
        extension=extension,
    )

    destination = THUMB_DIR / filename

    file_storage.save(destination)

    return f"assets/img/thumbs/{filename}"


# ============================================================
# MIGRAÇÃO DE NOMES ANTIGOS
# ============================================================

def migrate_long_thumbnail_names():
    """
    Renomeia thumbnails antigas com nomes excessivamente longos.

    Também atualiza os caminhos correspondentes no timeline.json.

    Retorna True quando alguma mudança foi realizada.
    """

    if not JSON_PATH.exists():
        return False

    data = load_data()
    changed = False

    for section_name in SECTION_IDS:
        entries = data.get(section_name, [])

        for entry in entries:
            image_path = entry.get("image", "").strip()

            if not image_path.startswith(
                "assets/img/thumbs/"
            ):
                continue

            old_filename = Path(image_path).name

            if len(old_filename) <= MAX_FILENAME_LENGTH:
                continue

            old_file_path = BASE_DIR / image_path

            if not old_file_path.exists():
                continue

            extension = (
                old_file_path
                .suffix
                .lstrip(".")
                .lower()
            )

            if extension not in ALLOWED_EXTENSIONS:
                continue

            date_value = entry.get(
                "date",
                "sem-data",
            )

            title = entry.get(
                "title",
                "entrada",
            )

            new_filename = build_thumbnail_filename(
                title=title,
                date_value=date_value,
                extension=extension,
            )

            new_file_path = THUMB_DIR / new_filename

            while new_file_path.exists():
                new_filename = build_thumbnail_filename(
                    title=title,
                    date_value=date_value,
                    extension=extension,
                )

                new_file_path = THUMB_DIR / new_filename

            old_file_path.rename(new_file_path)

            entry["image"] = (
                f"assets/img/thumbs/{new_filename}"
            )

            changed = True

            print(
                "Thumbnail renomeada:"
            )

            print(
                f"  antigo: {old_filename}"
            )

            print(
                f"  novo:   {new_filename}"
            )

    if changed:
        save_data(data)

    return changed


# ============================================================
# BACKUPS
# ============================================================

def create_backup():
    """
    Cria uma cópia do index.html antes da alteração.
    """

    if not HTML_PATH.exists():
        raise FileNotFoundError(
            "index.html não encontrado."
        )

    BACKUP_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    timestamp = datetime.now().strftime(
        "%Y%m%d-%H%M%S-%f"
    )

    destination = (
        BACKUP_DIR
        / f"index-{timestamp}.html"
    )

    shutil.copy2(
        HTML_PATH,
        destination,
    )

    return destination


# ============================================================
# GERAÇÃO DAS ENTRADAS HTML
# ============================================================

def create_entry_tag(soup, entry):
    """
    Constrói uma entrada da timeline.
    """

    article = soup.new_tag(
        "article",
        attrs={
            "class": "timeline-entry",
        },
    )

    time_tag = soup.new_tag(
        "time",
        attrs={
            "class": "timeline-date",
            "datetime": entry["date"],
        },
    )

    month = soup.new_tag(
        "span",
        attrs={
            "class": "timeline-month",
        },
    )

    month.string = entry["month"]

    year = soup.new_tag(
        "span",
        attrs={
            "class": "timeline-year",
        },
    )

    year.string = str(entry["year"])

    time_tag.append(month)
    time_tag.append(year)

    content = soup.new_tag(
        "div",
        attrs={
            "class": "timeline-content",
        },
    )

    text = soup.new_tag(
        "div",
        attrs={
            "class": "timeline-text",
        },
    )

    heading = soup.new_tag("h3")

    link = entry.get(
        "link",
        "",
    ).strip()

    if link:
        anchor = soup.new_tag(
            "a",
            href=link,
        )

        anchor.string = entry["title"]

        if link.startswith(
            (
                "http://",
                "https://",
            )
        ):
            anchor["target"] = "_blank"
            anchor["rel"] = "noopener"

        heading.append(anchor)

    else:
        heading.string = entry["title"]

    paragraph = soup.new_tag("p")
    paragraph.string = entry["description"]

    text.append(heading)
    text.append(paragraph)

    content.append(text)

    image_path = entry.get(
        "image",
        "",
    ).strip()

    if image_path:
        figure = soup.new_tag(
            "figure",
            attrs={
                "class": "timeline-image",
            },
        )

        image = soup.new_tag(
            "img",
            src=image_path,
            alt=(
                entry.get("alt", "").strip()
                or entry["title"]
            ),
        )

        figure.append(image)
        content.append(figure)

    article.append(time_tag)
    article.append(content)

    return article


def generate_html():
    """
    Recria as três timelines no index.html.
    """

    if not HTML_PATH.exists():
        raise FileNotFoundError(
            "index.html não encontrado."
        )

    data = load_data()

    html_content = HTML_PATH.read_text(
        encoding="utf-8"
    )

    soup = BeautifulSoup(
        html_content,
        "html.parser",
    )

    for section_key, section_id in SECTION_IDS.items():
        section = soup.find(
            "section",
            id=section_id,
        )

        if section is None:
            raise ValueError(
                f"Seção #{section_id} não encontrada "
                f"no index.html."
            )

        timeline = section.find(
            "div",
            class_="timeline",
        )

        if timeline is None:
            raise ValueError(
                f"Timeline da seção #{section_id} "
                f"não encontrada."
            )

        timeline.clear()

        entries = sorted(
            data.get(section_key, []),
            key=lambda item: (
                item.get("date", ""),
                item.get("title", ""),
            ),
            reverse=True,
        )

        for entry in entries:
            timeline.append(
                create_entry_tag(
                    soup,
                    entry,
                )
            )

    backup = create_backup()

    HTML_PATH.write_text(
        str(soup),
        encoding="utf-8",
    )

    return backup


# ============================================================
# BUSCA DE ENTRADAS
# ============================================================

def find_entry(data, entry_id):
    """
    Localiza uma entrada pelo ID.
    """

    for section, entries in data.items():
        for entry in entries:
            if entry.get("id") == entry_id:
                return section, entry

    return None, None


# ============================================================
# ROTAS DO EDITOR
# ============================================================

@app.route("/")
def index():
    """
    Página principal do editor.
    """

    data = load_data()

    return render_template(
        "editor.html",
        data=data,
        labels=SECTION_LABELS,
        months=MONTHS,
    )


@app.post("/add")
def add_entry():
    """
    Adiciona uma nova entrada.
    """

    data = load_data()

    section = request.form.get(
        "section",
        "",
    ).strip()

    date_value = request.form.get(
        "date",
        "",
    ).strip()

    title = request.form.get(
        "title",
        "",
    ).strip()

    description = request.form.get(
        "description",
        "",
    ).strip()

    link = request.form.get(
        "link",
        "",
    ).strip()

    alt = request.form.get(
        "alt",
        "",
    ).strip()

    if section not in SECTION_IDS:
        flash(
            "Selecione uma seção válida.",
            "error",
        )

        return redirect(
            url_for("index")
        )

    if not date_value:
        flash(
            "Informe a data.",
            "error",
        )

        return redirect(
            url_for("index")
        )

    if not title:
        flash(
            "Informe o título.",
            "error",
        )

        return redirect(
            url_for("index")
        )

    if not description:
        flash(
            "Informe a descrição.",
            "error",
        )

        return redirect(
            url_for("index")
        )

    try:
        year, month_number = date_value.split("-")

        year_number = int(year)

        if month_number not in MONTHS:
            raise ValueError(
                "Mês inválido."
            )

        image_path = save_thumbnail(
            file_storage=request.files.get("image"),
            title=title,
            date_value=date_value,
        )

    except (ValueError, OSError) as error:
        flash(
            str(error),
            "error",
        )

        return redirect(
            url_for("index")
        )

    entry = {
        "id": uuid.uuid4().hex,
        "date": date_value,
        "month": MONTHS[month_number],
        "year": year_number,
        "title": title,
        "description": description,
        "link": link,
        "image": image_path,
        "alt": alt or title,
    }

    data[section].append(entry)

    save_data(data)

    try:
        generate_html()

        flash(
            "Entrada adicionada e index.html atualizado.",
            "success",
        )

    except Exception as error:
        flash(
            (
                "A entrada foi salva no timeline.json, "
                "mas o index.html não foi gerado: "
                f"{error}"
            ),
            "error",
        )

    return redirect(
        url_for("index")
    )


@app.post("/delete/<entry_id>")
def delete_entry(entry_id):
    """
    Exclui uma entrada e sua thumbnail.
    """

    data = load_data()

    section, entry = find_entry(
        data,
        entry_id,
    )

    if not entry:
        flash(
            "Entrada não encontrada.",
            "error",
        )

        return redirect(
            url_for("index")
        )

    data[section] = [
        item
        for item in data[section]
        if item.get("id") != entry_id
    ]

    image_path = entry.get(
        "image",
        "",
    ).strip()

    if image_path.startswith(
        "assets/img/thumbs/"
    ):
        file_path = BASE_DIR / image_path

        try:
            if file_path.exists():
                file_path.unlink()

        except OSError as error:
            print(
                f"Não foi possível excluir a imagem: {error}"
            )

    save_data(data)

    try:
        generate_html()

        flash(
            "Entrada excluída.",
            "success",
        )

    except Exception as error:
        flash(
            (
                "A entrada foi excluída do JSON, "
                "mas o HTML não foi regenerado: "
                f"{error}"
            ),
            "error",
        )

    return redirect(
        url_for("index")
    )


@app.post("/generate")
def regenerate():
    """
    Regenera manualmente o index.html.
    """

    try:
        backup = generate_html()

        flash(
            (
                "index.html gerado. "
                f"Backup criado: {backup.name}"
            ),
            "success",
        )

    except Exception as error:
        flash(
            str(error),
            "error",
        )

    return redirect(
        url_for("index")
    )


# ============================================================
# ROTAS DOS ARQUIVOS DO SITE
# ============================================================

@app.route("/site")
def view_site():
    """
    Exibe o index.html do site.
    """

    response = send_from_directory(
        BASE_DIR,
        "index.html",
    )

    response.headers["Cache-Control"] = (
        "no-cache, no-store, must-revalidate"
    )

    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    return response


@app.route("/assets/<path:filename>")
def assets(filename):
    """
    Serve CSS, JavaScript, imagens e thumbnails.
    """

    response = send_from_directory(
        ASSETS_DIR,
        filename,
        conditional=False,
        max_age=0,
    )

    response.headers["Cache-Control"] = (
        "no-cache, no-store, must-revalidate"
    )

    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    return response


# ============================================================
# TRATAMENTO DE ERROS
# ============================================================

@app.errorhandler(413)
def file_too_large(error):
    """
    Trata uploads maiores que 10 MB.
    """

    flash(
        "A imagem ultrapassa o limite de 10 MB.",
        "error",
    )

    return redirect(
        url_for("index")
    )


# ============================================================
# INICIALIZAÇÃO
# ============================================================

if __name__ == "__main__":
    ensure_structure()

    try:
        thumbnails_changed = migrate_long_thumbnail_names()

        if thumbnails_changed:
            print(
                "Nomes antigos de thumbnails foram corrigidos."
            )

            generate_html()

            print(
                "timeline.json e index.html foram atualizados."
            )

    except Exception as error:
        print(
            "Não foi possível migrar as thumbnails antigas:"
        )

        print(error)

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False,
    )
