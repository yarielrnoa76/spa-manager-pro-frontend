import React from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * Encodes exactly the canonical hosted URL the caller passes -- never infers or reconstructs one
 * itself (§11 of the B3 contract: "El frontend nunca inventa la Hosted URL"). Client-side only
 * (`qrcode.react`'s `QRCodeSVG`), no network call, no tenant/branch/internal id ever touches it.
 */
const QrCodeDisplay: React.FC<{ value: string; size?: number }> = ({ value, size = 160 }) => (
  <div className="inline-flex flex-col items-center gap-2 p-3 bg-white border rounded-xl">
    <QRCodeSVG value={value} size={size} level="M" role="img" aria-label="Código QR del formulario" />
  </div>
);

export default QrCodeDisplay;
