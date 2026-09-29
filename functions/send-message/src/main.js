import { Account, Client, Permission, Role, TablesDB } from "node-appwrite";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

function errorCode(error) {
  return error && typeof error === "object" && "code" in error && typeof error.code === "number"
    ? error.code
    : 0;
}

function sameMessage(row, data) {
  return row.senderId === data.senderId
    && row.recipientId === data.recipientId
    && row.conversationId === data.conversationId
    && row.content === data.content;
}

const handler = async ({ req, res, error }) => {
  if (req.method !== "POST") {
    return res.json({ message: "Method not allowed." }, 405);
  }

  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const userJwt = req.headers["x-appwrite-user-jwt"];
  const ephemeralKey = req.headers["x-appwrite-key"];
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const profilesTableId = process.env.APPWRITE_PROFILES_TABLE_ID;
  const messagesTableId = process.env.APPWRITE_MESSAGES_TABLE_ID;

  if (!endpoint || !projectId || !userJwt || !ephemeralKey || !databaseId || !profilesTableId || !messagesTableId) {
    return res.json({ message: "Message delivery is not configured." }, 500);
  }

  let payload;
  try {
    payload = req.bodyJson;
  } catch {
    return res.json({ message: "Invalid request body." }, 400);
  }

  const { messageId, recipientId, conversationId, content } = payload ?? {};
  if (
    typeof messageId !== "string" || !ID_PATTERN.test(messageId)
    || typeof recipientId !== "string" || !ID_PATTERN.test(recipientId)
    || typeof conversationId !== "string"
    || typeof content !== "string" || content.trim().length < 1 || content.length > 10000
  ) {
    return res.json({ message: "Invalid message." }, 400);
  }

  try {
    const userClient = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(userJwt);
    const sender = await new Account(userClient).get();
    if (sender.$id === recipientId) {
      return res.json({ message: "Choose another user to message." }, 400);
    }

    const expectedConversationId = [sender.$id, recipientId].sort().join("_");
    if (conversationId !== expectedConversationId) {
      return res.json({ message: "Conversation does not match the participants." }, 400);
    }

    const serverClient = new Client().setEndpoint(endpoint).setProject(projectId).setKey(ephemeralKey);
    const tablesDb = new TablesDB(serverClient);
    const recipientProfile = await tablesDb.getRow({
      databaseId,
      tableId: profilesTableId,
      rowId: recipientId,
    });
    if (recipientProfile.userId !== recipientId) {
      return res.json({ message: "Recipient profile was not found." }, 404);
    }

    const data = {
      conversationId: expectedConversationId,
      senderId: sender.$id,
      senderName: sender.name,
      recipientId,
      content,
    };

    const findExisting = async () => {
      try {
        return await tablesDb.getRow({ databaseId, tableId: messagesTableId, rowId: messageId });
      } catch (readError) {
        if (errorCode(readError) === 404) return null;
        throw readError;
      }
    };

    const existing = await findExisting();
    if (existing) {
      if (sameMessage(existing, data)) {
        return res.json({ messageId, duplicate: true });
      }
      return res.json({ message: "Message ID is already in use." }, 409);
    }

    try {
      await tablesDb.createRow({
        databaseId,
        tableId: messagesTableId,
        rowId: messageId,
        data,
        permissions: [
          Permission.read(Role.user(sender.$id)),
          Permission.read(Role.user(recipientId)),
        ],
      });
    } catch (createError) {
      if (errorCode(createError) !== 409) throw createError;
      const racedRow = await findExisting();
      if (racedRow && sameMessage(racedRow, data)) {
        return res.json({ messageId, duplicate: true });
      }
      return res.json({ message: "Message ID is already in use." }, 409);
    }

    return res.json({ messageId, duplicate: false }, 201);
  } catch (caught) {
    const status = errorCode(caught) === 401 || errorCode(caught) === 403 ? 401 : 500;
    error(`Message creation failed with status ${status}.`);
    return res.json({ message: status === 401 ? "Sign in again to send messages." : "Message could not be saved." }, status);
  }
};

export default handler;