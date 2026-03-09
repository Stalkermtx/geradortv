import React, { useState } from 'react';
import { AspectRatio, ImageResolution } from '../types';
import { Settings2, Wand2, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { enhanceImagePrompt } from '../services/geminiService';

interface ControlsProps {
  prompt: string;
  setPrompt: (p: string) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (ar: AspectRatio) => void;
  resolution: ImageResolution;
  setResolution: (res: ImageResolution) => void;
  outputFormat: 'PNG' | 'JPEG';
  setOutputFormat: (format: 'PNG' | 'JPEG') => void;
  transparentBackground: boolean;
  setTransparentBackground: (transparent: boolean) => void;
  onGenerate: () => void;
  loading: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  prompt,
  setPrompt,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  outputFormat,
  setOutputFormat,
  transparentBackground,
  setTransparentBackground,
  onGenerate,
  loading
}) => {
  const [enhancing, setEnhancing] = useState(false);

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try {
      const enhanced = await enhanceImagePrompt(prompt);
      setPrompt(enhanced);
    } catch (error) {
      console.error("Failed to enhance prompt:", error);
      alert("Falha ao melhorar o prompt. Tente novamente.");
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-zinc-100 font-medium pb-2 border-b border-white/5">
          <Settings2 className="w-4 h-4 text-yellow-500" />
          <h3>Configuração de Geração</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Proporção</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
              disabled={loading}
              className="w-full bg-zinc-900/50 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 outline-none transition-all"
            >
              <option value="1:1">Quadrado (1:1)</option>
              <option value="16:9">Cinemático (16:9)</option>
              <option value="9:16">Mobile (9:16)</option>
              <option value="4:3">Padrão (4:3)</option>
              <option value="3:4">Retrato (3:4)</option>
              <option value="4:1">Banner Largo (4:1)</option>
              <option value="8:1">Banner Ultra Largo (8:1)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Resolução</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as ImageResolution)}
              disabled={loading}
              className="w-full bg-zinc-900/50 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 outline-none transition-all"
            >
              <option value="1K">1K Padrão</option>
              <option value="2K">2K Alta Definição</option>
              <option value="4K">4K Ultra HD</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between text-zinc-100 font-medium pb-2 border-b border-white/5">
           <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-yellow-500" />
              <h3>Detalhes do Prompt</h3>
           </div>
           <div className="flex items-center gap-2">
             <button
               onClick={handleEnhancePrompt}
               disabled={loading || enhancing || !prompt.trim()}
               className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               title="Melhorar prompt com IA"
             >
               {enhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
               Otimizar Prompt
             </button>
             <span className="text-xs text-zinc-500 px-2 py-1 rounded bg-zinc-800">Modo Avançado</span>
           </div>
        </div>
        
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          rows={6}
          className="w-full bg-zinc-900/50 border border-zinc-700 text-zinc-300 rounded-lg p-4 text-sm focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 outline-none transition-all custom-scrollbar resize-none leading-relaxed"
          placeholder="Descreva seu logotipo premium..."
        />
        
        <div className="space-y-4 pt-2">
          {/* Formato de Saída */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Formato de Saída</label>
            <div className="flex bg-[#1A1A1A] rounded-xl p-1 border border-white/5">
              <button
                onClick={() => setOutputFormat('PNG')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${outputFormat === 'PNG' ? 'bg-[#2A2A2A] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                PNG
              </button>
              <button
                onClick={() => setOutputFormat('JPEG')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${outputFormat === 'JPEG' ? 'bg-[#2A2A2A] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                JPEG
              </button>
            </div>
          </div>

          {/* Fundo Transparente Toggle */}
          <div 
            className="flex items-center justify-between bg-[#1A1A1A] border border-white/5 rounded-xl p-4 cursor-pointer hover:bg-[#222] transition-colors"
            onClick={() => setTransparentBackground(!transparentBackground)}
          >
            <div>
              <h4 className="text-white font-bold text-sm tracking-wide">FUNDO TRANSPARENTE</h4>
              <p className="text-zinc-500 text-xs mt-0.5">Gera imagem sem fundo (ideal para banners)</p>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${transparentBackground ? 'bg-[#FF6B00]' : 'bg-zinc-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${transparentBackground ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={onGenerate}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg tracking-wide shadow-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-3 mt-4
              ${loading 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700' 
                : 'bg-[#FF6B00] hover:bg-[#FF8533] text-black hover:shadow-[0_0_20px_rgba(255,107,0,0.3)]'
              }`}
          >
            {loading ? (
               <>Processando...</>
            ) : (
               <>
                 GERAR IMAGEM IA
                 <ArrowRight className="w-5 h-5" />
               </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Controls;