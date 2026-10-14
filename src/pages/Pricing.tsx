import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Check, 
  Copy, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MessageCircle, 
  Sparkles, 
  Send, 
  History, 
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  SUBSCRIPTION_PRICE_BDT, 
  PAYMENT_PHONE_NUMBER, 
  WHATSAPP_COMMUNITY_URL,
  submitSubscriptionPayment,
  getUserPayments
} from '../services/paymentService';
import { PaymentRecord } from '../types';

export const Pricing: React.FC = () => {
  const { userData, user } = useAuth();
  const navigate = useNavigate();

  // Payment form state
  const [selectedMethod, setSelectedMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [trxId, setTrxId] = useState('');
  const [email, setEmail] = useState(userData?.email || user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // User payment history state
  const [userPayments, setUserPayments] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (userData?.email) {
      setEmail(userData.email);
    }
  }, [userData?.email]);

  const fetchHistory = async () => {
    if (!userData?.uid) return;
    setLoadingHistory(true);
    try {
      const records = await getUserPayments(userData.uid);
      setUserPayments(records);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userData?.uid]);

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(PAYMENT_PHONE_NUMBER);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handlePasteTrx = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setTrxId(text.trim().toUpperCase());
    } catch {}
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) {
      navigate('/login');
      return;
    }

    const cleanTrx = trxId.trim().toUpperCase();
    if (!cleanTrx || cleanTrx.length < 3) {
      setSubmitError('অনুগ্রহ করে সঠিক Transaction ID (TrxID) লিখুন বা পেস্ট করুন।');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await submitSubscriptionPayment({
        userId: userData.uid,
        userEmail: email.trim() || userData.email,
        userName: userData.name || userData.nickname || 'User',
        trxId: cleanTrx,
        method: selectedMethod
      });

      setSubmitSuccess('পেমেন্ট রিকোয়েস্ট সফলভাবে জমা হয়েছে! এডমিন ভেরিফাই করে কিছুক্ষণের মধ্যে আপনার Unlimited সাবস্ক্রিপশন চালু করে দেবেন।');
      setTrxId('');
      fetchHistory();
    } catch (err: any) {
      setSubmitError(err?.message || 'পেমেন্ট জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUnlimitedActive = userData?.unlimited && (!userData.planEndDate || new Date(userData.planEndDate).getTime() > Date.now());
  const formattedEndDate = userData?.planEndDate ? new Date(userData.planEndDate).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar text-slate-200"
    >
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Parallel Text Membership
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-3">
            <CreditCard className="w-8 h-8 text-purple-400" />
            সাবস্ক্রিপশন প্ল্যান ও পেমেন্ট
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
            সীমাহীন আনলিমিটেড এআই ইমেজ প্রসেসিং ও মেটাডাটা তৈরির জন্য সহজ ও সাশ্রয়ী মাসিক প্ল্যান।
          </p>
        </div>

        {/* Development Cost Notice Banner */}
        <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-emerald-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center gap-3.5 shadow-lg shadow-purple-950/20">
          <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          <div className="text-xs sm:text-sm leading-relaxed text-slate-300">
            <span className="font-bold text-amber-300">গুরুত্বপূর্ণ নোটিশ: </span>
            ওয়েবসাইটটি সার্বক্ষণিক সচল রাখা, নতুন ফিচার ডেভেলপ করা এবং উচ্চক্ষমতাসম্পন্ন এআই সার্ভার খরচ মেটাতে অনেক ব্যয় হয়। তাই সবার নিরবচ্ছিন্ন সেবার জন্য সাবস্ক্রিপশন নেওয়া আবশ্যক।
          </div>
        </div>

        {/* Current Plan Status Box */}
        {userData && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isUnlimitedActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'}`}>
                {isUnlimitedActive ? <ShieldCheck className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
              </div>
              <div>
                <div className="text-xs text-slate-400">আপনার বর্তমান প্ল্যান</div>
                <div className="text-lg font-bold text-white flex items-center gap-2">
                  {isUnlimitedActive ? '১ মাস আনলিমিটেড (Active Unlimited)' : 'ফ্রি ট্রায়াল (Free Trial)'}
                  {isUnlimitedActive && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      সক্রিয়
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-left sm:text-right">
              {isUnlimitedActive ? (
                <div>
                  <div className="text-xs text-slate-400">মেয়াদ শেষ হবে</div>
                  <div className="text-sm font-semibold text-emerald-400">{formattedEndDate || '১ মাস'}</div>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-slate-400">অবশিষ্ট ট্রায়াল ক্রেডিট</div>
                  <div className="text-base font-bold text-purple-300">{userData.credits} Credits</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pricing Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          
          {/* Trial Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative">
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold mb-4">
                নতুন ব্যবহারকারীদের জন্য
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">ফ্রি ট্রায়াল (Trial)</h3>
              <p className="text-slate-400 text-xs sm:text-sm mb-6">নতুন একাউন্ট খুললেই সম্পূর্ণ ফ্রিতে ট্রায়াল ক্রেডিট।</p>
              
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">৳০</span>
                <span className="text-slate-400 text-sm">/ একবার</span>
              </div>

              <ul className="space-y-3.5 text-sm text-slate-300 mb-8">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>১০টি ফ্রি প্রসেসিং ক্রেডিট (10 Free Credits)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Adobe Stock টাইটেল, কি-ওয়ার্ড ও ক্যাটাগরি তৈরি</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>এক ক্লিকে CSV এক্সপোর্ট</span>
                </li>
                <li className="flex items-center gap-2.5 text-slate-500">
                  <Check className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>ক্রেডিট শেষ হলে আনলিমিটেড প্ল্যান নিতে হবে</span>
                </li>
              </ul>
            </div>

            <button 
              onClick={() => navigate('/')}
              className="w-full py-3.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-sm"
            >
              প্রসেসিং শুরু করুন
            </button>
          </div>

          {/* 200 Tk Unlimited Monthly Card */}
          <div className="bg-gradient-to-b from-purple-950/40 via-slate-900/90 to-slate-900 border-2 border-purple-500 rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative shadow-[0_0_40px_rgba(168,85,247,0.2)]">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-lg">
              সর্বাধিক জনপ্রিয় • Unlimited
            </div>

            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold mb-4 mt-2">
                ১ মাস আনলিমিটেড প্রসেসিং
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">আনলিমিটেড সাবস্ক্রিপশন</h3>
              <p className="text-slate-400 text-xs sm:text-sm mb-6">কোনো দৈনিক বা মাসিক ক্রেডিট সীমা নেই, যত খুশি তত ছবি প্রসেস করুন।</p>
              
              <div className="mb-6 flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-white">৳২০০</span>
                <span className="text-purple-300 font-medium text-sm">/ প্রতি মাস (30 দিন)</span>
              </div>

              <ul className="space-y-3.5 text-sm text-slate-200 mb-8">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-white">আনলিমিটেড মেটাডাটা জেনারেশন (Unlimited Processing)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>১ মাস (৩০ দিন) পূর্ণ মেয়াদ</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>হাই-স্পিড টার্বো ও সেন্ট্রাল এআই অ্যাক্সেস</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>অটোমেটিক ক্যাটাগরি ডিটেকশন ও CSV এক্সপোর্ট</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>সর্বোচ্চ ২টি ডিভাইসে নিরাপদ লগইন</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>প্রাইওরিটি হোয়াটসঅ্যাপ কমিউনিটি সাপোর্ট</span>
                </li>
              </ul>
            </div>

            <a 
              href="#payment-section"
              className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white transition-all text-center text-sm sm:text-base shadow-lg shadow-purple-900/40"
            >
              {isUnlimitedActive ? 'পুনরায় রিনিউ / পে করুন' : 'সাবস্ক্রিপশন কিনুন (৳২০০)'}
            </a>
          </div>

        </div>

        {/* Step-by-Step Payment Instructions & Submission Form */}
        <div id="payment-section" className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 scroll-mt-6">
          <div className="border-b border-slate-800 pb-5">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Send className="w-6 h-6 text-purple-400" />
              কীভাবে সাবস্ক্রিপশন কিনবেন? (Payment Instructions)
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              খুব সহজেই বিকাশ বা নগদ অ্যাপ থেকে সেন্ড মানি করে নিচের ফর্মে TrxID সাবমিট করুন।
            </p>
          </div>

          {/* 3 Easy Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Step 1 */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-sm">
                ১
              </div>
              <h4 className="font-bold text-white text-base">সেন্ড মানি করুন (Send Money)</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                আপনার <strong>bKash</strong> অথবা <strong>Nagad</strong> পার্সোনাল একাউন্ট থেকে <span className="text-emerald-400 font-bold">৳২০০ টাকা</span> সেন্ড মানি করুন।
              </p>
              
              <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-3 flex items-center justify-between gap-2 mt-2">
                <div className="font-mono text-sm sm:text-base font-bold text-purple-200">
                  {PAYMENT_PHONE_NUMBER}
                </div>
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className="px-2.5 py-1 bg-purple-600/40 hover:bg-purple-600 text-purple-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  {copiedNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedNumber ? 'কপি হয়েছে' : 'কপি করুন'}
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-pink-500/20 text-pink-300 flex items-center justify-center font-bold text-sm">
                ২
              </div>
              <h4 className="font-bold text-white text-base">রেফারেন্সে ইমেইল লিখুন</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                বিকাশ বা নগদ সেন্ড মানি করার সময় <strong>Reference (রেফারেন্স)</strong> এর ঘরে আপনার এই সাইটের <strong>লগইন ইমেইল অ্যাড্রেস</strong> লিখুন।
              </p>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 font-mono break-all">
                Reference: {email || 'your_email@gmail.com'}
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-3 relative overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-sm">
                ৩
              </div>
              <h4 className="font-bold text-white text-base">TrxID সাবমিট করুন</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                টাকা পাঠানো সফল হলে প্রাপ্ত <strong>Transaction ID (TrxID)</strong> কপি করে নিচের ফর্মে বসিয়ে <strong>সাবমিট</strong> বাটনে চাপ দিন।
              </p>
              <div className="text-[11px] text-slate-400 pt-1">
                এডমিন নোটিফিকেশন পেয়ে সাথে সাথে আপনার ১ মাসের আনলিমিটেড প্ল্যান চালু করবেন।
              </div>
            </div>

          </div>

          {/* Payment Submission Form */}
          <form onSubmit={handleSubmitPayment} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-slate-800/80 pb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              পেমেন্ট যাচাইয়ের ফর্ম (Submit TrxID)
            </h3>

            {/* Payment Method Selector (bKash & Nagad with authentic branded visuals) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2.5">
                পেমেন্ট মাধ্যম বেছে নিন (Select Payment Method)
              </label>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md">
                
                {/* bKash Button */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('bkash')}
                  className={`p-3.5 rounded-xl border flex items-center justify-center gap-3 transition-all ${
                    selectedMethod === 'bkash' 
                      ? 'bg-[#E2136E]/20 border-[#E2136E] text-white shadow-[0_0_20px_rgba(226,19,110,0.3)]' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="w-6 h-6 rounded-md bg-[#E2136E] flex items-center justify-center text-white font-bold text-xs shadow">
                    b
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">bKash (বিকাশ)</div>
                    <div className="text-[10px] text-slate-400">Send Money</div>
                  </div>
                </button>

                {/* Nagad Button */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('nagad')}
                  className={`p-3.5 rounded-xl border flex items-center justify-center gap-3 transition-all ${
                    selectedMethod === 'nagad' 
                      ? 'bg-[#F7941D]/20 border-[#F7941D] text-white shadow-[0_0_20px_rgba(247,148,29,0.3)]' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="w-6 h-6 rounded-md bg-[#F7941D] flex items-center justify-center text-white font-bold text-xs shadow">
                    ন
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">Nagad (নগদ)</div>
                    <div className="text-[10px] text-slate-400">Send Money</div>
                  </div>
                </button>

              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Account Email Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  আপনার একাউন্ট ইমেইল (User Email)
                </label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                />
              </div>

              {/* TrxID Input Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex justify-between items-center">
                  <span>Transaction ID (TrxID) *</span>
                  <button 
                    type="button" 
                    onClick={handlePasteTrx} 
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
                  >
                    <Copy className="w-3 h-3" /> পেস্ট করুন
                  </button>
                </label>
                <input 
                  type="text" 
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                  required
                  placeholder="যেমন: BK89X721AL অথবা 7XM92B..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white font-mono tracking-wider outline-none transition-colors"
                />
              </div>

            </div>

            {/* Error Message */}
            {submitError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs sm:text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Success Message */}
            {submitSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs sm:text-sm flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <span>{submitSuccess}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="text-xs text-slate-400">
                টাকার পরিমাণ: <span className="font-bold text-white text-sm">৳{SUBSCRIPTION_PRICE_BDT}</span> • মেয়াদ: <span className="font-bold text-white text-sm">১ মাস</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    সাবমিট হচ্ছে...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    সাবমিট করুন (Submit Payment)
                  </>
                )}
              </button>
            </div>

          </form>

        </div>

        {/* WhatsApp Community Support Banner */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-purple-950/40 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-14 h-14 rounded-2xl bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center text-[#25D366] shrink-0">
              <MessageCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                Parallel text community
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 font-medium">
                  Official WhatsApp Group
                </span>
              </h3>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">
                যেকোনো সমস্যা, পেমেন্ট সংক্রান্ত তথ্য বা সাপোর্টের জন্য আমাদের অফিসিয়াল হোয়াটসঅ্যাপ কমিউনিটিতে যুক্ত থাকুন।
              </p>
            </div>
          </div>

          <a 
            href={WHATSAPP_COMMUNITY_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-6 py-3.5 bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-950/40 shrink-0 transition-transform active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
            গ্রুপে যোগ দিন (Join Group)
            <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-75" />
          </a>
        </div>

        {/* User Payment History Section */}
        {userData && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                আপনার পেমেন্ট হিস্ট্রি (Payment History)
              </h3>
              <button 
                onClick={fetchHistory}
                disabled={loadingHistory}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                রিফ্রেশ
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                পেমেন্ট তথ্য লোড হচ্ছে...
              </div>
            ) : userPayments.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                আপনার কোনো পূর্ববর্তী পেমেন্ট রিকোয়েস্ট পাওয়া যায়নি।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="pb-3 font-semibold">তারিখ</th>
                      <th className="pb-3 font-semibold">মাধ্যম</th>
                      <th className="pb-3 font-semibold">TrxID</th>
                      <th className="pb-3 font-semibold">পরিমাণ</th>
                      <th className="pb-3 font-semibold">স্ট্যাটাস</th>
                      <th className="pb-3 font-semibold">মেয়াদ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {userPayments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 text-slate-300 font-sans">
                          {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 font-sans capitalize font-semibold text-slate-200">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${p.method === 'bkash' ? 'bg-pink-500/20 text-pink-300' : 'bg-orange-500/20 text-orange-300'}`}>
                            {p.method}
                          </span>
                        </td>
                        <td className="py-3 font-bold text-purple-300">{p.trxId}</td>
                        <td className="py-3 font-sans font-bold text-white">৳{p.amount}</td>
                        <td className="py-3 font-sans">
                          {p.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> অনুমোদিত (Approved)
                            </span>
                          ) : p.status === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/30">
                              <AlertCircle className="w-3 h-3" /> বাতিল (Rejected)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
                              <Clock className="w-3 h-3 animate-pulse" /> অপেক্ষমাণ (Pending)
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-sans text-slate-400 text-xs">
                          {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </motion.div>
  );
};
