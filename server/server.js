const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Parse JSON body
app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, '../public')));

// Path to users file
const USERS_FILE = path.join(__dirname, 'users.json');

// Track users and their socket IDs
const users = new Map();

// 🔁 Read users from file
function getRegisteredUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

// 💾 Write users to file
function saveRegisteredUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 📥 Register endpoint
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required.' });
  }

  const usersList = getRegisteredUsers();

  if (usersList.find(u => u.username === username)) {
    return res.status(409).json({ success: false, message: 'Username already exists.' });
  }

  usersList.push({ username, password });
  saveRegisteredUsers(usersList);

  res.json({ success: true });
});

// 🔐 Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  const usersList = getRegisteredUsers();
  const user = usersList.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }

  res.json({ success: true });
});

// 🧠 Serve users.js to frontend dynamically (only usernames)
app.get('/users.js', (req, res) => {
  const usersList = getRegisteredUsers().map(u => u.username);
  const jsContent = `const allUsers = ${JSON.stringify(usersList)};`;
  res.type('application/javascript').send(jsContent);
});

// 🔌 Socket.IO logic
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('register', (username) => {
    users.set(username, socket.id);
    console.log(`${username} registered with socket ID ${socket.id}`);
  });

  socket.on('send-message', ({ to, from, message }) => {
    const targetSocket = users.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('receive-message', { from, message });
    }
  });

  socket.on('create-group', (group) => {
    console.log(`Group created: ${group.name}`);
    group.members.forEach(member => {
      const socketId = users.get(member);
      if (socketId) {
        io.to(socketId).emit('group-created', group);
      }
    });
  });

  socket.on('send-group-message', ({ groupName, from, message, members }) => {
    members.forEach(member => {
      const socketId = users.get(member);
      if (socketId && member !== from) {
        io.to(socketId).emit('receive-message', {
          from: `${groupName} [${from}]`,
          message
        });
      }
    });
  });

  socket.on('disconnect', () => {
    for (let [username, id] of users.entries()) {
      if (id === socket.id) {
        users.delete(username);
        break;
      }
    }
    console.log('A user disconnected');
  });
});

// 🚀 Start server
server.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
