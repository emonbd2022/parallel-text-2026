const fs = require('fs');
let code = fs.readFileSync('src/pages/Pricing.tsx', 'utf-8');

code = code.replace(
  "const plans = [",
  "const plans = [\n    { name: 'Starter', credits: '2,000', price: '৳200', popular: false, validity: '1 Month' },\n    { name: 'Pro', credits: '5,000', price: '৳400', popular: true, validity: '2 Months' },\n    { name: 'Elite', credits: '10,000', price: '৳600', popular: false, validity: '6 Months' },\n    { name: 'Unlimited', credits: '∞', price: '৳2,000', popular: false, desc: 'Unlimited lifetime processing', validity: 'Lifetime' },\n  ]; //"
);

code = code.replace(
  "<span>{plan.credits} Images</span>",
  "<span>{plan.credits} Images</span>\n                </li>\n                <li className=\"flex items-center gap-3 text-slate-300\">\n                  <Check className=\"w-5 h-5 text-emerald-400 shrink-0\" />\n                  <span>{plan.validity} Validity</span>"
);

fs.writeFileSync('src/pages/Pricing.tsx', code);
