const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { tempDir, removeDir, startServer, stopServer, request } = require("./helpers");
const { fixtureBackup, PNG } = require("./fixtures");

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); });

async function app(t, { setupData } = {}) {
  const root = tempDir("e2e");
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
  if (setupData) setupData(dirs);
  const harness = { root, dirs, server: await startServer(dirs), errors: [] };
  const context = await browser.newContext();
  harness.context = context;
  harness.newPage = async () => {
    const page = await context.newPage();
    page.on("pageerror", error => harness.errors.push(error.message));
    page.on("console", entry => { if (entry.type() === "error" && !/Failed to load resource|ERR_CONNECTION_REFUSED|EventSource/.test(entry.text())) harness.errors.push(entry.text()); });
    await page.goto(harness.server.url);
    return page;
  };
  harness.restart = async () => {
    await stopServer(harness.server);
    harness.server = await startServer({ ...dirs, port: harness.server.port });
  };
  harness.state = async () => (await request(harness.server, "GET", "/api/state")).json.state;
  t.after(async () => {
    await context.close();
    await stopServer(harness.server, { hard: true });
    removeDir(root);
  });
  return harness;
}

async function ready(page) {
  await page.waitForSelector("#storageScreen", { state: "hidden" });
}

async function send(page, text) {
  await page.fill("#messageInput", text);
  await page.press("#messageInput", "Enter");
  await page.waitForSelector(`#messageList .message-text:text-is("${text}")`);
}

async function openChat(page, name) {
  await page.click(`[data-chat-open-id] .chat-row-name:text-is("${name}")`);
  await page.waitForSelector(`#activeChatName:text-is("${name}")`);
}

test("a sent message survives a reload and a server restart", async t => {
  const h = await app(t);
  const page = await h.newPage();
  await ready(page);
  await openChat(page, "NBA");
  await send(page, "durable hello");
  assert.equal(await page.inputValue("#messageInput"), "");
  await page.reload();
  await ready(page);
  await page.waitForSelector('#messageList .message-text:text-is("durable hello")');
  await h.restart();
  await page.reload();
  await ready(page);
  await page.waitForSelector('#messageList .message-text:text-is("durable hello")');
  assert.ok((await h.state()).messages.some(message => message.text === "durable hello"));
  assert.deepEqual(h.errors, []);
});

test("two tabs writing in turn both show everything and nothing disappears", async t => {
  const h = await app(t);
  const first = await h.newPage();
  const second = await h.newPage();
  await ready(first);
  await ready(second);
  await openChat(first, "NBA");
  await openChat(second, "NBA");
  for (let i = 0; i < 4; i += 1) {
    await send(i % 2 ? second : first, `turn ${i}`);
  }
  for (const page of [first, second]) {
    for (let i = 0; i < 4; i += 1) await page.waitForSelector(`#messageList .message-text:text-is("turn ${i}")`);
  }
  // Edits and deletes in one tab reach the other, and nothing else is lost.
  await first.click('#messageList article:has(.message-text:text-is("turn 0"))', { button: "right" });
  await first.click('#messageContextMenu [data-action="delete"]');
  await second.waitForSelector('#messageList .message-text:text-is("turn 0")', { state: "detached" });
  await send(second, "after delete");
  await first.waitForSelector('#messageList .message-text:text-is("after delete")');
  await first.reload();
  await ready(first);
  const texts = await first.$$eval("#messageList .message-text", nodes => nodes.map(node => node.textContent));
  assert.deepEqual(texts, ["turn 1", "turn 2", "turn 3", "after delete"]);
  const state = await h.state();
  assert.ok(state.trash.some(item => item.payload.message?.text === "turn 0"));
  assert.deepEqual(h.errors, []);
});

