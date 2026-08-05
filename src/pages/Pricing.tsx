import React from 'react';
import { CreditCard, Check } from 'lucide-react';

export const Pricing: React.FC = () => {
  const plans = [
    { name: 'Starter', credits: '2,000', price: '৳200', popular: false, validity: '1 Month' },
    { name: 'Pro', credits: '5,000', price: '৳400', popular: true, validity: '2 Months' },
    { name: 'Elite', credits: '10,000', price: '৳600', popular: false, validity: '6 Months' },
    { name: 'Unlimited', credits: '∞', price: '৳2,000', popular: false, desc: 'Unlimited lifetime processing', validity: 'Lifetime' },
  ];

  const handleBuy = (planName: string) => {
    const text = encodeURIComponent(`Hi, I would like to buy the ${planName} plan for Parallel Text.`);
    window.open(`https://wa.me/8801601934495?text=${text}`, '_blank');
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white flex items-center justify-center gap-3">
            <CreditCard className="w-10 h-10 text-purple-400" />
            Pricing Plans
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-lg">
            Choose the perfect plan for your image processing needs. Securely checkout via WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <div key={i} className={`bg-slate-900/80 border rounded-3xl p-8 relative flex flex-col ${plan.popular ? 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.2)] transform -translate-y-2' : 'border-slate-800'}`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                </div>
                <p className="text-slate-400 mt-2">{plan.desc || `${plan.credits} processing credits`}</p>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{plan.credits} Images</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{plan.validity} Validity</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Auto-generate metadata</span>
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>CSV Export</span>
                </li>
              </ul>

              <button 
                onClick={() => handleBuy(plan.name)}
                className={`w-full py-4 rounded-xl font-bold transition-all ${plan.popular ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/50' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
              >
                Buy Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
