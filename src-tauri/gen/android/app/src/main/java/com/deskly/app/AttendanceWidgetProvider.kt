package com.deskly.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File

class AttendanceWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_UPDATE_WIDGET = "com.deskly.app.ACTION_UPDATE_WIDGET"
        private const val PREFS_NAME = "deskly_widget_data"

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, AttendanceWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            val provider = AttendanceWidgetProvider()
            provider.onUpdate(context, appWidgetManager, allWidgetIds)
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val widgetData = loadWidgetData(context)

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_attendance_small)

            if (widgetData != null) {
                val pct = widgetData.percentage
                val attended = widgetData.attended
                val total = widgetData.total
                val pctNumber = String.format(java.util.Locale.US, "%.1f", pct)

                views.setTextViewText(R.id.tv_attendance_pct, pctNumber)
                views.setTextViewText(R.id.tv_pct_symbol, "%")
                views.setTextViewText(R.id.tv_attendance_classes, "$attended / $total")
                views.setProgressBar(R.id.pb_attendance, 100, pct.toInt().coerceIn(0, 100), false)
            } else {
                views.setTextViewText(R.id.tv_attendance_pct, "--")
                views.setTextViewText(R.id.tv_pct_symbol, "")
                views.setTextViewText(R.id.tv_attendance_classes, "-- / --")
                views.setProgressBar(R.id.pb_attendance, 100, 0, false)
            }

            // Launch Deskly Attendance page on widget tap
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.parse("deskly://dashboard/attendance")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_UPDATE_WIDGET) {
            updateAllWidgets(context)
        }
    }

    private data class WidgetData(
        val percentage: Double,
        val formattedPct: String,
        val attended: Int,
        val total: Int
    )

    private fun loadWidgetData(context: Context): WidgetData? {
        try {
            // First check SharedPreferences
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (prefs.contains("attendance_pct")) {
                val formattedPct = prefs.getString("attendance_pct", "--%") ?: "--%"
                val pct = prefs.getFloat("percentage", 0f).toDouble()
                val attended = prefs.getInt("classes_attended", 0)
                val total = prefs.getInt("classes_total", 0)
                return WidgetData(pct, formattedPct, attended, total)
            }

            // Candidate paths for widget_attendance.json
            val candidateFiles = listOfNotNull(
                File(context.filesDir, "widget_attendance.json"),
                File(context.filesDir, "deskly_widget_data.json"),
                context.dataDir?.let { File(it, "files/widget_attendance.json") },
                context.filesDir.parentFile?.let { File(it, "app_data/widget_attendance.json") },
                context.filesDir.parentFile?.let { File(it, "files/widget_attendance.json") }
            )

            for (jsonFile in candidateFiles) {
                if (jsonFile.exists() && jsonFile.canRead()) {
                    val jsonString = jsonFile.readText().trim()
                    if (jsonString.isNotEmpty()) {
                        val json = JSONObject(jsonString)
                        val pct = json.optDouble("percentage", 0.0)
                        val formattedPct = json.optString("formattedPct", "${String.format("%.1f", pct)}%")
                        val attended = json.optInt("attended", 0)
                        val total = json.optInt("total", 0)
                        return WidgetData(pct, formattedPct, attended, total)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return null
    }
}
