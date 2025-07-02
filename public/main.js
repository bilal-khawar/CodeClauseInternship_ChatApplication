const socket = io();

const chatForm = document.getElementById('chat-form');
const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg');
const userList = document.getElementById('user-list');

// Add fake users for now
const fakeUsers = ['Ali', 'Sara', 'Ahmed', 'Zara'];
fakeUsers.forEach(user => {
  const li = document.createElement('li');
  li.textContent = user;
  userList.appendChild(li);
});

// Send message
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = msgInput.value;
  socket.emit('chatMessage', msg);
  msgInput.value = '';
  msgInput.focus();
});

// Receive message
socket.on('message', (msg) => {
  const div = document.createElement('div');
  div.textContent = msg;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});
