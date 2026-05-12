// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = '/api'; // Vite proxy → localhost:5000 (works on LAN and ngrok)

// Expose switchTab so index.html inline script can call loadDepartments on tab switch
window._loadDepartments = null; // will be set after DOMContentLoaded

document.addEventListener('DOMContentLoaded', () => {
  const userLoginForm = document.getElementById('user-login-form');
  const userRegisterForm = document.getElementById('user-register-form');
  const showRegisterBtn = document.getElementById('show-register');
  const showLoginBtn = document.getElementById('show-login');
  const deptForm = document.getElementById('dept-login-form');
  const deptSelect = document.getElementById('dept-login-email');

  // ─── LOAD DEPARTMENTS FROM DB ──────────────────────────────────────────────
  async function loadDepartments() {
    if (!deptSelect) return;

    // Show loading state
    deptSelect.innerHTML = '<option value="" disabled selected>Loading departments…</option>';
    deptSelect.disabled = true;

    try {
      const resp = await fetch(`${API_BASE}/auth/departments`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Server error ${resp.status}: ${text}`);
      }
      const depts = await resp.json();

      if (!Array.isArray(depts) || depts.length === 0) {
        throw new Error('No departments returned from server');
      }

      deptSelect.innerHTML = '<option value="" disabled selected>Select your department…</option>';
      depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.email;
        opt.textContent = d.name;
        deptSelect.appendChild(opt);
      });
      deptSelect.disabled = false;

    } catch (err) {
      console.error('[loadDepartments] Failed:', err.message);

      // Show error with retry option in the select
      deptSelect.innerHTML = `
        <option value="" disabled selected>⚠️ Failed to load — click Retry</option>
        <option value="roads@smartcity.gov">Roads &amp; Infrastructure</option>
        <option value="electric@smartcity.gov">Electrical Department</option>
        <option value="water@smartcity.gov">Water Supply</option>
        <option value="sanitation@smartcity.gov">Sanitation Department</option>
        <option value="municipal@smartcity.gov">Municipal Corporation</option>
        <option value="other@smartcity.gov">Other</option>
      `;
      deptSelect.disabled = false;

      // Show visible error message below the select
      const existingErr = document.getElementById('dept-load-error');
      if (existingErr) existingErr.remove();
      const errEl = document.createElement('p');
      errEl.id = 'dept-load-error';
      errEl.style.cssText = 'color:#fbbf24;font-size:.75rem;margin-top:.25rem;';
      errEl.innerHTML = `⚠️ Could not load departments from server. Using local list. <a href="#" id="dept-retry-link" style="color:#818cf8;text-decoration:underline;">Retry</a>`;
      deptSelect.parentNode.appendChild(errEl);

      document.getElementById('dept-retry-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        errEl.remove();
        loadDepartments();
      });
    }
  }

  // Expose so index.html switchTab can trigger a reload
  window._loadDepartments = loadDepartments;

  // Load immediately so it's ready when the dept tab is opened
  loadDepartments();

  // ─── LOGIN ↔ REGISTER toggle (within Citizen tab) ─────────────────────────
  showRegisterBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    userLoginForm.classList.add('hidden');
    userRegisterForm.classList.remove('hidden');
  });

  showLoginBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    userRegisterForm.classList.add('hidden');
    userLoginForm.classList.remove('hidden');
  });

  // ─── CITIZEN LOGIN ─────────────────────────────────────────────────────────
  userLoginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = userLoginForm.querySelector('button[type="submit"]');
    const password = document.getElementById('login-password').value.trim();

    // Determine login mode (email or phone) via the toggle exposed on window
    const loginMode = (typeof window.getLoginMode === 'function') ? window.getLoginMode() : 'email';
    const email = document.getElementById('login-email').value.trim();
    const phone = document.getElementById('login-phone')?.value.trim();

    // Validate input based on active mode
    if (loginMode === 'email' && !email) {
      return showFormError(userLoginForm, 'Please enter your email address.');
    }
    if (loginMode === 'phone') {
      if (!phone || !/^\d{10}$/.test(phone)) {
        return showFormError(userLoginForm, 'Please enter a valid 10-digit phone number.');
      }
    }
    if (!password) return showFormError(userLoginForm, 'Please enter your password.');

    const origText = submitBtn.querySelector('span')?.textContent || submitBtn.textContent;
    setSubmitState(submitBtn, 'Signing in…', true);

    try {
      // Build payload — phone login sends { phone, password }, email sends { email, password }
      const payload = loginMode === 'phone'
        ? { phone, password }
        : { email, password };

      const resp = await fetch(`${API_BASE}/auth/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Login failed');

      sessionStorage.setItem('grievance_user', JSON.stringify({
        id: data.user?.id,
        email: data.user?.email,
        token: data.token,
      }));

      window.location.href = '/dashboard.html';

    } catch (err) {
      showFormError(userLoginForm, err.message);
      setSubmitState(submitBtn, origText, false);
    }
  });

  // ─── CITIZEN REGISTER ──────────────────────────────────────────────────────
  userRegisterForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = userRegisterForm.querySelector('button[type="submit"]');

    const name = document.getElementById('register-name').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const age = parseInt(document.getElementById('register-age').value, 10);
    const gender = document.getElementById('register-gender').value;
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();

    if (password.length < 6) {
      return showFormError(userRegisterForm, 'Password must be at least 6 characters.');
    }

    const origText = submitBtn.querySelector('span')?.textContent || submitBtn.textContent;
    setSubmitState(submitBtn, 'Creating account…', true);

    try {
      const resp = await fetch(`${API_BASE}/auth/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, age, gender, email, password }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Registration failed');

      sessionStorage.setItem('grievance_user', JSON.stringify({
        id: data.user?.id,
        email: data.user?.email,
        token: data.token,
      }));
      window.location.href = '/dashboard.html';

    } catch (err) {
      showFormError(userRegisterForm, err.message);
      setSubmitState(submitBtn, origText, false);
    }
  });

  // ─── DEPARTMENT LOGIN ──────────────────────────────────────────────────────
  deptForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = deptForm.querySelector('button[type="submit"]');
    const emailInput = document.getElementById('dept-login-email') || deptForm.querySelector('input[type="email"]');
    const passInput = document.getElementById('dept-password') || deptForm.querySelector('input[type="password"]');

    const origText = submitBtn.querySelector('span')?.textContent || submitBtn.textContent;
    setSubmitState(submitBtn, 'Signing in…', true);

    try {
      const resp = await fetch(`${API_BASE}/auth/dept/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.value.trim(), password: passInput.value.trim() }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Department login failed');

      sessionStorage.setItem('grievance_dept', JSON.stringify(data.department));
      window.location.href = '/department.html';

    } catch (err) {
      showFormError(deptForm, err.message);
      setSubmitState(submitBtn, origText, false);
    }
  });

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  function setSubmitState(btn, text, disabled) {
    const span = btn.querySelector('span');
    if (span) span.textContent = text;
    else btn.textContent = text;
    btn.disabled = disabled;
  }

  function showFormError(form, message) {
    clearFormErrors(form);
    const el = document.createElement('p');
    el.className = 'form-error-msg';
    el.style.cssText = 'color:#f87171;font-size:.8rem;text-align:center;margin-top:.25rem;';
    el.textContent = '⚠️ ' + message;
    form.appendChild(el);
  }

  function showFormSuccess(form, message) {
    clearFormErrors(form);
    const el = document.createElement('p');
    el.className = 'form-error-msg';
    el.style.cssText = 'color:#34d399;font-size:.8rem;text-align:center;margin-top:.25rem;';
    el.textContent = message;
    form.appendChild(el);
  }

  function clearFormErrors(form) {
    form.querySelectorAll('.form-error-msg').forEach(e => e.remove());
  }
});

