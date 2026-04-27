// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', () => {
  const userLoginForm    = document.getElementById('user-login-form');
  const userRegisterForm = document.getElementById('user-register-form');
  const showRegisterBtn  = document.getElementById('show-register');
  const showLoginBtn     = document.getElementById('show-login');
  const deptForm         = document.getElementById('dept-login-form');

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
    const email     = document.getElementById('login-email').value.trim();
    const password  = document.getElementById('login-password').value.trim();

    const origText = submitBtn.querySelector('span')?.textContent || submitBtn.textContent;
    setSubmitState(submitBtn, 'Signing in…', true);

    try {
      const resp = await fetch(`${API_BASE}/auth/user/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Login failed');

      sessionStorage.setItem('grievance_user', JSON.stringify({
        id:    data.user?.id,
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

    const name     = document.getElementById('register-name').value.trim();
    const phone    = document.getElementById('register-phone').value.trim();
    const age      = parseInt(document.getElementById('register-age').value, 10);
    const gender   = document.getElementById('register-gender').value;
    const email    = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();

    if (password.length < 6) {
      return showFormError(userRegisterForm, 'Password must be at least 6 characters.');
    }

    const origText = submitBtn.querySelector('span')?.textContent || submitBtn.textContent;
    setSubmitState(submitBtn, 'Creating account…', true);

    try {
      const resp = await fetch(`${API_BASE}/auth/user/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, phone, age, gender, email, password }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Registration failed');

      if (data.token) {
        sessionStorage.setItem('grievance_user', JSON.stringify({
          id:    data.user?.id,
          email: data.user?.email,
          token: data.token,
        }));
        window.location.href = '/dashboard.html';
      } else {
        // Email confirmation required — go back to login
        clearFormErrors(userRegisterForm);
        userRegisterForm.classList.add('hidden');
        userLoginForm.classList.remove('hidden');
        showFormSuccess(userLoginForm, '✅ Registered! Please sign in now.');
        setSubmitState(submitBtn, origText, false);
      }

    } catch (err) {
      showFormError(userRegisterForm, err.message);
      setSubmitState(submitBtn, origText, false);
    }
  });

  // ─── DEPARTMENT LOGIN ──────────────────────────────────────────────────────
  deptForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn  = deptForm.querySelector('button[type="submit"]');
    const emailInput = deptForm.querySelector('input[type="email"]');
    const passInput  = deptForm.querySelector('input[type="password"]');

    const origText = submitBtn.querySelector('span')?.textContent || submitBtn.textContent;
    setSubmitState(submitBtn, 'Signing in…', true);

    try {
      const resp = await fetch(`${API_BASE}/auth/dept/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: emailInput.value.trim(), password: passInput.value.trim() }),
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
