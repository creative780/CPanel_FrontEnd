import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCG586cD7CfforAK-0FnpBx5XskQARbjXM",
  authDomain: "creative-connect-v1.firebaseapp.com",
  projectId: "creative-connect-v1",
  storageBucket: "creative-connect-v1.firebasestorage.app",
  messagingSenderId: "167622620621",
  appId: "1:167622620621:web:3b9f397f48a75cd5bfc084"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export services
export { auth, db, googleProvider };
