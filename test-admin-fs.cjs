const admin = require('firebase-admin');
const fs = require('fs');
let serviceAccount;
try {
  serviceAccount = require('./firebase-adminsdk.json');
} catch (e) {
  console.log("No firebase-adminsdk.json");
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
db.collection('central_keys').get().then(snap => {
  console.log('Central keys in Firestore:', snap.size);
  process.exit(0);
}).catch(console.error);
