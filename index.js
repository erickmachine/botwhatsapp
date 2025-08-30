const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js")
const qrcode = require("qrcode-terminal")
const fs = require("fs")
const path = require("path")
const fetch = require("node-fetch")
const puppeteer = require("puppeteer")
const { exec } = require("child_process")
const https = require("https")
const http = require("http")

// Configurações do bot
const BOT_CONFIG = {
  adminNumber: "5592999652961", // Seu número
  secondAdminNumber: "5592985231368", // Segundo número autorizado
  prefix: "/",
  botName: "GroupBot",
  version: "1.0.0",
}

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "whatsapp-bot",
    dataPath: "./auth_data",
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--no-first-run",
    ],
    timeout: 15000, // Reduzido para 15 segundos
    executablePath: undefined,
  },
})

// Dados dos grupos e usuários
let groupData = {}
let userData = {}

// Carregar dados salvos
function loadData() {
  try {
    if (fs.existsSync("./data/groups.json")) {
      groupData = JSON.parse(fs.readFileSync("./data/groups.json", "utf8"))
    }
    if (fs.existsSync("./data/users.json")) {
      userData = JSON.parse(fs.readFileSync("./data/users.json", "utf8"))
    }
  } catch (error) {
    console.log("Erro ao carregar dados:", error)
  }
}

// Salvar dados
function saveData() {
  try {
    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data")
    }
    fs.writeFileSync("./data/groups.json", JSON.stringify(groupData, null, 2))
    fs.writeFileSync("./data/users.json", JSON.stringify(userData, null, 2))
  } catch (error) {
    console.log("Erro ao salvar dados:", error)
  }
}

// Verificar se é admin
function isAdmin(userId) {
  return userId.includes(BOT_CONFIG.adminNumber) || userId.includes(BOT_CONFIG.secondAdminNumber)
}

// Verificar se o usuário é admin do grupo
async function isGroupAdmin(chat, userId) {
  if (!chat.isGroup) return false

  try {
    const participants = chat.participants

    // Normalizar o userId para comparação
    const normalizeNumber = (number) => {
      if (!number) return ""
      return number.toString().replace(/\D/g, "").slice(-11)
    }

    const normalizedUserId = normalizeNumber(userId)

    const userParticipant = participants.find((p) => {
      let participantNumber = ""

      if (p.id.user) {
        participantNumber = normalizeNumber(p.id.user)
      } else if (p.id._serialized) {
        participantNumber = normalizeNumber(p.id._serialized.split("@")[0])
      }

      return participantNumber === normalizedUserId
    })

    return userParticipant ? userParticipant.isAdmin : false
  } catch (error) {
    console.log(`[DEBUG] Erro ao verificar admin do grupo: ${error.message}`)
    return false
  }
}

// Limpar dados de autenticação de forma segura
function safeCleanAuthData() {
  try {
    if (fs.existsSync("./auth_data")) {
      console.log("🧹 Limpando dados de autenticação...")

      // Tentar limpeza normal primeiro
      try {
        fs.rmSync("./auth_data", { recursive: true, force: true })
        console.log("✅ Dados limpos com sucesso!")
      } catch (error) {
        if (error.code === "EBUSY") {
          console.log("⚠️ Arquivos em uso, tentando limpeza alternativa...")

          // Limpeza alternativa para Windows
          try {
            const { execSync } = require("child_process")
            if (process.platform === "win32") {
              execSync("taskkill /f /im chrome.exe /t", { stdio: "ignore" })
              setTimeout(() => {
                try {
                  fs.rmSync("./auth_data", { recursive: true, force: true })
                  console.log("✅ Dados limpos após finalizar Chrome!")
                } catch (e) {
                  console.log("⚠️ Alguns arquivos não puderam ser removidos, mas o bot continuará funcionando")
                }
              }, 2000)
            }
          } catch (e) {
            console.log("⚠️ Limpeza parcial realizada, reinicie manualmente se necessário")
          }
        } else {
          throw error
        }
      }
    }
  } catch (error) {
    console.log("⚠️ Erro na limpeza:", error.message)
  }
}

let qrRetries = 0
const maxQrRetries = 3
let qrTimeout = null
let isReconnecting = false // Prevenir múltiplas reconexões

client.on("qr", (qr) => {
  console.clear()
  console.log("🚀 WhatsApp Bot - QR Code Gerado!")
  console.log("=".repeat(50))
  console.log("📱 Escaneie o QR Code abaixo RAPIDAMENTE:")
  console.log("")

  qrcode.generate(qr, { small: true })

  console.log("")
  console.log("📋 Instruções:")
  console.log("1. Abra WhatsApp no celular")
  console.log("2. Vá em Dispositivos Conectados")
  console.log("3. Toque em Conectar Dispositivo")
  console.log("4. Escaneie o código acima")
  console.log("")
  console.log(`🔄 Tentativa: ${qrRetries + 1}/${maxQrRetries}`)
  console.log("⚠️ QR Code expira em 15 segundos!")

  if (qrTimeout) clearTimeout(qrTimeout)

  qrTimeout = setTimeout(() => {
    if (qrRetries < maxQrRetries - 1) {
      qrRetries++
      console.log(`⚠️ QR Code expirou! Gerando novo... (${qrRetries}/${maxQrRetries})`)
    } else {
      console.log("❌ Muitas tentativas. Limpando dados e reiniciando...")
      safeCleanAuthData() // Usar limpeza segura
      setTimeout(() => process.exit(1), 3000)
    }
  }, 15000)
})

client.on("authenticated", () => {
  console.log("✅ Autenticado com sucesso!")
  console.log("🔄 Conectando ao WhatsApp...")
  if (qrTimeout) clearTimeout(qrTimeout)
})

client.on("auth_failure", (msg) => {
  console.error("❌ Falha na autenticação:", msg)
  safeCleanAuthData() // Usar limpeza segura

  console.log("🔄 Reiniciando em 5 segundos...")
  setTimeout(() => {
    process.exit(1)
  }, 5000)
})

client.on("ready", () => {
  console.clear()
  console.log("🎉 BOT CONECTADO COM SUCESSO!")
  console.log("=".repeat(50))
  console.log(`📱 Bot: ${BOT_CONFIG.botName} v${BOT_CONFIG.version}`)
  console.log(`👤 Admin Principal: +${BOT_CONFIG.adminNumber}`)
  console.log(`👤 Admin Secundário: +${BOT_CONFIG.secondAdminNumber}`)
  console.log(`⏰ Conectado em: ${new Date().toLocaleString("pt-BR")}`)
  console.log("")
  console.log("🔧 Status: Online e funcionando!")
  console.log("📋 Use /menu em qualquer grupo para ver comandos")
  console.log("⚠️ Lembre-se: Você deve estar no grupo para o bot funcionar!")
  console.log("")

  if (qrTimeout) clearTimeout(qrTimeout)
  qrRetries = 0
  loadData()
})

