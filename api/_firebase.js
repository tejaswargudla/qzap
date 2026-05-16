const admin = require('firebase-admin');
const fs = require('fs');

// Initialise only once — Vercel reuses function instances between requests
if (!admin.apps.length) {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // Preferred for local dev: point to the downloaded JSON file directly
    const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    try {
      serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      throw new Error(`Could not read service account file at "${filePath}": ${e.message}`);
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Fallback: full JSON pasted as a string (newlines in private_key must be \n)
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT is not valid JSON.\n' +
        'Tip: use FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json instead.'
      );
    }
  } else {
    throw new Error(
      'Firebase credentials not set.\n' +
      'Add FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json to .env.local'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
module.exports = { admin, db };
