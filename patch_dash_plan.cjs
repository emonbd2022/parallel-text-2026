const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

code = code.replace(
  "<Crown className=\"w-5 h-5 text-amber-400\" /> Current Plan\n            </h3>",
  "<Crown className=\"w-5 h-5 text-amber-400\" /> Current Plan\n            </h3>"
); // check if it exists

// replace standard plan view
code = code.replace(
  /<div className="text-4xl font-black text-white mb-2">\s*\{userData.unlimited \? 'Unlimited' : 'Standard'\}\s*<\/div>\s*\{!userData.unlimited && \(\s*<p className="text-slate-400">\s*You are on the pay-as-you-go plan.\s*<\/p>\s*\)\}/,
  `<div className="text-4xl font-black text-white mb-2 capitalize">
              {userData.plan && userData.plan !== 'free' ? userData.plan : (userData.unlimited ? 'Unlimited' : 'Free')}
            </div>
            {userData.plan && userData.plan !== 'free' ? (
              <p className="text-slate-400">
                {userData.planEndDate ? (
                   <>Valid until <strong className="text-white">{new Date(userData.planEndDate).toLocaleDateString()}</strong></>
                ) : (
                   'Active Subscription'
                )}
              </p>
            ) : (
              <p className="text-slate-400">
                You are on the free plan. Upgrade for more credits.
              </p>
            )}`
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
