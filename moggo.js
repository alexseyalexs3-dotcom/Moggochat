const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'moggo_db.json');

let DB = { users: {}, messages: {} };
if (fs.existsSync(DB_FILE)) {
  try { DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MoggoЧат · Red Edition</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; }
:root {
  --red: #ff3b30; --red-dark: #c41e1e;
  --glass: rgba(255, 255, 255, 0.1); --glass-strong: rgba(255, 255, 255, 0.2);
  --glass-border: rgba(255, 255, 255, 0.3);
  --text: #fff; --text-soft: rgba(255, 255, 255, 0.7);
  --bubble-in: rgba(255, 255, 255, 0.15);
  --shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
body {
  min-height: 100vh; color: var(--text);
  background: linear-gradient(135deg, #1a0000, #4a0000 45%, #8b0000);
  overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;
}
body.dark {
  background: linear-gradient(135deg, #0a0000, #2a0000 45%, #550000);
}
.blob { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.6; z-index: 0; pointer-events: none; }
.blob.b1 { width: 400px; height: 400px; background: #ff3b30; top: -100px; left: -100px; animation: f1 15s ease-in-out infinite; }
.blob.b2 { width: 350px; height: 350px; background: #ff6b6b; bottom: -100px; right: -100px; animation: f2 18s ease-in-out infinite; }
.blob.b3 { width: 300px; height: 300px; background: #c41e1e; top: 40%; left: 40%; animation: f3 20s ease-in-out infinite; }
@keyframes f1 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(50px, 80px) scale(1.1); } }
@keyframes f2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-60px, -50px) scale(1.1); } }
@keyframes f3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-40px, 60px); } }

.glass {
  background: var(--glass);
  backdrop-filter: blur(25px) saturate(200%);
  -webkit-backdrop-filter: blur(25px) saturate(200%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow);
  position: relative;
}
.glass::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0) 45%);
}

