import { app } from './src/lib/firebase.ts';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const db = getFirestore(app);
getDocs(collection(db, 'central_keys')).then(snap => {
  console.log('Central Keys in Firestore:', snap.size);
  process.exit(0);
}).catch(console.error);
