import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD75_rNAapNiD_WRkFQg_0VoJP1cc25Rxo",
  authDomain: "pisito-bf9d5.firebaseapp.com",
  projectId: "pisito-bf9d5",
  storageBucket: "pisito-bf9d5.firebasestorage.app",
  messagingSenderId: "1090779749895",
  appId: "1:1090779749895:web:5edcbd999501eccecf14a2"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
