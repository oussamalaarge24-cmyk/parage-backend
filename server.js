require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma
const prisma = new PrismaClient();

// CORS Configuration - Allow all origins for development
app.use(cors({
  origin: '*', // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IMPORTANT: Serve frontend files
// This path should point to your frontend folder
const frontendPath = path.join(__dirname, '../frontend');
console.log(`📁 Serving frontend from: ${frontendPath}`);

// Serve static files from frontend
app.use(express.static(frontendPath));

// For any route not starting with /api or /health, serve index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  // Send index.html for all other routes (SPA support)
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

// Make prisma available to routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// API routes (protected with JWT)
app.use('/api', apiRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: 'Connected to Supabase',
      frontendPath: frontendPath
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR',
      database: 'Disconnected',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to Supabase PostgreSQL successfully');

    // Create default users if they don't exist
    const bcrypt = require('bcryptjs');
    
    const adminExists = await prisma.user.findFirst({
      where: { role: 'admin' }
    });

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          nom: 'Administrator',
          role: 'admin',
          password_hash: hashedPassword
        }
      });
      console.log('✅ Default admin user created: admin / admin123');
    }

    // Create test users
    const testUsers = [
      { nom: 'Chef Production', role: 'chef', password: 'chef123' },
      { nom: 'Agent Pesée', role: 'pesee', password: 'pesee123' },
      { nom: 'Agent Réception', role: 'reception', password: 'reception123' },
      { nom: 'Agent Pointage', role: 'pointage', password: 'pointage123' },
      { nom: 'Directeur', role: 'direction', password: 'direction123' }
    ];

    for (const user of testUsers) {
      const exists = await prisma.user.findFirst({
        where: { nom: user.nom }
      });
      if (!exists) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await prisma.user.create({
          data: {
            nom: user.nom,
            role: user.role,
            password_hash: hashedPassword
          }
        });
        console.log(`✅ Test user created: ${user.nom} / ${user.password}`);
      }
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`📁 Frontend: http://localhost:${PORT}`);
      console.log(`🔐 API: http://localhost:${PORT}/api`);
      console.log(`💚 Health: http://localhost:${PORT}/health`);
      console.log(`\n📋 Default Users:`);
      console.log(`   Administrator / admin123 (admin)`);
      console.log(`   Chef Production / chef123 (chef)`);
      console.log(`   Agent Pesée / pesee123 (pesee)`);
      console.log(`   Agent Réception / reception123 (reception)`);
      console.log(`   Agent Pointage / pointage123 (pointage)`);
      console.log(`   Directeur / direction123 (direction)`);
      console.log(`\n➡️  Open http://localhost:${PORT} in your browser\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('\n👋 Disconnected from database');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  console.log('\n👋 Disconnected from database');
  process.exit(0);
});