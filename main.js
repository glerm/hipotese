// Configuração do terminal interativo
const terminalOutput = document.getElementById('terminal-output');
const commandInput = document.getElementById('command-input');

commandInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        // Processa o comando
        const command = this.value.trim().toLowerCase();
        let output = '';
        
        // Adiciona o comando digitado ao histórico
        output += `<div>> ${command}</div>`;
        
        // Verifica e exibe a resposta ou mensagem de ajuda
        if (responses[command]) {
            output += `<div>${responses[command]}</div>`;
        } else if (command) {
            output += `<div>Digite: "continue", "elabore" ou "conclua"</div>`;
        }
        
        // Adiciona a saída ao terminal
        terminalOutput.innerHTML += output;
        
        // Limpa o input e mantém o foco
        this.value = '';
        
        // Rola para baixo automaticamente
        terminalOutput.parentNode.scrollTop = terminalOutput.parentNode.scrollHeight;
    }
});