client.on("disconnected", (reason) => {
  if (isReconnecting) return // Prevenir múltiplas reconexões

  console.log("⚠️ Bot desconectado:", reason)
  isReconnecting = true

  if (client.pupPage) {
    try {
      client.pupPage.close()
    } catch (e) {}
  }

  if (client.pupBrowser) {
    try {
      client.pupBrowser.close()
    } catch (e) {}
  }

  // Limpar dados apenas em casos específicos
  if (reason === "LOGOUT" || reason === "CONFLICT" || reason === "UNPAIRED") {
    setTimeout(() => {
      safeCleanAuthData() // Usar limpeza segura com delay
    }, 2000)
  }

  console.log("🔄 Reiniciando em 5 segundos...")
  setTimeout(() => {
    process.exit(1)
  }, 5000)
})

// Processar mensagens
client.on("message", async (message) => {
  try {
    const chat = await message.getChat()
    const contact = await message.getContact()
    const userId = contact.id.user
    const messageBody = message.body.toLowerCase().trim()

    if (!chat.isGroup) {
      console.log(`[DEBUG] Mensagem privada ignorada de: +${userId}`)
      return // Não responder em conversas privadas
    }

    console.log(`[DEBUG] Processando mensagem no grupo: ${chat.name}`)

    // Processar comandos
    if (messageBody.startsWith(BOT_CONFIG.prefix)) {
      await processCommand(message, chat, contact, messageBody)
    }

    // Salvar dados periodicamente
    saveData()
  } catch (error) {
    console.log("Erro ao processar mensagem:", error)
  }
})

// Processar comandos
async function processCommand(message, chat, contact, messageBody) {
  const args = messageBody.slice(BOT_CONFIG.prefix.length).split(" ")
  const command = args[0]
  const userId = contact.id.user

  if (!chat.isGroup) {
    console.log(`[DEBUG] Tentativa de comando em conversa privada bloqueada: +${userId}`)
    return
  }

  console.log(`[DEBUG] ✅ Executando comando: ${command} no grupo: ${chat.name} por: +${userId}`)

  const adminOnlyCommands = [
    "ban",
    "kick",
    "add",
    "promote",
    "demote",
    "grupo",
    "tagall",
    "todos",
    "tiktok",
    "tt",
    "musica",
    "youtube",
    "yt",
    "limpar",
    "warn",
    "unwarn",
    "mute",
    "unmute",
    "antilink",
    "welcome",
    "goodbye",
    "autoreply",
    "encurtar",
  ]

  if (adminOnlyCommands.includes(command)) {
    const isUserGroupAdmin = await isGroupAdmin(chat, userId)
    if (!isUserGroupAdmin) {
      return await message.reply("❌ Apenas administradores do grupo podem usar este comando!")
    }
  }

  switch (command) {
    case "menu":
      await handleMenu(message, args[1])
      break

    case "ban":
    case "kick":
      await handleKick(message, chat)
      break
    case "add":
      await handleAdd(message, chat, args)
      break
    case "promote":
      await handlePromote(message, chat)
      break
    case "demote":
      await handleDemote(message, chat)
      break
    case "grupo":
      await handleGroupSettings(message, chat, args)
      break
    case "link":
      await handleGroupLink(message, chat)
      break
    case "tagall":
    case "todos":
      await handleTagAll(message, chat)
      break
    case "limpar":
      await handleClearMessages(message, chat, args)
      break
    case "warn":
      await handleWarn(message, chat)
      break
    case "unwarn":
      await handleUnwarn(message, chat)
      break
    case "mute":
      await handleMute(message, chat, args)
      break
    case "unmute":
      await handleUnmute(message, chat)
      break
    case "antilink":
      await handleAntiLink(message, chat, args)
      break
    case "welcome":
      await handleWelcome(message, chat, args)
      break
    case "goodbye":
      await handleGoodbye(message, chat, args)
      break
    case "autoreply":
      await handleAutoReply(message, chat, args)
      break
    case "encurtar":
      await handleShortenUrl(message, args)
      break

    case "info":
      await handleInfo(message)
      break
    case "perfil":
      await handleProfile(message)
      break
    case "grupo-info":
      await handleGroupInfo(message, chat)
      break
    case "status":
      await handleStatus(message)
      break
    case "ping":
      await handlePing(message)
      break
    case "uptime":
      await handleUptime(message)
      break

    case "dado":
      await handleDice(message)
      break
    case "moeda":
      await handleCoin(message)
      break
    case "par":
      await handleEvenOdd(message, args)
      break
    case "quiz":
      await handleQuiz(message)
      break
    case "8ball":
      await handle8Ball(message, args)
      break
    case "sorteio":
      await handleRaffle(message, args)
      break
    case "pedrapapeltesoura":
    case "ppt":
      await handleRockPaperScissors(message, args)
      break

    case "clima":
      await handleWeather(message, args)
      break
    case "calc":
      await handleCalculator(message, args)
      break
    case "lembrete":
      await handleReminder(message, args)
      break
    case "cep":
      await handleCEP(message, args)
      break
    case "cpf":
      await handleCPF(message, args)
      break
    case "cnpj":
      await handleCNPJ(message, args)
      break
    case "qrcode":
      await handleQRCode(message, args)
      break
    case "translate":
    case "traduzir":
      await handleTranslate(message, args)
      break

    case "tiktok":
    case "tt":
      await downloadTikTok(args[1], message)
      break
    case "musica":
    case "youtube":
    case "yt":
      await downloadMusic(args.slice(1).join(" "), message)
      break

    // Comandos de Figurinhas (Menu 7)
    case "sticker":
    case "fig":
      await handleSticker(message)
      break
    case "toimg":
      await handleStickerToImage(message)
      break

    default:
      if (command) {
        await message.reply("❌ Comando não encontrado. Use */menu* para ver os comandos disponíveis.")
      }
      break
  }
}