test("a corrupted data folder shows the error screen, never the default chats", async t => {
  const h = await app(t);
  await request(h.server, "POST", "/api/commit", { ops: [{ op: "put", store: "messages", value: { id: "m1", chatId: "nba", text: "real data", createdAt: new Date().toISOString() } }] });
  await stopServer(h.server);
  const log = path.join(h.dirs.dataDir, "log.jsonl");
  fs.writeFileSync(log, fs.readFileSync(log, "utf8").replace("real data", "real dat4"));
  h.server = await startServer({ ...h.dirs, port: h.server.port });
  const page = await h.newPage();
  await page.waitForSelector('#storageScreenTitle:text-is("Your SelfChat data could not be opened")');
  assert.match(await page.textContent("#storageScreenMessage"), /checksum/);
  assert.match(await page.textContent("#storageScreenPath"), new RegExp(h.dirs.dataDir.replace(/\\/g, "\\\\")));
  assert.equal(await page.isVisible("#storageScreen"), true);
  assert.equal(await page.locator('.chat-row-name:text-is("NBA")').count(), 0, "default chats are not shown");
  const write = await request(h.server, "POST", "/api/commit", { ops: [{ op: "put", store: "messages", value: { id: "m2", chatId: "nba", text: "x", createdAt: new Date().toISOString() } }] });
  assert.equal(write.status, 503, "nothing can be written while the folder is broken");
});

test("an unreadable data folder shows the error screen, never the default chats", async t => {
  const h = await app(t, { setupData: dirs => { fs.mkdirSync(path.dirname(dirs.dataDir), { recursive: true }); fs.writeFileSync(dirs.dataDir, "this is a file, not a folder"); } });
  const page = await h.newPage();
  await page.waitForSelector('#storageScreenTitle:text-is("Your SelfChat data could not be opened")');
  assert.equal(await page.locator('.chat-row-name:text-is("NBA")').count(), 0);
  assert.equal(fs.readFileSync(h.dirs.dataDir, "utf8"), "this is a file, not a folder", "the path was not touched");
});

test("a stopped server shows an error screen on load, and a failed send keeps the text", async t => {
  const h = await app(t);
  const page = await h.newPage();
  await ready(page);
  await openChat(page, "NBA");
  await stopServer(h.server);
  await page.fill("#messageInput", "not yet saved");
  await page.press("#messageInput", "Enter");
  await page.waitForSelector("#toast.show");
  assert.match(await page.textContent("#toast"), /not reachable|not saved/);
  assert.equal(await page.inputValue("#messageInput"), "not yet saved");
  assert.equal(await page.locator('#messageList .message-text:text-is("not yet saved")').count(), 0);
  assert.match(await page.textContent("#dataStatusWarning"), /not reachable/);
  h.server = await startServer({ ...h.dirs, port: h.server.port });
  await page.press("#messageInput", "Enter");
  await page.waitForSelector('#messageList .message-text:text-is("not yet saved")');
  assert.equal(await page.inputValue("#messageInput"), "");
  await stopServer(h.server);
  await page.reload().catch(() => {});
  await page.waitForSelector('#storageScreenTitle:text-is("SelfChat is not running")');
  assert.equal(await page.locator('.chat-row-name:text-is("NBA")').count(), 0);
  h.server = await startServer({ ...h.dirs, port: h.server.port });
});

test("first run says a new data folder was created and where", async t => {
  const h = await app(t);
  const page = await h.newPage();
  await ready(page);
  const warning = await page.textContent("#dataStatusWarning");
  assert.match(warning, /new empty data folder was created/);
  assert.ok(warning.includes(h.dirs.dataDir));
  assert.match(await page.textContent("#integrityStatus"), /passed/);
  assert.match(await page.textContent("#backupStatus"), /verified/);
  await h.restart();
  await page.reload();
  await ready(page);
  assert.doesNotMatch(await page.textContent("#dataStatusPanel"), /new empty data folder/);
});

