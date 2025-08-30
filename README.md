# 🤖 WhatsApp Group Bot

Bot completo para gerenciamento de grupos WhatsApp desenvolvido em Node.js.

## 📋 Funcionalidades

### 🔧 Comandos de Grupo (Menu 1)
- `/ban` - Remove membro do grupo
- `/add [número]` - Adiciona membro ao grupo  
- `/promote` - Promove membro a admin
- `/demote` - Remove admin de membro
- `/grupo abrir/fechar` - Controla mensagens do grupo
- `/link` - Obtém link do grupo
- `/tagall` - Marca todos os membros

### 📊 Comandos de Informações (Menu 2)
- `/info` - Informações do bot
- `/perfil` - Perfil do usuário
- `/grupo-info` - Informações do grupo
- `/status` - Status do sistema

### 🎮 Comandos de Jogos (Menu 3)
- `/dado` - Rola um dado
- `/moeda` - Cara ou coroa
- `/par [número]` - Par ou ímpar
- `/quiz` - Quiz aleatório

### 🛠️ Comandos de Utilidades (Menu 4)
- `/clima [cidade]` - Previsão do tempo
- `/calc [operação]` - Calculadora
- `/lembrete [tempo] [texto]` - Define lembrete
- `/encurtar [url]` - Encurta URLs

### 🎨 Comandos de Figurinhas (Menu 7)
- `/sticker` - Cria figurinha de imagem
- `/fig` - Alias para sticker
- `/toimg` - Converte figurinha em imagem

## 🚀 Instalação

### Pré-requisitos
- Node.js 16+ instalado
- NPM ou Yarn
- WhatsApp Web funcionando

### Passo a Passo

1. **Clone ou baixe o projeto**
\`\`\`bash
# Se usando Git
git clone <url-do-projeto>
cd whatsapp-group-bot

# Ou extraia o ZIP baixado
\`\`\`

2. **Instale as dependências**
\`\`\`bash
npm install
\`\`\`

3. **Configure o bot**
   - Abra o arquivo `index.js`
   - Na linha 8, altere o número admin:
   \`\`\`js
   adminNumber: '5592999652961', // Seu número aqui
   \`\`\`

4. **Execute o bot**
\`\`\`bash
npm start
\`\`\`

5. **Escaneie o QR Code**
   - Um QR Code aparecerá no terminal
   - Abra o WhatsApp no celular
   - Vá em "Dispositivos conectados"
   - Escaneie o QR Code

6. **Teste o bot**
   - Adicione o bot em um grupo
   - Certifique-se que você (admin) está no grupo
   - Digite `/menu` para ver os comandos

## ⚙️ Configuração

### Estrutura de Arquivos
\`\`\`
whatsapp-group-bot/
├── index.js          # Arquivo principal
├── package.json      # Dependências
├── README.md         # Este arquivo
└── data/             # Dados salvos (criado automaticamente)
    ├── groups.json   # Dados dos grupos
    └── users.json    # Dados dos usuários
\`\`\`

### Configurações Importantes

1. **Número do Admin**: Altere na linha 8 do `index.js`
2. **Prefixo**: Padrão é `/`, pode ser alterado na linha 9
3. **Nome do Bot**: Altere na linha 10

## 🔒 Segurança

- ✅ Bot só funciona em grupos onde o admin está presente
- ✅ Comandos de admin protegidos
- ✅ Verificação de permissões
- ✅ Dados salvos localmente

## 🐛 Solução de Problemas

### Bot não responde
- Verifique se você está no grupo
- Confirme se o QR Code foi escaneado
- Verifique se o bot tem permissões de admin

### Erro ao instalar dependências
\`\`\`bash
# Limpe o cache e reinstale
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
\`\`\`

### Bot desconecta frequentemente
- Use um servidor estável
- Considere usar PM2 para manter o bot rodando:
\`\`\`bash
npm install -g pm2
pm2 start index.js --name whatsapp-bot
\`\`\`

## 📱 Como Usar

1. **Adicione o bot ao grupo**
2. **Certifique-se que você está no grupo**
3. **Digite `/menu` para ver os comandos**
4. **Use `/menu [número]` para menus específicos**

### Exemplos de Uso
\`\`\`
/menu              # Menu principal
/menu 1            # Comandos de grupo
/ban               # Remove membro (responda mensagem)
/add 5511999999999 # Adiciona membro
/clima São Paulo   # Previsão do tempo
/calc 2+2*5        # Calculadora
/sticker           # Cria figurinha (responda imagem)
\`\`\`

## 🔄 Atualizações

Para atualizar o bot:
1. Baixe a nova versão
2. Substitua apenas o `index.js`
3. Mantenha a pasta `data/` para preservar configurações
4. Reinicie o bot

## 📞 Suporte

- Verifique se todas as dependências estão instaladas
- Confirme se o Node.js está atualizado
- Teste em grupos pequenos primeiro
- Mantenha o bot sempre atualizado

## ⚠️ Avisos Importantes

- Use apenas em grupos próprios ou com permissão
- Respeite os termos de uso do WhatsApp
- Mantenha o bot atualizado
- Faça backup dos dados regularmente

---

**Desenvolvido para gerenciamento eficiente de grupos WhatsApp** 🚀
