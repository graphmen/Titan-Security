package com.titan.monitor;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends BridgeActivity {
    private static final int WEB_PERMISSION_REQUEST = 9100;
    private PermissionRequest pendingWebPermissionRequest;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkInstallerPlugin.class);
        registerPlugin(TitanLocationPlugin.class);
        registerPlugin(TitanPermissionsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        Bridge bridge = getBridge();
        if (bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView == null) return;

        WebChromeClient existing = webView.getWebChromeClient();
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (existing != null) {
                    existing.onProgressChanged(view, newProgress);
                }
            }
        });
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        Set<String> needed = new LinkedHashSet<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                    != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.RECORD_AUDIO);
                }
            }
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                    != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.CAMERA);
                }
            }
        }

        if (needed.isEmpty()) {
            request.grant(request.getResources());
            return;
        }

        pendingWebPermissionRequest = request;
        ActivityCompat.requestPermissions(
            this,
            needed.toArray(new String[0]),
            WEB_PERMISSION_REQUEST
        );
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != WEB_PERMISSION_REQUEST || pendingWebPermissionRequest == null) {
            return;
        }

        PermissionRequest request = pendingWebPermissionRequest;
        pendingWebPermissionRequest = null;

        boolean allGranted = grantResults != null && grantResults.length > 0;
        if (allGranted) {
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
        } else {
            allGranted = false;
        }

        if (allGranted) {
            request.grant(request.getResources());
        } else {
            request.deny();
        }
    }
}
