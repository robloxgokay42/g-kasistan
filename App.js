// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-firestore.js";

/* --- FIREBASE CONFIG (senin verdiğin) --- */
const firebaseConfig = {
  apiKey: "AIzaSyARXo1J3dRw50kTPvuWPShewQcBFhewMkQ",
  authDomain: "gokasistan.firebaseapp.com",
  projectId: "gokasistan",
  storageBucket: "gokasistan.firebasestorage.app",
  messagingSenderId: "76350974511",
  appId: "1:76350974511:web:d7f0d10c22d287d9dc34da",
  measurementId: "G-T358KYVEBR"
};

const APP_ID = "gokasistan"; // artifacts/{appId}/users/{uid}/...
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* UI */
const userEmailEl = document.getElementById('user-email');
const signoutBtn = document.getElementById('signout');
const sendBtn = document.getElementById('send-btn');
const promptInput = document.getElementById('prompt-input');
const chatArea = document.getElementById('chat-area');
const newChatBtn = document.getElementById('new-chat');
const chatsList = document.getElementById('chats-list');

let currentChatId = null;

/* Auth state */
onAuthStateChanged(auth, user => {
  if(user){
    userEmailEl.textContent = user.email;
    loadChats(user.uid);
  } else {
    userEmailEl.innerHTML = `<button id="sign-in-google">Google ile giriş</button>`;
    document.getElementById('sign-in-google').addEventListener('click', async () => {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    });
  }
});

signoutBtn.addEventListener('click', ()=> signOut(auth));

newChatBtn.addEventListener('click', async () => {
  const u = auth.currentUser;
  if(!u) return alert('Giriş yapın');
  currentChatId = 'chat-' + Date.now();
  chatArea.innerHTML = '';
  const li = document.createElement('li');
  li.textContent = `Yeni sohbet — ${new Date().toLocaleString()}`;
  chatsList.prepend(li);

  // start listening messages for this chat
  listenMessagesForChat(u.uid, currentChatId);
});

sendBtn.addEventListener('click', sendPrompt);
promptInput.addEventListener('keydown', e => { if(e.key === 'Enter') sendPrompt(); });

async function sendPrompt(){
  const text = promptInput.value.trim();
  const u = auth.currentUser;
  if(!u) return alert('Giriş yapmalısın');
  if(!text) return;

  if(!currentChatId){
    currentChatId = 'chat-' + Date.now();
    listenMessagesForChat(u.uid, currentChatId);
  }

  const messagesRef = collection(db, 'artifacts', APP_ID, 'users', u.uid, 'chats', currentChatId, 'messages');
  await addDoc(messagesRef, { sender:'user', text, createdAt: serverTimestamp() });
  promptInput.value = '';

  // çağrı sunucuya: sunucuda GOOGLE_AI_KEY kullanılır
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, userId: u.uid, chatId: currentChatId })
    });
    const json = await res.json();
    const aiText = json?.reply || 'AI cevaplayamadı.';
    await addDoc(messagesRef, { sender:'ai', text: aiText, createdAt: serverTimestamp() });
  } catch(err){
    console.error(err);
    await addDoc(messagesRef, { sender:'ai', text: 'AI isteğinde hata: ' + err.message, createdAt: serverTimestamp() });
  }
}

function listenMessagesForChat(userId, chatId){
  chatArea.innerHTML = 'Yükleniyor...';
  const messagesRef = collection(db, 'artifacts', APP_ID, 'users', userId, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));
  onSnapshot(q, snap => {
    chatArea.innerHTML = '';
    snap.forEach(d => {
      const m = d.data();
      const div = document.createElement('div');
      div.className = 'message ' + (m.sender === 'user' ? 'user' : 'ai');
      div.textContent = m.text;
      chatArea.appendChild(div);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

function loadChats(uid){
  chatsList.innerHTML = '';
  const sample = document.createElement('li');
  sample.textContent = 'Yeni sohbet';
  sample.addEventListener('click', () => {
    currentChatId = 'chat-sample';
    listenMessagesForChat(uid, currentChatId);
  });
  chatsList.appendChild(sample);
}
