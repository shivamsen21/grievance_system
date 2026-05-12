const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// ─── USER REGISTER / LOGIN ─────────────────────────────────────────────────────

// Register user
router.post('/user/register', async (req, res) => {
  const { name, phone, age, gender, email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          full_name: name,
          phone,
          age,
          gender
        }
      }
    });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data.session?.access_token) {
      return res.status(400).json({
        error: 'Email verification is enabled in Supabase. Disable "Confirm email" in Auth settings.'
      });
    }

    res.json({ 
      message: 'Registration successful!', 
      user: data.user,
      token: data.session.access_token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login user  (supports email OR phone)
router.post('/user/login', async (req, res) => {
  let { email, phone, password } = req.body;

  try {
    // ── Phone login: look up email from profiles table ──────────────
    if (!email && phone) {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('email')
        .eq('phone', phone)
        .single();

      if (profileErr || !profile) {
        return res.status(404).json({ error: 'No account found with that phone number.' });
      }
      email = profile.email;
    }

    if (!email) {
      return res.status(400).json({ error: 'Email or phone number is required.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(401).json({ error: error.message });

    res.json({ token: data.session.access_token, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── GET DEPARTMENTS LIST (for populating dropdown) ────────────────────────────
router.get('/departments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name, email')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEPARTMENT LOGIN ──────────────────────────────────────────────────────────
router.post('/dept/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Department email is required' });
    }

    console.log(`[DEPT LOGIN ATTEMPT] Original: "${email}", Normalized: "${normalizedEmail}"`);

    // Alias fallback keeps compatibility with legacy seed data naming.
    const emailCandidates = [normalizedEmail];
    if (normalizedEmail === 'other@smartcity.gov') emailCandidates.push('others@smartcity.gov');
    if (normalizedEmail === 'others@smartcity.gov') emailCandidates.push('other@smartcity.gov');

    const { data: depts, error } = await supabase
      .from('departments')
      .select('*')
      .in('email', emailCandidates);

    const dept = (depts || []).find(d =>
      emailCandidates.includes(String(d.email || '').trim().toLowerCase())
    );

    if (error || !dept) return res.status(404).json({ error: 'Department not found' });

    const valid = await bcrypt.compare(password, dept.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

    // Return dept info (minus password)
    const { password_hash, ...deptSafe } = dept;
    res.json({ department: deptSafe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
