fetch('http://localhost:3000/api/collect-keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    keys: [{ label: 'test-user-key', key: 'AIzaSyTestUserKey12345', contributorName: 'TestUser', contributedBy: 'TestUser' }]
  })
}).then(res => res.json()).then(console.log).catch(console.error);
