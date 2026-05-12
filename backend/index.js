const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Routes
const authRoutes = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');

app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'AI Grievance System Backend is Running ✅' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  ;
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
