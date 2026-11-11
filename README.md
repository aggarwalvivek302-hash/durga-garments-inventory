# Durga Garments Inventory Management

A responsive inventory workspace for a garments business. It supports color/size variant catalogs, generated SKUs and Code 128 barcodes, stock IN/OUT audit records, low-stock tracking, transaction history, and CSV import/export.

## Run locally

1. Install Node.js 18 or newer.
2. In this folder, run:

   ```bash
   npm install
   npm run dev
   ```

3. Open the local URL printed by Vite.

## Barcode scanning

- Tap **Scan barcode** to open the camera scanner. The app requests the environment-facing camera where the browser supports it; closing the scanner stops its camera stream.
- A USB/Bluetooth scanner that types barcode digits works in the Stock movements search field. Focus the field, scan, then press Enter.
- Camera access requires browser permission and a secure context (HTTPS, or localhost). Camera hardware and browser permission behavior vary by device.
- Product labels use Code 128 barcodes and can be printed from the catalog.

## CSV format

CSV import accepts a header row with `Product` or `Name` and optionally `Category`, `Brand`, `Color`, `Size`, `SKU`, `Barcode`, `Stock` or `Opening Stock`, `Minimum Stock`, `Purchase Price`, `Selling Price`, `Discount Price`, and `GST %`. Imported opening quantities are recorded as stock-IN transactions.

Exports include product variants, barcode, current stock, minimum stock, prices, and GST rate.

## Data and production readiness

This starter persists data in the current browser's localStorage. It is suitable for a local prototype, not for concurrent staff, cross-device synchronization, role-based permissions, or production audit/security requirements. A production deployment needs authenticated users, server-side authorization, and a shared database/API (for example PostgreSQL) as the central source of truth. GST values are stored for reference and do not replace tax/accounting validation.
