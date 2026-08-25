const admin = require('firebase-admin');
const serviceAccount = require('./firebase-applet-config.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
db.collection('central_keys').get().then(snap => {
  console.log('Central keys in Firestore:', snap.size);
  process.exit(0);
}).catch(console.error);
