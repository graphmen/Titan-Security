'use client';

import React, { useState } from 'react';
import { X, Copy, Check, MessageCircle, User } from 'lucide-react';

export default function PinDeliveryModal({ open, data, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!open || !data?.pin) return null;

  const { pin, label, guardName, phone, waLink, sent, channel, error } = data;
  const channelLabel = channel === 'sms' ? 'SMS' : 'WhatsApp';

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this PIN:', pin);
    }
  };

  return (
    <div
      className="pin-delivery-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-delivery-title"
    >
      <div className="pin-delivery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pin-delivery-header">
          <div>
            <h3 id="pin-delivery-title">{label || 'Guard login PIN'}</h3>
            {sent ? (
              <p className="pin-delivery-status is-sent">Delivered via {channelLabel} to {phone}</p>
            ) : error ? (
              <p className="pin-delivery-status is-error">Auto-send failed — use manual delivery below</p>
            ) : (
              <p className="pin-delivery-status">Share this PIN with the guard — no SMS API required</p>
            )}
          </div>
          <button type="button" className="pin-delivery-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {(guardName || phone) && (
          <div className="pin-delivery-guard">
            <User size={14} />
            <span>
              {guardName || 'Guard'}
              {phone ? ` · ${phone}` : ''}
            </span>
          </div>
        )}

        <div className="pin-delivery-pin-block">
          <span className="pin-delivery-pin-label">6-digit login PIN</span>
          <div className="pin-delivery-pin">{pin}</div>
          <button type="button" className="btn-secondary pin-delivery-copy" onClick={copyPin}>
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy PIN</>}
          </button>
        </div>

        {!sent && (
          <div className="pin-delivery-steps">
            <strong>How to deliver (works in Zimbabwe)</strong>
            <ol>
              <li>WhatsApp should have opened with the PIN message — tap <em>Send</em> on your phone.</li>
              <li>Or tell the guard the PIN in person / phone call.</li>
              <li>Guard opens Titan Monitor app and enters this PIN on first login.</li>
            </ol>
          </div>
        )}

        <div className="pin-delivery-actions">
          {waLink && !sent && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary pin-delivery-wa"
            >
              <MessageCircle size={14} /> Open WhatsApp again
            </a>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>

        {!sent && (
          <p className="pin-delivery-note">
            Meta and Twilio SMS codes often do not reach +263 numbers. Manual WhatsApp or in-person PIN delivery is the reliable path for now.
          </p>
        )}
      </div>
    </div>
  );
}
