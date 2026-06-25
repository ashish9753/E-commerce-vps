# Fonepay Checkout Intent integration

Online payments use the **Fonepay Checkout Intent** gateway (dynamic QR), per
Fonepay's *Web Checkout Intent Flow* merchant spec v1.9. This replaced the old
manual flow (static QR + screenshot upload + admin verification) — payments now
confirm **automatically**.

## Flow

1. Customer places the order (it starts `PENDING`).
2. Frontend calls `POST /api/v1/payments/fonepay/:orderId/qr` → backend logs in
   to Fonepay (oAuth), calls `generate-intent-qr`, and returns a scannable QR.
3. Customer scans + pays from any banking / wallet app.
4. Settlement happens two ways (whichever fires first):
   - **WebSocket** — the backend connects to Fonepay's per-transaction socket
     (`services/fonepayWatcher.js`) for an instant push, then verifies.
   - **Polling** — the frontend polls `GET /payments/fonepay/:orderId/status`,
     which calls Fonepay's status API on demand.
   Both funnel through `settleFonepayPayment()`, which **re-verifies against the
   status API**, checks the amount, and flips the order to `PAID` exactly once
   (atomic claim — no double crediting).

Two payment "purposes" share this machinery:
- `full` → the whole ONLINE order amount → `order.paymentStatus = PAID`
- `booking` → the COD non-refundable advance → `order.codBookingStatus = PAID`

## Configuration (`.env`)

| Var | Required | Notes |
|-----|----------|-------|
| `FONEPAY_BASE_URL` | yes | UAT: `https://uat-new-merchant-api.fonepay.com` |
| `FONEPAY_USERNAME` | yes | oAuth username from Fonepay |
| `FONEPAY_PASSWORD` | yes | oAuth password from Fonepay |
| `FONEPAY_TERMINAL_ID` | yes | merchant terminal id / PAN (max 16 chars) |
| `FONEPAY_PRIVATE_KEY` | yes | client RSA private key (PEM); one line, `\n`-escaped |
| `FONEPAY_SIGN_ALGO` | no | signing hash, default `RSA-SHA256` |
| `FONEPAY_WS_ENABLED` | no | `false` disables the live WebSocket watcher (polling still works) |

Until all required vars are set, online payment cleanly reports
"temporarily unavailable" instead of erroring.

## Verifying your credentials

```
node scripts/fonepay-smoke.js
```

Runs oAuth login → generate a Rs. 1 Intent QR → status check. No money moves.
A green "All Fonepay calls succeeded" means the credentials + signing key work.

## Key files

- `src/services/fonepay.service.js` — HTTP client: signing, oAuth, QR, status, banks
- `src/services/fonepayWatcher.js` — live WebSocket settlement (best-effort)
- `src/controllers/payment.controller.js` — QR creation + idempotent settlement
- `src/routes/payment.routes.js` — `/payments/fonepay/...` routes
- Frontend: `src/components/FonepayCheckout.jsx`, `src/api/payments.js`
