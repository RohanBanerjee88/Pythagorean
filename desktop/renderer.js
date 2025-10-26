let selectedFilePath = null;

const uploadArea = document.getElementById('uploadArea');
const selectedFileDiv = document.getElementById('selectedFile');
const uploadBtn = document.getElementById('uploadBtn');
const status = document.getElementById('status');
const uploadSection = document.getElementById('uploadSection');
const resultSection = document.getElementById('resultSection');

// File selection
uploadArea.addEventListener('click', selectFile);
document.getElementById('changeFileBtn').addEventListener('click', selectFile);

async function selectFile() {
  const filePath = await window.electronAPI.selectFile();
  if (filePath) {
    selectedFilePath = filePath;
    showSelectedFile(filePath);
  }
}

function showSelectedFile(filePath) {
  console.log('Showing selected file:', filePath);
  const fileName = filePath.split(/[\\/]/).pop();
  
  // Hide upload area, show selected file
  uploadArea.style.display = 'none';
  selectedFileDiv.style.display = 'block';
  
  // Show file info
  document.getElementById('fileName').textContent = fileName;
  document.getElementById('fileSize').textContent = 'Ready to upload';
  
  // Enable upload button
  uploadBtn.disabled = false;
  
  // Clear any previous status
  status.style.display = 'none';
  status.className = 'status';
}

// Upload button
uploadBtn.addEventListener('click', async () => {
  if (!selectedFilePath) return;
  
  showStatus('loading', 'Uploading and processing file...');
  uploadBtn.disabled = true;
  
  try {
    const result = await window.electronAPI.uploadFile(selectedFilePath);
    
    if (result.success) {
      showStatus('success', '✓ File processed successfully!');
      
      // Show results after a brief delay
      setTimeout(() => {
        showResults(result.data);
      }, 500);
      
    } else {
      showStatus('error', `Error: ${result.error}`);
      uploadBtn.disabled = false;
    }
    
  } catch (error) {
    showStatus('error', `Error: ${error.message}`);
    uploadBtn.disabled = false;
  }
});

function showStatus(type, message) {
  status.className = `status ${type}`;
  
  if (type === 'loading') {
    status.innerHTML = `<span class="spinner"></span>${message}`;
  } else {
    status.textContent = message;
  }
  
  status.style.display = 'block';
}

function showResults(data) {
  // Hide upload section
  uploadSection.style.display = 'none';
  
  // Show result section
  resultSection.style.display = 'block';
  
  // Fill in the data
  document.getElementById('linkId').textContent = data.link_id;
  document.getElementById('shareUrl').textContent = data.shareable_url;
  document.getElementById('resultFilename').textContent = data.filename;
  document.getElementById('resultType').textContent = data.file_type;
  document.getElementById('resultChunks').textContent = data.chunks_created;
  
  // Store link_id for later use
  window.currentLinkId = data.link_id;
}

// Copy buttons
document.getElementById('copyLinkBtn').addEventListener('click', () => {
  const linkId = document.getElementById('linkId').textContent;
  copyToClipboard(linkId, 'Link ID copied!');
});

document.getElementById('copyUrlBtn').addEventListener('click', () => {
  const url = document.getElementById('shareUrl').textContent;
  copyToClipboard(url, 'URL copied!');
});

async function copyToClipboard(text, message) {
  await window.electronAPI.copyToClipboard(text);
  
  // Show temporary success message
  const originalStatus = status.innerHTML;
  showStatus('success', message);
  setTimeout(() => {
    status.innerHTML = originalStatus;
  }, 2000);
}

// Open chat button
document.getElementById('openChatBtn').addEventListener('click', async () => {
  if (window.currentLinkId) {
    await window.electronAPI.openChat(window.currentLinkId);
  }
});

// Upload another file
document.getElementById('uploadAnotherBtn').addEventListener('click', () => {
  // Reset everything
  selectedFilePath = null;
  window.currentLinkId = null;
  
  uploadSection.style.display = 'block';
  resultSection.style.display = 'none';
  uploadArea.style.display = 'block';
  selectedFileDiv.style.display = 'none';
  uploadBtn.disabled = true;
  status.style.display = 'none';
});

// Drag and drop support
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('active');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('active');
});

uploadArea.addEventListener('drop', async (e) => {
  e.preventDefault();
  uploadArea.classList.remove('active');
  
  const file = e.dataTransfer.files[0];
  if (file) {
    selectedFilePath = file.path;
    showSelectedFile(file.path);
  }
});