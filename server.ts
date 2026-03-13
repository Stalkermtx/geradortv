import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images just in case

// Default data structure
const defaultData = {
  users: [
    {
      id: "1",
      email: "admin@conextv.com",
      password: "10203040",
      name: "Administrador",
      whatsapp: "65999999999",
      role: "admin",
      subscriptionStatus: "active",
      planId: "pro",
      usageCount: 0,
    },
    {
      id: "2",
      email: "user@conextv.com",
      password: "102030",
      name: "Cliente Teste",
      whatsapp: "65888888888",
      role: "user",
      subscriptionStatus: "inactive",
      usageCount: 0,
    },
    {
      id: "3",
      email: "teste@conextv.com",
      password: "teste",
      name: "Usuário de Teste",
      whatsapp: "00000000000",
      role: "user",
      subscriptionStatus: "active",
      planId: "pro",
      usageCount: 0,
    },
  ],
  plans: [
    {
      id: "basic",
      name: "Básico",
      price: "Grátis",
      features: [
        "Acesso limitado",
        "Baixa resolução",
        "Marca d'água",
        "3 imagens de teste",
      ],
      maxUsage: 3,
      resolution: "Low",
      watermark: true,
    },
    {
      id: "pro",
      name: "Profissional",
      price: "R$ 29,90",
      features: [
        "Gerações Ilimitadas",
        "Resolução 4K Ultra HD",
        "Animações de Vídeo (Veo)",
        "Uso Comercial Liberado",
        "Suporte Prioritário",
      ],
      resolution: "4K",
      watermark: false,
    },
    {
      id: "credits",
      name: "Pacote de Créditos",
      price: "R$ 19,90",
      features: [
        "40 Créditos",
        "Válido por 30 dias",
        "1 Crédito = 1 Imagem",
        "Sem marca d'água",
      ],
      resolution: "4K",
      watermark: false,
      credits: 40,
    },
    {
      id: "enterprise",
      name: "Empresarial",
      price: "Consulte",
      features: ["API Dedicada", "Modelos Customizados", "SLA Garantido"],
      resolution: "4K",
      watermark: false,
      contactWhatsapp: "65992203318",
    },
  ],
  templates: [
    {
      id: "1",
      name: "Aviso de Vencimento",
      content: `Olá querido(a) cliente *{name}*,

*SUA CONTA EXPIRA EM BREVE!*

Seu plano de *{plan_price}* vence em:
*{expires_at}*

Seu usuário atual é *{username}*

Evite o bloqueio automático do seu sinal

Para renovar o seu plano agora, clique no link abaixo:
{pay_url}

*Observações:* Deixar campo de descrição em branco ou se precisar coloque *SUPORTE TÉCNICO*

Por favor, nos envie o comprovante de pagamento assim que possível.

É sempre um prazer te atender.`,
    },
    {
      id: "2",
      name: "Confirmação de Renovação",
      content: `*Confirmação de Renovação*

✅ Usuário: {username}
🗓️ Próximo Vencimento: {expires_at}`,
    },
  ],
  generations: [],
};

const DATA_FILE = path.join(__dirname, "data.json");

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
}

// Helper to read data
const readData = () => {
  try {
    const rawData = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error reading data file:", error);
    return defaultData;
  }
};

// Helper to write data
const writeData = (data: any) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing data file:", error);
  }
};

// API Routes
app.get("/api/data", (req, res) => {
  const data = readData();
  res.json(data);
});

app.post("/api/data", (req, res) => {
  const newData = req.body;
  writeData(newData);
  res.json({ success: true });
});

app.get("/api/proxy/games", async (req, res) => {
  try {
    const response = await fetch('https://xsender.painelmaster.lol/retornojogosmx.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Failed to fetch games data" });
  }
});

// WhatsApp Client Setup
let whatsappClient: any = null;
let qrCodeDataUrl: string | null = null;
let isWhatsAppConnected = false;
let isInitializing = false;

const initializeWhatsApp = async () => {
  if (isInitializing || isWhatsAppConnected) return;
  isInitializing = true;
  console.log('Initializing WhatsApp client...');

  try {
    whatsappClient = new Client({
      authStrategy: new LocalAuth({ clientId: 'conextv-client' }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu'],
        headless: true,
      }
    });

    whatsappClient.on('qr', async (qr: string) => {
      console.log('QR Code received');
      try {
        qrCodeDataUrl = await qrcode.toDataURL(qr);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    });

    whatsappClient.on('ready', () => {
      console.log('WhatsApp client is ready!');
      isWhatsAppConnected = true;
      qrCodeDataUrl = null;
    });

    whatsappClient.on('authenticated', () => {
      console.log('WhatsApp authenticated');
    });

    whatsappClient.on('auth_failure', (msg: string) => {
      console.error('WhatsApp authentication failure:', msg);
      isWhatsAppConnected = false;
      qrCodeDataUrl = null;
    });

    whatsappClient.on('disconnected', (reason: string) => {
      console.log('WhatsApp disconnected:', reason);
      isWhatsAppConnected = false;
      qrCodeDataUrl = null;
      // Re-initialize on disconnect
      setTimeout(initializeWhatsApp, 5000);
    });

    await whatsappClient.initialize();
  } catch (error) {
    console.error('Failed to initialize WhatsApp:', error);
    isWhatsAppConnected = false;
    qrCodeDataUrl = null;
  } finally {
    isInitializing = false;
  }
};

// Start initialization
initializeWhatsApp();

// API Routes
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    connected: isWhatsAppConnected,
    qrCode: qrCodeDataUrl
  });
});

app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    if (whatsappClient) {
      await whatsappClient.logout();
      await whatsappClient.destroy();
    }
    isWhatsAppConnected = false;
    qrCodeDataUrl = null;
    whatsappClient = null;
    
    // Re-initialize
    initializeWhatsApp();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

app.get('/api/whatsapp/contacts', async (req, res) => {
  if (!isWhatsAppConnected || !whatsappClient) {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }
  try {
    const contacts = await whatsappClient.getContacts();
    // Filter out groups and broadcast lists
    const filteredContacts = contacts.filter((c: any) => c.isUser && !c.isGroup && !c.isMe);
    res.json(filteredContacts.map((c: any) => ({
      id: c.id._serialized,
      name: c.name || c.pushname || c.number,
      number: c.number
    })));
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

app.get('/api/whatsapp/groups', async (req, res) => {
  if (!isWhatsAppConnected || !whatsappClient) {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }
  try {
    const chats = await whatsappClient.getChats();
    const groups = chats.filter((c: any) => c.isGroup);
    res.json(groups.map((g: any) => ({
      id: g.id._serialized,
      name: g.name
    })));
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

app.post('/api/whatsapp/send', async (req, res) => {
  if (!isWhatsAppConnected || !whatsappClient) {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }

  const { targetId, message, mediaUrl, mediaType } = req.body;

  if (!targetId) {
    return res.status(400).json({ error: 'Target ID is required' });
  }

  try {
    if (mediaUrl) {
      // Create MessageMedia object
      let media;
      if (mediaUrl.startsWith('data:')) {
        // Handle base64
        const parts = mediaUrl.split(';');
        const mimeType = parts[0].split(':')[1];
        const data = parts[1].split(',')[1];
        media = new MessageMedia(mimeType, data, 'media');
      } else {
        // Handle URL
        media = await MessageMedia.fromUrl(mediaUrl);
      }
      
      await whatsappClient.sendMessage(targetId, media, { caption: message || '' });
    } else if (message) {
      await whatsappClient.sendMessage(targetId, message);
    } else {
      return res.status(400).json({ error: 'Message or media is required' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
