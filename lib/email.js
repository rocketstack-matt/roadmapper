const { Resend } = require('resend');

const isEmailConfigured = () => !!process.env.RESEND_API_KEY;

const sendConfirmationEmail = async (toEmail, confirmUrl, owner, repo) => {
  if (!isEmailConfigured()) {
    return { skipped: true };
  }

  const fromEmail = process.env.FROM_EMAIL || 'Roadmapper <noreply@roadmapper.rocketstack.co>';
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [toEmail],
    subject: `Confirm your Roadmapper registration for ${owner}/${repo}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #24292f; margin-bottom: 24px;">Confirm your Roadmapper registration</h2>
        <p style="color: #57606a; font-size: 16px; line-height: 1.6;">
          You registered an API key for <strong>${owner}/${repo}</strong>. Please confirm your email address to activate it.
        </p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(135deg, #1E88E5, #26A69A); color: white; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;">
            Confirm Email
          </a>
        </div>
        <p style="color: #8b949e; font-size: 14px;">
          This link expires in 24 hours. If you did not register for Roadmapper, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">
        <p style="color: #8b949e; font-size: 12px; text-align: center;">
          <a href="https://roadmapper.rocketstack.co" style="color: #26A69A;">Roadmapper</a> &mdash; GitHub Issue Roadmaps Made Simple
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Failed to send confirmation email: ${error.message}`);
  }

  return { sent: true, id: data?.id };
};

module.exports = { sendConfirmationEmail, isEmailConfigured };
