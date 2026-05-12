const API_URL = '/api'; // Vite proxy → localhost:5000 (works on LAN and ngrok)

document.addEventListener('DOMContentLoaded', () => {
  const deptData = JSON.parse(sessionStorage.getItem('grievance_dept') || 'null');
  if (!deptData) return; // Will be redirected by HTML script

  const listEl = document.getElementById('grievances-list');
  const btnRefresh = document.getElementById('btn-refresh-reports');
  const completionForm = document.getElementById('completion-form');

  // Load grievances on start
  loadGrievances();

  btnRefresh.addEventListener('click', loadGrievances);

  async function loadGrievances() {
    listEl.innerHTML = `
      <div class="shimmer" style="height:140px;"></div>
      <div class="shimmer" style="height:140px;opacity:.7;"></div>
    `;

    try {
      const res = await fetch(`${API_URL}/complaints/department/${deptData.id}`);
      if (!res.ok) throw new Error('Failed to fetch grievances');
      const data = await res.json();

      renderGrievances(data);
    } catch (err) {
      listEl.innerHTML = `<p style="color:#f87171; text-align:center;">Error loading grievances: ${err.message}</p>`;
    }
  }

  function renderGrievances(complaints) {
    if (!complaints || complaints.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding: 2rem; color: rgba(255,255,255,0.4);">No grievances assigned yet.</div>`;
      return;
    }

    listEl.innerHTML = '';
    complaints.forEach(c => {
      // Formatting date
      const dateStr = new Date(c.created_at).toLocaleString('en-IN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      // Status styling
      let statusClass = 'status-pending';
      let statusText = 'Pending';
      if (c.status === 'in_process') { statusClass = 'status-in_process'; statusText = 'In Process'; }
      if (c.status === 'completed') { statusClass = 'status-completed'; statusText = 'Completed'; }

      // Card HTML
      const card = document.createElement('div');
      card.style.cssText = `
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 1rem;
        padding: 1.25rem;
        display: flex;
        flex-wrap: wrap;
        gap: 1.25rem;
        align-items: flex-start;
      `;

      card.innerHTML = `
        <!-- Image -->
        <div style="width: 120px; height: 120px; border-radius: 0.75rem; overflow: hidden; flex-shrink: 0; background: #1e293b; border: 1px solid rgba(255,255,255,0.1);">
          <img src="${c.image_url}" alt="Issue" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>

        <!-- Details -->
        <div style="flex: 1; min-width: 250px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span class="status-badge ${statusClass}" style="margin-bottom: 0.5rem;">${statusText}</span>
              <h3 style="font-size: 1.1rem; color: #f1f5f9; margin: 0;">${c.category}</h3>
            </div>
            <span style="font-size: 0.8rem; color: rgba(255,255,255,0.4);">${dateStr}</span>
          </div>
          
          <p style="font-size: 0.9rem; color: rgba(255,255,255,0.7); margin-bottom: 1rem; line-height: 1.4;">
            ${c.description || c.ai_summary || 'No description provided.'}
          </p>

          <!-- Actions -->
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            ${c.status === 'pending' ? `
              <button class="btn-update-status" data-id="${c.id}" data-status="in_process" 
                style="padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 600; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 0.5rem; cursor: pointer;">
                Mark as In Process
              </button>
            ` : ''}
            
            ${(c.status === 'pending' || c.status === 'in_process') ? `
              <button class="btn-complete" data-id="${c.id}"
                style="padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 600; background: linear-gradient(135deg,#10b981,#059669); color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                ✔ Mark Completed
              </button>
            ` : ''}

            ${c.completion_image_url ? `
              <a href="${c.completion_image_url}" target="_blank" 
                 style="padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 600; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; text-decoration: none; display: inline-flex; align-items: center;">
                 View Resolution Photo
              </a>
            ` : ''}
          </div>
        </div>
      `;

      listEl.appendChild(card);
    });

    // Attach event listeners for buttons
    document.querySelectorAll('.btn-update-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const status = e.target.getAttribute('data-status');
        await updateStatus(id, status, e.target);
      });
    });

    document.querySelectorAll('.btn-complete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        document.getElementById('completion-complaint-id').value = id;
        document.getElementById('completion-modal').classList.add('show');
      });
    });
  }

  // --- API Calls ---

  async function updateStatus(id, status, btnElement) {
    const origText = btnElement.textContent;
    btnElement.textContent = 'Updating...';
    btnElement.disabled = true;

    try {
      const res = await fetch(`${API_URL}/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error('Failed to update status');
      showToast('Status updated successfully!');
      loadGrievances(); // Refresh list

    } catch (err) {
      showToast('Error: ' + err.message);
      btnElement.textContent = origText;
      btnElement.disabled = false;
    }
  }

  // Completion Form Submit
  completionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('completion-complaint-id').value;
    const fileInput = document.getElementById('completion-image');

    if (!fileInput.files[0]) {
      showToast('Please select an image.');
      return;
    }

    const submitBtn = completionForm.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.textContent = 'Uploading...';
    submitBtn.disabled = true;

    const formData = new FormData();
    formData.append('completion_image', fileInput.files[0]);

    try {
      const res = await fetch(`${API_URL}/complaints/${id}/complete`, {
        method: 'POST',
        body: formData // Note: no Content-Type header when sending FormData!
      });

      if (!res.ok) throw new Error('Failed to mark as completed');

      showToast('Complaint marked as completed!');
      document.getElementById('completion-modal').classList.remove('show');
      completionForm.reset();
      loadGrievances(); // Refresh list

    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      submitBtn.textContent = origText;
      submitBtn.disabled = false;
    }
  });

  // --- Toast ---
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
  }
});
