// Set this after cdk deploy. Keep only the API URL here; never place AWS keys in a browser.
const API_URL = 'REPLACE_WITH_API_URL';
const statusEl = document.querySelector('#status'), progress = document.querySelector('#progress');
document.querySelector('#upload').onclick = async () => {
  const file = document.querySelector('#file').files[0], token = document.querySelector('#token').value.trim();
  if (!file || !token) return statusEl.textContent = 'Choose a file and provide an access token.';
  statusEl.textContent = 'Requesting secure upload URL…';
  const response = await fetch(`${API_URL}uploads`, { method:'POST', headers:{'content-type':'application/json', authorization: token}, body:JSON.stringify({fileName:file.name, contentType:file.type, size:file.size}) });
  if (!response.ok) return statusEl.textContent = `Upload rejected: ${await response.text()}`;
  const {url,key} = await response.json(); progress.hidden = false;
  await new Promise((resolve,reject) => { const x = new XMLHttpRequest(); x.upload.onprogress = e => { if(e.lengthComputable) progress.value = e.loaded/e.total*100; }; x.onload = () => x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`S3 ${x.status}`)); x.onerror=()=>reject(new Error('Network error')); x.open('PUT',url); x.setRequestHeader('Content-Type',file.type); x.send(file); });
  progress.hidden = true; statusEl.textContent = `Uploaded successfully. Object key:\n${key}`;
};
