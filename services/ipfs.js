// Layanan upload IPFS via Pinata.
//
// Aktif hanya jika PINATA_JWT di-set di .env. Tanpa itu, fungsi mengembalikan
// null dan pemanggil harus fallback ke penyimpanan lokal (uploads/ & metadata/).
//
// Env yang didukung:
//   PINATA_JWT      — JWT Pinata (wajib untuk mengaktifkan IPFS)
//   PINATA_GATEWAY  — gateway publik, default https://gateway.pinata.cloud

const PINATA_API = 'https://api.pinata.cloud';
const GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';

const isConfigured = () => Boolean(process.env.PINATA_JWT);

function headers() {
  return {
    Authorization: `Bearer ${process.env.PINATA_JWT}`,
  };
}

/**
 * Upload file (Buffer) ke IPFS. Return { cid, url } atau null jika tidak dikonfigurasi.
 */
async function pinFile(buffer, filename) {
  if (!isConfigured()) return null;

  const form = new FormData();
  form.append('file', new Blob([buffer]), filename);
  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: headers(),
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Pinata pinFile failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { cid: data.IpfsHash, url: `${GATEWAY}/ipfs/${data.IpfsHash}` };
}

/**
 * Upload objek JSON metadata ke IPFS. Return { cid, url } atau null jika tidak dikonfigurasi.
 */
async function pinJSON(metadata) {
  if (!isConfigured()) return null;

  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinataContent: metadata }),
  });
  if (!res.ok) {
    throw new Error(`Pinata pinJSON failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { cid: data.IpfsHash, url: `${GATEWAY}/ipfs/${data.IpfsHash}` };
}

module.exports = { isConfigured, pinFile, pinJSON };
