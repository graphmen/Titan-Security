package com.titan.monitor;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
    name = "TitanLocation",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        )
    }
)
public class TitanLocationPlugin extends Plugin {

    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermsCallback");
            return;
        }
        fetchLocation(call);
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission denied — enable GPS in your phone Settings");
            return;
        }
        fetchLocation(call);
    }

    private void fetchLocation(PluginCall call) {
        Context ctx = getContext();
        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) {
            call.reject("GPS unavailable on this device");
            return;
        }

        boolean gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        boolean networkEnabled = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        if (!gpsEnabled && !networkEnabled) {
            call.reject("GPS is off — enable location services in Settings");
            return;
        }

        if (ActivityCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
            && ActivityCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Location permission denied");
            return;
        }

        Location last = null;
        if (gpsEnabled) {
            last = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        }
        if (last == null && networkEnabled) {
            last = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
        }

        if (last != null && System.currentTimeMillis() - last.getTime() < 60000) {
            resolveLocation(call, last);
            return;
        }

        String provider = gpsEnabled ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
        Handler handler = new Handler(Looper.getMainLooper());
        Location finalLast = last;

        Runnable timeout = () -> {
            Location fallback = finalLast;
            if (fallback == null && networkEnabled) {
                fallback = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
            if (fallback != null) {
                resolveLocation(call, fallback);
            } else {
                call.reject("GPS timed out — move to an open area and try again");
            }
        };
        handler.postDelayed(timeout, 20000);

        LocationListener listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                handler.removeCallbacks(timeout);
                lm.removeUpdates(this);
                resolveLocation(call, location);
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}

            @Override
            public void onProviderEnabled(String provider) {}

            @Override
            public void onProviderDisabled(String provider) {}
        };

        lm.requestSingleUpdate(provider, listener, Looper.getMainLooper());
    }

    private void resolveLocation(PluginCall call, Location loc) {
        JSObject coords = new JSObject();
        coords.put("latitude", loc.getLatitude());
        coords.put("longitude", loc.getLongitude());
        coords.put("accuracy", loc.getAccuracy());
        JSObject ret = new JSObject();
        ret.put("coords", coords);
        call.resolve(ret);
    }
}
