import { BrevoClient } from '@getbrevo/brevo'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Lazily instantiated — server-side only
function getClient(): BrevoClient {
  return new BrevoClient({ apiKey: process.env.BREVO_API_KEY! })
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function createBrevoContact(params: {
  email: string
  firstName?: string
  company?: string
  listId?: number
}): Promise<{ id: number }> {
  const client = getClient()

  const result = await client.contacts.createContact({
    email: params.email,
    attributes: {
      FIRSTNAME: params.firstName ?? '',
      COMPANY: params.company ?? '',
    },
    ...(params.listId != null ? { listIds: [params.listId] } : {}),
    updateEnabled: true,
  })

  const id = result?.id
  if (id == null) {
    throw new Error('Brevo createContact: missing id in response')
  }
  return { id }
}

// ---------------------------------------------------------------------------
// Transactional email — double opt-in confirmation
// ---------------------------------------------------------------------------

export async function sendConfirmationEmail(params: {
  email: string
  firstName?: string
  confirmUrl: string
}): Promise<void> {
  const client = getClient()

  const greeting = params.firstName ? `Bonjour ${escapeHtml(params.firstName)},` : 'Bonjour,'

  await client.transactionalEmails.sendTransacEmail({
    sender: { name: '0Flaw', email: 'noreply@0flaw.fr' },
    to: [{ email: params.email, name: params.firstName }],
    subject: 'Confirmez votre inscription à la newsletter 0Flaw',
    htmlContent: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px 0;">
  <table width="600" cellpadding="0" cellspacing="0" style="margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="padding: 40px 40px 20px;">
        <p style="font-size: 16px; color: #333333; margin: 0 0 16px;">${greeting}</p>
        <p style="font-size: 16px; color: #333333; margin: 0 0 24px;">
          Merci de vous être inscrit à la newsletter <strong>0Flaw</strong>.<br />
          Cliquez sur le bouton ci-dessous pour confirmer votre inscription.
        </p>
        <p style="text-align: center; margin: 0 0 24px;">
          <a href="${escapeHtml(params.confirmUrl)}"
             style="display: inline-block; background-color: #00E5FF; color: #000000; font-weight: bold;
                    padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 16px;">
            Confirmer mon inscription
          </a>
        </p>
        <p style="font-size: 13px; color: #888888; margin: 0;">
          Ce lien expire dans 48h. Si vous n'avez pas demandé cette inscription, ignorez cet email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
  })
}

// ---------------------------------------------------------------------------
// Email campaigns
// ---------------------------------------------------------------------------

export async function createBrevoEmailCampaign(params: {
  subject: string
  preheader?: string
  htmlContent: string
  listId: number
  scheduledAt?: string
}): Promise<{ id: number }> {
  const client = getClient()

  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const result = await client.emailCampaigns.createEmailCampaign({
    name: `Newsletter 0Flaw — ${today}`,
    subject: params.subject,
    previewText: params.preheader,
    htmlContent: params.htmlContent,
    sender: { name: '0Flaw', email: 'newsletter@0flaw.fr' },
    recipients: { listIds: [params.listId] },
    ...(params.scheduledAt != null ? { scheduledAt: params.scheduledAt } : {}),
  })

  return { id: result.id }
}

export async function getCampaignStats(brevoId: number): Promise<{
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  unsubscribed: number
}> {
  const client = getClient()

  const result = await client.emailCampaigns.getEmailCampaign({ campaignId: brevoId })
  const stats = result.statistics?.campaignStats?.[0]

  return {
    sent: stats?.sent ?? 0,
    delivered: stats?.delivered ?? 0,
    opened: stats?.uniqueViews ?? 0,
    clicked: stats?.uniqueClicks ?? 0,
    bounced: (stats?.hardBounces ?? 0) + (stats?.softBounces ?? 0),
    unsubscribed: stats?.unsubscriptions ?? 0,
  }
}
