'use client';

import React, { useState } from 'react';
import { X, Copy, Check, MessageCircle, User, Mail } from 'lucide-react';

export default function PinDeliveryModal({ open, data, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!open || !data?.pin) return null;

  const {
    pin,
    label,
    guardName,
    phone,
    email,
    waLink,
    sent,
    emailSent,
    waSent,
    channel,
    error,
    emailNote,
  } = data;

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this PIN:', pin);
    }
  };

  const statusLine = () => {
    if (emailSent) return `PIN emailed to ${email}`;
    if (waSent) return `PIN sent via ${channel === 'sms' ? 'SMS' : 'WhatsApp'} to ${phone}`;
    if (error && emailNote) return emailNote;
    if (error) return 'Auto-send failed — share the PIN manually below';
    return 'Share this PIN with the guard for mobile app login';
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
            <p className={`pin-delivery-status ${sent ? 'is-sent' : error ? 'is-error' : ''}`}>
              {statusLine()}
            </p>
          </div>
          <button type="button" className="pin-delivery-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {(guardName || email || phone) && (
          <div className="pin-delivery-guard">
            <User size={14} />
            <span>
              {guardName || 'Guard'}
              {email ? ` · ${email}` : phone ? ` · ${phone}` : ''}
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

        {!emailSent && (
          <div className="pin-delivery-steps">
            <strong>How to deliver</strong>
            <ol>
              {email && !emailSent && (
                <li>Configure Resend in the Email tab if the PIN email did not arrive.</li>
              )}
              {waLink && !waSent && (
                <li>WhatsApp may have opened — tap <em>Send</em>, or use the button below.</li>
              )}
              <li>Guard opens <strong>Titan Monitor</strong> and enters this PIN.</li>
              <li>On first login they choose a new PIN.</li>
            </ol>
          </div>
        )}

        {emailSent && (
          <div className="pin-delivery-email-sent">
            <Mail size={16} />
            <span>Check the guard&apos;s inbox (and spam folder) for the PIN email.</span>
          </div>
        )}

        <div className="pin-delivery-actions">
          {waLink && !waSent && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary pin-delivery-wa"
            >
              <MessageCircle size={14} /> Open WhatsApp
            </a>
          )}
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
