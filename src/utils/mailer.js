import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // Gmail app passwords have spaces, we need to remove them
  const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  const emailPort = parseInt(process.env.EMAIL_PORT || '587', 10);
 
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: emailPort || 587,
    secure: false, // TLS, not SSL
    requireTLS: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: emailPass,
    },
  });

  // Verify SMTP connection on first use
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ SMTP CONNECTION ERROR:', error.message);
      console.error('   User:', process.env.EMAIL_USER);
      console.error('   Host:', process.env.EMAIL_HOST);
      console.error('   Port:', emailPort);
    } else {
      console.log('✅ SMTP VERIFIED: Ready to send emails');
    }
  });

  return transporter;
}

export const sendPhotographerWelcomeEmail = async ({ toEmail, name, password }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    const info = await getTransporter().sendMail({
      from: `"MemoAlbum Admin" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'Your CoupleCanvas Photographer Account is Ready',
      text: `Welcome ${name}\nEmail: ${toEmail}\nPassword: ${password}\n\nLog in at: ${frontendUrl}/login`,
      html: `
        <div style="font-family:sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#333;">
          <h2>Welcome to MemoAlbum, ${name}!</h2>
          <p>Your photographer account has been created successfully.</p>
          
          <div style="background:#f5f5f5; padding:20px; border-radius:8px; margin:20px 0;">
            <p style="margin:8px 0;"><strong>Email:</strong> ${toEmail}</p>
            <p style="margin:8px 0;"><strong>Password:</strong> ${password}</p>
          </div>

          <a href="${frontendUrl}/login" 
             style="display:inline-block; margin:20px 0; padding:14px 32px; background:#534AB7; color:#fff; border-radius:8px; text-decoration:none; font-weight:600;">
            Log in to your account
          </a>

          <p style="color:#666; font-size:14px; margin-top:20px;">
            Please change your password after your first login for security.
          </p>
        </div>
      `,
    });

    console.log(`✅ Welcome email sent to ${toEmail} (ID: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ FAILED to send welcome email to ${toEmail}:`, error.message);
    throw error;
  }
};

export const sendUserInvitationEmail = async ({ toEmail, name, roleName, password, partnerEmail }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const roleLabel = roleName ? roleName.charAt(0).toUpperCase() + roleName.slice(1) : 'User';
  const loginText = [
    `Hi ${name},`,
    '',
    `Your MemoAlbum ${roleLabel.toLowerCase()} account is ready.`,
    `Login email: ${toEmail}`,
    password ? `Login password: ${password}` : 'Login password: use the password shared by the admin team.',
    partnerEmail ? `Partner email: ${partnerEmail}` : '',
    '',
    `Open ${frontendUrl}/login to sign in to MemoAlbum.`,
    '',
    'If you did not request this account, you can ignore this email.',
  ].filter(Boolean).join('\n');

  try {
    const info = await getTransporter().sendMail({
      from: `"MemoAlbum Admin" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Log in to MemoAlbum - your ${roleLabel} account is ready`,
      text: loginText,
      html: `
        <div style="font-family:sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#333;">
          <h2>Welcome to MemoAlbum, ${name}!</h2>
          <p>Your <strong>${roleLabel.toLowerCase()}</strong> account is ready.</p>
          <p>Use the email address below to log in to MemoAlbum.</p>

          ${partnerEmail ? `<p>The secondary invitation email for this account is <strong>${partnerEmail}</strong>.</p>` : ''}

          <div style="background:#f5f5f5; padding:20px; border-radius:8px; margin:20px 0; border-left: 4px solid #9E0E5D;">
            <p style="margin:8px 0; font-size:14px;"><strong>Login Email:</strong></p>
            <p style="margin:0 0 12px 0; font-size:16px; color:#9E0E5D; word-break:break-all;">${toEmail}</p>
            ${password ? `<p style="margin:8px 0; font-size:14px;"><strong>Login Password:</strong></p><p style="margin:0; font-size:16px; color:#9E0E5D;">${password}</p>` : ''}
          </div>

          <p style="margin:16px 0;">Use the button below to sign in and complete your account setup.</p>

          <a href="${frontendUrl}/login" 
             style="display:inline-block; margin:20px 0; padding:14px 32px; background:#9E0E5D; color:#fff; border-radius:8px; text-decoration:none; font-weight:600;">
            Log in to your account
          </a>

          <p style="color:#666; font-size:14px; margin-top:20px;">
            Please change your password after your first login for security.
          </p>
        </div>
      `,
    });

    console.log(`✅ Invitation email sent to ${toEmail} (ID: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ FAILED to send invitation to ${toEmail}:`, error.message);
    throw error;
  }
};
export const sendResendInvitationEmail = async ({ toEmail, name, roleName, partnerEmail, password }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const roleLabel = roleName ? roleName.charAt(0).toUpperCase() + roleName.slice(1) : 'User';
  const loginText = [
    `Hi ${name},`,
    '',
    `This is a reminder that your MemoAlbum ${roleLabel.toLowerCase()} account is ready.`,
    `Login email: ${toEmail}`,
    password ? `Login password: ${password}` : 'Login password: use the password shared by the admin team.',
    partnerEmail ? `Partner email: ${partnerEmail}` : '',
    '',
    `Open ${frontendUrl}/login to sign in to MemoAlbum.`,
  ].filter(Boolean).join('\n');

  try {
    const info = await getTransporter().sendMail({
      from: `"MemoAlbum Admin" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Log in to MemoAlbum - reminder for your ${roleLabel} account`,
      text: loginText,
      html: `
        <div style="font-family:sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#333;">
          <h2>Hello ${name},</h2>
          <p>This is a reminder for your <strong>MemoAlbum ${roleLabel.toLowerCase()}</strong> account invitation.</p>
          <p>Please use the email address below to log in to MemoAlbum.</p>
          ${partnerEmail ? `<p>The partner email on this account is <strong>${partnerEmail}</strong>.</p>` : ''}
          <div style="background:#f5f5f5; padding:20px; border-radius:8px; margin:20px 0; border-left: 4px solid #9E0E5D;">
            <p style="margin:8px 0; font-size:14px;"><strong>Login Email:</strong></p>
            <p style="margin:0 0 12px 0; font-size:16px; color:#9E0E5D; word-break:break-all;">${toEmail}</p>
            ${password ? `<p style="margin:8px 0; font-size:14px;"><strong>Login Password:</strong></p><p style="margin:0; font-size:16px; color:#9E0E5D;">${password}</p>` : '<p style="margin:8px 0; font-size:14px;"><strong>Login Password:</strong></p><p style="margin:0; font-size:14px;">Use the password shared by the admin team.</p>'}
          </div>
          <a href="${frontendUrl}/login"
             style="display:inline-block; margin:20px 0; padding:14px 32px; background:#9E0E5D; color:#fff; border-radius:8px; text-decoration:none; font-weight:600;">
            Log in to your account
          </a>
        </div>
      `,
    });

    console.log(`✅ Resend invitation email sent to ${toEmail} (ID: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ FAILED to send resend invitation to ${toEmail}:`, error.message);
    throw error;
  }
};

export const sendAlbumInviteEmail = async ({ toEmail, customerName, albumTitle, photographerName, registerUrl }) => {
  try {
    const info = await getTransporter().sendMail({
      from: `"MemoAlbum" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Your wedding album is ready — ${albumTitle}`,
      text: `Hi ${customerName},\n\nYour photographer ${photographerName} has created your wedding album "${albumTitle}".\n\nView your album: ${registerUrl}`,
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
    console.log(`✅ Album invite email sent to ${toEmail} (ID: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ FAILED to send album invite to ${toEmail}:`, error.message);
    throw error;
  }
};

export const sendPaymentConfirmationEmail = async ({ toEmail, customerName, albumTitle, viewUrl }) => {
  try {
    const info = await getTransporter().sendMail({
      from: `"MemoAlbum" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Payment confirmed — view your album now`,
      text: `Hi ${customerName},\n\nYour payment for "${albumTitle}" has been received.\n\nView your album: ${viewUrl}`,
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
    console.log(`✅ Payment confirmation email sent to ${toEmail} (ID: ${info.messageId})`);
  } catch (error) {
    console.error(`❌ FAILED to send payment confirmation to ${toEmail}:`, error.message);
    throw error;
  }
};