import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Laptop, Smartphone, LogOut, RefreshCw, AlertTriangle, CheckCircle2, Lock, HelpCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getOrCreateDeviceId, formatDeviceId, detectDeviceMetadata, MAX_DEVICES_PER_ACCOUNT } from '../utils/deviceManager';

export const DeviceLimitModal: React.FC = () => {
  const { user, userData, logout, resetUserDevices } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentDeviceId = getOrCreateDeviceId();
  const currentMeta = detectDeviceMetadata(currentDeviceId);
  const registeredIds = Array.isArray(userData?.deviceIds) ? userData.deviceIds : [];

  const handleResetDevices = async () => {
    if (!window.confirm("Authorize this device and deregister other machines? This will set this device as Device Slot 1.")) {
      return;
    }

    setIsResetting(true);
    setErrorMessage(null);
    try {
      if (resetUserDevices) {
        await resetUserDevices();
        setResetSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        throw new Error("Reset function not available");
      }
    } catch (e: any) {
      console.error("Device reset failed:", e);
      setErrorMessage(e.message || "Failed to reset devices. Please try signing out and back in.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
      >
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <Lock className="w-3 h-3" /> Security Enforcement
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Device Limit Reached
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              1 Account = Maximum 2 Active Devices
            </p>
          </div>
        </div>

        {/* Status Explanation */}
        <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
          <p className="text-slate-300 text-sm leading-relaxed">
            Your account <strong className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded text-xs">{user?.email || userData?.email || 'this account'}</strong> has already reached the maximum limit of <strong className="text-rose-400">{MAX_DEVICES_PER_ACCOUNT} authorized devices</strong>.
          </p>
          <p className="text-slate-400 text-xs leading-relaxed">
            To protect your account and maintain fair resource usage, new sessions on a 3rd distinct browser or computer are blocked until an old device is released.
          </p>
        </div>

        {/* Device Status Breakdown */}
        <div className="space-y-2.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Current Device Slots (2 of 2 in use)
          </span>

          <div className="space-y-2">
            {registeredIds.slice(0, 2).map((devId, idx) => {
              const meta = Array.isArray(userData?.devices) ? userData.devices.find(d => d.id === devId) : null;
              return (
                <div
                  key={devId}
                  className="flex items-center justify-between p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-300">
                      {idx === 0 ? <Laptop className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {meta?.name || `Authorized Device #${idx + 1}`}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        ID: {formatDeviceId(devId)}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
              );
            })}

            {/* Current Unregistered Device */}
            <div className="flex items-center justify-between p-3.5 bg-rose-950/30 rounded-xl border border-rose-500/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-300">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-rose-200 block flex items-center gap-1.5">
                    This Machine (Blocked)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {currentMeta.name} • {formatDeviceId(currentDeviceId)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Slot Full
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {resetSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Device registered successfully! Refreshing session...</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handleResetDevices}
            disabled={isResetting || resetSuccess}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
          >
            {isResetting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>Authorize This Device (Reset Old Slots)</span>
          </button>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>

        {/* Footer Support */}
        <div className="text-center text-[11px] text-slate-500 pt-1">
          Need help? Contact support or an administrator to manage your devices.
        </div>
      </motion.div>
    </div>
  );
};
