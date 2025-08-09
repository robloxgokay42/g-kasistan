// app.js
import { FIREBASE_CONFIG, GOOGLE_AISTUDIO_API_KEY } from './config.js';

// Firebase modular SDK import (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-firestore.js";

// Init Firebase
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const APP_ID = "gokasistan";

const userEmailEl = document.getElementById('user-email');
const signoutBtn = document.getElementById('signout');
const sendBtn = document.getElementById('send-btn');
const promptInput = document.getElementById('prompt-input');
const chatArea = document.getElementById('chat-area');
const newChatBtn = document.getElementById('new-chat');
const chatsList = document.getElementById('chats-list');

let currentChatId = null;

onAuthStateChanged(auth, user => {
  if(user){
    userEmailEl.textContent = user.email;
    loadChats(user.uid);
  } else {
    userEmailEl.innerHTML = `<button id="sign-in-google">Google ile giriş</button>`;
    document.getElementById('sign-in-google').addEventListener('click', async () => {
      const provider = new GoogleAuthProvider();
      try { await signInWithPopup(auth, provider); }
      catch(e){ alert('Giriş hata: '+e.message); }
    });
  }
});

signoutBtn.addEventListener('click', ()=> signOut(auth));
newChatBtn.addEventListener('click', ()=> {
  if(!auth.currentUser) return alert('Giriş yapın');
  currentChatId = 'chat-' + Date.now();
  chatArea.innerHTML = '';
  listenMessagesForChat(auth.currentUser.uid, currentChatId);
});

sendBtn.addEventListener('click', sendPrompt);
promptInput.addEventListener('keydown', e => { if(e.key === 'Enter') sendPrompt(); });

async function sendPrompt(){
  const text = promptInput.value.trim();
  const user = auth.currentUser;
  if(!user) return alert('Giriş yapın');
  if(!text) return;

  if(!currentChatId) {
    currentChatId = 'chat-' + Date.now();
    listenMessagesForChat(user.uid, currentChatId);
  }

  const messagesRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'chats', currentChatId, 'messages');
  await addDoc(messagesRef, { sender:'user', text, createdAt: serverTimestamp() });
  promptInput.value = '';

  // === GOOGLE AI STUDIO ÇAĞRISI (İstemci tarafı, doğrudan API key kullanılıyor) ===
  try {
    // Not: endpoint yapısı Google tarafında değişebilir, bu örnek "generativelanguage" API pattern'ine göre.
    const endpoint = `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate?key=${GOOGLE_AISTUDIO_API_KEY}`;

    const body = {
      // örnek payload — gerektiğinde Google dokümantasyonuna göre değiştir
      prompt: {
        text: text
      },
      // parametreler (isteğe göre)
      temperature: 0.2,
      maxOutputTokens: 512
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const json = await response.json();
    // Basit parse (google'ın yanıt formatına göre uyarlaman gerekebilir)
    let aiText = '';
    if(json && json.candidates && json.candidates.length > 0){
      aiText = json.candidates[0].content || JSON.stringify(json.candidates[0]);
    } else if(json?.output?.[0]?.content) {
      aiText = json.output.map(o => o.content).join('\n');
    } else {
      aiText = JSON.stringify(json);
    }

    await addDoc(messagesRef, { sender:'ai', text: aiText, createdAt: serverTimestamp() });
  } catch(err){
    console.error('AI hatası', err);
    await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'chats', currentChatId, 'messages'), {
      sender: 'ai', text: 'AI isteğinde hata: ' + err.message, createdAt: serverTimestamp()
    });
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
  // Basit placeholder. Sohbetleri listellemek için /chats collection'ına meta verisi kaydet.
  const li = document.createElement('li');
  li.textContent = 'Yeni sohbet';
  li.addEventListener('click', () => {
    currentChatId = 'chat-sample';
    listenMessagesForChat(uid, currentChatId);
  });
  chatsList.appendChild(li);
}
