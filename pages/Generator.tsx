import React, { useState, useEffect } from 'react';
import { generateImage, generateVideo, DEFAULT_PROMPT } from '../services/geminiService';
import { AspectRatio, ImageResolution } from '../types';
import ImageDisplay from '../components/ImageDisplay';
import Controls from '../components/Controls';
import ApiKeyChecker from '../components/ApiKeyChecker';
import FAQ from '../components/FAQ';
import Features from '../components/Features';
import { Sparkles, Zap, Play, Loader2, LogOut, User, ShieldCheck, Download, History, Trash2, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { storage } from '../lib/firebase';
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';

interface HistoryItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  timestamp: number;
  aspectRatio: AspectRatio;
}

const Generator: React.FC = () => {
  const { user, logout, incrementUsage, logGeneration } = useAuth();
  const navigate = useNavigate();
  const [apiKeyValid, setApiKeyValid] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [videoAspectRatio, setVideoAspectRatio] = useState<AspectRatio>('16:9');
  const [videoScript, setVideoScript] = useState<string>('');
  const [resolution, setResolution] = useState<ImageResolution>('4K');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from server on mount
  useEffect(() => {
    if (user) {
      fetch('/api/data')
        .then(res => res.json())
        .then(data => {
          let hiddenIds: string[] = [];
          try {
            hiddenIds = JSON.parse(localStorage.getItem('hidden_generations') || '[]');
          } catch (e) {
            console.error("Failed to parse hidden generations", e);
          }

          // Find generations for this user and map them to HistoryItem format
          const userGenerations = (data.generations || [])
            .filter((g: any) => g.userId === user.id && !hiddenIds.includes(g.id))
            .map((g: any) => ({
              id: g.id,
              type: g.model.includes('veo') ? 'video' : 'image',
              url: g.imageUrl,
              prompt: g.prompt,
              timestamp: new Date(g.timestamp).getTime(),
              aspectRatio: '1:1' // Defaulting as it wasn't saved in GenerationHistory
            }))
            .sort((a: any, b: any) => b.timestamp - a.timestamp);
          
          setHistory(userGenerations);
        })
        .catch(err => console.error("Failed to load history from server", err));
    }
  }, [user]);

  useEffect(() => {
    if (user?.subscriptionStatus === 'inactive') {
      navigate('/subscription');
    }
  }, [user, navigate]);

  const addToHistory = (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    setHistory(prev => [newItem, ...prev]);
    // Note: logGeneration in AuthContext handles saving to the backend
  };

  const clearHistory = () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
      // Get current history IDs to mark as deleted
      const currentIds = history.map(h => h.id);
      
      // Save to localStorage so they don't show up again for this user
      try {
        const hidden = JSON.parse(localStorage.getItem('hidden_generations') || '[]');
        localStorage.setItem('hidden_generations', JSON.stringify([...hidden, ...currentIds]));
      } catch (e) {
        console.error("Failed to save hidden generations", e);
      }
      
      setHistory([]);
    }
  };

  const addWatermarkToImage = (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Configure watermark text
        const text = "ConexTV Pro";
        // Calculate font size based on image width to maintain proportion
        const fontSize = Math.max(24, Math.floor(img.width / 12)); 
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)"; // 15% opacity
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Draw grid of watermarks
        const cols = 3;
        const rows = 3;
        const colWidth = img.width / cols;
        const rowHeight = img.height / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = c * colWidth + colWidth / 2;
            const y = r * rowHeight + rowHeight / 2;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-15 * Math.PI / 180); // -15 degrees rotation
            ctx.fillText(text, 0, 0);
            ctx.restore();
          }
        }

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = (e) => reject(new Error("Failed to load image for watermarking"));
      img.src = imageUrl;
    });
  };

  const handleGenerate = async () => {
    if (!apiKeyValid) {
       setError("Verificação da chave API necessária.");
       return;
    }

    // Check Basic Plan Limits
    if (user?.planId === 'basic') {
      if ((user.usageCount || 0) >= 3) {
        setError("Limite do plano Básico atingido (3 imagens). Atualize para o Pro para continuar gerando.");
        return;
      }
    }

    // Check Credits
    if (user?.planId === 'credits') {
      if ((user.credits || 0) <= 0) {
        setError("Seus créditos acabaram. Adquira um novo pacote para continuar gerando.");
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    setImageUrl(null);
    setVideoUrl(null);

    try {
      // Force Low resolution for Basic plan
      const effectiveResolution = user?.planId === 'basic' ? '1K' : resolution;
      
      let url = await generateImage(prompt, aspectRatio, effectiveResolution);
      
      // Apply watermark if Basic plan
      if (user?.planId === 'basic') {
        url = await addWatermarkToImage(url);
      }

      // Upload to Firebase Storage
      const imageRef = ref(storage, `images/${user?.id}_${Date.now()}.png`);
      await uploadString(imageRef, url, 'data_url');
      const firebaseUrl = await getDownloadURL(imageRef);

      setImageUrl(firebaseUrl);
      incrementUsage();
      logGeneration(prompt, firebaseUrl, 'gemini-3.1-flash-image-preview');
      addToHistory({
        type: 'image',
        url: firebaseUrl,
        prompt: prompt,
        aspectRatio: aspectRatio
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocorreu um erro inesperado durante a geração.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!imageUrl || !apiKeyValid) return;
    
    setVideoLoading(true);
    setError(null);
    
    try {
      const promptToUse = videoScript.trim() 
        ? videoScript 
        : "Um vídeo de introdução curto e animado de 5 segundos. Os elementos metálicos do logotipo ganham vida com efeitos de brilho sutis e um movimento futurista. Adequado para uma introdução de vídeo.";
      
      const url = await generateVideo(imageUrl, promptToUse, videoAspectRatio);
      
      // Upload to Firebase Storage
      const videoBlob = await fetch(url).then(r => r.blob());
      const videoRef = ref(storage, `videos/${user?.id}_${Date.now()}.mp4`);
      await uploadBytes(videoRef, videoBlob);
      const firebaseUrl = await getDownloadURL(videoRef);

      setVideoUrl(firebaseUrl);
      logGeneration(promptToUse, firebaseUrl, 'veo-3.1-fast-generate-preview');
      addToHistory({
        type: 'video',
        url: firebaseUrl,
        prompt: videoScript.trim() ? "Roteiro Personalizado" : "Intro Animada",
        aspectRatio: videoAspectRatio
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Falha na geração do vídeo.");
    } finally {
      setVideoLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  if (user.subscriptionStatus === 'expired') {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Clock className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Assinatura Expirada</h2>
            <p className="text-zinc-400 mt-2">
              Sua assinatura de 30 dias chegou ao fim.
            </p>
          </div>
          <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
            <p className="text-sm text-zinc-300">
              Sua conta está bloqueada aguardando reativação pelo administrador ou exclusão automática.
            </p>
          </div>
          <a 
            href="https://wa.me/5565992203318?text=Olá, minha assinatura expirou e gostaria de renovar."
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Solicitar Reativação
          </a>
          <button 
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="text-sm text-zinc-500 hover:text-white underline transition-colors"
          >
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-[#050505] to-black text-white selection:bg-yellow-500/30 flex flex-col">
      <ApiKeyChecker onKeyValid={() => setApiKeyValid(true)} />
      
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                <Zap className="w-5 h-5 text-black fill-current" />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-white">
               Conex<span className="text-yellow-500">TV</span> <span className="text-zinc-500 font-light mx-2">|</span> <span className="text-zinc-400 font-normal text-sm">Gerador de Logo</span>
             </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
              <Sparkles className="w-3 h-3 text-yellow-500" />
              POWERED BY CONEXTV PRO
            </div>
            
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              {user.planId === 'credits' && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                  <span className="text-xs font-bold text-yellow-500">{user.credits || 0} Créditos</span>
                </div>
              )}
              <button 
                onClick={() => navigate(user.role === 'admin' ? '/admin' : '/profile')}
                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-yellow-500 transition-colors"
                title={user.role === 'admin' ? "Painel Administrativo" : "Meu Perfil"}
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                  {user.email.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden md:block text-sm text-zinc-300">
                  {user.email}
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto flex-grow w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-4 space-y-6">
            <Controls 
              prompt={prompt}
              setPrompt={setPrompt}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              onGenerate={handleGenerate}
              loading={loading}
            />
            
            <div className="text-xs text-zinc-600 p-4 border border-dashed border-zinc-800 rounded-xl">
              <strong className="text-zinc-500 block mb-1">Dica Pro:</strong>
              Use terminologia de alto contraste como "iluminação cinematográfica", "8K" e "ray-traced" para obter os melhores efeitos metálicos. O modelo é otimizado para texturas de alta fidelidade.
            </div>
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-8">
            <div className="sticky top-24 space-y-4">
               <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Pré-visualização ao Vivo</h2>
                  <div className="flex items-center gap-4">
                    {imageUrl && (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
                        Imagem Pronta
                      </span>
                    )}
                    {videoUrl && (
                      <span className="text-xs text-blue-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>
                        Vídeo Pronto
                      </span>
                    )}
                  </div>
               </div>
               
               <ImageDisplay 
                 imageUrl={imageUrl} 
                 loading={loading} 
                 error={error} 
               />

               {imageUrl && !videoUrl && !videoLoading && (
                 <div className="space-y-3">
                   <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Formato do Vídeo</label>
                      <div className="flex gap-2">
                        {['16:9', '9:16', '1:1', '4:3', '3:4'].map((ratio) => (
                          <button
                            key={ratio}
                            onClick={() => setVideoAspectRatio(ratio as AspectRatio)}
                            className={`px-2 py-1 text-xs rounded border transition-all ${
                              videoAspectRatio === ratio 
                                ? 'bg-yellow-500 text-black border-yellow-500 font-bold' 
                                : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Roteiro do Vídeo (Opcional)</label>
                      <textarea
                        value={videoScript}
                        onChange={(e) => setVideoScript(e.target.value)}
                        placeholder="Descreva como você quer a animação (ex: zoom lento, brilho intenso, partículas flutuando...)"
                        rows={2}
                        className="w-full bg-zinc-900/50 border border-zinc-700 text-zinc-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 outline-none transition-all resize-none"
                      />
                   </div>

                   <button 
                     onClick={handleGenerateVideo}
                     className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all group"
                   >
                     <Play className="w-4 h-4 text-yellow-500 group-hover:scale-110 transition-transform" />
                     Gerar Intro Animada (5s)
                   </button>
                 </div>
               )}

               {videoLoading && (
                 <div className="w-full py-8 bg-zinc-900/50 border border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-3">
                   <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
                   <span className="text-sm text-zinc-400">Gerando intro de vídeo... isso pode levar um minuto</span>
                 </div>
               )}

               {videoUrl && (
                 <div className="mt-4 space-y-4">
                   <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Intro de Vídeo</h3>
                   <div className={`group relative w-full rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black ${
                     videoAspectRatio === '1:1' ? 'aspect-square' : 
                     videoAspectRatio === '16:9' ? 'aspect-video' : 
                     videoAspectRatio === '9:16' ? 'aspect-[9/16] max-h-[70vh] mx-auto' : 
                     videoAspectRatio === '4:3' ? 'aspect-[4/3]' : 
                     videoAspectRatio === '3:4' ? 'aspect-[3/4] max-h-[70vh] mx-auto' : 'aspect-video'
                   }`}>
                     {/* Background Blur for nicer framing */}
                     <div 
                       className="absolute inset-0 bg-cover bg-center blur-2xl opacity-40 scale-110"
                       style={{ backgroundImage: `url(${imageUrl})` }} 
                     />
                     
                     <div className="relative z-10 w-full h-full flex items-center justify-center">
                       <video 
                         src={videoUrl} 
                         controls 
                         autoPlay 
                         loop 
                         className="w-full h-full object-contain relative z-10"
                       />
                     </div>

                     {user?.planId === 'basic' && (
                        <div className="absolute inset-0 z-20 pointer-events-none grid grid-cols-2 md:grid-cols-3 grid-rows-3 gap-4 p-4 overflow-hidden">
                          {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-center">
                              <span className="text-white/20 text-xl md:text-3xl font-bold uppercase tracking-widest -rotate-12 select-none whitespace-nowrap">
                                ConexTV Pro
                              </span>
                            </div>
                          ))}
                        </div>
                     )}

                     {/* Sticky Download Button - Always Visible */}
                     <div className="absolute bottom-4 right-4 z-30">
                        <a 
                          href={videoUrl} 
                          download={`conextv-intro-${Date.now()}.mp4`}
                          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-semibold rounded-full hover:bg-zinc-200 transition-colors shadow-lg shadow-black/50"
                        >
                          <Download className="w-4 h-4" />
                          Baixar Vídeo
                        </a>
                     </div>
                   </div>
                 </div>
               )}
               
               {/* Technical Specs Footer beneath image */}
               <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="glass-panel p-4 rounded-lg flex flex-col items-center justify-center text-center">
                     <span className="text-zinc-500 text-xs uppercase mb-1">Modelo</span>
                     <span className="text-zinc-200 font-mono text-sm">ConexTV Pro Gerador</span>
                  </div>
                  <div className="glass-panel p-4 rounded-lg flex flex-col items-center justify-center text-center">
                     <span className="text-zinc-500 text-xs uppercase mb-1">Resolução</span>
                     <span className="text-zinc-200 font-mono text-sm">{resolution} / 720p</span>
                  </div>
                  <div className="glass-panel p-4 rounded-lg flex flex-col items-center justify-center text-center">
                     <span className="text-zinc-500 text-xs uppercase mb-1">Processamento</span>
                     <span className="text-zinc-200 font-mono text-sm">Deep Ray-Tracing</span>
                  </div>
               </div>
            </div>
          </div>

          {/* History Section */}
          {history.length > 0 && (
            <div className="lg:col-span-12 mt-8 border-t border-white/5 pt-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-zinc-400" />
                  <h2 className="text-lg font-semibold text-white">Histórico de Geração</h2>
                </div>
                <button 
                  onClick={clearHistory}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpar Histórico
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {history.map((item) => (
                  <div key={item.id} className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-zinc-900">
                    {item.type === 'image' ? (
                      <img src={item.url} alt="History" className="w-full h-full object-cover" />
                    ) : (
                      <video src={item.url} className="w-full h-full object-cover" />
                    )}
                    
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 bg-black/50 px-2 py-1 rounded-full">
                        {item.type === 'video' ? 'Vídeo' : 'Imagem'}
                      </span>
                      <a 
                        href={item.url} 
                        download={`conextv-${item.type}-${item.timestamp}.${item.type === 'video' ? 'mp4' : 'png'}`}
                        className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"
                        title="Baixar"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <div className="absolute bottom-2 left-2 right-2 text-center">
                         <p className="text-[10px] text-zinc-400 truncate w-full">{new Date(item.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Features Section */}
          <div className="lg:col-span-12 mt-12 border-t border-white/5 pt-12">
            <Features />
          </div>

          {/* FAQ Section */}
          <div className="lg:col-span-12 mt-12 border-t border-white/5 pt-12">
            <FAQ />
          </div>

        </div>
      </main>

      <footer className="w-full border-t border-white/5 bg-black/50 backdrop-blur-xl py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-zinc-500 text-sm">
            &copy; 2026 <span className="font-bold text-zinc-300">ConexTV.</span> Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Generator;
