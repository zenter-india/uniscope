package com.uniscope.uniscope_mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps an audio call alive while the app is backgrounded or the phone is
 * locked. Agora's engine runs in the main process; without a foreground
 * service Android throttles the mic and can kill the process a minute or
 * two after the app leaves the foreground, which drops the call silently.
 *
 * The notification is ongoing (non-dismissible), shows a live chronometer
 * from the call's start time, opens the app on tap, and carries an
 * "End call" action that routes back into MainActivity so the Flutter side
 * can tear the call down cleanly (see MainActivity's `uniscope/call`
 * channel and CallScreen).
 *
 * Started/stopped over that same MethodChannel from CallScreen — never
 * on its own. Hand-rolled rather than via a plugin for the same reason as
 * the mic-permission channel (see MainActivity's doc comment).
 */
class CallForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "uniscope_ongoing_call"
        const val NOTIF_ID = 4207

        const val ACTION_START = "com.uniscope.call.START"
        const val ACTION_STOP = "com.uniscope.call.STOP"
        const val ACTION_END_CALL = "com.uniscope.call.END_CALL"

        const val EXTRA_PEER = "peer"
        const val EXTRA_STARTED_AT = "startedAtMillis"

        /** MainActivity checks for this on the launch/new intent to tell
         *  Flutter the call was ended from the notification. */
        const val EXTRA_END_FROM_NOTIFICATION = "uniscope_end_call"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelfCompat()
                return START_NOT_STICKY
            }
            ACTION_END_CALL -> {
                val bringBack = Intent(this, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    putExtra(EXTRA_END_FROM_NOTIFICATION, true)
                }
                startActivity(bringBack)
                stopSelfCompat()
                return START_NOT_STICKY
            }
        }

        val peer = intent?.getStringExtra(EXTRA_PEER)?.takeIf { it.isNotBlank() } ?: "your mentor"
        val startedAt = intent?.getLongExtra(EXTRA_STARTED_AT, System.currentTimeMillis())
            ?: System.currentTimeMillis()

        val notification = buildNotification(peer, startedAt)
        // FOREGROUND_SERVICE_TYPE_MICROPHONE (and the 3-arg overload taking a
        // type) is API 30+. Below that a plain foreground service still keeps
        // the process alive.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTIF_ID, notification)
        }
        return START_STICKY
    }

    private fun stopSelfCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    private fun buildNotification(peer: String, startedAtMillis: Long): Notification {
        ensureChannel()

        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val endCall = PendingIntent.getService(
            this,
            1,
            Intent(this, CallForegroundService::class.java).setAction(ACTION_END_CALL),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_speakerphone)
            .setContentTitle("On call with $peer")
            .setContentText("Tap to return to the call")
            .setUsesChronometer(true)
            .setWhen(startedAtMillis)
            .setShowWhen(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openApp)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End call", endCall)
            .build()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Ongoing call",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Shows while an audio call is in progress"
            setShowBadge(false)
            setSound(null, null)
            enableVibration(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
