import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { contextBuilder } from './middlewares/contextBuilder.js';

// 2. All local route imports (with extensions!)
import fileRoutes from './routes/fileRoutes.js';
import userRoutes from './routes/userRoutes.js';
import recipeRoutes from './routes/recipeRoutes.js';
import medicalConditionRoutes from './routes/medicalConditionRoutes.js';

// 3. Now initialize configuration
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "connect-src": ["'self'", "https://cognito-idp.us-west-2.amazonaws.com", "https://*.amazoncognito.com"],
    },
  },
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Tell Express to trust the Nginx proxy headers
app.set('trust proxy', true);
// Global Middlewares
app.use(express.json());
app.use(contextBuilder);

app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
// app.use('/api/chat', chatRoutes);
app.use('/api/medical-conditions', medicalConditionRoutes);
app.use('/api/reports', fileRoutes);

// Health check
app.listen(3000, '0.0.0.0', () => {
    console.log('Server is running on 0.0.0.0:3000');
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler for API routes
app.use('/api/:splat', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});