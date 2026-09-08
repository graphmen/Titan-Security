package com.titan.monitor;

import android.app.Activity;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.os.Bundle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "TitanNfc")
public class TitanNfcPlugin extends Plugin {

    private NfcAdapter nfcAdapter;
    private boolean scanning = false;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        nfcAdapter = NfcAdapter.getDefaultAdapter(getContext());
        JSObject ret = new JSObject();
        ret.put("supported", nfcAdapter != null);
        ret.put("enabled", nfcAdapter != null && nfcAdapter.isEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void startScan(PluginCall call) {
        nfcAdapter = NfcAdapter.getDefaultAdapter(getContext());
        if (nfcAdapter == null) {
            call.reject("NFC not supported on this device");
            return;
        }
        if (!nfcAdapter.isEnabled()) {
            call.reject("NFC is disabled — enable it in phone Settings");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        if (scanning) {
            call.resolve();
            return;
        }

        scanning = true;
        Bundle extras = new Bundle();
        extras.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250);

        nfcAdapter.enableReaderMode(
            activity,
            this::onTagDiscovered,
            NfcAdapter.FLAG_READER_NFC_A
                | NfcAdapter.FLAG_READER_NFC_B
                | NfcAdapter.FLAG_READER_NFC_F
                | NfcAdapter.FLAG_READER_NFC_V
                | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            extras
        );
        call.resolve();
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        stopReaderMode();
        call.resolve();
    }

    private void onTagDiscovered(Tag tag) {
        if (tag == null) return;

        String tagId = bytesToHex(tag.getId());
        String ndefText = readNdefText(tag);

        JSObject payload = new JSObject();
        payload.put("tagId", tagId);
        if (ndefText != null && !ndefText.isEmpty()) {
            payload.put("ndefText", ndefText);
        }
        notifyListeners("nfcTag", payload);
    }

    private String readNdefText(Tag tag) {
        Ndef ndef = Ndef.get(tag);
        if (ndef == null) return null;
        try {
            ndef.connect();
            android.nfc.NdefMessage message = ndef.getNdefMessage();
            ndef.close();
            if (message == null) return null;
            for (android.nfc.NdefRecord record : message.getRecords()) {
                if (record.getTnf() == android.nfc.NdefRecord.TNF_WELL_KNOWN
                    && java.util.Arrays.equals(record.getType(), android.nfc.NdefRecord.RTD_TEXT)) {
                    byte[] payload = record.getPayload();
                    if (payload.length > 1) {
                        int langLen = payload[0] & 0x3F;
                        return new String(payload, 1 + langLen, payload.length - 1 - langLen, StandardCharsets.UTF_8);
                    }
                }
            }
        } catch (Exception ignored) {
            // UID is enough for patrol matching
        }
        return null;
    }

    private static String bytesToHex(byte[] bytes) {
        if (bytes == null) return "";
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    private void stopReaderMode() {
        scanning = false;
        Activity activity = getActivity();
        if (nfcAdapter != null && activity != null) {
            nfcAdapter.disableReaderMode(activity);
        }
    }

    @Override
    protected void handleOnPause() {
        stopReaderMode();
    }
}
