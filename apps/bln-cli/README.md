# Bln cli

> Test bln compat without the frontend

## Setup

Expects a `.env` file with node configuration. An .env-example can be found here [.env-example](./.env-example)..

## Example commands

### Make and pay

Invoice without amount

```
yarn start make-invoice lnd1 --output PayRequest \
  | xargs yarn start pay lnd2 --amount 1000 --request
```

Invoice with an amount

```
yarn start make-invoice lnd1 --amount 1000 --output PayRequest \
  | xargs yarn start pay lnd2 --request
```

### Decomposing invoice

Make and display:

```bash
yarn start make-invoice lnd2 --amount 1000 --output PayRequest \
  | xargs yarn start show-invoice \
  | jq ' { payee : .payee , paymentHash : .paymentHash , paymentSecret : .paymentSecret }'
```

Result

```json
{
  "payee": "039c52d9bee5eaa71191a211eced45908ac391098ddc25df203740e1b93ea4982a",
  "paymentHash": "af1d3781312baa93c7687305df6ea6f01927d7752a5281b37f7d5acaeedaab0c",
  "paymentSecret": "4db35e9b9331c0d42a6504af9dfd54f1221ad0d133558889f9757041a37548fd"
}
```

Pay:

```bash
yarn start pay lnd1 \
  --payee 039c52d9bee5eaa71191a211eced45908ac391098ddc25df203740e1b93ea4982a \
  --payment-hash af1d3781312baa93c7687305df6ea6f01927d7752a5281b37f7d5acaeedaab0c --payment-secret 4db35e9b9331c0d42a6504af9dfd54f1221ad0d133558889f9757041a37548fd \
  --amount 1000
```

Results in a successful payment. This relies in part in the undeclared options
taking on the default values in LND, and these being acceptable for the route.
This will not always be the case.

## Troubleshooting

### Payments too small

For amounts < 1000 msat, LND would error `NO_ROUTE_FOUND`. Zeus app more
helpfully suggests that this may be because the amount is too small.
