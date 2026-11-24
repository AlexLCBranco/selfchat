"use strict";
// A backup in the current SelfChat export format (schemaVersion 4), with attachments as data URLs.

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

function dataUrl(type, buffer) {
  return `data:${type};base64,${buffer.toString("base64")}`;
}

function fixtureBackup() {
  const t = minutes => new Date(Date.UTC(2026, 10, 20, 12, minutes)).toISOString();
  const trashedMessage = { id: "msg-trashed", chatId: "nba", text: "deleted but kept in Trash", createdAt: t(9), editedAt: null };
  const trashedChatMessages = [
    { id: "msg-old-chat-1", chatId: "chat-old", text: "from a deleted chat", createdAt: t(10), editedAt: null },
    { id: "msg-old-chat-2", chatId: "chat-old", type: "image", imageId: "att-trash-image", imageName: "old.png", imageType: "image/png", caption: "", createdAt: t(11), editedAt: null }
  ];
  return {
    schemaVersion: 4,
    exportedAt: t(30),
    activeChatId: "nba",
    chats: [
      { id: "unsorted", name: "Unsorted", emoji: "📥", createdAt: "2026-01-01T00:00:03.000Z", permanent: true },
      { id: "nba", name: "NBA", emoji: "🏀", createdAt: "2026-01-01T00:00:02.000Z", pinnedAt: t(1), note: "Season notes" },
      { id: "chat-ai", name: "AI tools", emoji: "🤖", avatarImageId: "att-avatar", createdAt: t(0), orderIndex: 0 }
    ],
    messages: [
      { id: "msg-1", chatId: "nba", text: "Hello from the old app", createdAt: t(2), editedAt: null, starredAt: t(3), tags: ["work"] },
      { id: "msg-2", chatId: "nba", text: "edited", createdAt: t(3), editedAt: t(4), editHistory: [{ text: "original", editedAt: t(3) }], pinnedAt: t(5), title: "Important" },
      { id: "msg-3", chatId: "nba", text: "a reply", createdAt: t(5), editedAt: null, replyToId: "msg-1", replyPreview: "Hello from the old app" },
      { id: "msg-img", chatId: "chat-ai", type: "image", imageId: "att-image", imageName: "pixel.png", imageType: "image/png", caption: "an image", createdAt: t(6), editedAt: null },
      { id: "msg-file", chatId: "chat-ai", type: "file", attachmentId: "att-file", fileName: "notes.txt", fileType: "text/plain", fileSize: 11, caption: "", createdAt: t(7), editedAt: null },
      { id: "msg-sticker", chatId: "unsorted", type: "sticker", stickerId: "custom-1", createdAt: t(8), editedAt: null, movedAt: t(8) }
    ],
    customStickers: [{ id: "custom-1", imageId: "att-sticker", label: "My sticker" }],
    trash: [
      { id: "message:msg-trashed", entityType: "message", entityId: "msg-trashed", deletedAt: t(12), payload: { message: trashedMessage, originalChatId: "nba" } },
      { id: "chat:chat-old", entityType: "chat", entityId: "chat-old", deletedAt: t(13), payload: { chat: { id: "chat-old", name: "Old", emoji: "💬", createdAt: t(0) }, messages: trashedChatMessages, draft: "" } }
    ],
    deletedChatIds: ["chat-old"],
    deletedMessageIds: ["msg-trashed", "msg-old-chat-1", "msg-old-chat-2"],
    drafts: { nba: "unsent draft" },
    attachments: [
      { id: "att-image", name: "pixel.png", type: "image/png", data: dataUrl("image/png", PNG) },
      { id: "att-file", name: "notes.txt", type: "text/plain", data: dataUrl("text/plain", Buffer.from("hello notes")) },
      { id: "att-avatar", name: "avatar.webp", type: "image/png", data: dataUrl("image/png", PNG) },
      { id: "att-sticker", name: "sticker.png", type: "image/png", data: dataUrl("image/png", PNG) },
      { id: "att-trash-image", name: "old.png", type: "image/png", data: dataUrl("image/png", Buffer.concat([PNG, Buffer.from([1])])) }
    ]
  };
}

module.exports = { fixtureBackup, PNG };
