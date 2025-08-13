// Objeto para armazenar as respostas
const responses = {};

// Carrega textos do arquivo HTML
async function loadTexts() {
    try {
        const response = await fetch('textos.html');
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        responses.continue = doc.getElementById('continue').textContent.trim();
        responses.elabore = doc.getElementById('elabore').textContent.trim();
        responses.conclua = doc.getElementById('conclua').textContent.trim();
        responses.codigos = doc.getElementById('codigos').textContent.trim();
        
        console.log('Textos carregados!', responses);
    } catch (error) {
        console.error('Erro ao carregar textos:', error);
        // Fallback
        responses.continue = 'Texto padrão (continue)';
        responses.elabore = 'Texto padrão (elabore)';
        responses.conclua = 'Texto padrão (conclua)';
        responses.codigos = 'Texto padrão (codigos)';
        responses.rascunhos = 'Texto padrão (rascunhos)';
    }
}

// Chama a função ao carregar a página
loadTexts();

// Restante do seu código do terminal...
const terminalOutput = document.getElementById('terminal-output');
const commandInput = document.getElementById('command-input');

commandInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const command = this.value.trim().toLowerCase();
        let output = `<div>> ${command}</div>`;
        
        if (responses[command]) {
            output += `<div>${responses[command]}</div>`;
        } else if (command) {
            output += `<div>Digite: "continue", "elabore", "rascunhos", "codigos" ou "conclua"</div>`;
        }
        
        terminalOutput.innerHTML += output;
        this.value = '';
        terminalOutput.parentNode.scrollTop = terminalOutput.parentNode.scrollHeight;
    }
});
