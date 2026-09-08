const os = require("os");
const { detectSerial } = require("./vision");
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const { createDriveClient } = require('./google-drive');
const sharp = require('sharp');





const PORT = process.env.PORT || 3000;
const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
const INDEX_FILE = path.join(__dirname, 'kits.json');
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 20, fileSize: 10 * 1024 * 1024 } });

if (!PARENT_FOLDER_ID) {
  throw new Error('Set GOOGLE_DRIVE_PARENT_FOLDER_ID before starting the server.');
}

const drive = createDriveClient();
const app = express();
app.use(cors());


async function readIndex() {
  try { return JSON.parse(await fs.readFile(INDEX_FILE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function writeIndex(records) {
  await fs.writeFile(INDEX_FILE, JSON.stringify(records, null, 2));
}

function folderName(client) {
  return client.trim();
}

  async function uploadImages(files, parentId) {
  let serial = "UNKNOWN";

  // Detect serial from first image
  if (files.length > 0) {
    const tempPath = path.join(os.tmpdir(), "serial.jpg");

    await fs.writeFile(tempPath, files[0].buffer);

    serial = await detectSerial(tempPath);

    await fs.unlink(tempPath);

    console.log("Detected:", serial);
  }

  return Promise.all(
    files.map(async (file, index) => {
      console.log("Detected serial:", serial);
console.log("Uploading file as:", `${serial}.jpg`);
      const fileName = `${serial}.jpg`;

const saved = await drive.files.create({
  requestBody: {
    name: fileName,
    parents: [parentId],
  },
  media: {
    mimeType: file.mimetype,
    body: require("stream").Readable.from(file.buffer),
  },
  fields: "id,name,webViewLink",
});

return {
  ...saved.data,
  name: fileName,
  detectedSerial: serial,
};
    })
  );
}

app.get('/kits', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim().toLowerCase();
    const records = await readIndex();
    const results = !query ? records : records.filter((record) =>
      [record.kitName, record.client, record.serialNumber].some((value) => value.toLowerCase().includes(query)));
    res.json(results);
  } catch (error) { next(error); }
});

app.post('/kits', upload.array('images', 20), async (req, res, next) => {
  try {
    const { kitName, client, serialNumber } = req.body;

if (!kitName || !client) {
  return res.status(400).json({
    error: "kitName and client are required.",
  });
}


    // Upload all images
    // Create client folder in Google Drive
const folder = await drive.files.create({
  requestBody: {
    name: folderName(client),
    mimeType: "application/vnd.google-apps.folder",
    parents: [PARENT_FOLDER_ID],
  },
  fields: "id, webViewLink",
});
    const images = await uploadImages(req.files, folder.data.id);
    const detectedSerial =
  images.length > 0 ? images[0].detectedSerial : "UNKNOWN";

    // Save metadata
    const record = {
      id: folder.data.id,
      kitName: kitName.trim(),
      client: client.trim(),
      serialNumber: detectedSerial,
      images,
      driveFolderId: folder.data.id,
      driveFolderUrl:
        folder.data.webViewLink ||
        `https://drive.google.com/drive/folders/${folder.data.id}`,
      createdAt: new Date().toISOString(),
    };

    const records = await readIndex();

    await writeIndex([record, ...records]);

    res.status(201).json(record);

  } catch (error) {
    next(error);
  }
});

app.patch('/kits/:id', upload.array('images', 20), async (req, res, next) => {
  try {
    const { kitName, client, serialNumber } = req.body;
    if (![kitName, client, serialNumber].every((value) => value && value.trim())) {
      return res.status(400).json({ error: 'kitName, client, and serialNumber are required.' });
    }
    const records = await readIndex();
    const index = records.findIndex((item) => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Kit not found.' });
    const previous = records[index];
    await drive.files.update({ fileId: previous.driveFolderId, requestBody: { name: folderName(serialNumber, kitName) } });
    const newImages = await uploadImages(req.files, previous.driveFolderId);
    const record = { ...previous, kitName: kitName.trim(), client: client.trim(), serialNumber: serialNumber.trim(), images: [...previous.images, ...newImages], updatedAt: new Date().toISOString() };
    records[index] = record;
    await writeIndex(records);
    res.json(record);
  } catch (error) { next(error); }
});

app.get('/files/:id/content', async (req, res, next) => {
  try {
    const file = await drive.files.get({ fileId: req.params.id, alt: 'media' }, { responseType: 'stream' });
    res.setHeader('Content-Type', file.headers['content-type'] || 'image/jpeg');
    file.data.pipe(res);
  } catch (error) { next(error); }
});

app.delete('/kits/:kitId/images/:imageId', async (req, res, next) => {
  try {
    const records = await readIndex();
    const index = records.findIndex((item) => item.id === req.params.kitId);
    if (index === -1) return res.status(404).json({ error: 'Kit not found.' });
    const image = records[index].images.find((item) => item.id === req.params.imageId);
    if (!image) return res.status(404).json({ error: 'Image not found.' });
    await drive.files.delete({ fileId: image.id });
    records[index] = { ...records[index], images: records[index].images.filter((item) => item.id !== image.id), updatedAt: new Date().toISOString() };
    await writeIndex(records);
    res.json(records[index]);
  } catch (error) { next(error); }
});

app.delete('/kits/:id', async (req, res, next) => {
  try {
    const records = await readIndex();
    const record = records.find((item) => item.id === req.params.id);
    if (!record) return res.status(404).json({ error: 'Kit not found.' });
    await drive.files.delete({ fileId: record.driveFolderId });
    await writeIndex(records.filter((item) => item.id !== record.id));
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error("ERROR:", error);

  res.status(500).json({
    error: error.message,
    stack: error.stack,
  });
});

app.listen(PORT, () => console.log(`Cretile API listening on port ${PORT}`));