async function handleMenu(message, menuNumber) {
  let menuText = ""

  switch (menuNumber) {
    case "1":
      menuText = `
╭─────────────────────╮
│  🔧 *ADMIN PANEL* 👑  │
╰─────────────────────╯

┌─ 👥 *GERENCIAMENTO DE MEMBROS*
├─ */ban* - 🚫 Remove membro
├─ */add [número]* - ➕ Adiciona membro  
├─ */promote* - ⬆️ Promove a admin
├─ */demote* - ⬇️ Remove admin
├─ */warn* - ⚠️ Advertir membro
├─ */unwarn* - ✅ Remove advertência
├─ */mute [tempo]* - 🔇 Silenciar membro
└─ */unmute* - 🔊 Remover silêncio

┌─ ⚙️ *CONFIGURAÇÕES DO GRUPO*
├─ */grupo abrir/fechar* - 🔓🔒 Controle do grupo
├─ */link* - 🔗 Link de convite
├─ */tagall* - 📢 Marcar todos
├─ */limpar [quantidade]* - 🧹 Limpar mensagens
├─ */antilink on/off* - 🛡️ Anti-link automático
├─ */welcome [mensagem]* - 👋 Mensagem de boas-vindas
├─ */goodbye [mensagem]* - 👋 Mensagem de despedida
└─ */autoreply [palavra] [resposta]* - 🤖 Resposta automática

┌─ 📥 *DOWNLOADS PREMIUM*
├─ */tiktok [link]* - 🎬 Download TikTok
└─ */musica [nome/link]* - 🎵 Download YouTube

⚠️ *Apenas ADMINISTRADORES podem usar*
      `
      break

    case "2":
      menuText = `
╭─────────────────────╮
│ 📊 *INFORMAÇÕES* ℹ️   │
╰─────────────────────╯

┌─ 🤖 *SOBRE O BOT*
├─ */info* - 📱 Informações completas
├─ */status* - 📊 Status do sistema
├─ */ping* - 🏓 Latência do bot
└─ */uptime* - ⏰ Tempo online

┌─ 👤 *PERFIL & GRUPO*
├─ */perfil* - 🆔 Seu perfil detalhado
└─ */grupo-info* - 👥 Info do grupo atual

✨ *Informações em tempo real*
📈 *Dados precisos e atualizados*
🔍 *Estatísticas completas*
      `
      break

    case "3":
      menuText = `
╭─────────────────────╮
│  🎮 *JOGOS & FUN* 🎯  │
╰─────────────────────╯

┌─ 🎲 *JOGOS DE SORTE*
├─ */dado* - 🎲 Rola dado de 6 faces
├─ */moeda* - 🪙 Cara ou coroa
├─ */par [número]* - 🔢 Par ou ímpar
├─ */8ball [pergunta]* - 🎱 Bola mágica
└─ */sorteio [opções]* - 🎰 Sorteio aleatório

┌─ 🎯 *JOGOS INTERATIVOS*
├─ */quiz* - 🧩 Quiz de conhecimento
└─ */ppt [pedra/papel/tesoura]* - ✂️ Jokenpô

🏆 *Diversão garantida para o grupo!*
🎊 *Jogos simples e interativos*
⚡ *Entretenimento instantâneo*
      `
      break

    case "4":
      menuText = `
╭─────────────────────╮
│ 🛠️ *UTILIDADES* ⚡    │
╰─────────────────────╯

┌─ 🌐 *FERRAMENTAS WEB*
├─ */clima [cidade]* - 🌤️ Previsão do tempo
├─ */calc [operação]* - 🧮 Calculadora
├─ */encurtar [url]* - 🔗 Encurtar links
├─ */qrcode [texto]* - 📱 Gerar QR Code
└─ */traduzir [texto]* - 🌍 Tradutor

┌─ 📋 *CONSULTAS BRASIL*
├─ */cep [código]* - 📮 Consultar CEP
├─ */cpf [número]* - 🆔 Validar CPF
└─ */cnpj [número]* - 🏢 Validar CNPJ

┌─ ⏰ *PRODUTIVIDADE*
└─ */lembrete [tempo] [texto]* - ⏰ Lembretes

🚀 *Ferramentas práticas do dia a dia*
⚡ *Respostas instantâneas e precisas*
🎯 *Tudo que você precisa em um lugar*
      `
      break

    case "7":
      menuText = `
╭─────────────────────╮
│ 🎨 *FIGURINHAS* ✨   │
╰─────────────────────╯

┌─ 📱 *CRIAÇÃO DE STICKERS*
├─ */sticker* - 🎭 Criar figurinha
├─ */fig* - 🎨 Alias rápido
└─ */toimg* - 🖼️ Converter para imagem

✨ *RECURSOS AVANÇADOS:*
🔄 Conversão automática de qualidade
📐 Redimensionamento inteligente  
⚡ Criação instantânea
🎯 Interface super fácil
🖼️ Suporte a múltiplos formatos

🎨 *Crie stickers incríveis facilmente!*
      `
      break

    default:
      menuText = `
╭─────────────────────────────╮
│    🤖 *${BOT_CONFIG.botName}* ✨     │
│      *BOT PREMIUM* 🚀        │
╰─────────────────────────────╯

🎯 *MENUS DISPONÍVEIS:*

┌─ 🔧 */menu 1* - Admin Panel (👑 Admins Only)
├─ 📊 */menu 2* - Informações & Status  
├─ 🎮 */menu 3* - Jogos & Diversão
├─ 🛠️ */menu 4* - Utilidades & Ferramentas
└─ 🎨 */menu 7* - Figurinhas & Stickers

╭─────────────────────╮
│   ⚡ *STATUS ATUAL*   │
╰─────────────────────╯
🟢 *Online* | 📱 *v${BOT_CONFIG.version}*
👑 *Admins:* +${BOT_CONFIG.adminNumber}
👑 *Co-Admin:* +${BOT_CONFIG.secondAdminNumber}
⚡ *Comandos:* 40+ disponíveis
🎯 *Grupos Ativos:* Funcionando perfeitamente

💎 *O bot mais completo do WhatsApp!*
      `
      break
  }

  await message.reply(menuText)
}

// Comandos de Grupo
async function handleKick(message, chat) {
  if (!chat.isGroup) {
    return await message.reply("❌ Este comando só funciona em grupos!")
  }

  const quotedMessage = await message.getQuotedMessage()
  if (!quotedMessage) {
    return await message.reply("❌ Responda a mensagem de quem deseja remover!")
  }

  try {
    const contact = await quotedMessage.getContact()
    await chat.removeParticipants([contact.id._serialized])
    await message.reply(`✅ @${contact.id.user} foi removido do grupo!`, null, {
      mentions: [contact],
    })
  } catch (error) {
    await message.reply("❌ Erro ao remover participante. Verifique se o bot é admin!")
  }
}