test("feature parity: attachments, edit, star, pin, move, Trash, chats, notes and recovery persist", async t => {
  const h = await app(t);
  const page = await h.newPage();
  await ready(page);
  await openChat(page, "NBA");

  await send(page, "first");
  await send(page, "second");
  // Reply
  await page.click('#messageList article:has(.message-text:text-is("first"))', { button: "right" });
  await page.click('#messageContextMenu [data-action="reply"]');
  await send(page, "a reply");
  await page.waitForSelector('#messageList .reply-quote:has-text("first")');
  // Edit
  await page.click('#messageList article:has(.message-text:text-is("second"))', { button: "right" });
  await page.click('#messageContextMenu [data-action="edit"]');
  await page.fill(".inline-message-edit textarea", "second edited");
  await page.click('.inline-message-edit button[type="submit"]');
  await page.waitForSelector('#messageList .message-text:text-is("second edited")');
  // Star and pin
  await page.click('#messageList article:has(.message-text:text-is("first"))', { button: "right" });
  await page.click('#messageContextMenu [data-action="star"]');
  await page.click('#messageList article:has(.message-text:text-is("first"))', { button: "right" });
  await page.click('#messageContextMenu [data-action="pin"]');
  await page.waitForSelector("#pinnedMessageBanner:not([hidden])");
  // Image and file attachments
  await page.setInputFiles("#imageInput", [
    { name: "pixel.png", mimeType: "image/png", buffer: PNG },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("file body") }
  ]);
  await page.fill("#messageInput", "two files");
  await page.press("#messageInput", "Enter");
  await page.waitForSelector("#messageList img.message-media:not([hidden])");
  await page.waitForSelector('#messageList .file-card:has-text("notes.txt")');
  // New chat, move a message into it
  await page.click("#newChatButton");
  await page.fill("#chatNameInput", "Projects");
  await page.click('#chatForm button[type="submit"]');
  await page.waitForSelector('#activeChatName:text-is("Projects")');
  await openChat(page, "NBA");
  await page.click('#messageList article:has(.message-text:text-is("second edited"))', { button: "right" });
  await page.click('#messageContextMenu [data-action="move"]');
  await page.selectOption("#moveDestinationSelect", { label: "Projects" });
  await page.click("#confirmMoveButton");
  await page.waitForSelector('#messageList .message-text:text-is("second edited")', { state: "detached" });
  // Chat notes
  await page.click("#chatNotesButton");
  await page.fill("#chatNotesInput", "remember this");
  await page.click('#chatNotesForm button[type="submit"]');
  // Delete a message, then undo
  await page.click('#messageList article:has(.message-text:text-is("a reply"))', { button: "right" });
  await page.click('#messageContextMenu [data-action="delete"]');
  await page.click('#toast button:text-is("Undo")');
  await page.waitForSelector('#messageList .message-text:text-is("a reply")');

  await page.reload();
  await ready(page);
  await openChat(page, "NBA");
  await page.waitForSelector('#messageList .message-text:text-is("a reply")');
  await page.waitForSelector("#messageList img.message-media:not([hidden])");
  await page.waitForSelector("#pinnedMessageBanner:not([hidden])");
  assert.equal(await page.textContent("#starredMessageCount"), "1");
  let state = await h.state();
  const projects = state.chats.find(chat => chat.name === "Projects");
  assert.equal(state.messages.find(message => message.text === "second edited").chatId, projects.id);
  assert.equal(state.chats.find(chat => chat.id === "nba").note, "remember this");
  assert.equal(state.messages.find(message => message.text === "a reply").replyToId, state.messages.find(message => message.text === "first").id);
  assert.equal(Object.keys(state.attachments).length, 2);

  // Delete the Projects chat to Trash, then restore it from Trash
  await openChat(page, "Projects");
  await page.click("#chatMenuButton");
  await page.click("#deleteChatButton");
  await page.waitForSelector('[data-chat-open-id] .chat-row-name:text-is("Projects")', { state: "detached" });
  await page.click("#settingsButton");
  await page.click("#openTrashButton");
  await page.click('.trash-row:has-text("Projects") [data-trash-action="restore"]');
  await page.click("#closeTrashButton");
  await page.waitForSelector('[data-chat-open-id] .chat-row-name:text-is("Projects")');
  state = await h.state();
  assert.ok(state.messages.some(message => message.text === "second edited"));
  assert.equal(state.trash.length, 0);

  // Recovery: restore the point before today's first change, then return via "before restore"
  await page.click("#settingsButton");
  await page.waitForSelector("#recoveryList .recovery-row");
  const rows = await page.locator("#recoveryList .recovery-row").count();
  assert.ok(rows >= 1);
  await page.locator("#recoveryList [data-restore-snapshot]").last().click();
  await page.click("#confirmRecoveryButton");
  await page.waitForSelector('#toast:has-text("Point-in-time recovery restored")');
  state = await h.state();
  assert.equal(state.messages.length, 0);
  assert.equal(await page.isVisible("#settingsDialog"), true, "Settings stays open after a restore, as before");
  await page.waitForSelector('#recoveryList .recovery-row:has-text("before restore")');
  await page.locator('#recoveryList .recovery-row:has-text("before restore") [data-restore-snapshot]').first().click();
  await page.click("#confirmRecoveryButton");
  await page.waitForSelector('#toast:has-text("Point-in-time recovery restored")');
  state = await h.state();
  assert.equal(state.messages.length, 5);
  assert.deepEqual(h.errors, []);
});

