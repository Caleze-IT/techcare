/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  server.js — Backend TechCare IT Consulting              ║
 * ║  Node.js + Express                                       ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  SETUP:                                                  ║
 * ║  1. npm init -y                                          ║
 * ║  2. npm install express cors express-rate-limit nodemailer║
 * ║  3. Crie o arquivo .env (veja comentários abaixo)        ║
 * ║  4. node server.js                                       ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── Dependências ──────────────────────────────────────────────
const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

// ── Variáveis de ambiente ──────────────────────────────────────
// Crie um arquivo .env na raiz com este conteúdo:
//
//   EMAIL_USER=email_do_user
//   EMAIL_PASS=sua_senha_de_app_aqui
//   EMAIL_TO=Email_do_user
//   PORT=3000
//   ALLOWED_ORIGIN=https://seudominio.com.br
//
// Para usar .env instale: npm install dotenv
// E descomente a linha abaixo:
require('dotenv').config();

const PORT           = process.env.PORT           || 3000;
const EMAIL_USER     = process.env.EMAIL_USER     || '';
const EMAIL_PASS     = process.env.EMAIL_PASS     || '';
const EMAIL_TO       = process.env.EMAIL_TO       || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5500'; // Live Server padrão do VS Code

// ── App ───────────────────────────────────────────────────────
const app = express();

// ── CORS — só aceita requisições do seu domínio ───────────────
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['POST'],
}));

// ── Parse de JSON ─────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // limita o tamanho do body

// ── Rate Limiting — evita spam e abusos ───────────────────────
// Máximo 5 envios por IP a cada 15 minutos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { erro: 'Muitas tentativas. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/contato', limiter);

// ── Configuração do Nodemailer (Outlook/Hotmail) ───────────────
// Se usar Gmail, troque host e port e use uma senha de app:
// https://support.google.com/accounts/answer/185833
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});
// ── Rota POST /api/contato ────────────────────────────────────
app.post('/api/contato', async (req, res) => {

  const { nome, email, empresa, tipo, urgencia, mensagem } = req.body;

  // ── Validação no servidor (nunca confie só no front) ────────
  const erros = [];

  if (!nome || typeof nome !== 'string' || nome.trim().length < 2)
    erros.push('Nome inválido.');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    erros.push('E-mail inválido.');

  const tiposValidos = ['infraestrutura','redes','seguranca','erp','cloud','automacao','outro'];
  if (!tipo || !tiposValidos.includes(tipo))
    erros.push('Tipo de problema inválido.');

  const urgenciasValidas = ['baixa','media','critica'];
  if (!urgencia || !urgenciasValidas.includes(urgencia))
    erros.push('Urgência inválida.');

  if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length < 20)
    erros.push('Mensagem muito curta (mínimo 20 caracteres).');

  if (mensagem && mensagem.length > 1000)
    erros.push('Mensagem muito longa.');

  if (erros.length > 0) {
    return res.status(400).json({ erro: erros.join(' ') });
  }

  // ── Monta o e-mail ──────────────────────────────────────────
  const urgenciaLabel = {
    baixa: '🟢 Planejamento',
    media: '🟡 Essa semana',
    critica: '🔴 AMBIENTE PARADO',
  }[urgencia];

  const tipoLabel = {
    infraestrutura: 'Infraestrutura / Servidores',
    redes: 'Redes / Conectividade',
    seguranca: 'Segurança / AD',
    erp: 'ERP / Banco de dados',
    cloud: 'Cloud / Backup',
    automacao: 'Automação / Otimização',
    outro: 'Outro',
  }[tipo];

  const mailOptions = {
    from: `"TechCare Site" <${EMAIL_USER}>`,
    to: EMAIL_TO,
    replyTo: email.trim(),  // ao clicar "Responder" no seu e-mail, já vai para o cliente
    subject: `[${urgenciaLabel}] Nova solicitação — ${tipoLabel}`,
    text: `
Nova solicitação via site TechCare
══════════════════════════════════

Nome:     ${nome.trim()}
E-mail:   ${email.trim()}
Empresa:  ${empresa ? empresa.trim() : 'Não informado'}
Tipo:     ${tipoLabel}
Urgência: ${urgenciaLabel}

Mensagem:
──────────
${mensagem.trim()}

──────────
IP: ${req.ip}
Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
    `.trim(),
  };

  // ── Envia o e-mail ───────────────────────────────────────────
  try {
    await transporter.sendMail(mailOptions);
    console.log(`[${new Date().toISOString()}] ✅ E-mail enviado — ${nome} <${email}> — urgência: ${urgencia}`);
    return res.status(200).json({ ok: true, mensagem: 'Solicitação recebida com sucesso.' });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Falha ao enviar e-mail:`, err.message);
    return res.status(500).json({ erro: 'Erro interno ao enviar. Tente novamente mais tarde.' });
  }
});

// ── Rota de health check (para saber se o server está vivo) ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Inicia o servidor ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 TechCare Backend rodando em http://localhost:${PORT}`);
  console.log(`   Aguardando requisições de: ${ALLOWED_ORIGIN}\n`);
});
