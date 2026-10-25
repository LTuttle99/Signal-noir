(function () {
  "use strict";
  const studio = window.DataHubStudio;
  if (!studio) return;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const esc = studio.escapeHtml;
  const userId = sessionStorage.getItem("datahub_chat_user_id") || `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  sessionStorage.setItem("datahub_chat_user_id", userId);
  const state = { open: false, activeChannel: "general", replyTo: null, unread: {}, localPresence: new Map(), livePresence: [], client: null, realtime: null, live: false, connectedProjectId: null, typing: new Map(), typingTimer: null };
  const extensionListeners = [];
  const bus = "BroadcastChannel" in window ? new BroadcastChannel("datahub_studio_collaboration") : null;

  function project() { return studio.state.project; }
  function displayName() { return $("#chat-display-name").value.trim() || localStorage.getItem("datahub_chat_name") || "Project teammate"; }
  function initials(name) { return String(name || "T").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
  function currentMessages() { return (project()?.chatMessages || []).filter(message => message.channel === state.activeChannel); }
  function colorFor(value) { let hash = 0; for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0; return `hsl(${Math.abs(hash) % 360} 72% 43%)`; }
  function roomConfig() { return project()?.collaborationConfig || null; }
  function setConnectionLabel() { const config = roomConfig(); $("#chat-connection-label").textContent = state.live && config ? `Live · ${config.room}` : "Local project room"; $("#chat-settings-btn").textContent = state.live ? "Room settings" : "Connect live"; }
  function persistSoon() { clearTimeout(persistSoon.timer); persistSoon.timer = setTimeout(() => studio.saveProject(true).catch(() => {}), 250); }
  function normalizeMessage(input) {
    if (!input || typeof input !== "object") return null; const channelIds = new Set((project()?.chatChannels || []).map(item => item.id)), id = String(input.id || "").slice(0, 160), text = String(input.text || "").slice(0, 10000), author = String(input.author || "Teammate").slice(0, 80); if (!id || !text) return null;
    const reference = input.reference && typeof input.reference === "object" ? { type: String(input.reference.type || "Reference").slice(0, 40), id: String(input.reference.id || "").slice(0, 160), label: String(input.reference.label || "").slice(0, 500) } : null;
    return { id, projectId: project()?.id, channel: channelIds.has(input.channel) ? input.channel : "general", authorId: String(input.authorId || "remote").slice(0, 160), author, text, reference, replyTo: input.replyTo ? String(input.replyTo).slice(0, 160) : null, pinned: !!input.pinned, at: Number.isFinite(Number(input.at)) ? Number(input.at) : Date.now() };
  }
  function addMessage(message, remote = false) {
    message = normalizeMessage(message); if (!message) return;
    if (!project() || project().chatMessages.some(item => item.id === message.id)) return;
    project().chatMessages.push(message); project().chatMessages = project().chatMessages.slice(-1000); studio.markDirty(); persistSoon();
    if (!state.open || message.channel !== state.activeChannel) { state.unread[message.channel] = (state.unread[message.channel] || 0) + 1; updateUnread(); }
    renderChannels(); renderMessages();
    if (remote && !state.open) studio.toast(`${message.author} sent a project message.`);
  }
  function mutateMessage(id, changes) { const message = project()?.chatMessages.find(item => item.id === id); if (!message) return; Object.assign(message, changes); studio.markDirty(); persistSoon(); renderMessages(); }
  function sendTransport(event, payload) {
    bus?.postMessage({ type: event, projectId: project()?.id, senderId: userId, payload });
    if (state.live && state.realtime) state.realtime.send({ type: "broadcast", event, payload }).catch(() => {});
  }
  function receiveEvent(event, payload, senderId, remote = true) {
    if (senderId === userId) return;
    if (event === "message" && payload?.message) addMessage(payload.message, remote);
    if (event === "delete" && payload?.id) { project().chatMessages = project().chatMessages.filter(item => item.id !== payload.id); studio.markDirty(); persistSoon(); renderMessages(); }
    if (event === "pin" && payload?.id) mutateMessage(payload.id, { pinned: !!payload.pinned });
    if (event === "typing" && payload?.name) { if (payload.typing) state.typing.set(senderId, { name: payload.name, at: Date.now() }); else state.typing.delete(senderId); renderTyping(); renderPresence(); }
    if (event === "presence" && payload?.name) { state.localPresence.set(senderId, { id: senderId, name: payload.name, at: Date.now(), typing: false }); renderPresence(); }
    if (event === "presence-leave") { state.localPresence.delete(senderId); state.typing.delete(senderId); renderPresence(); renderTyping(); }
    if (event.startsWith("ops:")) extensionListeners.forEach(listener => listener(event.slice(4), payload, senderId));
  }

  function openChat() { state.open = true; $("#chat-drawer").classList.add("open"); $("#chat-drawer").setAttribute("aria-hidden", "false"); $("#chat-scrim").hidden = false; state.unread[state.activeChannel] = 0; updateUnread(); renderAll(); setTimeout(() => $("#chat-message").focus(), 200); }
  function closeChat() { state.open = false; $("#chat-drawer").classList.remove("open"); $("#chat-drawer").setAttribute("aria-hidden", "true"); $("#chat-scrim").hidden = true; }
  function updateUnread() { const total = Object.values(state.unread).reduce((sum, count) => sum + count, 0), badge = $("#chat-unread"); badge.hidden = !total; badge.textContent = total > 99 ? "99+" : String(total); }
  function renderChannels() {
    const channels = project()?.chatChannels || []; $("#chat-channels").innerHTML = channels.map(channel => `<button class="chat-channel ${channel.id === state.activeChannel ? "active" : ""}" data-chat-channel="${esc(channel.id)}"># ${esc(channel.name)}${state.unread[channel.id] ? `<b>${state.unread[channel.id]}</b>` : ""}</button>`).join("");
    $$('[data-chat-channel]').forEach(button => button.onclick = () => { state.activeChannel = button.dataset.chatChannel; state.unread[state.activeChannel] = 0; state.replyTo = null; renderReply(); updateUnread(); renderChannels(); renderMessages(); });
  }
  function messageBody(text) {
    const safe = esc(text), name = displayName(); if (!name) return safe; const variants = [name, name.split(/\s+/)[0]].filter(Boolean).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); if (!variants.length) return safe; return safe.replace(new RegExp(`@(${variants.join("|")})\\b`, "gi"), "<mark>@$1</mark>");
  }
  function referenceLabel(reference) { return reference ? `${reference.type}: ${reference.label}` : ""; }
  function renderMessages() {
    const target = $("#chat-messages"), query = $("#chat-search").value.trim().toLowerCase(); let messages = currentMessages(); if (query) messages = messages.filter(message => `${message.author} ${message.text} ${referenceLabel(message.reference)}`.toLowerCase().includes(query));
    if (!messages.length) { target.innerHTML = `<div class="chat-empty">${query ? "No matching messages." : `No messages in #${esc(project()?.chatChannels.find(item => item.id === state.activeChannel)?.name || state.activeChannel)} yet.<br>Start the conversation or attach project context below.`}</div>`; return; }
    target.innerHTML = messages.map(message => {
      const reply = message.replyTo ? project().chatMessages.find(item => item.id === message.replyTo) : null, own = message.authorId === userId;
      return `<article class="chat-message ${message.pinned ? "pinned" : ""}" data-message-id="${esc(message.id)}"><div class="chat-avatar" style="background:${colorFor(message.authorId)}1f;color:${colorFor(message.authorId)}">${esc(initials(message.author))}</div><div><div class="chat-message-head"><strong>${esc(message.author)}</strong><span>${new Date(message.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><div class="chat-message-actions"><button data-reply-message="${esc(message.id)}">Reply</button><button data-chat-action="task" data-chat-action-id="${esc(message.id)}">Task</button><button data-chat-action="issue" data-chat-action-id="${esc(message.id)}">Issue</button><button data-chat-action="decision" data-chat-action-id="${esc(message.id)}">Decision</button><button data-pin-message="${esc(message.id)}">${message.pinned ? "Unpin" : "Pin"}</button>${own ? `<button data-delete-message="${esc(message.id)}">Delete</button>` : ""}</div></div>${reply ? `<div class="chat-reply-card"><strong>Replying to ${esc(reply.author)}</strong>${esc(reply.text.slice(0, 120))}</div>` : ""}<div class="chat-message-body">${messageBody(message.text)}</div>${message.reference ? `<div class="chat-reference-card"><strong>${esc(message.reference.type)}</strong>${esc(message.reference.label)}</div>` : ""}</div></article>`;
    }).join("");
    $$('[data-reply-message]').forEach(button => button.onclick = () => { state.replyTo = button.dataset.replyMessage; renderReply(); $("#chat-message").focus(); });
    $$('[data-pin-message]').forEach(button => button.onclick = () => { const message = project().chatMessages.find(item => item.id === button.dataset.pinMessage); if (!message) return; message.pinned = !message.pinned; studio.markDirty(); persistSoon(); sendTransport("pin", { id: message.id, pinned: message.pinned }); renderMessages(); });
    $$('[data-delete-message]').forEach(button => button.onclick = () => { if (!confirm("Delete this message?")) return; project().chatMessages = project().chatMessages.filter(item => item.id !== button.dataset.deleteMessage); studio.markDirty(); persistSoon(); sendTransport("delete", { id: button.dataset.deleteMessage }); renderMessages(); });
    $$('[data-chat-action]').forEach(button => button.onclick = () => { const message = project().chatMessages.find(item => item.id === button.dataset.chatActionId); if (!message || !window.DataHubOperations) return studio.toast("Operations is still loading."); window.DataHubOperations.fromChat(button.dataset.chatAction, message); });
    target.scrollTop = target.scrollHeight;
  }
  function renderReply() { const preview = $("#chat-reply-preview"), message = project()?.chatMessages.find(item => item.id === state.replyTo); if (!message) { preview.hidden = true; preview.innerHTML = ""; return; } preview.hidden = false; preview.innerHTML = `Replying to <strong>${esc(message.author)}</strong>: ${esc(message.text.slice(0, 110))}<button id="cancel-chat-reply" aria-label="Cancel reply">×</button>`; $("#cancel-chat-reply").onclick = () => { state.replyTo = null; renderReply(); }; }
  function renderReferences() {
    const p = project(), options = [{ group: "Datasets", items: p?.datasets?.map(item => ({ type: "Dataset", id: item.id, label: `${item.name} · ${item.rows?.length || 0} rows` })) || [] }, { group: "Metrics", items: p?.metrics?.map(item => ({ type: "Metric", id: item.id, label: `${item.name} · ${item.formula}` })) || [] }, { group: "Glossary", items: p?.glossary?.map(item => ({ type: "Definition", id: item.id, label: `${item.term} · ${item.definition}` })) || [] }, { group: "Stories", items: p?.stories?.map(item => ({ type: "Story", id: item.id, label: item.title })) || [] }];
    $("#chat-reference").innerHTML = '<option value="">Attach project context…</option>' + options.filter(group => group.items.length).map(group => `<optgroup label="${group.group}">${group.items.map(item => `<option value="${esc(`${item.type}|${item.id}|${item.label}`)}">${esc(item.label)}</option>`).join("")}</optgroup>`).join("");
  }
  function renderPresence() {
    const now = Date.now(); for (const [id, user] of state.localPresence) if (now - user.at > 30000) state.localPresence.delete(id); const people = state.live ? state.livePresence : [{ id: userId, name: displayName() }, ...state.localPresence.values()]; const unique = [...new Map(people.map(person => [person.id, person])).values()].slice(0, 8); $("#chat-presence-list").innerHTML = unique.map(person => `<span class="presence-avatar ${state.typing.has(person.id) ? "typing" : ""}" style="background:${colorFor(person.id)}" title="${esc(person.name)}${state.typing.has(person.id) ? " is typing" : ""}">${esc(initials(person.name))}</span>`).join("");
  }
  function renderTyping() { const now = Date.now(); for (const [id, item] of state.typing) if (now - item.at > 5000) state.typing.delete(id); const names = [...state.typing.values()].map(item => item.name); $("#chat-typing").textContent = names.length ? `${names.slice(0, 2).join(" and ")} ${names.length === 1 ? "is" : "are"} typing…` : ""; }
  function renderAll() { if (!project()) return; renderChannels(); renderMessages(); renderReply(); renderReferences(); renderPresence(); renderTyping(); setConnectionLabel(); const config = roomConfig(); $("#chat-display-name").value = localStorage.getItem("datahub_chat_name") || ""; if (config) { $("#chat-supabase-url").value = config.url || ""; $("#chat-room-name").value = config.room || ""; } }

  function sendMessage() {
    const text = $("#chat-message").value.trim(); if (!text) return; const rawReference = $("#chat-reference").value, parts = rawReference ? rawReference.split("|") : [], reference = parts.length >= 3 ? { type: parts[0], id: parts[1], label: parts.slice(2).join("|") } : null;
    const message = { id: `${userId}_${Date.now().toString(36)}`, projectId: project().id, channel: state.activeChannel, authorId: userId, author: displayName(), text, reference, replyTo: state.replyTo, pinned: false, at: Date.now() }; addMessage(message); sendTransport("message", { message }); $("#chat-message").value = ""; $("#chat-reference").value = ""; state.replyTo = null; renderReply(); stopTyping();
  }
  function announcePresence() { const payload = { name: displayName(), at: Date.now() }; state.localPresence.set(userId, { id: userId, ...payload }); bus?.postMessage({ type: "presence", projectId: project()?.id, senderId: userId, payload }); renderPresence(); }
  function startTyping() { sendTransport("typing", { name: displayName(), typing: true }); clearTimeout(state.typingTimer); state.typingTimer = setTimeout(stopTyping, 1500); }
  function stopTyping() { clearTimeout(state.typingTimer); sendTransport("typing", { name: displayName(), typing: false }); }

  async function connectLive() {
    const url = $("#chat-supabase-url").value.trim(), key = $("#chat-supabase-key").value.trim() || localStorage.getItem("datahub_chat_supabase_key") || "", room = $("#chat-room-name").value.trim(), name = $("#chat-display-name").value.trim(); if (!name || !url || !key || !room) return studio.toast("Add your name, Supabase URL, publishable key, and room name."); if (!window.supabase?.createClient) return studio.toast("Supabase Realtime could not load.");
    await disconnectLive(false); localStorage.setItem("datahub_chat_name", name); localStorage.setItem("datahub_chat_supabase_key", key); project().collaborationConfig = { url, room }; studio.markDirty(); persistSoon();
    try {
      state.client = window.supabase.createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      state.realtime = state.client.channel(`datahub-chat:${room}`, { config: { broadcast: { self: false }, presence: { key: userId } } })
        .on("broadcast", { event: "message" }, ({ payload }) => receiveEvent("message", payload, payload?.message?.authorId))
        .on("broadcast", { event: "delete" }, ({ payload }) => receiveEvent("delete", payload, payload?.senderId || "remote"))
        .on("broadcast", { event: "pin" }, ({ payload }) => receiveEvent("pin", payload, payload?.senderId || "remote"))
        .on("broadcast", { event: "typing" }, ({ payload }) => receiveEvent("typing", payload, payload?.senderId || payload?.name || "remote"))
        .on("broadcast", { event: "ops:record" }, ({ payload }) => receiveEvent("ops:record", payload, payload?.senderId || "remote"))
        .on("presence", { event: "sync" }, () => { const presence = state.realtime.presenceState(); state.livePresence = Object.values(presence).flat().map(item => ({ id: item.userId, name: item.name || "Teammate" })); renderPresence(); });
      state.realtime.subscribe(async status => { if (status === "SUBSCRIBED") { state.live = true; state.connectedProjectId = project().id; await state.realtime.track({ userId, name, onlineAt: new Date().toISOString() }); setConnectionLabel(); renderPresence(); studio.toast(`Connected to live room “${room}”.`); } if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) { state.live = false; state.connectedProjectId = null; setConnectionLabel(); studio.toast("The live room could not connect. Local chat still works."); } });
    } catch (error) { state.live = false; setConnectionLabel(); studio.toast("The live room could not connect. Check the project URL and key."); }
  }
  async function disconnectLive(clearConfig = true) { if (state.client && state.realtime) { try { await state.client.removeChannel(state.realtime); } catch (_) {} } state.client = null; state.realtime = null; state.live = false; state.connectedProjectId = null; state.livePresence = []; if (clearConfig && project()) { project().collaborationConfig = null; studio.markDirty(); persistSoon(); } setConnectionLabel(); renderPresence(); if (clearConfig) studio.toast("Using local project chat."); }
  function copyInvite() {
    const config = roomConfig(), text = state.live && config ? `Join my Signal Noir project chat.\nRoom: ${config.room}\nSupabase project: ${config.url}\nAsk me separately for the publishable key, then open Studio → Chat → Connect live.` : `Open this Signal Noir project and choose Chat. We are currently using local mode, which syncs only between browser tabs.`;
    navigator.clipboard?.writeText(text).then(() => studio.toast("Chat invitation details copied.")).catch(() => studio.toast("Could not copy the invitation."));
  }

  window.DataHubCollaboration = {
    send(type, payload) { sendTransport(`ops:${type}`, payload); },
    subscribe(listener) { if (typeof listener === "function") extensionListeners.push(listener); },
    draftMessage(text) { openChat(); $("#chat-message").value = String(text || ""); $("#chat-message").focus(); },
    isLive() { return state.live; }
  };

  function bind() {
    $("#open-chat-btn").onclick = openChat; $("#close-chat-btn").onclick = closeChat; $("#chat-scrim").onclick = closeChat; $("#chat-settings-btn").onclick = () => { $("#chat-settings").hidden = false; }; $("#chat-settings-close").onclick = () => { $("#chat-settings").hidden = true; };
    $("#chat-form").onsubmit = event => { event.preventDefault(); sendMessage(); }; $("#chat-message").oninput = startTyping; $("#chat-search").oninput = renderMessages; $("#connect-chat-btn").onclick = connectLive; $("#disconnect-chat-btn").onclick = () => disconnectLive(true); $("#chat-invite-btn").onclick = copyInvite;
    $("#chat-display-name").onchange = event => { localStorage.setItem("datahub_chat_name", event.target.value.trim()); announcePresence(); };
    bus?.addEventListener("message", event => { const packet = event.data; if (!packet || packet.projectId !== project()?.id) return; receiveEvent(packet.type, packet.payload, packet.senderId); });
    window.addEventListener("datahub:project-render", async () => { if (state.connectedProjectId && state.connectedProjectId !== project()?.id) await disconnectLive(false); renderAll(); announcePresence(); const config = roomConfig(), key = localStorage.getItem("datahub_chat_supabase_key"); if (config && key && !state.live && !state.realtime) { $("#chat-supabase-key").value = key; connectLive(); } });
    setInterval(() => { announcePresence(); renderTyping(); }, 10000); window.addEventListener("beforeunload", () => { bus?.postMessage({ type: "presence-leave", projectId: project()?.id, senderId: userId }); stopTyping(); }); renderAll(); announcePresence();
  }
  bind();
})();
