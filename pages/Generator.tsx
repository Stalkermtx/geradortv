import React, { useState, useEffect } from 'react';
import { generateImage, generateVideo, DEFAULT_PROMPT } from '../services/geminiService';
import { AspectRatio, ImageResolution } from '../types';
import ImageDisplay from '../components/ImageDisplay';
import Controls from '../components/Controls';
import ApiKeyChecker from '../components/ApiKeyChecker';
import { Sparkles, Zap, Play, Loader2, LogOut, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Generator: React.FC = () => {
  const { user, logout, incrementUsage } = useAuth();
  const navigate = useNavigate();
  const [apiKeyValid, setApiKeyValid] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [resolution, setResolution] = useState<ImageResolution>('4K');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user?.subscriptionStatus !== 'active') {
      navigate('/subscription');
    }
  }, [user, navigate]);

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

      setImageUrl(url);
      incrementUsage();
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
      const url = await generateVideo(imageUrl, "Um vídeo de introdução curto e animado de 5 segundos. Os elementos metálicos do logotipo ganham vida com efeitos de brilho sutis e um movimento futurista. Adequado para uma introdução de vídeo.");
      setVideoUrl(url);
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
                 <button 
                   onClick={handleGenerateVideo}
                   className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all group"
                 >
                   <Play className="w-4 h-4 text-yellow-500 group-hover:scale-110 transition-transform" />
                   Gerar Intro Animada (5s)
                 </button>
               )}

               {videoLoading && (
                 <div className="w-full py-8 bg-zinc-900/50 border border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-3">
                   <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
                   <span className="text-sm text-zinc-400">Gerando intro de vídeo... isso pode levar um minuto</span>
                 </div>
               )}

               {videoUrl && (
                 <div className="mt-4 space-y-2">
                   <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Intro de Vídeo</h3>
                   <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-video">
                     <video 
                       src={videoUrl} 
                       controls 
                       autoPlay 
                       loop 
                       className="w-full h-full object-cover"
                     />
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