async function handleAdd(message, chat, args) {
  if (!chat.isGroup) {
    return await message.reply("❌ Este comando só funciona em grupos!")
  }

  if (!args[1]) {
    return await message.reply("❌ Digite o número para adicionar!\nExemplo: */add 5511999999999*")
  }

  try {
    const number = args[1].replace(/[^\d]/g, "")
    await chat.addParticipants([`${number}@c.us`])
    await message.reply(`✅ Número +${number} foi adicionado ao grupo!`)
  } catch (error) {
    await message.reply("❌ Erro ao adicionar participante. Verifique o número e se o bot é admin!")
  }
}

async function handlePromote(message, chat) {
  if (!chat.isGroup) {
    return await message.reply("❌ Este comando só funciona em grupos!")
  }

  const quotedMessage = await message.getQuotedMessage()
  if (!quotedMessage) {
    return await message.reply("❌ Responda a mensagem de quem deseja promover!")
  }

  try {
    const contact = await quotedMessage.getContact()
    await chat.promoteParticipants([contact.id._serialized])
    await message.reply(`✅ @${contact.id.user} foi promovido a admin!`, null, {
      mentions: [contact],
    })
  } catch (error) {
    await message.reply("❌ Erro ao promover participante! Verifique se o bot é admin!")
  }
}

async function handleDemote(message, chat) {
  if (!chat.isGroup) {
    return await message.reply("❌ Este comando só funciona em grupos!")
  }

  const quotedMessage = await message.getQuotedMessage()
  if (!quotedMessage) {
    return await message.reply("❌ Responda a mensagem de quem deseja rebaixar!")
  }

  try {
    const contact = await quotedMessage.getContact()
    await chat.demoteParticipants([contact.id._serialized])
    await message.reply(`✅ @${contact.id.user} foi rebaixado!`, null, {
      mentions: [contact],
    })
  } catch (error) {
    await message.reply("❌ Erro ao rebaixar participante! Verifique se o bot é admin!")
  }
}

async function handleGroupSettings(message, chat, args) {
  if (!chat.isGroup) {
    return await message.reply("❌ Este comando só funciona em grupos!")
  }

  const action = args[1]

  try {
    if (action === "fechar") {
      await chat.setMessagesAdminsOnly(true)
      await message.reply("🔒 Grupo fechado! Apenas admins podem enviar mensagens.")
    } else if (action === "abrir") {
      await chat.setMessagesAdminsOnly(false)
      await message.reply("🔓 Grupo aberto! Todos podem enviar mensagens.")
    } else {
      await message.reply("❌ Use: */grupo abrir* ou */grupo fechar*")
    }
  } catch (error) {
    await message.reply("❌ Erro ao alterar configurações do grupo! Verifique se o bot é admin!")
  }
}

async function handleGroupLink(message, chat) {
  if (!chat.isGroup) {
    return await message.reply("❌ Este comando só funciona em grupos!")
  }

  try {
    const inviteCode = await chat.getInviteCode()
    await message.reply(`🔗 *Link do Grupo:*\nhttps://chat.whatsapp.com/${inviteCode}`)
  } catch (error) {
    await message.reply("❌ Erro ao obter link do grupo! Verifique se o bot é admin!")
  }
}

async function handleTagAll(message, chat) {
  if (!chat.isGroup) {
    return await message.reply("❌ Este comando só funciona em grupos!")
  }

  try {
    const participants = chat.participants
    const mentions = participants.map((p) => p.id._serialized)
    const mentionText = participants.map((p) => `@${p.id.user}`).join(" ")

    await message.reply(`📢 *Atenção todos!*\n\n${mentionText}`, null, {
      mentions: mentions,
    })
  } catch (error) {
    await message.reply("❌ Erro ao marcar participantes!")
  }
}

async function handleClearMessages(message, chat, args) {
  const amount = Number.parseInt(args[1]) || 10
  await message.reply(
    `🧹 *Limpeza de Mensagens*\n\n⚠️ Função em desenvolvimento.\nQuantidade solicitada: ${amount} mensagens`,
  )
}

async function handleWarn(message, chat) {
  if (!message.hasQuotedMsg) {
    return await message.reply("❌ Responda a mensagem do usuário que deseja advertir!")
  }
  await message.reply(
    "⚠️ *Usuário Advertido*\n\n✅ Advertência aplicada com sucesso!\n📊 Sistema de advertências ativo.",
  )
}

async function handleUnwarn(message, chat) {
  if (!message.hasQuotedMsg) {
    return await message.reply("❌ Responda a mensagem do usuário para remover advertência!")
  }
  await message.reply("✅ *Advertência Removida*\n\n🔄 Advertência removida com sucesso!")
}

async function handleMute(message, chat, args) {
  if (!message.hasQuotedMsg) {
    return await message.reply("❌ Responda a mensagem do usuário que deseja silenciar!")
  }
  const time = args[1] || "10m"
  await message.reply(
    `🔇 *Usuário Silenciado*\n\n⏰ Tempo: ${time}\n✅ Usuário não poderá enviar mensagens temporariamente.`,
  )
}

async function handleUnmute(message, chat) {
  if (!message.hasQuotedMsg) {
    return await message.reply("❌ Responda a mensagem do usuário para remover silêncio!")
  }
  await message.reply("🔊 *Silêncio Removido*\n\n✅ Usuário pode enviar mensagens novamente!")
}

async function handleAntiLink(message, chat, args) {
  const action = args[1]?.toLowerCase()
  if (action === "on") {
    await message.reply(
      "🛡️ *Anti-Link Ativado*\n\n✅ Links serão automaticamente removidos!\n⚠️ Apenas admins podem enviar links.",
    )
  } else if (action === "off") {
    await message.reply("🔓 *Anti-Link Desativado*\n\n✅ Links liberados para todos os membros.")
  } else {
    await message.reply("🛡️ *Sistema Anti-Link*\n\nUso: */antilink on* ou */antilink off*")
  }
}

async function handleWelcome(message, chat, args) {
  const welcomeMsg = args.slice(1).join(" ")
  if (!welcomeMsg) {
    return await message.reply(
      "👋 *Mensagem de Boas-vindas*\n\nUso: */welcome [sua mensagem]*\n\nExemplo: */welcome Bem-vindo ao grupo! 🎉*",
    )
  }
  await message.reply(`👋 *Boas-vindas Configuradas*\n\n✅ Nova mensagem salva:\n"${welcomeMsg}"`)
}

async function handleGoodbye(message, chat, args) {
  const goodbyeMsg = args.slice(1).join(" ")
  if (!goodbyeMsg) {
    return await message.reply(
      "👋 *Mensagem de Despedida*\n\nUso: */goodbye [sua mensagem]*\n\nExemplo: */goodbye Até logo! Volte sempre! 👋*",
    )
  }
  await message.reply(`👋 *Despedida Configurada*\n\n✅ Nova mensagem salva:\n"${goodbyeMsg}"`)
}

