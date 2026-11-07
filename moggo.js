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

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const SUPPORT_BOT = '__support__';
const CREATOR = 'mogg';
const AV_COLORS = ['#3390ec','#4a7bc8','#7ba7e8','#5b8def','#6a5acd','#1e90ff','#3a6bc4','#4682b4'];
const onlineUsers = new Map();

function getUserList() {
  const out = {};
  for (const u in DB.users) out[u] = { color: DB.users[u].color || '#3390ec' };
  return out;
}
function getChatKey(a, b) { return [a, b].sort().join('|'); }
function formatTime(ts) {
  const d = new Date(ts * 1000);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

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

  socket.on('logout', () => {
    if (me) { onlineUsers.delete(me); io.emit('online', Array.from(onlineUsers.keys())); me = null; }
  });

  socket.on('addFriend', ({ friend }, cb) => {
    if (!me) return cb({ ok: false });
    if (!DB.users[me].friends.includes(friend)) { DB.users[me].friends.push(friend); saveDB(); }
    cb({ ok: true, friends: DB.users[me].friends });
  });

  socket.on('removeFriend', ({ friend }, cb) => {
    if (!me) return cb({ ok: false });
    DB.users[me].friends = DB.users[me].friends.filter(x => x !== friend);
    saveDB();
    cb({ ok: true, friends: DB.users[me].friends });
  });

  socket.on('setColor', ({ color }, cb) => {
    if (!me) return cb({ ok: false });
    DB.users[me].color = color; saveDB();
    io.emit('users_update', getUserList());
    cb({ ok: true });
  });

  socket.on('getMessages', ({ with: withUser }, cb) => {
    if (!me) return cb([]);
    const arr = (DB.messages[getChatKey(me, withUser)] || []).map(m => ({ ...m, time: formatTime(m.created_at) }));
    cb(arr);
  });

  socket.on('getSupportMessages', (cb) => {
    if (!me) return cb([]);
    const arr = (DB.messages[getChatKey(me, SUPPORT_BOT)] || []).map(m => ({ ...m, time: formatTime(m.created_at) }));
    cb(arr);
  });

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

  socket.on('disconnect', () => {
    if (me) { onlineUsers.delete(me); io.emit('online', Array.from(onlineUsers.keys())); }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 MoggoЧат сервер запущен на порту ' + PORT);
});
