import { Readable } from "node:stream";
import { google } from "googleapis";

function getDriveClient() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

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
  await drive.files.delete({ fileId: folderId });
}

export async function getDownloadStream(fileId: string) {
  const drive = getDriveClient();
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  return response.data;
}

export async function getFileMetadata(fileId: string) {
  const drive = getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size"
  });
  return response.data;
}
