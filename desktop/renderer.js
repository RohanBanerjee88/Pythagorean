let selectedFilePaths = [];

const uploadArea = document.getElementById('uploadArea');
const selectedFilesDiv = document.getElementById('selectedFiles');
const filesList = document.getElementById('filesList');
const uploadBtn = document.getElementById('uploadBtn');
const status = document.getElementById('status');
const uploadSection = document.getElementById('uploadSection');
const resultSection = document.getElementById('resultSection');
const uploadProgress = document.getElementById('uploadProgress');
const collectionNotice = document.getElementById('collectionNotice');

// Select files
uploadArea.addEventListener('click', selectFiles);
document.getElementById('addMoreBtn').addEventListener('click', selectFiles);

async function selectFiles() {
  const filePaths = await window.electronAPI.selectFile();
  if (filePaths && filePaths.length > 0) {
    // Add new files (avoid duplicates)
    filePaths.forEach(path => {
      if (!selectedFilePaths.includes(path)) {
        selectedFilePaths.push(path);
      }
    });
    renderFilesList();
  }
}

function renderFilesList() {
  // Update count
  document.getElementById('fileCount').textContent = selectedFilePaths.length;
  
  if (selectedFilePaths.length === 0) {
    uploadArea.style.display = 'block';
    selectedFilesDiv.style.display = 'none';
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Upload Files';
    return;
  }
  
  // Show files list
  uploadArea.style.display = 'none';
  selectedFilesDiv.style.display = 'block';
  uploadBtn.disabled = false;
  
  // Update button text
  const fileWord = selectedFilePaths.length === 1 ? 'File' : 'Files';
  uploadBtn.textContent = `Upload ${selectedFilePaths.length} ${fileWord}`;
  
  // Show collection notice if multiple files
  collectionNotice.style.display = selectedFilePaths.length > 1 ? 'block' : 'none';
  
  // Render file items
  filesList.innerHTML = '';
  selectedFilePaths.forEach((path, index) => {
    const fileName = path.split(/[\\/]/).pop();
    
    const fileItem = document.createElement('div');
    fileItem.className = 'file-list-item';
    fileItem.innerHTML = `
      <div class="file-list-info">
        <span class="file-list-icon">📄</span>
        <div class="file-list-details">
          <div class="file-list-name">${fileName}</div>
          <div class="file-list-size">Ready to upload</div>
        </div>
      </div>
      <button class="btn-remove" data-index="${index}">×</button>
    `;
    
    filesList.appendChild(fileItem);
  });
  
  // Add remove button listeners
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      removeFile(index);
    });
  });
  
  // Clear status
  status.style.display = 'none';
}

function removeFile(index) {
  selectedFilePaths.splice(index, 1);
  renderFilesList();
}

// Upload button
uploadBtn.addEventListener('click', async () => {
  if (selectedFilePaths.length === 0) return;
  
  uploadBtn.disabled = true;
  uploadProgress.style.display = 'block';
  uploadProgress.innerHTML = '';
  status.style.display = 'none';
  
  try {
    let collectionId = null;
    const uploadedDocs = [];
    
    // Create collection if multiple files
    if (selectedFilePaths.length > 1) {
      addProgressItem('Creating collection...', 'progress');
      const response = await fetch('http://localhost:8000/collection/create', {
        method: 'POST'
      });
      const data = await response.json();
      collectionId = data.collection_id;
      addProgressItem(`✓ Collection created: ${collectionId}`, 'success');
    }
    
    // Upload each file
    for (let i = 0; i < selectedFilePaths.length; i++) {
      const filePath = selectedFilePaths[i];
      const fileName = filePath.split(/[\\/]/).pop();
      
      addProgressItem(`Uploading ${fileName}...`, 'progress');
      
      const result = await window.electronAPI.uploadFile(filePath, collectionId);
      
      if (result.success) {
        uploadedDocs.push(result.data);
        addProgressItem(`✓ ${fileName} processed`, 'success');
      } else {
        addProgressItem(`✗ ${fileName} failed: ${result.error}`, 'error');
      }
    }
    
    // Show results
    if (uploadedDocs.length > 0) {
      showResults({
        link_id: collectionId || uploadedDocs[0].link_id,
        is_collection: selectedFilePaths.length > 1,
        documents: uploadedDocs
      });
    } else {
      showStatus('error', 'All uploads failed');
      uploadBtn.disabled = false;
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    showStatus('error', 'Error: ' + error.message);
    uploadBtn.disabled = false;
  }
});

function addProgressItem(message, type = 'progress') {
  const item = document.createElement('div');
  item.className = `progress-item ${type}`;
  item.textContent = message;
  uploadProgress.appendChild(item);
  uploadProgress.scrollTop = uploadProgress.scrollHeight;
}

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
  uploadProgress.style.display = 'none';
  
  // Show result section
  resultSection.style.display = 'block';
  
  // Update title
  const titleText = data.is_collection 
    ? `Collection Processed Successfully!`
    : `File Processed Successfully!`;
  document.getElementById('resultTitle').textContent = titleText;
  
  // Fill in the data
  document.getElementById('linkId').textContent = data.link_id;
  document.getElementById('shareUrl').textContent = `http://localhost:3000/chat/${data.link_id}`;
  
  // Update documents label
  const docsLabel = data.is_collection 
    ? `📊 Documents in Collection (${data.documents.length})`
    : `📊 Document Details`;
  document.getElementById('documentsLabel').textContent = docsLabel;
  
  // Render documents list
  const documentsList = document.getElementById('documentsList');
  documentsList.innerHTML = '';
  
  data.documents.forEach(doc => {
    const docItem = document.createElement('div');
    docItem.className = 'doc-result-item';
    docItem.innerHTML = `
      <span class="doc-result-icon">📄</span>
      <div class="doc-result-info">
        <div class="doc-result-name">${doc.filename}</div>
        <div class="doc-result-meta">${doc.file_type} • ${doc.chunks_created} chunks</div>
      </div>
    `;
    documentsList.appendChild(docItem);
  });
  
  // Store for later use
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
  showStatus('success', message);
  setTimeout(() => {
    status.style.display = 'none';
  }, 2000);
}

// Open chat button
document.getElementById('openChatBtn').addEventListener('click', async () => {
  if (window.currentLinkId) {
    await window.electronAPI.openChat(window.currentLinkId);
  }
});

// Upload another
document.getElementById('uploadAnotherBtn').addEventListener('click', () => {
  // Reset everything
  selectedFilePaths = [];
  window.currentLinkId = null;
  
  uploadSection.style.display = 'block';
  resultSection.style.display = 'none';
  uploadProgress.style.display = 'none';
  renderFilesList();
});