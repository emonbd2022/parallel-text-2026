import { app } from './src/lib/firebase.ts';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const auth = getAuth(app);
const db = getFirestore(app);

signInWithEmailAndPassword(auth, 'reactoremon2022@gmail.com', 'password').then(async (cred) => {
  console.log('Signed in', cred.user.uid);
  try {
    await setDoc(doc(db, 'central_keys', 'test-doc'), {
        id: 'test-doc',
        label: 'Test Key',
        key: 'AIzaSyTest1234567890',
        maskedKey: 'AIzaSy••••••••7890',
        keyHash: 'hash',
        contributedBy: 'user',
        contributorName: 'user',
        contributorEmail: 'user@test.com',
        enabled: true,
        createdAt: new Date().toISOString()
    });
    console.log('Success');
  } catch(e) {
    console.error('Firestore Error:', e);
  }
  process.exit(0);
}).catch(e => {
  console.log('Auth Error', e);
  process.exit(1);
});