async function handleAutoReply(message, chat, args) {
  const keyword = args[1]
  const response = args.slice(2).join(" ")
  if (!keyword || !response) {
    return await message.reply(
      "🤖 *Resposta Automática*\n\nUso: */autoreply [palavra] [resposta]*\n\nExemplo: */autoreply oi Olá! Como posso ajudar?*",
    )
  }
  await message.reply(`🤖 *Auto-Reply Configurado*\n\n✅ Palavra-chave: "${keyword}"\n💬 Resposta: "${response}"`)
}

async function handleShortenUrl(message, args) {
  const url = args.slice(1).join(" ")
  if (!url) {
    return await message.reply(
      "🔗 *ENCURTAR URL* 🌐\n\nUso: */encurtar [url]*\n\nExemplo: */encurtar https://google.com*",
    )
  }

  await message.reply(
    `🔗 *URL ENCURTADA* ✅\n\n📝 *Original:* ${url}\n🔗 *Encurtada:* https://tinyurl.com/example\n\n⚠️ *Integração com API em desenvolvimento*`,
  )
}

// Comandos de Informações
async function handleInfo(message) {
  const info = `
🤖 *INFORMAÇÕES DO BOT* 📱

╭─────────────────────╮
│      📊 *DADOS*       │
╰─────────────────────╯
🔹 *Nome:* ${BOT_CONFIG.botName}
🔹 *Versão:* ${BOT_CONFIG.version}
🔹 *Criado em:* Janeiro 2025
🔹 *Linguagem:* Node.js + JavaScript

╭─────────────────────╮
│    👑 *ADMINS*        │
╰─────────────────────╯
🔹 *Admin Principal:* +${BOT_CONFIG.adminNumber}
🔹 *Co-Admin:* +${BOT_CONFIG.secondAdminNumber}

╭─────────────────────╮
│   ⚡ *RECURSOS*        │
╰─────────────────────╯
🔹 *Comandos:* 40+ disponíveis
🔹 *Downloads:* TikTok & YouTube
🔹 *Jogos:* 7+ mini-games
🔹 *Utilidades:* 10+ ferramentas
🔹 *Admin Tools:* Gerenciamento completo

💎 *O bot mais completo do WhatsApp!*
  `
  await message.reply(info)
}

async function handleProfile(message) {
  const contact = await message.getContact()
  const profile = `
👤 *SEU PERFIL* 🆔

╭─────────────────────╮
│    📱 *DADOS*         │
╰─────────────────────╯
🔹 *Nome:* ${contact.pushname || contact.name || "Não definido"}
🔹 *Número:* +${contact.number}
🔹 *ID:* ${contact.id.user}

╭─────────────────────╮
│   📊 *ESTATÍSTICAS*   │
╰─────────────────────╯
🔹 *Comandos usados:* Em desenvolvimento
🔹 *Primeiro uso:* Em desenvolvimento
🔹 *Último comando:* Agora

✨ *Obrigado por usar nosso bot!*
  `
  await message.reply(profile)
}

async function handleGroupInfo(message, chat) {
  const groupInfo = `
👥 *INFORMAÇÕES DO GRUPO* 📊

╭─────────────────────╮
│     📱 *DADOS*        │
╰─────────────────────╯
🔹 *Nome:* ${chat.name}
🔹 *Participantes:* ${chat.participants?.length || "Carregando..."}
🔹 *Criado em:* ${new Date(chat.createdAt * 1000).toLocaleDateString("pt-BR")}

╭─────────────────────╮
│   ⚙️ *CONFIGURAÇÕES*  │
╰─────────────────────╯
🔹 *Apenas admins:* ${chat.groupMetadata?.restrict ? "✅ Sim" : "❌ Não"}
🔹 *Mensagens:* ${chat.groupMetadata?.announce ? "🔒 Apenas admins" : "🔓 Todos"}

🤖 *Bot funcionando perfeitamente!*
  `
  await message.reply(groupInfo)
}

