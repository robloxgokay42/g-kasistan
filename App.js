// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.20.0/firebase-firestore.js";

/* --------- Firebase config (senin verdiğin) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyARXo1J3dRw50kTPvuWPShewQcBFhewMkQ",
  authDomain: "gokasistan.firebaseapp.com",
  projectId: "gokasistan",
  storageBucket: "gokasistan.firebasestorage.app",
  messagingSenderId: "76350974511",
  appId: "1:76350974511:web:d7f0d10c22d287d9dc34da",
  measurementId: "G-T358KYVEBR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* UI references */
const userEmailEl = document.getElementById('user-email');
const signoutBtn = document.getElementById('signout');
const sendBtn = document.getElementById('send-btn');
const promptInput = document.getElementById('prompt-input');
const chatArea = document.getElementById('chat-area');
const newChatBtn = document.getElementById('new-chat');
const chatsList = document.getElementById('chats-list');

let currentChatId = null;
const APP_ID = "gokasistan"; // artifacts/{appId} path root used in rules

/* Auth state */
onAuthStateChanged(auth, user => {
  if(user){
    userEmailEl.textContent = user.email;
    // load chats for this user
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

/* New chat */
newChatBtn.addEventListener('click', async () => {
  const u = auth.currentUser;
  if(!u) return alert('Giriş yapın');
  // create a new chat id (use timestamp)
  currentChatId = 'chat-'+Date.now();
  // create initial message doc if you want — here we just update UI
  chatArea.innerHTML = '';
  const li = document.createElement('li');
  li.textContent = `Yeni sohbet — ${new Date().toLocaleString()}`;
  chatsList.prepend(li);
});

/* Send prompt -> save to Firestore and call AI (server proxy) */
sendBtn.addEventListener('click', async ()=>{
  const text = promptInput.value.trim();
  const u = auth.currentUser;
  if(!u) return alert('Giriş yapmalısın');
  if(!text) return;

  if(!currentChatId) {
    currentChatId = 'chat-'+Date.now();
  }

  // save user's message
  const messagesRef = collection(db, 'artifacts', APP_ID, 'users', u.uid, 'chats', currentChatId, 'messages');
  await addDoc(messagesRef, {
    sender: 'user',
    text,
    createdAt: serverTimestamp()
  });

  // clear input and show locally
  promptInput.value = '';

  // call server-side AI proxy
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, userId: u.uid, chatId: currentChatId })
    });

    const data = await res.json();
    const aiText = data?.reply || 'AI cevap vermedi.';

    // save AI message to Firestore
    await addDoc(messagesRef, {
      sender: 'ai',
      text: aiText,
      createdAt: serverTimestamp()
    });

  } catch(err){
    console.error(err);
    alert('AI isteğinde hata: ' + err.message);
  }
});

/* Real-time listener for messages of current chat */
async function listenMessagesForChat(userId, chatId) {
  if(!userId || !chatId) return;
  // cleanup previous
  chatArea.innerHTML = 'Yükleniyor...';
  const messagesRef = collection(db, 'artifacts', APP_ID, 'users', userId, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));
  onSnapshot(q, snapshot => {
    chatArea.innerHTML = '';
    snapshot.forEach(doc => {
      const m = doc.data();
      const el = document.createElement('div');
      el.className = 'message ' + (m.sender === 'user' ? 'user' : 'ai');
      el.textContent = m.text;
      chatArea.appendChild(el);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

/* load chat list for user */
function loadChats(uid){
  // For simplicity we only show placeholder; you can implement listing by retrieving chats collection
  chatsList.innerHTML = '';
  // sample entry to click and load messages
  const sample = document.createElement('li');
  sample.textContent = 'Yeni sohbet';
  sample.addEventListener('click', () => {
    currentChatId = 'chat-sample';
    listenMessagesForChat(uid, currentChatId);
  });
  chatsList.appendChild(sample);
}
