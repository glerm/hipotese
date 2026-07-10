document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("pesquisa-cards");

  if (!container) return;

  try {
    const response = await fetch("pesquisa.md");

    if (!response.ok) {
      throw new Error(
        `Não foi possível carregar pesquisa.md (${response.status})`
      );
    }

    const source = await response.text();
    const blocks = parseWikiBlocks(source);

    container.innerHTML = "";

    blocks.forEach(({ title, text }) => {
      const article = document.createElement("article");
      article.className = "card";

      const heading = document.createElement("h3");
      heading.textContent = title;

      const paragraph = document.createElement("p");
      paragraph.textContent = text;

      article.appendChild(heading);
      article.appendChild(paragraph);

      container.appendChild(article);
    });
  } catch (error) {
    container.innerHTML = `
      <article class="card">
        <h3>Erro ao carregar pesquisa.md</h3>
        <p>
          Abra o site por um servidor localhost para permitir a leitura do arquivo.
        </p>
      </article>
    `;

    console.error(error);
  }
});

function parseWikiBlocks(source) {
  const lines = source.split(/\r?\n/);

  const blocks = [];

  let currentTitle = "";
  let currentText = [];

  function saveCurrentBlock() {
    if (!currentTitle) return;

    blocks.push({
      title: currentTitle,
      text: currentText.join(" ").trim()
    });
  }

  lines.forEach((line) => {
    const heading = line.match(/^\[([^\]]+)\]\s*$/);

    if (heading) {
      saveCurrentBlock();
      currentTitle = heading[1].trim();
      currentText = [];
      return;
    }

    if (currentTitle && line.trim()) {
      currentText.push(line.trim());
    }
  });

  saveCurrentBlock();

  return blocks;
}