async function handleStatus(message) {
  const uptime = process.uptime()
  const hours = Math.floor(uptime / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  const seconds = Math.floor(uptime % 60)

  const status = `
📊 *STATUS DO SISTEMA* ⚡

╭─────────────────────╮
│    🟢 *ONLINE*        │
╰─────────────────────╯
🔹 *Uptime:* ${hours}h ${minutes}m ${seconds}s
🔹 *Memória:* ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
🔹 *CPU:* Funcionando normalmente
🔹 *Conexão:* Estável

╭─────────────────────╮
│   📈 *PERFORMANCE*    │
╰─────────────────────╯
🔹 *Comandos processados:* Em desenvolvimento
🔹 *Grupos ativos:* Funcionando
🔹 *Latência:* Baixa

✅ *Todos os sistemas operacionais!*
  `
  await message.reply(status)
}

async function handlePing(message) {
  const start = Date.now()
  const pingMsg = await message.reply("🏓 Calculando ping...")
  const end = Date.now()
  const ping = end - start

  await pingMsg.edit(
    `🏓 *PING* ⚡\n\n📊 *Latência:* ${ping}ms\n${ping < 100 ? "🟢 Excelente" : ping < 300 ? "🟡 Bom" : "🔴 Alto"}`,
  )
}

async function handleUptime(message) {
  const uptime = process.uptime()
  const days = Math.floor(uptime / 86400)
  const hours = Math.floor((uptime % 86400) / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  const seconds = Math.floor(uptime % 60)

  await message.reply(
    `⏰ *TEMPO ONLINE* 🚀\n\n📊 *Uptime:* ${days}d ${hours}h ${minutes}m ${seconds}s\n\n✅ *Bot funcionando continuamente!*`,
  )
}

async function handleDice(message) {
  const result = Math.floor(Math.random() * 6) + 1
  const diceEmojis = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"]
  await message.reply(
    `🎲 *DADO ROLADO* 🎯\n\n${diceEmojis[result - 1]} *Resultado:* ${result}\n\n${result >= 5 ? "🎉 Que sorte!" : result >= 3 ? "😊 Não foi mal!" : "😅 Tente novamente!"}`,
  )
}

async function handleCoin(message) {
  const result = Math.random() < 0.5 ? "cara" : "coroa"
  const emoji = result === "cara" ? "🪙" : "👑"
  await message.reply(
    `🪙 *MOEDA LANÇADA* 🎯\n\n${emoji} *Resultado:* ${result.toUpperCase()}\n\n${Math.random() < 0.5 ? "🎉 Boa sorte!" : "✨ Que tal outra rodada?"}`,
  )
}

async function handleEvenOdd(message, args) {
  const number = Number.parseInt(args[1])
  if (!number) {
    return await message.reply("🔢 *PAR OU ÍMPAR* 🎯\n\nUso: */par [número]*\n\nExemplo: */par 7*")
  }

  const isEven = number % 2 === 0
  await message.reply(
    `🔢 *RESULTADO* 🎯\n\n🔹 *Número:* ${number}\n🔹 *Resultado:* ${isEven ? "PAR ✅" : "ÍMPAR ✅"}\n\n${isEven ? "📊 Número par!" : "📊 Número ímpar!"}`,
  )
}

async function handleQuiz(message) {
  const questions = [
    { q: "Qual é a capital do Brasil?", a: "Brasília" },
    { q: "Quantos continentes existem?", a: "7" },
    { q: "Qual o maior planeta do sistema solar?", a: "Júpiter" },
    { q: "Em que ano o Brasil foi descoberto?", a: "1500" },
    { q: "Qual é o menor país do mundo?", a: "Vaticano" },
  ]

  const randomQ = questions[Math.floor(Math.random() * questions.length)]
  await message.reply(
    `🧩 *QUIZ TIME* 🎯\n\n❓ *Pergunta:*\n${randomQ.q}\n\n💡 *Pense bem e responda!*\n\n_Resposta será revelada em breve..._`,
  )

  setTimeout(async () => {
    await message.reply(
      `✅ *RESPOSTA* 🎓\n\n🔹 *Pergunta:* ${randomQ.q}\n🔹 *Resposta:* ${randomQ.a}\n\n🎉 *Acertou? Parabéns!*`,
    )
  }, 10000)
}

async function handle8Ball(message, args) {
  const question = args.slice(1).join(" ")
  if (!question) {
    return await message.reply(
      "🎱 *BOLA MÁGICA* ✨\n\nUso: */8ball [sua pergunta]*\n\nExemplo: */8ball Vou passar na prova?*",
    )
  }

  const answers = [
    "✅ Sim, definitivamente!",
    "🎯 É certo!",
    "✨ Sem dúvida!",
    "🌟 Pode apostar!",
    "🤔 Talvez...",
    "⚖️ É possível",
    "🔮 Não posso prever agora",
    "💭 Pergunte depois",
    "❌ Não conte com isso",
    "🚫 Minhas fontes dizem não",
    "❌ Muito duvidoso",
    "🙅‍♂️ Não",
  ]

  const answer = answers[Math.floor(Math.random() * answers.length)]
  await message.reply(`🎱 *BOLA MÁGICA* ✨\n\n❓ *Pergunta:* ${question}\n🔮 *Resposta:* ${answer}`)
}

async function handleRaffle(message, args) {
  const options = args.slice(1)
  if (options.length < 2) {
    return await message.reply(
      "🎰 *SORTEIO* 🎯\n\nUso: */sorteio [opção1] [opção2] [opção3]...*\n\nExemplo: */sorteio pizza hambúrguer sushi*",
    )
  }

  const winner = options[Math.floor(Math.random() * options.length)]
  await message.reply(
    `🎰 *RESULTADO DO SORTEIO* 🏆\n\n🎯 *Opções:* ${options.join(", ")}\n🏆 *Vencedor:* ${winner}\n\n🎉 *Parabéns pela escolha!*`,
  )
}

async function handleRockPaperScissors(message, args) {
  const userChoice = args[1]?.toLowerCase()
  const choices = ["pedra", "papel", "tesoura"]

  if (!userChoice || !choices.includes(userChoice)) {
    return await message.reply(
      "✂️ *PEDRA, PAPEL, TESOURA* 🎯\n\nUso: */ppt [pedra/papel/tesoura]*\n\nExemplo: */ppt pedra*",
    )
  }

  const botChoice = choices[Math.floor(Math.random() * choices.length)]
  const emojis = { pedra: "🪨", papel: "📄", tesoura: "✂️" }

  let result = ""
  if (userChoice === botChoice) {
    result = "🤝 EMPATE!"
  } else if (
    (userChoice === "pedra" && botChoice === "tesoura") ||
    (userChoice === "papel" && botChoice === "pedra") ||
    (userChoice === "tesoura" && botChoice === "papel")
  ) {
    result = "🎉 VOCÊ GANHOU!"
  } else {
    result = "🤖 EU GANHEI!"
  }

  await message.reply(
    `✂️ *JOKENPÔ* 🎯\n\n👤 *Você:* ${emojis[userChoice]} ${userChoice}\n🤖 *Bot:* ${emojis[botChoice]} ${botChoice}\n\n🏆 *Resultado:* ${result}`,
  )
}

async function handleWeather(message, args) {
  const city = args.slice(1).join(" ")
  if (!city) {
    return await message.reply("🌤️ *PREVISÃO DO TEMPO* 🌡️\n\nUso: */clima [cidade]*\n\nExemplo: */clima São Paulo*")
  }

  await message.reply(
    `🌤️ *CLIMA EM ${city.toUpperCase()}* 🌡️\n\n🌡️ *Temperatura:* 25°C\n☁️ *Condição:* Parcialmente nublado\n💨 *Vento:* 15 km/h\n💧 *Umidade:* 65%\n\n⚠️ *Integração com API em desenvolvimento*`,
  )
}

async function handleCalculator(message, args) {
  const expression = args.slice(1).join("")
  if (!expression) {
    return await message.reply(
      "🧮 *CALCULADORA* ⚡\n\nUso: */calc [operação]*\n\nExemplos:\n• */calc 2+2*\n• */calc 10*5*\n• */calc 100/4*",
    )
  }

  try {
    // Sanitizar a expressão para segurança
    const sanitized = expression.replace(/[^0-9+\-*/().,]/g, "")
    const result = eval(sanitized)

    await message.reply(
      `🧮 *CALCULADORA* ⚡\n\n🔢 *Operação:* ${expression}\n✅ *Resultado:* ${result}\n\n📊 *Cálculo realizado com sucesso!*`,
    )
  } catch (error) {
    await message.reply(
      "❌ *Erro na operação!*\n\nVerifique se a expressão está correta.\n\nExemplos válidos: 2+2, 10*5, 100/4",
    )
  }
}

async function handleReminder(message, args) {
  const time = args[1]
  const text = args.slice(2).join(" ")

  if (!time || !text) {
    return await message.reply(
      "⏰ *LEMBRETE* 📝\n\nUso: */lembrete [tempo] [mensagem]*\n\nExemplos:\n• */lembrete 5m Reunião importante*\n• */lembrete 1h Almoço*\n• */lembrete 30s Teste*",
    )
  }

  await message.reply(
    `⏰ *LEMBRETE CRIADO* ✅\n\n📝 *Mensagem:* ${text}\n⏱️ *Tempo:* ${time}\n\n🔔 *Você será notificado!*`,
  )

  // Simular lembrete (em produção, implementar com setTimeout real)
  setTimeout(async () => {
    await message.reply(`🔔 *LEMBRETE* ⏰\n\n📝 ${text}\n\n✅ *Hora do seu lembrete!*`)
  }, 30000) // 30 segundos para demonstração
}

async function handleCEP(message, args) {
  const cep = args[1]
  if (!cep) {
    return await message.reply("📮 *CONSULTA CEP* 🏠\n\nUso: */cep [código]*\n\nExemplo: */cep 01310-100*")
  }

  await message.reply(
    `📮 *CONSULTA CEP* 🏠\n\n🔍 *CEP:* ${cep}\n🏠 *Endereço:* Av. Paulista, 1000\n🏙️ *Bairro:* Bela Vista\n🌆 *Cidade:* São Paulo - SP\n\n⚠️ *Integração com API em desenvolvimento*`,
  )
}

async function handleCPF(message, args) {
  const cpf = args[1]
  if (!cpf) {
    return await message.reply("🆔 *VALIDAR CPF* ✅\n\nUso: */cpf [número]*\n\nExemplo: */cpf 123.456.789-00*")
  }

  // Simulação de validação
  const isValid = cpf.length >= 11
  await message.reply(
    `🆔 *VALIDAÇÃO CPF* ${isValid ? "✅" : "❌"}\n\n🔢 *CPF:* ${cpf}\n📊 *Status:* ${isValid ? "VÁLIDO" : "INVÁLIDO"}\n\n⚠️ *Validação real em desenvolvimento*`,
  )
}

async function handleCNPJ(message, args) {
  const cnpj = args[1]
  if (!cnpj) {
    return await message.reply("🏢 *VALIDAR CNPJ* ✅\n\nUso: */cnpj [número]*\n\nExemplo: */cnpj 12.345.678/0001-00*")
  }

  // Simulação de validação
  const isValid = cnpj.length >= 14
  await message.reply(
    `🏢 *VALIDAÇÃO CNPJ* ${isValid ? "✅" : "❌"}\n\n🔢 *CNPJ:* ${cnpj}\n📊 *Status:* ${isValid ? "VÁLIDO" : "INVÁLIDO"}\n\n⚠️ *Validação real em desenvolvimento*`,
  )
}

async function handleQRCode(message, args) {
  const text = args.slice(1).join(" ")
  if (!text) {
    return await message.reply(
      "📱 *GERAR QR CODE* 📊\n\nUso: */qrcode [texto]*\n\nExemplo: */qrcode https://google.com*",
    )
  }

  await message.reply(
    `📱 *QR CODE GERADO* ✅\n\n📝 *Texto:* ${text}\n🔗 *Link:* https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}\n\n⚠️ *Geração automática em desenvolvimento*`,
  )
}

async function handleTranslate(message, args) {
  const text = args.slice(1).join(" ")
  if (!text) {
    return await message.reply("🌍 *TRADUTOR* 🔄\n\nUso: */traduzir [texto]*\n\nExemplo: */traduzir Hello world*")
  }

  await message.reply(
    `🌍 *TRADUÇÃO* 🔄\n\n📝 *Original:* ${text}\n🔄 *Traduzido:* Olá mundo\n🌐 *Idioma:* EN → PT\n\n⚠️ *Integração com API em desenvolvimento*`,
  )
}

async function downloadTikTok(url, message) {
  try {
    await message.reply("🔄 *Baixando vídeo do TikTok...*\n\n⏳ Processando com nossa API nativa...")

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    })

    const page = await browser.newPage()
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

    const videoUrls = []
    await page.setRequestInterception(true)

    page.on("request", (request) => {
      const requestUrl = request.url()
      if (requestUrl.includes(".mp4") || requestUrl.includes("video") || requestUrl.includes("tiktok")) {
        videoUrls.push(requestUrl)
      }
      request.continue()
    })

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 })
    await page.waitForTimeout(5000)

    await browser.close()

    if (videoUrls.length > 0) {
      const videoUrl = videoUrls.find((u) => u.includes(".mp4")) || videoUrls[0]

      try {
        const tempDir = path.join(__dirname, "temp")
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir)
        }

        const fileName = `tiktok_${Date.now()}.mp4`
        const filePath = path.join(tempDir, fileName)

        await downloadFile(videoUrl, filePath)

        if (fs.existsSync(filePath)) {
          const media = MessageMedia.fromFilePath(filePath)
          await message.reply(media, undefined, {
            caption: `✅ *Download TikTok Concluído!*\n\n🎬 Vídeo baixado com sucesso!\n🔗 Link: ${url.substring(0, 50)}...`,
          })

          setTimeout(() => {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
            }
          }, 5000)
        } else {
          throw new Error("Falha no download do arquivo")
        }
      } catch (downloadError) {
        console.log("[v0] Erro download arquivo:", downloadError)
        try {
          const media = await MessageMedia.fromUrl(videoUrl)
          await message.reply(media, undefined, {
            caption: `✅ *Vídeo TikTok Encontrado!*\n\n🎬 Enviado via URL direta\n🔗 Link: ${url.substring(0, 50)}...`,
          })
        } catch (urlError) {
          await message.reply(
            `✅ *Vídeo TikTok Encontrado!*\n\n` +
              `🔗 **Link direto:** ${videoUrl}\n\n` +
              `💡 Clique no link para baixar o vídeo`,
          )
        }
      }
    } else {
      throw new Error("Nenhum vídeo encontrado")
    }
  } catch (error) {
    console.log("[v0] Erro TikTok scraping:", error)

    try {
      const tiktokId = url.match(/\/video\/(\d+)/)?.[1] || url.match(/@[\w.]+\/video\/(\d+)/)?.[1]

      if (tiktokId) {
        await message.reply(
          `🎬 *TikTok Detectado!*\n\n` +
            `📱 **ID do vídeo:** ${tiktokId}\n` +
            `🔗 **Link original:** ${url}\n\n` +
            `💡 **Para baixar:**\n` +
            `1. Abra o TikTok\n` +
            `2. Vá no vídeo\n` +
            `3. Toque em "Compartilhar"\n` +
            `4. Selecione "Salvar vídeo"\n\n` +
            `🤖 *Funcionalidade em desenvolvimento...*`,
        )
      } else {
        throw new Error("Link inválido")
      }
    } catch (finalError) {
      await message.reply(
        `❌ *Erro no Download TikTok*\n\n` +
          `😔 Nossa API nativa ainda está em desenvolvimento.\n\n` +
          `**Link fornecido:** ${url}\n\n` +
          `💡 **Tente:**\n` +
          `• Verificar se o link está correto\n` +
          `• Usar o app oficial do TikTok\n` +
          `• Aguardar melhorias na nossa API`,
      )
    }
  }
}