test("feature parity: titles, tags, duplicate, chat pin, stickers, avatar, visibility, drafts, search, split view, purge", async t => {
  const h = await app(t);
  const page = await h.newPage();
  await ready(page);
  await openChat(page, "Soccer");
  await send(page, "goal");
  const menu = async action => {
    await page.click('#messageList article:has(.message-text:text-is("goal"))', { button: "right" });
    await page.click(`#messageContextMenu [data-action="${action}"]`);
  };
  await menu("title");
  await page.fill("#messageTitleInput", "Match");
  await page.click('#messageTitleForm button[type="submit"]');
  await menu("tags");
  await page.fill("#messageTagsInput", "sport, weekend");
  await page.click('#messageTagsForm button[type="submit"]');
  await menu("duplicate");
  await page.waitForFunction(() => document.querySelectorAll('#messageList .message-text').length === 2);
  // Chat pin
  await page.click('[data-chat-id="soccer"]', { button: "right" });
  await page.click('#chatContextMenu [data-chat-action="pin"]');
  // Custom sticker, then send it
  await page.click("#stickerButton");
  await page.click("#createStickerButton");
  await page.setInputFiles("#stickerImageInput", { name: "me.png", mimeType: "image/png", buffer: PNG });
  await page.click("#saveStickerButton");
  await page.waitForSelector('#toast:has-text("Sticker created")');
  await page.click("#stickerButton");
  await page.locator(".sticker-image-choice").first().click();
  await page.waitForSelector("#messageList .sticker-message");
  // Chat avatar image
  await page.click("#chatMenuButton");
  await page.click("#changeChatAvatarButton");
  await page.setInputFiles("#avatarImageInput", { name: "face.png", mimeType: "image/png", buffer: PNG });
  await page.waitForSelector("#avatarEditorPreview img");
  await page.click('#avatarForm button[type="submit"]');
  await page.waitForSelector('#toast:has-text("Chat icon updated")');
  // Hide a chat from All Messages
  await page.click("[data-global-view-open]");
  await page.click('[data-hide-global-chat-id="soccer"]');
  // Draft
  await openChat(page, "NBA");
  await page.fill("#messageInput", "half-written thought");
  await page.waitForTimeout(700);

  await page.reload();
  await ready(page);
  await openChat(page, "NBA");
  assert.equal(await page.inputValue("#messageInput"), "half-written thought");
  let state = await h.state();
  const soccer = state.chats.find(chat => chat.id === "soccer");
  assert.ok(soccer.pinnedAt);
  assert.ok(state.attachments[soccer.avatarImageId]);
  assert.deepEqual(state.meta.globalHiddenChatIds, ["soccer"]);
  assert.equal(state.customStickers.length, 1);
  const goals = state.messages.filter(message => message.text === "goal");
  assert.equal(goals.length, 2);
  assert.equal(goals.find(message => message.title).title, "Match");
  assert.deepEqual(goals.find(message => message.tags).tags, ["sport", "weekend"]);
  assert.ok(state.messages.some(message => message.type === "sticker"));

  // Search across chats and open the result
  await page.fill("#chatFilterInput", "goal");
  await page.locator("[data-search-message-id]").first().click();
  await page.waitForSelector('#activeChatName:text-is("Soccer")');
  // Split view shows a second chat
  await page.click("#splitViewButton");
  await page.waitForSelector("#splitConversation:not([hidden])");
  await page.click("#closeSplitViewButton");

  // Delete one message permanently from Trash, then empty Trash
  await page.click('#messageList article:has(.message-text:text-is("goal")) >> nth=0', { button: "right" });
  await page.click('#messageContextMenu [data-action="delete"]');
  await page.locator('#messageList article.sticker-message').click({ button: "right" });
  await page.click('#messageContextMenu [data-action="delete"]');
  await page.click("#settingsButton");
  await page.click("#openTrashButton");
  await page.locator('[data-trash-action="purge"]').first().click();
  await page.click("#confirmActionButton");
  await page.waitForSelector('#toast:has-text("Deleted from Trash")');
  await page.click("#emptyTrashButton");
  await page.click("#confirmActionButton");
  await page.waitForSelector('#toast:has-text("Trash emptied")');
  state = await h.state();
  assert.equal(state.trash.length, 0);
  assert.equal(state.messages.filter(message => message.text === "goal").length, 1);
  assert.deepEqual(h.errors, []);
});

