const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS, // App Password (16-char)
  },
});

// Verify transporter on startup (logs error but doesn't crash)
transporter.verify((err) => {
  if (err) console.error('❌ Mailer config error:', err.message);
  else console.log('✅ Mailer ready (Gmail SMTP)');
});

/* ── helpers ─────────────────────────────────────────────────────────── */

function severityColor(severity) {
  if (severity === 'high')   return '#ef4444';
  if (severity === 'medium') return '#f59e0b';
  return '#22c55e';
}

function statusBadgeHtml(status) {
  const map = {
    pending:    { color: '#f59e0b', bg: '#fef3c7', label: 'Pending' },
    in_process: { color: '#3b82f6', bg: '#eff6ff', label: 'In Process' },
    completed:  { color: '#22c55e', bg: '#f0fdf4', label: 'Completed' },
  };
  const s = map[status] || map.pending;
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${s.bg};color:${s.color};font-weight:700;font-size:13px">${s.label}</span>`;
}

/* ── 1. Complaint Received ────────────────────────────────────────────── */

async function sendComplaintReceivedMail(toEmail, complaintId, department, category, severity, summary) {
  const sevColor = severityColor(severity);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 32px 24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="width:42px;height:42px;background:rgba(255,255,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px">🏙️</div>
        <span style="color:#bfdbfe;font-size:13px;font-weight:600;letter-spacing:.05em">SMART CITY REPORT</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Complaint Received ✅</h1>
      <p style="color:#bfdbfe;margin:6px 0 0;font-size:14px">We have received your grievance and it is being reviewed.</p>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="color:#374151;font-size:15px;margin:0 0 24px">Dear Citizen,</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px">
        Your complaint has been <strong>successfully submitted</strong> to our system. Here are the details:
      </p>

      <!-- Info Card -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;width:130px;vertical-align:top">Complaint ID</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:700;font-family:monospace">#${complaintId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;vertical-align:top">Category</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600">${category || 'General'}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;vertical-align:top">Department</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600">${department}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;vertical-align:top">Severity</td>
            <td style="padding:8px 0">
              <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${sevColor}20;color:${sevColor};font-size:12px;font-weight:700;text-transform:capitalize">${severity || 'medium'}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;vertical-align:top">Status</td>
            <td style="padding:8px 0">${statusBadgeHtml('pending')}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;vertical-align:top">Summary</td>
            <td style="padding:8px 0;color:#374151;font-size:13px">${summary || '—'}</td>
          </tr>
        </table>
      </div>

      <!-- Timeline -->
      <h3 style="color:#0f172a;font-size:14px;font-weight:700;margin:0 0 12px">What happens next?</h3>
      <div style="position:relative;padding-left:24px;border-left:2px solid #e2e8f0;margin-bottom:24px">
        <div style="margin-bottom:16px">
          <div style="width:12px;height:12px;background:#2563eb;border-radius:50%;position:absolute;left:-7px;margin-top:3px"></div>
          <p style="margin:0;color:#0f172a;font-size:13px;font-weight:600">Complaint Received</p>
          <p style="margin:2px 0 0;color:#64748b;font-size:12px">Your complaint is now in our system.</p>
        </div>
        <div style="margin-bottom:16px">
          <div style="width:12px;height:12px;background:#e2e8f0;border-radius:50%;position:absolute;left:-7px;margin-top:3px"></div>
          <p style="margin:0;color:#94a3b8;font-size:13px;font-weight:600">Under Review</p>
          <p style="margin:2px 0 0;color:#94a3b8;font-size:12px">Department will assign a team.</p>
        </div>
        <div>
          <div style="width:12px;height:12px;background:#e2e8f0;border-radius:50%;position:absolute;left:-7px;margin-top:3px"></div>
          <p style="margin:0;color:#94a3b8;font-size:13px;font-weight:600">Resolved</p>
          <p style="margin:2px 0 0;color:#94a3b8;font-size:12px">You'll receive another email with proof of resolution.</p>
        </div>
      </div>

      <p style="color:#64748b;font-size:13px;margin:0">
        Thank you for helping us build a better city. 🌆
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center">
      <p style="color:#94a3b8;font-size:12px;margin:0">Smart City Grievance System &mdash; Powered by AI</p>
      <p style="color:#cbd5e1;font-size:11px;margin:4px 0 0">This is an automated notification. Please do not reply to this email.</p>
    </div>

  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"Smart City Report" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `✅ Complaint #${complaintId} Received — ${category || 'Grievance'}`,
    html,
  });
}

/* ── 2. Status Updated (in_process) ──────────────────────────────────── */

async function sendStatusUpdateMail(toEmail, complaintId, newStatus, department) {
  const statusLabel = newStatus === 'in_process' ? 'In Process 🔧' : capitalize(newStatus);

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#3b82f6,#0ea5e9);padding:32px">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Status Update 🔧</h1>
      <p style="color:#bae6fd;margin:6px 0 0;font-size:14px">Your complaint is now being worked on.</p>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:15px">Dear Citizen,</p>
      <p style="color:#374151;font-size:15px">Your complaint <strong>#${complaintId}</strong> status has been updated to <strong>${statusLabel}</strong> by the <strong>${department}</strong> department.</p>
      <div style="background:#eff6ff;border-radius:12px;padding:20px;margin:24px 0">
        <p style="margin:0;color:#1d4ed8;font-size:14px;font-weight:700">New Status: ${statusBadgeHtml(newStatus)}</p>
      </div>
      <p style="color:#64748b;font-size:13px">You will receive another email once the issue is fully resolved.</p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center">
      <p style="color:#94a3b8;font-size:12px;margin:0">Smart City Grievance System &mdash; Powered by AI</p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"Smart City Report" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `🔧 Complaint #${complaintId} — Status Updated to ${statusLabel}`,
    html,
  });
}

/* ── 3. Complaint Completed ──────────────────────────────────────────── */

async function sendComplaintCompletedMail(toEmail, complaintId, photoUrl) {
  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Issue Resolved! 🎉</h1>
      <p style="color:#bbf7d0;margin:6px 0 0;font-size:14px">Great news — your complaint has been resolved.</p>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:15px">Dear Citizen,</p>
      <p style="color:#374151;font-size:15px">
        Great news! Your complaint <strong>#${complaintId}</strong> has been marked as <strong>Resolved ✅</strong>.
      </p>
      ${photoUrl ? `
      <div style="margin:24px 0">
        <p style="color:#374151;font-size:14px;font-weight:600;margin-bottom:12px">📸 Proof of Completion:</p>
        <img src="${photoUrl}" alt="Completion Photo" style="width:100%;border-radius:10px;border:1px solid #e2e8f0">
      </div>` : ''}
      <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin:24px 0">
        <p style="margin:0;color:#16a34a;font-size:14px;font-weight:700">Status: ${statusBadgeHtml('completed')}</p>
      </div>
      <p style="color:#64748b;font-size:13px">
        Thank you for reporting this issue and helping us build a better city! 🌆
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center">
      <p style="color:#94a3b8;font-size:12px;margin:0">Smart City Grievance System &mdash; Powered by AI</p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"Smart City Report" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `🎉 Complaint #${complaintId} Has Been Resolved!`,
    html,
  });
}

function capitalize(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ');
}

module.exports = { sendComplaintReceivedMail, sendStatusUpdateMail, sendComplaintCompletedMail };
