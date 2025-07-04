// 🔐 Redirect if not logged in
if (!sessionStorage.getItem('username')) {
  window.location.href = 'login.html';
}

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const loggedInUser = sessionStorage.getItem('username');
  document.getElementById('chat-username').textContent = loggedInUser;

  const userList = document.getElementById('user-list');
  const chatBox = document.getElementById('chat-box');
  const chatForm = document.getElementById('chat-form');
  const msgInput = document.getElementById('msg');
  const chatHeader = document.getElementById('chat-header');

  const createGroupBtn = document.getElementById('create-group-btn');
  const groupModal = document.getElementById('group-modal');
  const groupNameInput = document.getElementById('group-name');
  const friendCheckboxes = document.getElementById('friend-checkboxes');
  const submitGroupBtn = document.getElementById('submit-group-btn');
  const cancelGroupBtn = document.getElementById('cancel-group-btn');

  const chatHistory = {};
  let currentUser = null;

  const friends = [];
  const recommendations = [];
  const groups = [];

  loadFriendsFromLocalStorage();
  loadGroupsFromLocalStorage(); // ✅ Added here
  loadChatHistoryFromLocalStorage();
  populateSidebar();

  socket.on("connect", () => {
    socket.emit('register', loggedInUser);
  });

  // 📥 Receive private or group message
  socket.on('receive-message', ({ from, message }) => {
    let chatKey = from;
    let displayMsg = `${from}: ${message}`;

    const groupMatch = from.match(/^(.+?) \[(.+?)\]$/);
    if (groupMatch) {
      const groupName = groupMatch[1];
      const senderName = groupMatch[2];
      chatKey = `__group__${groupName}`;
      displayMsg = `${senderName}: ${message}`;
    }

    if (!chatHistory[chatKey]) chatHistory[chatKey] = [];
    chatHistory[chatKey].push(displayMsg);
    saveChatHistory(chatKey);

    if (currentUser === chatKey) {
      addMessageToDOM(displayMsg);
    } else {
      showToast(`New message from ${from}`);
    }
  });

  // 🆕 New group received
  socket.on('group-created', (group) => {
    if (!groups.find(g => g.name === group.name)) {
      groups.push(group);
      saveGroupsToLocalStorage(); // ✅ save it
      populateSidebar();
      showToast(`You've been added to group "${group.name}"`, "#007bff");
    }
  });

  // 💬 Send message
  chatForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!currentUser) return showToast("Please select a user or group.");
    const msg = msgInput.value.trim();
    if (!msg) return;

    const fullMsg = `You: ${msg}`;
    if (!chatHistory[currentUser]) chatHistory[currentUser] = [];
    chatHistory[currentUser].push(fullMsg);
    saveChatHistory(currentUser);
    addMessageToDOM(fullMsg, true);

    msgInput.value = '';
    msgInput.focus();

    if (currentUser.startsWith('__group__')) {
      const groupName = currentUser.replace('__group__', '');
      const group = groups.find(g => g.name === groupName);
      if (!group) return;
      socket.emit('send-group-message', {
        groupName,
        from: loggedInUser,
        message: msg,
        members: group.members
      });
    } else {
      if (!friends.includes(currentUser)) {
        return showToast("You can only message users you've added as friends.");
      }
      socket.emit('send-message', {
        from: loggedInUser,
        to: currentUser,
        message: msg
      });
    }
  });

  // 💾 Save chat history
  function saveChatHistory(key) {
    const saved = JSON.parse(localStorage.getItem(`chatHistory_${loggedInUser}`)) || {};
    saved[key] = chatHistory[key];
    localStorage.setItem(`chatHistory_${loggedInUser}`, JSON.stringify(saved));
  }

  function loadChatHistoryFromLocalStorage() {
    const stored = JSON.parse(localStorage.getItem(`chatHistory_${loggedInUser}`)) || {};
    for (let key in stored) {
      chatHistory[key] = stored[key];
    }
  }

  function loadChatHistory(key) {
    chatBox.innerHTML = '';
    const messages = chatHistory[key] || [];
    messages.forEach(msg => {
      const isOwn = msg.startsWith("You:");
      addMessageToDOM(msg, isOwn);
    });
  }

  function selectUser(username, element) {
    currentUser = username;
    chatHeader.textContent = `Chat with ${username}`;
    document.querySelectorAll('#user-list li').forEach(li => li.classList.remove('active'));
    element.classList.add('active');
    loadChatHistory(username);
  }

  function selectGroup(group) {
    currentUser = `__group__${group.name}`;
    chatHeader.textContent = `Group: ${group.name}`;
    document.querySelectorAll('#user-list li').forEach(li => li.classList.remove('active'));
    loadChatHistory(currentUser);
  }

  function addMessageToDOM(msg, isOwnMessage = false) {
    const div = document.createElement('div');
    div.classList.add('chat-message');
    if (isOwnMessage || msg.startsWith("You:")) {
      div.classList.add('own-message');
    }
    div.textContent = msg;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function addFriend(username) {
    if (!friends.includes(username)) {
      friends.push(username);
      const index = recommendations.indexOf(username);
      if (index !== -1) recommendations.splice(index, 1);
      saveFriendsToLocalStorage();
      populateSidebar();
      showToast(`${username} added to friends!`, "#4caf50");
    }
  }

  function saveFriendsToLocalStorage() {
    localStorage.setItem(`friends_${loggedInUser}`, JSON.stringify(friends));
  }

  function saveGroupsToLocalStorage() {
    localStorage.setItem(`groups_${loggedInUser}`, JSON.stringify(groups));
  }

  function loadFriendsFromLocalStorage() {
    const stored = localStorage.getItem(`friends_${loggedInUser}`);
    if (stored) {
      const storedFriends = JSON.parse(stored);
      allUsers.forEach(user => {
        if (user === loggedInUser) return;
        if (storedFriends.includes(user)) {
          friends.push(user);
        } else {
          recommendations.push(user);
        }
      });
    } else {
      allUsers.forEach((user, idx) => {
        if (user === loggedInUser) return;
        if (idx < 2) friends.push(user);
        else recommendations.push(user);
      });
    }
  }

  function loadGroupsFromLocalStorage() {
    const stored = localStorage.getItem(`groups_${loggedInUser}`);
    if (stored) {
      const savedGroups = JSON.parse(stored);
      groups.push(...savedGroups);
    }
  }

  function populateSidebar() {
    userList.innerHTML = '';

    if (groups.length > 0) {
      const groupHeader = document.createElement('h4');
      groupHeader.textContent = 'Groups';
      userList.appendChild(groupHeader);

      groups.forEach(group => {
        const li = document.createElement('li');
        li.textContent = group.name;
        li.addEventListener('click', () => selectGroup(group));
        userList.appendChild(li);
      });
    }

    const friendsHeader = document.createElement('h4');
    friendsHeader.textContent = 'Friends';
    userList.appendChild(friendsHeader);

    friends.forEach(username => {
      const li = createUserListItem(username);
      userList.appendChild(li);
    });

    const recHeader = document.createElement('h4');
    recHeader.textContent = 'Recommendations';
    userList.appendChild(recHeader);

    recommendations.forEach(username => {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = username;

      const addBtn = document.createElement('button');
      addBtn.textContent = '+ Add';
      addBtn.classList.add('add-btn');
      addBtn.addEventListener('click', () => addFriend(username));

      li.appendChild(nameSpan);
      li.appendChild(addBtn);
      userList.appendChild(li);
    });
  }

  function createUserListItem(username) {
    const li = document.createElement('li');
    li.textContent = username;
    li.addEventListener('click', () => selectUser(username, li));
    return li;
  }

  // 👥 Group creation modal logic
  createGroupBtn.addEventListener('click', () => {
    if (friends.length === 0) return showToast("Add some friends first.");
    groupModal.classList.remove('hidden');
    groupNameInput.value = '';
    populateFriendCheckboxes();
  });

  function populateFriendCheckboxes() {
    friendCheckboxes.innerHTML = '';
    friends.forEach(friend => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = friend;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + friend));
      friendCheckboxes.appendChild(label);
    });
  }

  submitGroupBtn.addEventListener('click', () => {
    const groupName = groupNameInput.value.trim();
    const selectedMembers = Array.from(friendCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);

    if (!groupName) return showToast("Enter a group name.");
    if (selectedMembers.length < 2) return showToast("Select at least 2 friends.");

    const group = {
      name: groupName,
      members: [...new Set([...selectedMembers, loggedInUser])]
    };

    groups.push(group);
    saveGroupsToLocalStorage(); // ✅ save on creation
    populateSidebar();
    socket.emit('create-group', group);
    groupModal.classList.add('hidden');
  });

  cancelGroupBtn.addEventListener('click', () => {
    groupModal.classList.add('hidden');
  });

  function showToast(message, color = "#ff4d4d") {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "bottom",
      position: "left",
      backgroundColor: color,
      stopOnFocus: true
    }).showToast();
  }

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    sessionStorage.clear();
    localStorage.removeItem(`chatHistory_${loggedInUser}`);
    localStorage.removeItem(`groups_${loggedInUser}`);
    localStorage.removeItem(`friends_${loggedInUser}`);
    window.location.href = 'login.html';
  });
});