test("import and export from Settings use the server and show matching counts", async t => {
  const h = await app(t);
  const page = await h.newPage();
  await ready(page);
  const file = path.join(h.root, "backup.json");
  fs.writeFileSync(file, JSON.stringify(fixtureBackup()));
  await page.click("#settingsButton");
  await page.setInputFiles("#importInput", file);
  await page.waitForSelector('#confirmationMessage:has-text("Merge 3 chats, 6 messages, and 5 attachments")');
  await page.click("#confirmActionButton");
  await page.waitForSelector('#toast:has-text("all 6 messages")');
  await page.waitForSelector('[data-chat-open-id] .chat-row-name:text-is("AI tools")');
  await openChat(page, "AI tools");
  await page.waitForSelector("#messageList img.message-media:not([hidden])");
  const exported = await request(h.server, "GET", "/api/export");
  assert.equal(exported.status, 200);
  assert.match(exported.headers["content-disposition"], /attachment; filename="selfchat-backup-/);
  assert.equal(exported.json.messages.length, 6);
  assert.equal(exported.json.attachments.length, 5);
  await page.click("#settingsButton");
  const downloadPromise = page.waitForEvent("download");
  await page.click("#exportButton");
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^selfchat-backup-.*\.json$/);
  assert.deepEqual(h.errors, []);
});

test("the backup folder can be changed in Settings and a verified backup is written there", async t => {
  const h = await app(t);
  const page = await h.newPage();
  await ready(page);
  const target = path.join(h.root, "chosen backups");
  await page.click("#settingsButton");
  await page.click("#backupFolderButton");
  await page.fill("#backupFolderInput", target);
  await page.click('#backupFolderForm button[type="submit"]');
  await page.waitForSelector('#toast:has-text("backup written and verified")');
  assert.equal(fs.readdirSync(target).filter(name => name.startsWith("SelfChat backup ")).length, 1);
  assert.equal((await h.state()).meta.backupDir, target);
});
