const fs = require('fs');
let code = fs.readFileSync('src/pages/Pricing.tsx', 'utf-8');

const regex = /const plans = \[\s*\{[\s\S]*?\];\s*\/\/\s*\{[\s\S]*?\];/;
const goodPlans = `const plans = [
    { name: 'Starter', credits: '2,000', price: '৳200', popular: false, validity: '1 Month' },
    { name: 'Pro', credits: '5,000', price: '৳400', popular: true, validity: '2 Months' },
    { name: 'Elite', credits: '10,000', price: '৳600', popular: false, validity: '6 Months' },
    { name: 'Unlimited', credits: '∞', price: '৳2,000', popular: false, desc: 'Unlimited lifetime processing', validity: 'Lifetime' },
  ];`;

code = code.replace(regex, goodPlans);
fs.writeFileSync('src/pages/Pricing.tsx', code);
