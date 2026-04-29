const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPhotographerWelcomeEmail = async ({ toEmail, name, password }) => {
  await transporter.sendMail({
    from: `"CoupleCanvas Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your CoupleCanvas photographer account is ready',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#333">
        <h2>Welcome to CoupleCanvas, ${name}!</h2>
        <p>Your photographer account has been created by the admin.</p>
        <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0">
          <p style="margin:4px 0"><strong>Email:</strong> ${toEmail}</p>
          <p style="margin:4px 0"><strong>Password:</strong> ${password}</p>
        </div>
        <a href="${process.env.FRONTEND_URL}/photographer/login"
           style="display:inline-block;margin:16px 0;padding:12px 28px;background:#534AB7;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">
          Log in to your account
        </a>
        <p style="color:#888;font-size:13px">Please change your password after first login.</p>
      </div>
    `,
  });
};

const sendAlbumInviteEmail = async ({ toEmail, customerName, albumTitle, photographerName, registerUrl }) => {
  await transporter.sendMail({
    from: `"CoupleCanvas" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your wedding album is ready — ${albumTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#333">
        <h2>Hi ${customerName},</h2>
        <p>Your photographer <strong>${photographerName}</strong> has created your wedding album <strong>"${albumTitle}"</strong>.</p>
        <p>Click below to register and view your album:</p>
        <a href="${registerUrl}"
           style="display:inline-block;margin:16px 0;padding:12px 28px;background:#534AB7;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">
          View my album
        </a>
        <p style="color:#888;font-size:13px">After registering you will need to complete a one-time payment to access your album.</p>
      </div>
    `,
  });
};

const sendPaymentConfirmationEmail = async ({ toEmail, customerName, albumTitle, viewUrl }) => {
  await transporter.sendMail({
    from: `"CoupleCanvas" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Payment confirmed — view your album now`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#333">
        <h2>Payment confirmed!</h2>
        <p>Hi ${customerName}, your payment for <strong>"${albumTitle}"</strong> has been received.</p>
        <a href="${viewUrl}"
           style="display:inline-block;margin:16px 0;padding:12px 28px;background:#0F6E56;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">
          View album
        </a>
      </div>
    `,
  });
};

module.exports = {
  sendPhotographerWelcomeEmail,
  sendAlbumInviteEmail,
  sendPaymentConfirmationEmail,
};