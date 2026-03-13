import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { QrCode, LogOut, Loader2, CheckCircle } from 'lucide-react';

const WhatsAppConnection: React.FC = () => {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const [connectionState, setConnectionState] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const [qrCode, setQrCode] = useState<string | null>(null);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/whatsapp/status');
      const data = await response.json();
      
      if (data.connected) {
        setConnectionState('CONNECTED');
        setQrCode(null);
      } else if (data.qrCode) {
        setConnectionState('CONNECTING');
        setQrCode(data.qrCode);
      } else {
        setConnectionState('DISCONNECTED');
        setQrCode(null);
      }
    } catch (err) {
      console.error("Error checking connection:", err);
      setConnectionState('DISCONNECTED');
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/whatsapp/logout', { method: 'POST' });
      setConnectionState('DISCONNECTED');
      setQrCode(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleConnect = async () => {
    setConnectionState('CONNECTING');
    setError(null);
    checkConnection();
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            Conexão WhatsApp
          </h3>
          <p className="text-sm text-zinc-400">
            Conecte seu WhatsApp para enviar campanhas e mensagens.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${
            connectionState === 'CONNECTED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
            'bg-zinc-800 text-zinc-400 border border-zinc-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connectionState === 'CONNECTED' ? 'bg-green-500' : 'bg-zinc-500'}`} />
            {connectionState === 'CONNECTED' ? 'Conectado' : 'Desconectado'}
          </span>
          {connectionState === 'CONNECTED' && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Desconectar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {connectionState === 'DISCONNECTED' && (
        <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-zinc-800 rounded-xl bg-black/20">
          <QrCode className="w-12 h-12 text-zinc-600 mb-3" />
          <p className="text-zinc-400 text-center max-w-sm mb-4 text-sm">
            Para utilizar os recursos do WhatsApp, você precisa conectar seu aparelho lendo o QR Code.
          </p>
          <button
            onClick={handleConnect}
            className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            Gerar QR Code
          </button>
        </div>
      )}

      {connectionState === 'CONNECTING' && qrCode && (
        <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-zinc-800 rounded-xl bg-black/20">
          <h4 className="text-sm font-medium text-white mb-3">Escaneie o QR Code</h4>
          <div className="bg-white p-3 rounded-xl mb-3">
            <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
          </div>
          <p className="text-zinc-400 text-center text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Aguardando conexão...
          </p>
        </div>
      )}

      {connectionState === 'CONNECTED' && (
        <div className="flex flex-col items-center justify-center py-6 border border-green-500/20 rounded-xl bg-green-500/5">
          <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
          <p className="text-green-400 font-medium text-center">
            WhatsApp conectado com sucesso!
          </p>
          <p className="text-zinc-400 text-sm text-center mt-1">
            Você já pode enviar campanhas e mensagens.
          </p>
        </div>
      )}
    </div>
  );
};

export default WhatsAppConnection;
