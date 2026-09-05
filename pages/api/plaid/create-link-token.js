import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { DEMO_USER_ID } from '../../../lib/constants';

const client = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
}));

// Called by the frontend right before opening Plaid Link.
// The returned link_token is short-lived and safe to send to the browser
// (unlike the access_token, which must never leave the server).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const userId = req.body.userId || DEMO_USER_ID;

    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Budgy',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: `${process.env.APP_URL}/api/plaid/webhook`,
    });

    res.status(200).json({ link_token: response.data.link_token });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'Failed to create link token' });
  }
}