const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const supabase = require('../services/supabase');
const { uploadImage } = require('../services/cloudinary');
const { analyzeGrievance } = require('../services/ai');
const {
  sendComplaintReceivedMail,
  sendStatusUpdateMail,
  sendComplaintCompletedMail,
} = require('../services/mailer');

// ── Multer: keep file in memory buffer ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are accepted'));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/complaints   — Submit a new complaint
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { user_id, user_email, description, lat, lng } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Image is required. Please capture a photo.' });
    }

    // ── 1. Upload image to Cloudinary ────────────────────────────────────────
    const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    let imageUrl, imagePublicId;
    try {
      const uploadResult = await uploadImage(base64Data, 'grievances');
      imageUrl      = uploadResult.url;
      imagePublicId = uploadResult.public_id;
    } catch (cloudErr) {
      console.error('Cloudinary upload failed:', cloudErr.message);
      return res.status(502).json({ error: 'Image upload failed. Please try again.' });
    }

    // ── 2. AI Classification ─────────────────────────────────────────────────
    const aiResult = await analyzeGrievance(imageUrl, description);
    const { category, department: deptName, summary, severity } = aiResult;

    // ── 3. Match department from Supabase ────────────────────────────────────
    const { data: departments } = await supabase.from('departments').select('*');

    let assignedDept = (departments || []).find(d =>
      deptName.toLowerCase().includes(d.name.toLowerCase()) ||
      d.name.toLowerCase().includes(deptName.toLowerCase())
    ) || (departments?.[0] ?? null);

    // ── 4. Insert complaint into Supabase ────────────────────────────────────
    const { data: complaint, error: dbError } = await supabase
      .from('complaints')
      .insert([{
        user_id:         user_id   || null,
        user_email:      user_email || null,
        description:     description || summary,
        image_url:       imageUrl,
        image_public_id: imagePublicId,
        lat:             lat ? parseFloat(lat) : null,
        lng:             lng ? parseFloat(lng) : null,
        category,
        severity,
        ai_summary:      summary,
        department_id:   assignedDept?.id    || null,
        department_name: assignedDept?.name  || deptName,
        status:          'pending',
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      throw dbError;
    }

    // ── 5. Send confirmation email ────────────────────────────────────────────
    if (user_email) {
      try {
        await sendComplaintReceivedMail(
          user_email,
          complaint.id,
          assignedDept?.name || deptName,
          category,
          severity,
          summary
        );
      } catch (mailErr) {
        // Non-fatal — log but don't fail the request
        console.error('Email sending failed:', mailErr.message);
      }
    }

    res.status(201).json({
      success:      true,
      complaint_id: complaint.id,
      category,
      department:   assignedDept?.name || deptName,
      severity,
      summary,
      image_url:    imageUrl,
      status:       'pending',
    });

  } catch (err) {
    console.error('Submit complaint error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/complaints/user/:userId — User's complaint history
//   ?email=user@example.com  (optional fallback when userId is a mock token)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { email }  = req.query;   // optional email fallback

    const COLS = 'id, created_at, category, description, ai_summary, image_url, status, severity, department_name, lat, lng, completion_image_url';

    let data, error;

    // ── Primary: query by real UUID user_id ──────────────────────────────────
    const isMockId = !userId || userId.startsWith('unconfirmed') || userId.length < 10;

    if (!isMockId) {
      ({ data, error } = await supabase
        .from('complaints')
        .select(COLS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }));
    }

    // ── Fallback: query by email (covers mock-bypass logins) ─────────────────
    if ((!data || data.length === 0) && email) {
      ({ data, error } = await supabase
        .from('complaints')
        .select(COLS)
        .eq('user_email', email)
        .order('created_at', { ascending: false }));
    }

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/complaints/:id — Single complaint (for polling real status)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Complaint not found' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/complaints/department/:deptId — All complaints for a department
// ─────────────────────────────────────────────────────────────────────────────
router.get('/department/:deptId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('department_id', req.params.deptId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/complaints/:id/status — Update status (in_process / pending)
//   Sends status-update email to user
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'in_process', 'completed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }

    // Fetch complaint for email
    const { data: complaint, error: fetchErr } = await supabase
      .from('complaints')
      .select('user_email, department_name, category')
      .eq('id', req.params.id)
      .single();

    if (fetchErr) throw fetchErr;

    // Update status
    const { error } = await supabase
      .from('complaints')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;

    // Email user about status change
    if (complaint?.user_email) {
      try {
        await sendStatusUpdateMail(
          complaint.user_email,
          req.params.id,
          status,
          complaint.department_name || 'Municipal Corporation'
        );
      } catch (mailErr) {
        console.error('Status email error:', mailErr.message);
      }
    }

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/complaints/:id/complete — Mark as completed with proof photo
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/complete', upload.single('completion_image'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Completion image is required' });
    }

    // Upload completion photo
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const { url: completionImageUrl } = await uploadImage(base64, 'completions');

    // Get complaint for email
    const { data: complaint } = await supabase
      .from('complaints')
      .select('user_email')
      .eq('id', id)
      .single();

    // Update to completed
    const { error } = await supabase
      .from('complaints')
      .update({
        status: 'completed',
        completion_image_url: completionImageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    // Send resolution email
    if (complaint?.user_email) {
      try {
        await sendComplaintCompletedMail(complaint.user_email, id, completionImageUrl);
      } catch (mailErr) {
        console.error('Completion email error:', mailErr.message);
      }
    }

    res.json({ success: true, completion_image_url: completionImageUrl, status: 'completed' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
