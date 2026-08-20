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
import java.util.concurrent.atomic.AtomicReference;

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
    public void checkPermissions(PluginCall call) {
        call.resolve(permissionStatus());
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (hasFineLocation()) {
            call.resolve(permissionStatus());
            return;
        }
        requestPermissionForAlias("location", call, "requestOnlyCallback");
    }

    @PermissionCallback
    private void requestOnlyCallback(PluginCall call) {
        call.resolve(permissionStatus());
    }

    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        if (!hasFineLocation()) {
            requestPermissionForAlias("location", call, "locationPermsCallback");
            return;
        }
        fetchLocationQuick(call);
    }

    /** Watch GPS until accuracy meets maxAccuracyMeters (premise capture / clock-in). */
    @PluginMethod
    public void getHighAccuracyPosition(PluginCall call) {
        if (!hasFineLocation()) {
            requestPermissionForAlias("location", call, "highAccuracyPermsCallback");
            return;
        }
        float maxAccuracy = call.getFloat("maxAccuracyMeters", 15f);
        int timeoutMs = call.getInt("timeoutMs", 45000);
        watchForBestAccuracy(call, maxAccuracy, timeoutMs);
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        if (!hasFineLocation()) {
            call.reject("Precise location permission denied — enable GPS in your phone Settings");
            return;
        }
        fetchLocationQuick(call);
    }

    @PermissionCallback
    private void highAccuracyPermsCallback(PluginCall call) {
        if (!hasFineLocation()) {
            call.reject("Precise location permission denied — enable GPS in your phone Settings");
            return;
        }
        float maxAccuracy = call.getFloat("maxAccuracyMeters", 15f);
        int timeoutMs = call.getInt("timeoutMs", 45000);
        watchForBestAccuracy(call, maxAccuracy, timeoutMs);
    }

    private boolean hasFineLocation() {
        return ActivityCompat.checkSelfPermission(
            getContext(), Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private void fetchLocationQuick(PluginCall call) {
        Context ctx = getContext();
        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) {
            call.reject("GPS unavailable on this device");
            return;
        }

        if (!lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            call.reject("GPS is off — enable location services in Settings");
            return;
        }

        Location last = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        if (last != null && last.hasAccuracy() && last.getAccuracy() <= 25f
            && System.currentTimeMillis() - last.getTime() < 30000) {
            resolveLocation(call, last);
            return;
        }

        Handler handler = new Handler(Looper.getMainLooper());
        LocationListener listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                handler.removeCallbacksAndMessages(null);
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

        handler.postDelayed(() -> {
            lm.removeUpdates(listener);
            if (last != null) {
                resolveLocation(call, last);
            } else {
                call.reject("GPS timed out — move to an open area and try again");
            }
        }, 20000);

        lm.requestLocationUpdates(
            LocationManager.GPS_PROVIDER, 500L, 0f, listener, Looper.getMainLooper()
        );
    }

    private void watchForBestAccuracy(PluginCall call, float maxAccuracyMeters, long timeoutMs) {
        Context ctx = getContext();
        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) {
            call.reject("GPS unavailable on this device");
            return;
        }

        if (!lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            call.reject("GPS is off — enable location services in Settings");
            return;
        }

        Location cached = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
        if (cached != null && cached.hasAccuracy() && cached.getAccuracy() <= maxAccuracyMeters
            && System.currentTimeMillis() - cached.getTime() < 15000) {
            resolveLocation(call, cached);
            return;
        }

        Handler handler = new Handler(Looper.getMainLooper());
        AtomicReference<Location> bestRef = new AtomicReference<>();

        LocationListener listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (!location.hasAccuracy()) return;
                Location current = bestRef.get();
                if (current == null || location.getAccuracy() < current.getAccuracy()) {
                    bestRef.set(location);
                }
                if (location.getAccuracy() <= maxAccuracyMeters) {
                    handler.removeCallbacksAndMessages(null);
                    lm.removeUpdates(this);
                    resolveLocation(call, location);
                }
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}

            @Override
            public void onProviderEnabled(String provider) {}

            @Override
            public void onProviderDisabled(String provider) {}
        };

        Runnable onTimeout = () -> {
            lm.removeUpdates(listener);
            Location best = bestRef.get();
            if (best != null && best.hasAccuracy()) {
                int acc = Math.round(best.getAccuracy());
                int target = Math.round(maxAccuracyMeters);
                call.reject(
                    "GPS accuracy ±" + acc + "m — need ±" + target
                        + "m or better. Move to open sky and retry."
                );
            } else {
                call.reject("Could not get a GPS fix — enable location and try outdoors");
            }
        };

        handler.postDelayed(onTimeout, timeoutMs);
        lm.requestLocationUpdates(
            LocationManager.GPS_PROVIDER, 500L, 0f, listener, Looper.getMainLooper()
        );
    }

    private void resolveLocation(PluginCall call, Location loc) {
        JSObject coords = new JSObject();
        coords.put("latitude", loc.getLatitude());
        coords.put("longitude", loc.getLongitude());
        coords.put("accuracy", loc.hasAccuracy() ? loc.getAccuracy() : null);
        JSObject ret = new JSObject();
        ret.put("coords", coords);
        call.resolve(ret);
    }

    private JSObject permissionStatus() {
        JSObject ret = new JSObject();
        String status = hasFineLocation() ? "granted" : getPermissionState("location").toString().toLowerCase();
        ret.put("location", status);
        return ret;
    }
}
