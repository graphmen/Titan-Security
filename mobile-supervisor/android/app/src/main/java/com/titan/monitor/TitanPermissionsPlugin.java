package com.titan.monitor;

import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "TitanPermissions",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class TitanPermissionsPlugin extends Plugin {

    @PluginMethod
    public void checkMicrophone(PluginCall call) {
        call.resolve(micStatus());
    }

    @PluginMethod
    public void requestMicrophone(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            call.resolve(micStatus());
            return;
        }
        requestPermissionForAlias("microphone", call, "micCallback");
    }

    @PermissionCallback
    private void micCallback(PluginCall call) {
        call.resolve(micStatus());
    }

    private JSObject micStatus() {
        boolean granted = ActivityCompat.checkSelfPermission(
            getContext(), Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED;
        JSObject ret = new JSObject();
        ret.put("microphone", granted ? "granted" : getPermissionState("microphone").toString().toLowerCase());
        ret.put("granted", granted);
        return ret;
    }
}
