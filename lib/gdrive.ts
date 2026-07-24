import { Readable } from "node:stream";
import { google } from "googleapis";

function normalizePrivateKey(privateKey: string) {
  return privateKey
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
}

function getServiceAccountCredentials() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const base64Json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;

  if (base64Json) {
    const credentials = JSON.parse(Buffer.from(base64Json, "base64").toString("utf8"));
    return {
      clientEmail: credentials.client_email as string | undefined,
      privateKey: credentials.private_key ? normalizePrivateKey(credentials.private_key) : undefined
    };
  }

  if (json) {
    const credentials = JSON.parse(json);
    return {
      clientEmail: credentials.client_email as string | undefined,
      privateKey: credentials.private_key ? normalizePrivateKey(credentials.private_key) : undefined
    };
  }

  return {
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY
      ? normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY)
      : undefined
  };
}

function getDriveClient() {
  const { clientEmail, privateKey } = getServiceAccountCredentials();

  if (!privateKey || !clientEmail) {
    throw new Error("Missing Google service account credentials.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"]
  });

  return google.drive({ version: "v3", auth });
}

export async function createEventFolder(folderName: string) {
  const drive = getDriveClient();
  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ? [process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID] : undefined
    },
    fields: "id"
  });

  if (!response.data.id) throw new Error("Google Drive did not return a folder id.");
  return response.data.id;
}

export async function uploadFileToFolder(
  folderId: string,
  fileStream: Readable,
  fileName: string,
  mimeType: string
) {
  const drive = getDriveClient();
  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: [folderId]
    },
    media: {
      mimeType,
      body: fileStream
    },
    fields: "id,name,mimeType,size"
  });

  if (!response.data.id) throw new Error(`Google Drive upload failed for ${fileName}.`);
  return response.data;
}

export async function deleteFolderAndContents(folderId: string) {
  const drive = getDriveClient();
  await drive.files.delete({ fileId: folderId, supportsAllDrives: true });
}

export async function getDownloadStream(fileId: string) {
  const drive = getDriveClient();
  const response = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  return response.data;
}

export async function getFileMetadata(fileId: string) {
  const drive = getDriveClient();
  const response = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: "id,name,mimeType,size"
  });
  return response.data;
}
