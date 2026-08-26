const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
`if (!existing.contributorName || existing.contributorName === 'central' || existing.contributorName === 'anonymous') {
                        existing.contributorName = exactContributor;
                    }
                    if (!existing.contributedBy || existing.contributedBy === 'central' || existing.contributedBy === 'anonymous') {
                        existing.contributedBy = exactContributor;
                    }`,
`if (!existing.contributorName || existing.contributorName === 'central' || existing.contributorName === 'anonymous' || existing.contributorName === 'Community Contributor' || existing.contributorName === 'User' || existing.contributorName === 'Community') {
                        existing.contributorName = exactContributor;
                    }
                    if (!existing.contributedBy || existing.contributedBy === 'central' || existing.contributedBy === 'anonymous' || existing.contributedBy === 'Community Contributor' || existing.contributedBy === 'User' || existing.contributedBy === 'Community') {
                        existing.contributedBy = exactContributor;
                    }`);

fs.writeFileSync('server.ts', content);
