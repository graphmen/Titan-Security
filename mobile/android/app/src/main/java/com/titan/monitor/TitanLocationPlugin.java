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
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
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

    private static final float EXCEPTIONAL_ACCURACY_METERS = 3f;

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

    /** Watch GPS with warmup + stabilization until accuracy meets maxAccuracyMeters. */
    @PluginMethod
    public void getHighAccuracyPosition(PluginCall call) {
        if (!hasFineLocation()) {
            requestPermissionForAlias("location", call, "highAccuracyPermsCallback");
            return;
        }
        float maxAccuracy = call.getFloat("maxAccuracyMeters", 5f);
        int timeoutMs = call.getInt("timeoutMs", 60000);
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
        float maxAccuracy = call.getFloat("maxAccuracyMeters", 5f);
        int timeoutMs = call.getInt("timeoutMs", 60000);
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

    /**
     * High-accuracy capture: GPS-only, warmup period, then stabilization window
     * requiring multiple good samples before returning the best fix.
     */
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

        final long warmupMs = call.getInt("warmupMs", 10000);
        final long stabilizeMs = call.getInt("stabilizeMs", 6000);
        final int minSamples = call.getInt("minSamples", 3);
        final long startMs = System.currentTimeMillis();

        Handler handler = new Handler(Looper.getMainLooper());
        AtomicReference<Location> bestOverall = new AtomicReference<>();
        AtomicReference<Location> bestQualified = new AtomicReference<>();
        AtomicInteger qualifiedCount = new AtomicInteger(0);
        AtomicBoolean stabilizeScheduled = new AtomicBoolean(false);
        AtomicBoolean resolved = new AtomicBoolean(false);

        LocationListener listener = new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                if (resolved.get() || !location.hasAccuracy()) return;

                Location current = bestOverall.get();
                if (current == null || location.getAccuracy() < current.getAccuracy()) {
                    bestOverall.set(location);
                }

                long elapsed = System.currentTimeMillis() - startMs;
                boolean pastWarmup = elapsed >= warmupMs;
                boolean exceptional = location.getAccuracy() <= EXCEPTIONAL_ACCURACY_METERS;

                if (!pastWarmup && !exceptional) {
                    return;
                }

                if (location.getAccuracy() > maxAccuracyMeters) {
                    return;
                }

                qualifiedCount.incrementAndGet();
                Location bestQ = bestQualified.get();
                if (bestQ == null || location.getAccuracy() < bestQ.getAccuracy()) {
                    bestQualified.set(location);
                }

                if (stabilizeScheduled.compareAndSet(false, true)) {
                    handler.postDelayed(() -> finishStabilized(
                        call, lm, this, handler, resolved, bestOverall, bestQualified,
                        qualifiedCount, maxAccuracyMeters, minSamples
                    ), stabilizeMs);
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
            if (resolved.get()) return;
            resolved.set(true);
            lm.removeUpdates(listener);
            handler.removeCallbacksAndMessages(null);
            rejectWithBest(call, bestOverall.get(), maxAccuracyMeters);
        };

        handler.postDelayed(onTimeout, timeoutMs);
        lm.requestLocationUpdates(
            LocationManager.GPS_PROVIDER, 1000L, 0f, listener, Looper.getMainLooper()
        );
    }

    private void finishStabilized(
        PluginCall call,
        LocationManager lm,
        LocationListener listener,
        Handler handler,
        AtomicBoolean resolved,
        AtomicReference<Location> bestOverall,
        AtomicReference<Location> bestQualified,
        AtomicInteger qualifiedCount,
        float maxAccuracyMeters,
        int minSamples
    ) {
        if (resolved.get()) return;
        resolved.set(true);
        lm.removeUpdates(listener);
        handler.removeCallbacksAndMessages(null);

        Location pick = bestQualified.get();
        int count = qualifiedCount.get();

        if (pick != null && pick.getAccuracy() <= maxAccuracyMeters && count >= minSamples) {
            resolveLocation(call, pick);
            return;
        }

        if (pick != null && pick.getAccuracy() <= maxAccuracyMeters) {
            int acc = Math.round(pick.getAccuracy());
            call.reject(
                "GPS still settling — got ±" + acc + "m but need " + minSamples
                    + " stable readings. Hold still in open sky 15–20s and retry."
            );
            return;
        }

        rejectWithBest(call, bestOverall.get(), maxAccuracyMeters);
    }

    private void rejectWithBest(PluginCall call, Location best, float maxAccuracyMeters) {
        if (best != null && best.hasAccuracy()) {
            int acc = Math.round(best.getAccuracy());
            int target = Math.round(maxAccuracyMeters);
            call.reject(
                "GPS accuracy ±" + acc + "m — need ±" + target
                    + "m or better. Move to open sky, hold still 15–20s, and retry."
            );
        } else {
            call.reject("Could not get a GPS fix — enable location and try outdoors");
        }
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
