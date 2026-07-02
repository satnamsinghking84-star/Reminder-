import fs from 'fs';
import path from 'path';
import https from 'https';

const downloadFile = (url: string, dest: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

async function main() {
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const icon192Url = 'https://cdn-icons-png.flaticon.com/192/3602/3602145.png';
  const icon512Url = 'https://cdn-icons-png.flaticon.com/512/3602/3602145.png';

  try {
    console.log('Downloading local 192px icon...');
    await downloadFile(icon192Url, path.join(publicDir, 'icon-192.png'));
    console.log('Successfully saved local icon-192.png');

    console.log('Downloading local 512px icon...');
    await downloadFile(icon512Url, path.join(publicDir, 'icon-512.png'));
    console.log('Successfully saved local icon-512.png');
  } catch (error) {
    console.error('Failed to download icons:', error);
  }
}

main();
