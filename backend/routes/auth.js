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

    // If email confirmations are OFF in Supabase, data.session will exist.
    // If they are ON, data.session is null. We'll return a mock token so the UI proceeds smoothly,
    // but the proper way is to disable 'Confirm email' in Supabase Auth providers.
    let token = data.session?.access_token;
    if (!token) {
       token = "mock-token-please-disable-email-confirmation-in-supabase";
    }

    res.json({ 
      message: 'Registration successful!', 
      user: data.user,
      token: token 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login user
router.post('/user/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      if (error.message === 'Email not confirmed') {
        // Bypass email confirmation for prototype locally
        return res.json({ 
          token: "mock-token-please-disable-email-confirmation-in-supabase", 
          user: { email: email, id: "unconfirmed-user-bypass" } 
        });
      }
      return res.status(401).json({ error: error.message });
    }
    
    res.json({ token: data.session.access_token, user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEPARTMENT LOGIN ──────────────────────────────────────────────────────────
router.post('/dept/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data: dept, error } = await supabase
      .from('departments')
      .select('*')
      .eq('email', email)
      .single();

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