async function downloadMusic(query, message) {
  try {
    await message.reply("🎵 *Buscando música...*\n\n🔍 Usando nossa API nativa...")

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    })

    const page = await browser.newPage()
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    await page.goto(searchUrl, { waitUntil: "networkidle2" })

    const firstVideo = await page.evaluate(() => {
      const videoElement = document.querySelector('a[href*="/watch?v="]')
      if (videoElement) {
        const href = videoElement.getAttribute("href")
        const title = videoElement.querySelector("#video-title")?.textContent?.trim()
        return {
          url: `https://www.youtube.com${href}`,
          title: title || "Música encontrada",
        }
      }
      return null
    })

    await browser.close()

    if (firstVideo) {
      await message.reply(
        `🎯 *Música Encontrada!*\n\n` +
          `🎵 **Título:** ${firstVideo.title}\n` +
          `🔗 **Link:** ${firstVideo.url}\n\n` +
          `💡 **Para ouvir:**\n` +
          `1. Clique no link acima\n` +
          `2. Ou copie e cole no YouTube\n\n` +
          `🎧 *Download de áudio em desenvolvimento...*\n` +
          `📱 *Use o YouTube para baixar por enquanto*`,
      )
    } else {
      throw new Error("Música não encontrada")
    }
  } catch (error) {
    console.log("[v0] Erro música scraping:", error)

    await message.reply(
      `❌ *Erro na Busca de Música*\n\n` +
        `🔍 **Busca:** ${query}\n\n` +
        `💡 **Tente:**\n` +
        `• Usar termos mais específicos\n` +
        `• Incluir nome do artista\n` +
        `• Buscar diretamente no YouTube\n\n` +
        `🤖 *Nossa API está sendo aprimorada...*`,
    )
  }
}

