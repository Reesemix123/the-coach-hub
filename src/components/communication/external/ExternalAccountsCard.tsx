'use client';

import React, { useState, useEffect } from 'react';
import { Check, AlertTriangle } from 'lucide-react';

interface VimeoAccountInfo {
  connected: boolean;
  accountName: string | null;
  accountId: string | null;
  connectedAt: string | null;
  status: string;
  tokenExpiresAt: string | null;
}

export function ExternalAccountsCard() {
  const [vimeo, setVimeo] = useState<VimeoAccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      setLoading(true);
      const response = await fetch('/api/communication/external-accounts');
      if (response.ok) {
        const data = await response.json();
        setVimeo(data.accounts?.vimeo || null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect your Vimeo account?')) return;

    try {
      setDisconnecting(true);
      const response = await fetch('/api/communication/external-accounts?platform=vimeo', {
        method: 'DELETE',
      });
      if (response.ok) {
        setVimeo(null);
      }
    } catch { /* silent */ }
    finally { setDisconnecting(false); }
  }

  function handleConnect() {
    window.location.href = '/api/auth/vimeo';
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#1ab7ea] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Vimeo</h3>
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const isConnected = vimeo?.connected;
  const isExpiringSoon =
    vimeo?.tokenExpiresAt &&
    new Date(vimeo.tokenExpiresAt).getTime() - Date.now() < 7 * 86400000;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isConnected ? 'bg-[#1ab7ea]' : 'bg-gray-200'
            }`}
          >
            <span
              className={`font-bold text-sm ${
                isConnected ? 'text-white' : 'text-gray-500'
              }`}
            >
              V
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Vimeo</h3>
            {isConnected ? (
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-green-500" />
                <span className="text-sm text-green-600">
                  Connected as {vimeo?.accountName}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Not connected</p>
            )}
          </div>
        </div>

        {isConnected ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="px-4 py-2 text-sm bg-[#1ab7ea] text-white rounded-lg hover:bg-[#1097c4] transition-colors font-medium"
          >
            Connect Vimeo
          </button>
        )}
      </div>

      {isConnected && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Connected{' '}
              {vimeo?.connectedAt
                ? new Date(vimeo.connectedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : ''}
            </span>
            {isExpiringSoon && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">
                  Token expiring soon — reconnect recommended
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {!isConnected && (
        <p className="mt-4 text-xs text-gray-400">
          Connect your Vimeo account to share game film and highlights
          externally. A watermark is applied to all shared videos.
        </p>
      )}
    </div>
  );
}
