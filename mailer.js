const nodemailer = require('nodemailer');

// Configure the email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS  // Your Gmail password (or App Password)
  }
});

// Function to send verification email
const sendVerificationEmail = (user, token) => {
  const verificationUrl = `http://localhost:3000/verify-email?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Please verify your email',
    html: `<h4>Thank you for registering, ${user.fullName}!</h4>
           <p>Please verify your email by clicking the following link:</p>
           <a href="${verificationUrl}">Verify Email</a>`
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail };
