# Increase.com "Round Up" Rule

This repo gives an example of a "round up rule" (https://www.forbes.com/advisor/personal-finance/the-5-best-round-up-apps-for-saving-money/). It uses a Google Cloud Function to "round up" your transfers, meaning that your account balance is a whole dollar amount. Yes, it's silly and trivial, but I think it's fun! The API details are safely stored in Google Cloud Secrets, and the function is run as a webhook every time a potential change occurs to your account balance. It acts on debits as well as credits, keeping your primary account balance clean!

## Setup

In order to use this, you need to enable a few APIs in GCP, and set up your secret.

1. Enable the Cloud Build, Cloud Functions, and Secret Manager APIs.
2. Create a secret (I named mine "increase-round-up").
3. Paste in the configuration, a template is in "secret-example.json" (you'll need to copy some account IDs and your group's bearer token into this).
4. Copy the "name" of the secret into .env-tmpl and save it as .env.
5. Deploy the function to google with a `npm run deploy`.
6. Google will print out the URL of your new cloud function, it will look like:

```
httpsTrigger:
  securityLevel: SECURE_OPTIONAL
  url: https://us-central1-<project-name>.cloudfunctions.net/increase-round-up
```

7. Copy that URL and your generated shared secret into your Increase.com webhook configuration: https://dashboard.increase.com/group-settings/webhooks.

## Testing

```
npm test
```
