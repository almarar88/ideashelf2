package com.rafeeq.companion.data.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.rafeeq.companion.core.Net
import com.rafeeq.companion.data.Place
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import java.net.URLEncoder

/**
 * تحديد الموقع بدون الاعتماد على خدمات جوجل — نستخدم [LocationManager] فقط،
 * ما يجعل التطبيق يعمل على كل الأجهزة بما فيها التي بلا Google Play.
 */
class LocationRepository(private val context: Context) {

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /** يحاول الحصول على الموقع الحالي، ثم يُترجمه إلى اسم مدينة. */
    @SuppressLint("MissingPermission")
    suspend fun currentPlace(): Place? {
        if (!hasPermission()) return null
        val location = lastKnown() ?: freshFix() ?: return null
        return reverseGeocode(location.latitude, location.longitude)
            ?: Place(
                name = "موقعي",
                latitude = location.latitude,
                longitude = location.longitude,
                elevation = if (location.hasAltitude()) location.altitude else 0.0,
            )
    }

    @SuppressLint("MissingPermission")
    private fun lastKnown(): Location? {
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
        val providers = runCatching { manager.getProviders(true) }.getOrDefault(emptyList())
        return providers.mapNotNull { runCatching { manager.getLastKnownLocation(it) }.getOrNull() }
            .filter { System.currentTimeMillis() - it.time < 2 * 60 * 60 * 1000L }
            .maxByOrNull { it.accuracy.let { a -> if (a <= 0f) Float.MAX_VALUE else -a } }
    }

    @SuppressLint("MissingPermission")
    private suspend fun freshFix(): Location? = withTimeoutOrNull(12_000L) {
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return@withTimeoutOrNull null
        val provider = when {
            manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            else -> return@withTimeoutOrNull null
        }
        try {
            suspendCancellableCoroutine { cont ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val signal = android.os.CancellationSignal()
                    cont.invokeOnCancellation { runCatching { signal.cancel() } }
                    manager.getCurrentLocation(
                        provider, signal, context.mainExecutor,
                    ) { loc -> if (cont.isActive) cont.resumeWith(Result.success(loc)) }
                } else {
                    @Suppress("DEPRECATION")
                    val listener = object : android.location.LocationListener {
                        override fun onLocationChanged(location: Location) {
                            manager.removeUpdates(this)
                            if (cont.isActive) cont.resumeWith(Result.success(location))
                        }
                        override fun onProviderDisabled(provider: String) {}
                        override fun onProviderEnabled(provider: String) {}
                        @Deprecated("Deprecated in Java")
                        override fun onStatusChanged(p: String?, s: Int, e: android.os.Bundle?) {}
                    }
                    cont.invokeOnCancellation { runCatching { manager.removeUpdates(listener) } }
                    manager.requestLocationUpdates(provider, 0L, 0f, listener, context.mainLooper)
                }
            }
        } catch (_: TimeoutCancellationException) {
            null
        } catch (_: SecurityException) {
            null
        }
    }

    /** بحث عن مدينة بالاسم — Open‑Meteo Geocoding (مجاني، بلا مفتاح). */
    suspend fun search(query: String): List<Place> = withContext(Dispatchers.IO) {
        if (query.isBlank()) return@withContext emptyList()
        val encoded = URLEncoder.encode(query.trim(), "UTF-8")
        val url = "https://geocoding-api.open-meteo.com/v1/search" +
            "?name=$encoded&count=10&language=ar&format=json"
        runCatching {
            val dto = Net.json.decodeFromString(GeoResponse.serializer(), Net.text(url))
            dto.results.orEmpty().map {
                Place(
                    name = it.name,
                    country = it.country.orEmpty(),
                    admin = it.admin1.orEmpty(),
                    latitude = it.latitude,
                    longitude = it.longitude,
                    timezone = it.timezone.orEmpty(),
                    elevation = it.elevation ?: 0.0,
                )
            }
        }.getOrDefault(emptyList())
    }

    /** تحويل الإحداثيات إلى اسم مكان — BigDataCloud (مجاني، بلا مفتاح). */
    suspend fun reverseGeocode(latitude: Double, longitude: Double): Place? =
        withContext(Dispatchers.IO) {
            val url = "https://api.bigdatacloud.net/data/reverse-geocode-client" +
                "?latitude=$latitude&longitude=$longitude&localityLanguage=ar"
            runCatching {
                val dto = Net.json.decodeFromString(ReverseDto.serializer(), Net.text(url))
                val name = listOfNotNull(dto.city, dto.locality, dto.principalSubdivision)
                    .firstOrNull { it.isNotBlank() } ?: "موقعي"
                Place(
                    name = name,
                    country = dto.countryName.orEmpty(),
                    admin = dto.principalSubdivision.orEmpty(),
                    latitude = latitude,
                    longitude = longitude,
                )
            }.getOrNull()
        }

    @Serializable
    private data class GeoResponse(val results: List<GeoResult>? = null)

    @Serializable
    private data class GeoResult(
        val name: String,
        val latitude: Double,
        val longitude: Double,
        val country: String? = null,
        val admin1: String? = null,
        val timezone: String? = null,
        val elevation: Double? = null,
    )

    @Serializable
    private data class ReverseDto(
        val city: String? = null,
        val locality: String? = null,
        val principalSubdivision: String? = null,
        val countryName: String? = null,
    )
}
