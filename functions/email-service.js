function getUniqueEmailRecipients(baseEmail, adminEmails = []) {
  return [...new Set([baseEmail, ...adminEmails].filter(Boolean))];
}

function createEmailService({ transporter, from, notifyEmail, adminLink, getAdminEmails }) {
  async function sendEmail(to, subject, html) {
    try {
      await transporter.sendMail({ from, to, subject, html });
      console.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      console.error(`Failed to send email to ${to}:`, err);
    }
  }

  async function notifyAdmins(subject, html) {
    const adminEmails = await getAdminEmails();
    const emails = getUniqueEmailRecipients(notifyEmail, adminEmails);
    for (const email of emails) {
      await sendEmail(email, subject, html + adminLink);
    }
  }

  return {
    sendEmail,
    notifyAdmins,
  };
}

module.exports = {
  createEmailService,
  getUniqueEmailRecipients,
};
