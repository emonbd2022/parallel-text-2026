import dotenv from 'dotenv';
dotenv.config();

async function test() {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';

    console.log("Using dbId:", dbId);
    
    // Testing with dbId
    let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/central_keys?pageSize=1&key=${apiKey}`;
    let res = await fetch(url);
    console.log(dbId, res.status, await res.text());

    // Testing with (default)
    let url2 = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/central_keys?pageSize=1&key=${apiKey}`;
    let res2 = await fetch(url2);
    console.log("(default)", res2.status, await res2.text());
}
test();
