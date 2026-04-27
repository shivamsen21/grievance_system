// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', () => {
  // ─── ELEMENT REFS ───────────────────────────────────────────────────────────
  const video            = document.getElementById('camera-stream');
  const canvas           = document.getElementById('photo-canvas');
  const btnStartCamera   = document.getElementById('btn-start-camera');
  const btnCapture       = document.getElementById('btn-capture');
  const btnRetake        = document.getElementById('btn-retake');
  const placeholder      = document.getElementById('camera-placeholder');

  // ─── PERMISSION MODAL REFS ──────────────────────────────────────────────────
  const permOverlay    = document.getElementById('camera-permission-overlay');
  const camModalBox    = document.getElementById('cam-modal-box');
  const askState       = document.getElementById('cam-ask-state');
  const blockedState   = document.getElementById('cam-blocked-state');
  const camBtnAllow    = document.getElementById('cam-btn-allow');
  const camBtnCancel   = document.getElementById('cam-btn-cancel');
  const camBtnRetry    = document.getElementById('cam-btn-retry');
  const camBtnClose    = document.getElementById('cam-btn-close');

  const locationIcon     = document.getElementById('location-status-icon');
  const locationText     = document.getElementById('location-status-text');
  const btnGetLocation   = document.getElementById('btn-get-location');

  const complaintDesc    = document.getElementById('complaint-desc');
  const btnSubmit        = document.getElementById('btn-submit-complaint');
  const myReportsList    = document.getElementById('my-reports-list');

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let stream        = null;
  let photoBlob     = null;       // will store the captured photo as Blob
  let userLocation  = null;
  let locationWatch = null;       // watchId for continuous tracking
  let isLocating    = false;

  // Retrieve logged-in user from sessionStorage (set during login)
  const user = JSON.parse(sessionStorage.getItem('grievance_user') || 'null');
  const userId    = user?.id    || null;
  const userEmail = user?.email || null;

  // ─── TOAST HELPER ──────────────────────────────────────────────────────────
  const toastEl = document.getElementById('toast');
  let _toastTimer = null;
  function showToast(msg, duration = 3500) {
    if (!toastEl) { console.log(msg); return; }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  // ─── LOCATION HELPERS ──────────────────────────────────────────────────────

  /** Update the UI location indicator */
  function setLocationUI(state, text) {
    locationText.textContent = text;
    const dot = document.getElementById('location-dot');
    if (!dot) return;
    dot.style.background = '';
    dot.style.boxShadow  = '';
    if (state === 'ok') {
      dot.style.background = '#10b981';
      dot.style.boxShadow  = '0 0 6px #10b981';
    } else if (state === 'err') {
      dot.style.background = '#ef4444';
      dot.style.boxShadow  = '0 0 6px #ef4444';
    } else if (state === 'loading') {
      dot.style.background = '#f59e0b';
      dot.style.boxShadow  = '0 0 6px #f59e0b';
    } else {
      dot.style.background = '#475569';
    }
  }

  /** Start watching location automatically */
  function startLocationTracking() {
    if (!('geolocation' in navigator)) {
      setLocationUI('err', 'Geolocation not supported');
      return;
    }
    if (isLocating) return;      // already tracking
    isLocating = true;

    setLocationUI('loading', 'Detecting your location…');

    // Stop any existing watcher
    if (locationWatch !== null) {
      navigator.geolocation.clearWatch(locationWatch);
    }

    locationWatch = navigator.geolocation.watchPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        };
        setLocationUI(
          'ok',
          `📍 ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}  (±${userLocation.accuracy}m)`
        );
        btnGetLocation.classList.add('hidden');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        let msg = 'Location unavailable';
        if (err.code === 1) msg = 'Location permission denied';
        else if (err.code === 2) msg = 'Location signal lost';
        else if (err.code === 3) msg = 'Location timed out';
        setLocationUI('err', msg);
        isLocating = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  /** Manual "Get Location" button (fallback) */
  btnGetLocation.addEventListener('click', () => startLocationTracking());

  // ─── CAMERA PERMISSION MODAL LOGIC ──────────────────────────────────────────

  function showPermModal() {
    // Reset to ask-state
    askState.style.display     = '';
    blockedState.style.display = 'none';
    camModalBox.classList.remove('blocked');
    permOverlay.classList.add('show');
  }

  function hidePermModal() {
    permOverlay.classList.remove('show');
  }

  async function requestCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      // Permission granted — hide modal and start video
      hidePermModal();
      video.srcObject = stream;
      video.classList.remove('hidden');
      placeholder.classList.add('hidden');
      btnStartCamera.classList.add('hidden');
      btnCapture.classList.remove('hidden');

      // Auto-start location tracking
      startLocationTracking();

    } catch (err) {
      console.error('Camera error:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        // Show blocked / denied state
        askState.style.display     = 'none';
        blockedState.style.display = '';
        camModalBox.classList.add('blocked');
      } else {
        hidePermModal();
        alert('Camera not available: ' + err.message);
      }
    }
  }

  // "Open Camera" button → show our custom permission modal first
  btnStartCamera.addEventListener('click', () => showPermModal());

  // "Allow Camera" inside modal → request browser permission
  camBtnAllow.addEventListener('click', () => requestCamera());

  // "Cancel" → close modal without doing anything
  camBtnCancel.addEventListener('click', () => hidePermModal());

  // "Try Again" from blocked state
  camBtnRetry.addEventListener('click', () => {
    askState.style.display     = '';
    blockedState.style.display = 'none';
    camModalBox.classList.remove('blocked');
    requestCamera();
  });

  // "Close" from blocked state
  camBtnClose.addEventListener('click', () => hidePermModal());

  // Close modal on backdrop click
  permOverlay.addEventListener('click', (e) => {
    if (e.target === permOverlay) hidePermModal();
  });


  btnCapture.addEventListener('click', () => {
    if (!stream) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to Blob for multipart upload
    canvas.toBlob((blob) => { photoBlob = blob; }, 'image/jpeg', 0.85);

    // Freeze stream
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    video.classList.add('hidden');
    canvas.classList.remove('hidden');

    btnCapture.classList.add('hidden');
    btnRetake.classList.remove('hidden');
  });

  btnRetake.addEventListener('click', async () => {
    photoBlob = null;
    canvas.classList.add('hidden');
    btnRetake.classList.add('hidden');
    btnStartCamera.classList.remove('hidden');
    // Restart camera & location
    btnStartCamera.click();
  });

  // ─── SUBMIT LOGIC ──────────────────────────────────────────────────────────

  btnSubmit.addEventListener('click', async () => {
    if (!photoBlob) {
      return alert('Please capture a photo of the issue first.');
    }
    if (!userLocation) {
      return alert('Location is still being fetched. Please wait a moment.');
    }

    const description = complaintDesc.value.trim();

    // Build FormData for multipart/form-data POST
    const formData = new FormData();
    formData.append('image', photoBlob, 'complaint.jpg');
    formData.append('lat', userLocation.lat);
    formData.append('lng', userLocation.lng);
    formData.append('description', description);
    if (userId)    formData.append('user_id', userId);
    if (userEmail) formData.append('user_email', userEmail);

    btnSubmit.textContent = '⏳ Submitting…';
    btnSubmit.disabled    = true;

    try {
      const resp = await fetch(`${API_BASE}/complaints`, {
        method: 'POST',
        body: formData,
      });

      const result = await resp.json();

      if (!resp.ok) throw new Error(result.error || 'Submission failed');

      showToast(
        `✅ Grievance submitted! Category: ${result.category} · Severity: ${result.severity}`
      );

      resetForm();
      if (userId || userEmail) loadUserReports(userId || 'fallback');

    } catch (err) {
      console.error(err);
      showToast('❌ Error: ' + err.message, 5000);
    } finally {
      btnSubmit.textContent = 'Submit Grievance';
      btnSubmit.disabled    = false;
    }
  });

  // ─── RESET FORM ────────────────────────────────────────────────────────────

  function resetForm() {
    photoBlob = null;
    userLocation = null;
    isLocating = false;

    if (locationWatch !== null) {
      navigator.geolocation.clearWatch(locationWatch);
      locationWatch = null;
    }

    complaintDesc.value = '';
    canvas.classList.add('hidden');
    placeholder.classList.remove('hidden');
    btnRetake.classList.add('hidden');
    btnStartCamera.classList.remove('hidden');
    btnCapture.classList.add('hidden');
    btnGetLocation.classList.remove('hidden');
    setLocationUI('idle', 'Location not verified');
  }

  // ─── REFRESH BUTTON ────────────────────────────────────────────────────────
  document.getElementById('btn-refresh-reports')?.addEventListener('click', () => {
    if (userId || userEmail) loadUserReports(userId || 'fallback');
  });

  // ─── LOAD USER REPORTS ─────────────────────────────────────────────────────

  async function loadUserReports(uid) {
    if (!myReportsList) return;
    // Show shimmer placeholders
    myReportsList.innerHTML = [
      '<div class="shimmer" style="height:76px;"></div>',
      '<div class="shimmer" style="height:76px;opacity:.7;"></div>',
      '<div class="shimmer" style="height:76px;opacity:.4;"></div>',
    ].join('');

    try {
      // Build URL: pass email as fallback for mock-bypass logins
      const url = new URL(`${API_BASE}/complaints/user/${encodeURIComponent(uid)}`);
      if (userEmail) url.searchParams.set('email', userEmail);

      const resp = await fetch(url.toString());
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error);

      if (!data.length) {
        myReportsList.innerHTML = `
          <div class="text-center py-10">
            <svg class="w-14 h-14 mx-auto text-slate-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-3-3v6M4 6h16M4 18h16"/>
            </svg>
            <p class="text-sm font-medium text-slate-400">No reports submitted yet.</p>
            <p class="text-xs text-slate-300 mt-1">Capture a photo and submit your first grievance!</p>
          </div>`;
        return;
      }

      myReportsList.innerHTML = data.map(c => `
        <div class="report-card">

          <!-- Thumbnail -->
          <div style="width:60px;height:60px;border-radius:.625rem;background:rgba(255,255,255,0.06);flex-shrink:0;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
            ${c.image_url
              ? `<img src="${c.image_url}" style="width:100%;height:100%;object-fit:cover;" alt="Issue photo" loading="lazy">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.2);font-size:1.25rem;">📷</div>`
            }
          </div>

          <!-- Content -->
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.375rem;">
              <h3 style="font-size:.875rem;font-weight:700;color:#f1f5f9;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.category || 'Grievance'}</h3>
              <span class="badge ${statusBadge(c.status)}" style="flex-shrink:0;">${statusLabel(c.status)}</span>
            </div>

            <p style="font-size:.78rem;color:rgba(255,255,255,0.4);margin:0 0 .5rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${c.ai_summary || c.description || '—'}</p>

            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;font-size:.72rem;color:rgba(255,255,255,0.3);">
              ${c.department_name ? `<span style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);padding:.15rem .5rem;border-radius:99px;">${c.department_name}</span>` : ''}
              <span style="display:inline-flex;align-items:center;gap:.3rem;">
                <span style="width:6px;height:6px;border-radius:50%;background:${c.severity==='high'?'#ef4444':c.severity==='medium'?'#f59e0b':'#10b981'};display:inline-block;"></span>
                ${capitalize(c.severity || '')} severity
              </span>
              <span style="margin-left:auto;">${formatDate(c.created_at)}</span>
            </div>

            ${c.completion_image_url ? `
              <details style="margin-top:.5rem;">
                <summary style="font-size:.75rem;color:#10b981;cursor:pointer;font-weight:600;">📸 View Completion Photo</summary>
                <img src="${c.completion_image_url}" style="margin-top:.375rem;border-radius:.5rem;width:100%;object-fit:cover;max-height:120px;" alt="Completion" loading="lazy">
              </details>` : ''}
          </div>
        </div>
      `).join('');

    } catch (err) {
      myReportsList.innerHTML = `
        <p class="text-sm text-red-400">⚠️ Failed to load reports: ${err.message}</p>`;
    }
  }

  // ─── UTILITIES ─────────────────────────────────────────────────────────────

  function statusBadge(status) {
    if (status === 'completed')  return 'bg-emerald-100 text-emerald-700';
    if (status === 'in_process') return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
  }

  function statusLabel(status) {
    if (status === 'completed')  return '✅ Completed';
    if (status === 'in_process') return '🔄 In Progress';
    return '⏳ Pending';
  }

  function severityDot(severity) {
    if (severity === 'high')   return 'bg-red-400';
    if (severity === 'medium') return 'bg-amber-400';
    return 'bg-emerald-400';
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ');
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────
  // Load reports on page open — works for real UUID and mock-bypass logins
  if (userId || userEmail) {
    loadUserReports(userId || 'fallback');
  }
});
