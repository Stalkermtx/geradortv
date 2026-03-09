import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images just in case

const firebaseConfig = {
  apiKey: "AIzaSyA6555MqKTD3JCLe4E5en6Wi3WJDpBmj9g",
  authDomain: "flixyapp-b51d2.firebaseapp.com",
  projectId: "flixyapp-b51d2",
  storageBucket: "flixyapp-b51d2.firebasestorage.app",
  messagingSenderId: "823032292680",
  appId: "1:823032292680:web:f99e2d0c8c5e01fd1d3f7d",
  measurementId: "G-1FQ3BYF8NH"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const DB_DOC = doc(db, "conextv", "data");

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

// Helper to read data
const readData = async () => {
  try {
    const snap = await getDoc(DB_DOC);
    if (snap.exists()) {
      return snap.data();
    }
    // Initialize if not exists
    await setDoc(DB_DOC, defaultData);
    return defaultData;
  } catch (error) {
    console.error("Error reading data from Firestore:", error);
    return defaultData;
  }
};

// Helper to write data
const writeData = async (data: any) => {
  try {
    await setDoc(DB_DOC, data);
  } catch (error) {
    console.error("Error writing data to Firestore:", error);
  }
};

// API Routes
app.get("/api/data", async (req, res) => {
  const data = await readData();
  res.json(data);
});

app.post("/api/data", async (req, res) => {
  const newData = req.body;
  await writeData(newData);
  res.json({ success: true });
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