/* Авторизация */
.auth-wrap { position: relative; z-index: 2; width: 100%; display: flex; justify-content: center; align-items: center; height: 100vh; padding: 20px; }
.auth-card { width: 400px; padding: 40px 30px; border-radius: 24px; text-align: center; animation: popIn 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
@keyframes popIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.auth-card h1 { font-size: 36px; font-weight: 800; margin-bottom: 8px; color: #fff; text-shadow: 0 2px 10px rgba(255, 59, 48, 0.5); }
.auth-card .sub { color: var(--text-soft); font-size: 14px; margin-bottom: 25px; }
.field { width: 100%; padding: 16px; margin-bottom: 15px; font-size: 15px; background: var(--glass-strong); border: 1px solid var(--glass-border); border-radius: 16px; color: #fff; outline: none; transition: 0.3s; }
.field::placeholder { color: rgba(255, 255, 255, 0.6); }
.field:focus { border-color: var(--red); box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.3); }
.btn-primary { width: 100%; padding: 16px; border: none; border-radius: 16px; cursor: pointer; font-size: 16px; font-weight: 700; color: #fff; background: linear-gradient(135deg, var(--red), var(--red-dark)); box-shadow: 0 8px 24px rgba(255, 59, 48, 0.4); transition: 0.3s; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(255, 59, 48, 0.6); }
.switch-link { text-align: center; margin-top: 20px; font-size: 14px; color: var(--text-soft); }
.switch-link a { color: var(--red); font-weight: 700; cursor: pointer; }
.err { text-align: center; font-size: 14px; min-height: 20px; margin-bottom: 10px; font-weight: 600; color: #ff6b6b; }
.hidden { display: none !important; }

/* Приложение */
.app { position: relative; z-index: 2; width: min(1060px, 96vw); height: min(700px, 94vh); border-radius: 24px; display: flex; overflow: hidden; padding: 12px; gap: 12px; animation: popIn 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
.sidebar { width: 320px; display: flex; flex-direction: column; border-radius: 20px; overflow: hidden; }
.side-head { padding: 15px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--glass-border); }
.brand { font-size: 20px; font-weight: 800; color: #fff; }
.head-actions { display: flex; gap: 8px; align-items: center; }
.icon-btn { width: 38px; height: 38px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--glass-strong); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: 0.2s; color: #fff; }
.icon-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(255, 59, 48, 0.3); }
.my-avatar { width: 40px; height: 40px; border-radius: 50%; color: #fff; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid rgba(255, 255, 255, 0.5); transition: 0.2s; }
.my-avatar:hover { transform: scale(1.08); }
.search-row { padding: 10px 15px; }
.search-row input { width: 100%; padding: 12px 16px; border-radius: 20px; font-size: 14px; border: 1px solid var(--glass-border); background: var(--glass-strong); color: #fff; outline: none; transition: 0.2s; }
.search-row input::placeholder { color: rgba(255, 255, 255, 0.5); }
.search-row input:focus { border-color: var(--red); box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.2); }
.tabs { display: flex; gap: 6px; padding: 0 15px 10px; }
.tab { flex: 1; padding: 10px; text-align: center; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; color: var(--text-soft); transition: 0.2s; border: 1px solid transparent; }
.tab.active { color: #fff; background: linear-gradient(135deg, var(--red), var(--red-dark)); box-shadow: 0 4px 14px rgba(255, 59, 48, 0.4); }
.tab:not(.active):hover { background: rgba(255, 255, 255, 0.1); }
.list { flex: 1; overflow-y: auto; padding: 0 10px 10px; }
.list::-webkit-scrollbar { width: 6px; }
.list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }
.item { display: flex; align-items: center; gap: 12px; padding: 12px; margin-bottom: 4px; border-radius: 16px; cursor: pointer; transition: 0.2s; position: relative; border: 1px solid transparent; }
.item:hover { background: rgba(255, 255, 255, 0.1); border-color: var(--glass-border); }
.item.active { background: rgba(255, 59, 48, 0.2); border-color: rgba(255, 59, 48, 0.5); }
.av { width: 48px; height: 48px; border-radius: 50%; color: #fff; font-weight: 800; font-size: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; position: relative; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); }
.av .dot { position: absolute; bottom: 0; right: 0; width: 13px; height: 13px; border-radius: 50%; background: #2ecc71; border: 2.5px solid rgba(255, 255, 255, 0.8); }
.av .dot.offline { background: #aaa; }
.av.bot { background: linear-gradient(135deg, #ff6b6b, #c41e1e) !important; }
.item .meta { flex: 1; overflow: hidden; }
.item .name { font-weight: 700; font-size: 15px; color: #fff; display: flex; align-items: center; gap: 6px; }
.item .name .bot-tag { font-size: 9px; font-weight: 800; background: var(--red); color: #fff; padding: 2px 6px; border-radius: 8px; }
.item .preview { font-size: 13px; color: var(--text-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.mini-btn { width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer; background: linear-gradient(135deg, var(--red), var(--red-dark)); color: #fff; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: 0.2s; box-shadow: 0 4px 10px rgba(255, 59, 48, 0.4); }
.mini-btn:hover { transform: scale(1.1); }
.empty { padding: 40px 20px; text-align: center; color: var(--text-soft); font-size: 14px; }

/* Чат */
.chat { flex: 1; display: flex; flex-direction: column; border-radius: 20px; overflow: hidden; position: relative; }
.chat-head { padding: 15px 20px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid var(--glass-border); background: var(--glass-strong); }
.chat-head .av { width: 44px; height: 44px; font-size: 18px; }
.chat-head .title { flex: 1; }
.chat-head .title .n { font-weight: 800; font-size: 17px; color: #fff; display: flex; align-items: center; gap: 8px; }
.chat-head .title .n .bot-tag { font-size: 10px; font-weight: 800; background: var(--red); color: #fff; padding: 2px 7px; border-radius: 8px; }
.chat-head .title .st { font-size: 13px; color: #2ecc71; font-weight: 600; display: flex; align-items: center; gap: 5px; }
.chat-head .title .st::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #2ecc71; box-shadow: 0 0 8px #2ecc71; }
.chat-head .title .st.offline { color: var(--text-soft); }
.chat-head .title .st.offline::before { background: #aaa; box-shadow: none; }
.messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
.messages::-webkit-scrollbar { width: 6px; }
.messages::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }
.date-sep { align-self: center; font-size: 12px; font-weight: 700; color: #fff; background: rgba(255, 59, 48, 0.4); padding: 5px 15px; border-radius: 12px; margin: 10px 0; backdrop-filter: blur(4px); }
.msg { max-width: 70%; padding: 12px 16px; border-radius: 18px; font-size: 15px; line-height: 1.4; word-wrap: break-word; position: relative; animation: msgIn 0.3s ease; }
@keyframes msgIn { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
.msg.sent { align-self: flex-end; color: #fff; background: linear-gradient(135deg, var(--red), var(--red-dark)); border-bottom-right-radius: 4px; box-shadow: 0 4px 15px rgba(255, 59, 48, 0.3); }
.msg.recv { align-self: flex-start; color: #fff; background: var(--bubble-in); border: 1px solid var(--glass-border); border-bottom-left-radius: 4px; backdrop-filter: blur(10px); }
.msg.bot-msg { background: linear-gradient(135deg, #ff6b6b, #8b0000); color: #fff; border: none; }
.msg .t { font-size: 11px; opacity: 0.7; margin-top: 4px; display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
.msg .read { font-size: 12px; color: #fff; }
.input-row { padding: 15px; display: flex; gap: 10px; align-items: center; border-top: 1px solid var(--glass-border); background: var(--glass-strong); }
.input-row input { flex: 1; padding: 14px 20px; border-radius: 24px; font-size: 15px; border: 1px solid var(--glass-border); background: rgba(255, 255, 255, 0.1); color: #fff; outline: none; transition: 0.2s; }
.input-row input::placeholder { color: rgba(255, 255, 255, 0.5); }
.input-row input:focus { border-color: var(--red); box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.2); }
.send-btn { width: 50px; height: 50px; border-radius: 50%; border: none; cursor: pointer; background: linear-gradient(135deg, var(--red), var(--red-dark)); color: #fff; font-size: 20px; box-shadow: 0 6px 20px rgba(255, 59, 48, 0.4); transition: 0.2s; flex-shrink: 0; }
.send-btn:hover { transform: scale(1.08) rotate(8deg); }
.no-chat { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-soft); gap: 15px; }
.no-chat .emoji { font-size: 80px; opacity: 0.5; animation: f1 5s ease-in-out infinite; }
.no-chat .txt { font-size: 16px; font-weight: 600; }
@media(max-width: 760px) { .app { padding: 8px; gap: 8px; } .sidebar { width: 120px; } .brand, .search-row, .tabs, .item .preview { display: none; } .item { padding: 8px; justify-content: center; } }
</style>
</head>
<body>
<div class="blob b1"></div>
<div class="blob b2"></div>
<div class="blob b3"></div>

<div id="authScreen" class="auth-wrap">
  <div class="auth-card glass">
    <h1>MoggoЧат</h1>
    <p class="sub">Red Edition · Liquid Glass</p>
    <div id="authErr" class="err"></div>
    <div id="loginForm">
      <input class="field" id="loginUser" placeholder="Логин" maxlength="20">
      <input class="field" id="loginPass" type="password" placeholder="Пароль" maxlength="40">
      <button class="btn-primary" onclick="doLogin()">Войти</button>
      <div class="switch-link">Нет аккаунта? <a onclick="showReg()">Создать</a></div>
    </div>
    <div id="regForm" class="hidden">
      <input class="field" id="regUser" placeholder="Придумайте логин" maxlength="20">
      <input class="field" id="regPass" type="password" placeholder="Пароль (мин. 4)" maxlength="40">
      <input class="field" id="regPass2" type="password" placeholder="Повторите пароль" maxlength="40">
      <button class="btn-primary" onclick="doRegister()">Создать аккаунт</button>
      <div class="switch-link">Уже есть? <a onclick="showLogin()">Войти</a></div>
    </div>
  </div>
</div>

<div id="appScreen" class="app glass hidden">
  <div class="sidebar glass">
    <div class="side-head">
      <div class="brand">Moggo</div>
      <div class="head-actions">
        <button class="icon-btn" onclick="toggleTheme()">🌙</button>
        <button class="icon-btn" onclick="doLogout()">⏻</button>
        <div class="my-avatar" id="myAv" onclick="openProfile()">?</div>
      </div>
    </div>
    <div class="search-row"><input id="search" placeholder="🔍 Поиск..." oninput="renderList()"></div>
    <div class="tabs">
      <div class="tab active" data-tab="friends" onclick="switchTab('friends')">Чаты</div>
      <div class="tab" data-tab="all" onclick="switchTab('all')">Люди</div>
    </div>
    <div class="list" id="list"></div>
  </div>

  <div class="chat glass">
    <div class="no-chat" id="noChat"><div class="emoji">💬</div><div class="txt">Выберите чат</div></div>
    <div id="activeChat" class="hidden" style="flex: 1; display: flex; flex-direction: column; height: 100%;">
      <div class="chat-head">
        <div class="av" id="chatAv">?</div>
        <div class="title">
          <div class="n" id="chatName"></div>
          <div class="st" id="chatStatus">в сети</div>
        </div>
        <button class="icon-btn" onclick="toggleFriendChat()">👥</button>
      </div>
      <div class="messages" id="messages"></div>
      <div class="input-row">
        <button class="icon-btn" onclick="toggleEmoji()">😀</button>
        <input id="msgInput" placeholder="Сообщение..." onkeypress="if(event.key==='Enter')sendMsg()">
        <button class="send-btn" onclick="sendMsg()">➤</button>
      </div>
    </div>
  </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
let me = null;
let users = {};
let onlineSet = new Set();
let chatWith = null;
let tab = 'friends';
let myFriends = [];
const AV_COLORS = ['#ff3b30', '#ff6b6b', '#c41e1e', '#e63946', '#d90429', '#ef233c'];
const SUPPORT_BOT = '__support__';
const BOT_NAME = 'Поддержка Moggo';
const CREATOR = 'mogg';

function showReg(){ loginForm.classList.add('hidden'); regForm.classList.remove('hidden'); authErr.textContent=''; }
function showLogin(){ regForm.classList.add('hidden'); loginForm.classList.remove('hidden'); authErr.textContent=''; }

function doRegister(){
  const u = regUser.value.trim(), p = regPass.value, p2 = regPass2.value;
  if(u.length < 3) return authErr.textContent = 'Логин ≥ 3';
  if(p.length < 4) return authErr.textContent = 'Пароль ≥ 4';
  if(p !== p2) return authErr.textContent = 'Пароли не совпадают';
  socket.emit('register', { username: u, password: p }, res => {
    if(!res.ok) return authErr.textContent = res.error;
    authErr.style.color = '#2ecc71';
    authErr.textContent = 'Аккаунт создан!';
    setTimeout(() => { showLogin(); loginUser.value = u; authErr.textContent = ''; }, 900);
  });
}

function doLogin(){
  const u = loginUser.value.trim(), p = loginPass.value;
  socket.emit('login', { username: u, password: p }, res => {
    if(!res.ok) return authErr.textContent = res.error;
    me = u; users = res.users; myFriends = res.friends;
    localStorage.setItem('mg_session', u);
    openApp();
  });
}

function doLogout(){
  socket.emit('logout');
  localStorage.removeItem('mg_session');
  me = null; chatWith = null;
  appScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  loginPass.value = '';
}

function openApp(){
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  myAv.textContent = me[0].toUpperCase();
  myAv.style.background = `linear-gradient(135deg, ${users[me].color}, ${shade(users[me].color, 30)})`;
  renderList(); closeChat();
}

function switchTab(t){
  tab = t;
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
  renderList();
}

function loadMessages(withUser){
  return new Promise(res => {
    if(withUser === SUPPORT_BOT) socket.emit('getSupportMessages', res);
    else socket.emit('getMessages', { with: withUser }, res);
  });
}

function renderList(){
  const q = search.value.trim().toLowerCase();
  list.innerHTML = '';
  
  const botEl = document.createElement('div');
  botEl.className = 'item' + (chatWith === SUPPORT_BOT ? ' active' : '');
  botEl.innerHTML = `<div class="av bot">🤖<div class="dot"></div></div><div class="meta"><div class="name">${BOT_NAME} <span class="bot-tag">BOT</span></div><div class="preview">Напишите — уйдёт создателю</div></div>`;
  botEl.onclick = () => openChat(SUPPORT_BOT);
  list.appendChild(botEl);

  if(tab === 'friends'){
    let arr = [...myFriends];
    if(q) arr = arr.filter(u => u.toLowerCase().includes(q));
    if(!arr.length && !q) { list.innerHTML += '<div class="empty">Нет друзей. Перейдите во вкладку «Люди»</div>'; return; }
    arr.forEach(u => {
      const color = users[u]?.color || '#ff3b30';
      const isOnline = onlineSet.has(u);
      const el = document.createElement('div');
      el.className = 'item' + (chatWith === u ? ' active' : '');
      el.innerHTML = `<div class="av" style="background: linear-gradient(135deg, ${color}, ${shade(color, 30)})">${u[0].toUpperCase()}<div class="dot ${isOnline ? '' : 'offline'}"></div></div><div class="meta"><div class="name">${escapeHtml(u)}</div><div class="preview">${isOnline ? 'в сети' : 'не в сети'}</div></div>`;
      el.onclick = () => openChat(u);
      list.appendChild(el);
    });
  } else {
    let arr = Object.keys(users).filter(u => u !== me && !myFriends.includes(u));
    if(q) arr = arr.filter(u => u.toLowerCase().includes(q));
    if(!arr.length) { list.innerHTML += '<div class="empty">Никого не найдено</div>'; return; }
    arr.forEach(u => {
      const color = users[u].color || '#ff3b30';
      const isOnline = onlineSet.has(u);
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `<div class="av" style="background: linear-gradient(135deg, ${color}, ${shade(color, 30)})">${u[0].toUpperCase()}<div class="dot ${isOnline ? '' : 'offline'}"></div></div><div class="meta"><div class="name">${escapeHtml(u)}</div><div class="preview">${isOnline ? 'в сети' : 'не в сети'}</div></div><button class="mini-btn">+</button>`;
      el.querySelector('.mini-btn').onclick = e => { e.stopPropagation(); addFriend(u); };
      el.onclick = () => addFriend(u);
      list.appendChild(el);
    });
  }
}

function addFriend(u){
  socket.emit('addFriend', { friend: u }, res => {
    if(res.ok){ myFriends = res.friends; toast('✅ ' + u + ' добавлен'); renderList(); }
  });
}

function toggleFriendChat(){
  if(!chatWith || chatWith === SUPPORT_BOT) return;
  if(myFriends.includes(chatWith)){
    socket.emit('removeFriend', { friend: chatWith }, res => {
      if(res.ok){ myFriends = res.friends; toast('❌ ' + chatWith + ' удалён'); renderList(); }
    });
  } else {
    socket.emit('addFriend', { friend: chatWith }, res => {
      if(res.ok){ myFriends = res.friends; toast('✅ ' + chatWith + ' добавлен'); renderList(); }
    });
  }
}

function openChat(u){
  chatWith = u;
  noChat.classList.add('hidden');
  activeChat.classList.remove('hidden');
  if(u === SUPPORT_BOT){
    chatName.innerHTML = BOT_NAME + ' <span class="bot-tag">BOT</span>';
    chatStatus.textContent = 'служба поддержки';
    chatStatus.className = 'st';
    chatAv.textContent = '🤖'; chatAv.className = 'av bot';
    chatAv.style.background = 'linear-gradient(135deg, #ff6b6b, #c41e1e)';
  } else {
    const color = users[u].color || '#ff3b30';
    chatName.textContent = u;
    const isOnline = onlineSet.has(u);
    chatStatus.textContent = isOnline ? 'в сети' : 'не в сети';
    chatStatus.className = 'st' + (isOnline ? '' : ' offline');
    chatAv.textContent = u[0].toUpperCase(); chatAv.className = 'av';
    chatAv.style.background = `linear-gradient(135deg, ${color}, ${shade(color, 30)})`;
  }
  loadMessages(u).then(arr => renderMessages(arr));
  renderList();
  setTimeout(() => msgInput.focus(), 100);
}

function closeChat(){
  chatWith = null;
  noChat.classList.remove('hidden');
  activeChat.classList.add('hidden');
}

function renderMessages(arr){
  messages.innerHTML = '';
  if(!arr || !arr.length){
    messages.innerHTML = `<div class="empty">${chatWith === SUPPORT_BOT ? '👋 Напишите в поддержку' : 'Начните диалог 👋'}</div>`;
    return;
  }
  let lastDate = '';
  arr.forEach(m => {
    const d = new Date(m.created_at * 1000);
    const ds = dateLabel(d);
    if(ds !== lastDate){
      lastDate = ds;
      const sep = document.createElement('div');
      sep.className = 'date-sep'; sep.textContent = ds;
      messages.appendChild(sep);
    }
    const isMe = m.sender === me;
    const isBot = m.sender === SUPPORT_BOT;
    const el = document.createElement('div');
    el.className = 'msg ' + (isBot ? 'bot-msg' : isMe ? 'sent' : 'recv');
    el.innerHTML = `${m.from_creator ? '<div style="font-size: 11px; opacity: 0.8; margin-bottom: 4px;">👤 Поддержка:</div>' : ''}${escapeHtml(m.text)}<div class="t">${m.time || formatTime(d)} ${isMe ? '<span class="read">✓✓</span>' : ''}</div>`;
    messages.appendChild(el);
  });
  messages.scrollTop = messages.scrollHeight;
}

function sendMsg(){
  const text = msgInput.value.trim();
  if(!text || !chatWith) return;
  socket.emit('sendMessage', { to: chatWith, text });
  msgInput.value = '';
}

function toggleTheme(){
  document.body.classList.toggle('dark');
  localStorage.setItem('mg_dark', document.body.classList.contains('dark') ? '1' : '0');
}

function openProfile(){
  const my = users[me];
  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.innerHTML = `<div class="modal glass" style="text-align: center;"><h3 style="color: #fff; margin-bottom: 20px;">🎨 Аватар — ${me}</h3><div class="colors" style="display: flex; gap: 10px; justify-content: center; margin-bottom: 20px;">${AV_COLORS.map(c => `<div data-c="${c}" style="background: ${c}; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 3px solid ${c === my.color ? '#fff' : 'transparent'};"></div>`).join('')}</div><button class="btn-primary" onclick="this.closest('.modal-bg').remove()">Готово</button></div>`;
  modal.onclick = e => { if(e.target === modal) modal.remove(); };
  modal.querySelectorAll('.colors div').forEach(d => {
    d.onclick = () => {
      socket.emit('setColor', { color: d.dataset.c }, res => {
        if(res.ok){
          users[me].color = d.dataset.c;
          myAv.style.background = `linear-gradient(135deg, ${d.dataset.c}, ${shade(d.dataset.c, 30)})`;
          modal.querySelectorAll('.colors div').forEach(x => x.style.borderColor = 'transparent');
          d.style.borderColor = '#fff';
          renderList();
        }
      });
    };
  });
  document.body.appendChild(modal);
}

function shade(hex, p){
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + p, g = ((n >> 8) & 255) + p, b = (n & 255) + p;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

function dateLabel(d){
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const y = new Date(t); y.setDate(y.getDate() - 1);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  if(dd.getTime() === t.getTime()) return 'Сегодня';
  if(dd.getTime() === y.getTime()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function formatTime(d){
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function toast(msg){
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  t.style.cssText = 'position: fixed; top: 24px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; color: #fff; background: linear-gradient(135deg, #ff3b30, #c41e1e); box-shadow: 0 10px 32px rgba(255, 59, 48, 0.5); z-index: 999;';
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = '0.3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 1800);
}

socket.on('online', arr => {
  onlineSet = new Set(arr);
  renderList();
  if(chatWith && chatWith !== SUPPORT_BOT){
    const isOnline = onlineSet.has(chatWith);
    chatStatus.textContent = isOnline ? 'в сети' : 'не в сети';
    chatStatus.className = 'st' + (isOnline ? '' : ' offline');
  }
});

socket.on('users_update', u => {
  users = u;
  if(me) renderList();
});

socket.on('new_message', m => {
  if(chatWith && (m.sender === chatWith || m.receiver === chatWith)){
    loadMessages(chatWith).then(renderMessages);
  }
  renderList();
});

socket.on('new_ticket', t => {
  if(me === CREATOR) toast('📨 Новое сообщение от ' + t.sender);
});

window.addEventListener('load', () => {
  if(localStorage.getItem('mg_dark') === '1') document.body.classList.add('dark');
  loginPass.addEventListener('keypress', e => { if(e.key === 'Enter') doLogin(); });
  regPass2.addEventListener('keypress', e => { if(e.key === 'Enter') doRegister(); });
});
</script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(HTML);
});

const SUPPORT_BOT = '__support__';
const CREATOR = 'mogg';
const AV_COLORS = ['#ff3b30', '#ff6b6b', '#c41e1e', '#e63946', '#d90429', '#ef233c'];
const onlineUsers = new Map();

function getUserList() { const out = {}; for (const u in DB.users) out[u] = { color: DB.users[u].color || '#ff3b30' }; return out; }
function getChatKey(a, b) { return [a, b].sort().join('|'); }
function formatTime(ts) { const d = new Date(ts * 1000); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); }

io.on('connection', (socket) => {
  let me = null;
  socket.on('register', ({ username, password }, cb) => {
    if (!username || username.length < 3) return cb({ ok: false, error: 'Логин ≥ 3 символов' });
    if (!password || password.length < 4) return cb({ ok: false, error: 'Пароль ≥ 4 символов' });
    if (DB.users[username]) return cb({ ok: false, error: 'Логин занят' });
    const hash = bcrypt.hashSync(password, 10);
    const color = AV_COLORS[Math.floor(Math.random() * AV_COLORS.length)];
    DB.users[username] = { password: hash, color, friends: [] };
    saveDB();
    cb({ ok: true });
  });
  socket.on('login', ({ username, password }, cb) => {
    const user = DB.users[username];
    if (!user) return cb({ ok: false, error: 'Пользователь не найден' });
    if (!bcrypt.compareSync(password, user.password)) return cb({ ok: false, error: 'Неверный пароль' });
    me = username;
    onlineUsers.set(me, socket.id);
    socket.join('user:' + me);
    cb({ ok: true, users: getUserList(), friends: user.friends || [] });
    io.emit('online', Array.from(onlineUsers.keys()));
    io.emit('users_update', getUserList());
  });
  socket.on('logout', () => { if (me) { onlineUsers.delete(me); io.emit('online', Array.from(onlineUsers.keys())); me = null; } });
  socket.on('addFriend', ({ friend }, cb) => { if (!me) return cb({ ok: false }); if (!DB.users[me].friends.includes(friend)) { DB.users[me].friends.push(friend); saveDB(); } cb({ ok: true, friends: DB.users[me].friends }); });
  socket.on('removeFriend', ({ friend }, cb) => { if (!me) return cb({ ok: false }); DB.users[me].friends = DB.users[me].friends.filter(x => x !== friend); saveDB(); cb({ ok: true, friends: DB.users[me].friends }); });
  socket.on('setColor', ({ color }, cb) => { if (!me) return cb({ ok: false }); DB.users[me].color = color; saveDB(); io.emit('users_update', getUserList()); cb({ ok: true }); });
  socket.on('getMessages', ({ with: withUser }, cb) => { if (!me) return cb([]); const arr = (DB.messages[getChatKey(me, withUser)] || []).map(m => ({ ...m, time: formatTime(m.created_at) })); cb(arr); });
  socket.on('getSupportMessages', (cb) => { if (!me) return cb([]); const arr = (DB.messages[getChatKey(me, SUPPORT_BOT)] || []).map(m => ({ ...m, time: formatTime(m.created_at) })); cb(arr); });
  socket.on('sendMessage', ({ to, text }) => {
    if (!me || !text) return;
    const now = Math.floor(Date.now() / 1000);
    if (to === SUPPORT_BOT) {
      const botKey = getChatKey(me, SUPPORT_BOT);
      if (!DB.messages[botKey]) DB.messages[botKey] = [];
      DB.messages[botKey].push({ id: 'msg_' + Date.now() + Math.random(), sender: me, receiver: SUPPORT_BOT, text, created_at: now, from_creator: 0 });
      if (!DB.messages['creator|inbox']) DB.messages['creator|inbox'] = [];
      DB.messages['creator|inbox'].push({ id: 'ticket_' + Date.now() + Math.random(), sender: me, receiver: CREATOR, text, created_at: now, is_ticket: true });
      saveDB();
      io.to('user:' + me).emit('new_message', { id: 'm' + Date.now(), sender: me, receiver: SUPPORT_BOT, text, created_at: now, from_creator: 0 });
      if (onlineUsers.has(CREATOR) && CREATOR !== me) io.to('user:' + CREATOR).emit('new_ticket', { sender: me, text });
      setTimeout(() => {
        const replyText = '✅ Отправлено создателю. Ожидайте ответа.';
        const botMsg = { id: 'bot_' + Date.now(), sender: SUPPORT_BOT, receiver: me, text: replyText, created_at: Math.floor(Date.now() / 1000), from_creator: 0 };
        DB.messages[botKey].push(botMsg); saveDB();
        io.to('user:' + me).emit('new_message', botMsg);
      }, 700);
      return;
    }
    const key = getChatKey(me, to);
    if (!DB.messages[key]) DB.messages[key] = [];
    const msg = { id: 'msg_' + Date.now() + Math.random(), sender: me, receiver: to, text, created_at: now, from_creator: 0 };
    DB.messages[key].push(msg); saveDB();
    io.to('user:' + me).emit('new_message', msg);
    if (onlineUsers.has(to)) io.to('user:' + to).emit('new_message', msg);
  });
  socket.on('disconnect', () => { if (me) { onlineUsers.delete(me); io.emit('online', Array.from(onlineUsers.keys())); } });
});

server.listen(PORT, '0.0.0.0', () => { console.log('🚀 MoggoЧат (Red Edition) запущен на порту ' + PORT); });
