const crypto = require("crypto");
const fetch = require("node-fetch");

let config = null;

const BASE_URL = "https://api.increase.com";

async function handle(req) {
  // no action unless we're creating a transaction:
  if (req.body.event != "created") return;
  if (!req.body.data.id.match(/^(pending_)?transaction/)) return;

  const transaction = req.body.data;

  if (
    config.sourceAccountIDs &&
    !config.sourceAccountIDs.includes(transaction.account_id)
  ) {
    console.log(`${transaction.account_id} not in `, config.sourceAccountIDs);
    return;
  }

  const account = await fetch(
    `${BASE_URL}/accounts/${transaction.account_id}`,
    {
      headers: {
        authorization: "Bearer " + config.apiToken,
      },
    }
  ).then((r) => r.json());

  const balance = account.balance;
  const excessBalance = balance % 100;

  if (excessBalance == 0) {
    return;
  }

  return await fetch(
    `${BASE_URL}/accounts/${transaction.account_id}/transfers/accounts`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + config.apiToken,
      },
      body: JSON.stringify({
        amount: excessBalance,
        description: `Round-Up for ${transaction.description}`,
        destination_account_id: config.savingsAccountID,
      }),
    }
  );
}

function signatureValid(req) {
  var hmac = crypto.createHmac(
    "sha256",
    Buffer.from(config.webhookSharedSecret)
  );
  hmac.update(req.rawBody);

  let computedSignature = "sha256=" + hmac.digest("hex");
  let httpSignature = req.headers["x-bank-webhook-signature"];

  return computedSignature == httpSignature;
}

async function fetchConfig() {
  const {
    SecretManagerServiceClient,
  } = require("@google-cloud/secret-manager");
  const client = new SecretManagerServiceClient();

  const [accessResponse] = await client.accessSecretVersion({
    name: "projects/508677331744/secrets/increase-round-up/versions/1",
  });
  const payload = accessResponse.payload.data.toString("utf8");

  return JSON.parse(payload);
}

exports.roundUp = async (req, res) => {
  config = config || (await fetchConfig());

  if (!signatureValid(req)) {
    return res.sendStatus(401);
  }

  try {
    await handle(req);
    res.sendStatus(200);
  } catch (exception) {
    console.error("Error handling: ", exception);
    res.sendStatus(500);
  }
};
