const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB (without deprecated options)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Middleware setup
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Add this line to parse incoming JSON requests
app.use(express.json());  // <-- This will fix the issue with parsing JSON in POST requests

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session setup
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));
// Route to render services.ejs
app.get('/services', (req, res) => {
  res.render('services');  // Ensure 'services.ejs' is in the 'views' folder
});

// Nodemailer setup using environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Use environment variable for Gmail user
    pass: process.env.GMAIL_PASS, // Use environment variable for Gmail app password
  },
});

// Route to handle contact form submission
app.post('/submit-contact', (req, res) => {
  const { name, contact, email, message } = req.body;

  // Validate that all fields are provided
  if (!name || !contact || !email || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.GMAIL_USER, // Send email to yourself (can be changed)
    subject: 'New Contact Form Submission',
    text: `Name: ${name}\nContact: ${contact}\nEmail: ${email}\nMessage: ${message}`
  };

  // Send the email using nodemailer
  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error while sending email:', err);
      return res.status(500).json({ success: false, message: 'An error occurred while sending the email' });
    }
    console.log('Email sent: ' + info.response);
    // Send a JSON response for success without page reload
    return res.status(200).json({ success: true, message: 'Email sent successfully' });
  });
});
// Import authentication routes
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