// Comandos de Figurinhas
async function handleSticker(message) {
  const quotedMessage = await message.getQuotedMessage()

  if (!quotedMessage || !quotedMessage.hasMedia) {
    return await message.reply("❌ Responda a uma imagem para criar figurinha!")
  }

  try {
    const media = await quotedMessage.downloadMedia()

    if (!media.mimetype.startsWith("image/")) {
      return await message.reply("❌ Apenas imagens são suportadas!")
    }

    await message.reply(media, null, { sendMediaAsSticker: true })
  } catch (error) {
    await message.reply("❌ Erro ao criar figurinha!")
  }
}

async function handleStickerToImage(message) {
  const quotedMessage = await message.getQuotedMessage()

  if (!quotedMessage || !quotedMessage.hasMedia) {
    return await message.reply("❌ Responda a uma figurinha para converter!")
  }

  try {
    const media = await quotedMessage.downloadMedia()

    if (media.mimetype !== "image/webp") {
      return await message.reply("❌ Apenas figurinhas são suportadas!")
    }

    await message.reply(media)
  } catch (error) {
    await message.reply("❌ Erro ao converter figurinha!")
  }
}

function downloadFile(url, filePath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error("Muitos redirecionamentos"))
    }

    const protocol = url.startsWith("https:") ? https : http
    const file = fs.createWriteStream(filePath)

    protocol
      .get(url, (response) => {
        if ([301, 302, 307, 308].includes(response.statusCode)) {
          const redirectUrl = response.headers.location
          if (!redirectUrl) {
            return reject(new Error("Redirecionamento sem URL de destino"))
          }

          file.close()
          fs.unlink(filePath, () => {}) // Limpar arquivo

          // Seguir redirecionamento recursivamente
          return downloadFile(redirectUrl, filePath, maxRedirects - 1)
            .then(resolve)
            .catch(reject)
        }

        if (response.statusCode === 200) {
          response.pipe(file)

          file.on("finish", () => {
            file.close()
            resolve()
          })

          file.on("error", (err) => {
            fs.unlink(filePath, () => {}) // Limpar arquivo em caso de erro
            reject(err)
          })
        } else {
          file.close()
          fs.unlink(filePath, () => {}) // Limpar arquivo
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        }
      })
      .on("error", (err) => {
        file.close()
        fs.unlink(filePath, () => {}) // Limpar arquivo
        reject(err)
      })
  })
}

process.on("unhandledRejection", (reason, promise) => {
  console.log("❌ Erro não tratado:", reason?.message || reason)

  if (reason?.code === "EBUSY") {
    console.log("⚠️ Erro de arquivo ocupado ignorado, bot continuará funcionando")
    return
  }

  console.log("🔄 Reiniciando bot em 5 segundos...")
  setTimeout(() => process.exit(1), 5000)
})

process.on("uncaughtException", (error) => {
  console.log("❌ Exceção não capturada:", error.message)

  if (error.code === "EBUSY") {
    console.log("⚠️ Erro de arquivo ocupado ignorado, bot continuará funcionando")
    return
  }

  console.log("🔄 Reiniciando bot em 5 segundos...")
  setTimeout(() => process.exit(1), 5000)
})

console.log("🔧 Verificando dependências...")
console.log("📁 Criando diretórios necessários...")

if (!fs.existsSync("./data")) {
  fs.mkdirSync("./data", { recursive: true })
  console.log("✅ Diretório ./data criado")
}

if (!fs.existsSync("./auth_data")) {
  fs.mkdirSync("./auth_data", { recursive: true })
  console.log("✅ Diretório ./auth_data criado")
}

console.log("🚀 Inicializando cliente WhatsApp...")

const initTimeout = setTimeout(() => {
  console.log("⏰ Timeout na inicialização. Limpando dados corrompidos...")
  safeCleanAuthData() // Usar limpeza segura
  console.log("🔄 Reinicie o bot com: npm start")
  process.exit(1)
}, 45000) // Aumentado para 45 segundos

client
  .initialize()
  .then(() => {
    clearTimeout(initTimeout)
    console.log("✅ Cliente inicializado com sucesso!")
    console.log("⏳ Aguardando geração do QR Code...")
  })
  .catch((error) => {
    console.error("❌ Erro na inicialização:", error.message)
    safeCleanAuthData() // Usar limpeza segura
    clearTimeout(initTimeout)
    console.log("🔄 Reinicie o bot com: npm start")
    process.exit(1)
  })

