package com.uniscope.uniscope_mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.WindowManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Hand-rolled native channels — permission_handler's platform channel never
 * binds on this project's AGP 9 / Kotlin 2.3 toolchain (plugin registers
 * without error, but the Dart side still gets MissingPluginException on
 * every call). Bypassing plugins entirely here is simpler than chasing that
 * incompatibility, and the same reasoning applies to the call foreground
 * service (see CallForegroundService.kt).
 *
 * - `uniscope/permissions`: runtime mic + notification permission, open settings.
 * - `uniscope/call`: start/stop the ongoing-call foreground service, keep the
 *   screen awake during a call, and deliver the "End call" tap from the
 *   notification back to Flutter.
 */
class MainActivity : FlutterActivity() {
    private val permissionsChannelName = "uniscope/permissions"
    private val callChannelName = "uniscope/call"

    private val micRequestCode = 4201
    private val notifRequestCode = 4202
    private var pendingMicResult: MethodChannel.Result? = null

    private var callChannel: MethodChannel? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val messenger = flutterEngine.dartExecutor.binaryMessenger

        MethodChannel(messenger, permissionsChannelName).setMethodCallHandler { call, result ->
            when (call.method) {
                "requestMicrophone" -> {
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
                        PackageManager.PERMISSION_GRANTED
                    ) {
                        result.success(true)
                    } else {
                        pendingMicResult = result
                        ActivityCompat.requestPermissions(
                            this,
                            arrayOf(Manifest.permission.RECORD_AUDIO),
                            micRequestCode,
                        )
                    }
                }
                "requestNotifications" -> {
                    // Android 13+ only — below that the notification shows without a runtime grant.
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
                        PackageManager.PERMISSION_GRANTED
                    ) {
                        ActivityCompat.requestPermissions(
                            this,
                            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                            notifRequestCode,
                        )
                    }
                    result.success(null)
                }
                "openAppSettings" -> {
                    startActivity(
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.fromParts("package", packageName, null)
                        },
                    )
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }

        callChannel = MethodChannel(messenger, callChannelName).also { channel ->
            channel.setMethodCallHandler { call, result ->
                when (call.method) {
                    "startCallService" -> {
                        val intent = Intent(this, CallForegroundService::class.java).apply {
                            action = CallForegroundService.ACTION_START
                            putExtra(CallForegroundService.EXTRA_PEER, call.argument<String>("peer"))
                            call.argument<Number>("startedAtMillis")?.let {
                                putExtra(CallForegroundService.EXTRA_STARTED_AT, it.toLong())
                            }
                        }
                        ContextCompat.startForegroundService(this, intent)
                        result.success(null)
                    }
                    "stopCallService" -> {
                        startService(
                            Intent(this, CallForegroundService::class.java)
                                .setAction(CallForegroundService.ACTION_STOP),
                        )
                        result.success(null)
                    }
                    "keepScreenOn" -> {
                        val on = call.arguments as? Boolean ?: false
                        runOnUiThread {
                            if (on) {
                                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                            } else {
                                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                            }
                        }
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
        }

        // A cold start via the notification's "End call" action.
        maybeReportEndFromNotification(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        maybeReportEndFromNotification(intent)
    }

    private fun maybeReportEndFromNotification(intent: Intent?) {
        if (intent?.getBooleanExtra(CallForegroundService.EXTRA_END_FROM_NOTIFICATION, false) == true) {
            intent.removeExtra(CallForegroundService.EXTRA_END_FROM_NOTIFICATION)
            callChannel?.invokeMethod("endCall", null)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        if (requestCode == micRequestCode) {
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            pendingMicResult?.success(granted)
            pendingMicResult = null
        } else {
            super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        }
    }
}
