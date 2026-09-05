/**
 * Google Drive integration boundary.
 *
 * Never put a Google client secret in this app. The safe production design is:
 * app -> your small API -> Google Drive API. The API owns the OAuth refresh token
 * or service account and returns the folder/file IDs to the app.
 */

const API_URL = "http://192.168.0.10:3000";

export function driveImageUrl(fileId) {
  return `${API_URL}/files/${fileId}/content`;
}

export async function uploadKit({ kitName, client, serialNumber, images }) {
  if (!API_URL) throw new Error('Set EXPO_PUBLIC_API_URL before enabling Google Drive uploads.');

  const payload = new FormData();
  payload.append('kitName', kitName);
  payload.append('client', client);
  payload.append('serialNumber', serialNumber);
  appendImages(payload, images);

  const response = await fetch(`${API_URL}/kits`, { method: 'POST', body: payload });
  if (!response.ok) throw new Error('The images could not be uploaded to Google Drive.');
  return response.json();
}

export async function updateKit(id, { kitName, client, serialNumber, images }) {
  if (!API_URL) throw new Error('Set EXPO_PUBLIC_API_URL before enabling Google Drive uploads.');
  const payload = new FormData();
  payload.append('kitName', kitName);
  payload.append('client', client);
  payload.append('serialNumber', serialNumber);
  appendImages(payload, images);
  const response = await fetch(`${API_URL}/kits/${id}`, { method: 'PATCH', body: payload });
  if (!response.ok) throw new Error('The kit could not be updated in Google Drive.');
  return response.json();
}

function appendImages(payload, images) {
  images.forEach((image, index) => {
    const asset = typeof image === 'string' ? { uri: image } : image;
    payload.append('images', {
      uri: asset.uri,
      name: asset.fileName || `photo-${index + 1}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
  });
}

export async function searchKits(query) {
  if (!API_URL) return [];
  const response = await fetch(`${API_URL}/kits?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Could not search kit records.');
  return response.json();
}

export async function deleteKit(id) {
  if (!API_URL) throw new Error('Google Drive is not connected.');
  const response = await fetch(`${API_URL}/kits/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('The kit could not be deleted from Google Drive.');
}

export async function deleteKitImage(kitId, imageId) {
  if (!API_URL) throw new Error('Google Drive is not connected.');
  const response = await fetch(`${API_URL}/kits/${kitId}/images/${imageId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('The image could not be deleted from Google Drive.');
  return response.json();
}
