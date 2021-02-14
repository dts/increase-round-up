let mockFetchImplementation;

jest.mock("node-fetch", () => {
  return jest.fn().mockImplementation(function () {
    return mockFetchImplementation.apply(this, arguments);
  });
});

let config = {
  webhookSharedSecret: "",
  apiToken: "",
  sourceAccountIDs: ["account_source"],
  savingsAccountID: ["account_sav"],
};

jest.mock("@google-cloud/secret-manager", () => {
  class SecretManagerServiceClient {
    accessSecretVersion() {
      return [
        {
          payload: {
            data: Buffer.from(JSON.stringify(config), "utf-8"),
          },
        },
      ];
    }
  }

  return {
    SecretManagerServiceClient,
  };
});

const crypto = require("crypto");

function jsonResponse(body, status = 200) {
  return new Promise((resolve) =>
    resolve({
      json: () => Promise.resolve(body),
    })
  );
}

function requestFrom(body) {
  const rawBody = Buffer.from(JSON.stringify(body));

  var hmac = crypto.createHmac(
    "sha256",
    Buffer.from(config.webhookSharedSecret)
  );
  hmac.update(rawBody);

  return {
    body: body,
    rawBody: rawBody,
    headers: {
      "x-bank-webhook-signature": `sha256=${hmac.digest("hex")}`,
    },
  };
}

function createResponse() {
  return {
    sendStatus: jest.fn(),
  };
}

beforeEach(() => {
  jest.resetModules();

  mockFetchImplementation = (url) => {
    if (url.match(/account_source$/)) return jsonResponse({ balance: 345 });
    if (url.match(/transfers\/accounts/)) return jsonResponse({});
    console.log("Missed mock: " + url);
  };
});

test("end to end success", async () => {
  const { roundUp } = require("../index");

  const body = {
    event: "created",
    data: { id: "transaction_foo", account_id: "account_source" },
  };
  const response = createResponse();

  await roundUp(requestFrom(body), response);

  expect(response.sendStatus.mock.calls[0][0]).toEqual(200);
});

test("end to end no-op", async () => {
  const { roundUp } = require("../index");

  const body = {
    event: "created",
    data: { id: "transaction_foo", account_id: "account_source" },
  };
  const response = createResponse();

  mockFetchImplementation = (url) => {
    if (url.match(/account_source$/)) return jsonResponse({ balance: 300 });
    if (url.match(/transfers\/accounts/)) return jsonResponse({});
    console.log("Missed mock: " + url);
  };

  await roundUp(requestFrom(body), response);

  expect(response.sendStatus.mock.calls[0][0]).toEqual(200);
});

test("invalid signature", async () => {
  const { roundUp } = require("../index");

  const body = {
    event: "created",
    data: { id: "transaction_foo", account_id: "account_source" },
  };
  const response = createResponse();
  const request = requestFrom(body);
  request.headers["x-bank-webhook-signature"] = "foo";

  await roundUp(request, response);

  expect(response.sendStatus.mock.calls[0][0]).toEqual(401);
});

test("exceptions", async () => {
  const { roundUp } = require("../index");

  const body = {
    event: "created",
    data: { id: "transaction_foo", account_id: "account_source" },
  };
  const response = createResponse();
  const request = requestFrom(body);

  mockFetchImplementation = () =>
    new Promise((resolve, reject) => reject(new Error()));

  await roundUp(request, response);

  expect(response.sendStatus.mock.calls[0][0]).toEqual(500);
});

test("non-matching account", async () => {
  const { roundUp } = require("../index");

  const body = {
    event: "created",
    data: { id: "transaction_foo", account_id: "account_not_source" },
  };
  const response = createResponse();
  const request = requestFrom(body);

  await roundUp(request, response);

  expect(response.sendStatus.mock.calls[0][0]).toEqual(200);
});

test("non-creating", async () => {
  const { roundUp } = require("../index");

  const body = { event: "updated" };
  const response = createResponse();
  const request = requestFrom(body);

  await roundUp(request, response);

  expect(response.sendStatus.mock.calls[0][0]).toEqual(200);
});

test("creating irrelevant", async () => {
  const { roundUp } = require("../index");

  const body = { event: "created", data: { id: "declined_transaction" } };
  const response = createResponse();
  const request = requestFrom(body);

  await roundUp(request, response);

  expect(response.sendStatus.mock.calls[0][0]).toEqual(200);
});
