package com.deskly.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File

open class AttendanceWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_UPDATE_WIDGET = "com.deskly.app.ACTION_UPDATE_WIDGET"
        private const val PREFS_NAME = "deskly_widget_data"

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)

            val p2x3 = AttendanceWidgetProvider()
            val ids2x3 = appWidgetManager.getAppWidgetIds(ComponentName(context, AttendanceWidgetProvider::class.java))
            for (id in ids2x3) {
                p2x3.updateWidget(context, appWidgetManager, id)
            }

            val p2x4 = AttendanceWidgetProvider2x4()
            val ids2x4 = appWidgetManager.getAppWidgetIds(ComponentName(context, AttendanceWidgetProvider2x4::class.java))
            for (id in ids2x4) {
                p2x4.updateWidget(context, appWidgetManager, id)
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateWidget(context, appWidgetManager, appWidgetId)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_UPDATE_WIDGET) {
            updateAllWidgets(context)
        }
    }

    fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val widgetData = loadWidgetData(context)
        val views = RemoteViews(context.packageName, R.layout.widget_attendance_small)

        if (widgetData != null) {
            val pct = widgetData.percentage
            val attended = widgetData.attended
            val total = widgetData.total
            val odHours = widgetData.odHours
            val pctNumber = String.format(java.util.Locale.US, "%.1f", pct)

            views.setTextViewText(R.id.tv_attendance_pct, "$pctNumber%")
            views.setProgressBar(R.id.pb_attendance, 100, pct.toInt().coerceIn(0, 100), false)

            views.setTextViewText(R.id.tv_classes_attended, "$attended")
            views.setTextViewText(R.id.tv_classes_total, " / $total")
            val classesPct = if (total > 0) {
                ((attended.toDouble() / total.toDouble()) * 100).toInt().coerceIn(0, 100)
            } else {
                0
            }
            views.setProgressBar(R.id.pb_classes, 100, classesPct, false)

            views.setTextViewText(R.id.tv_od_hours, "$odHours")
            val odPct = if (odHours > 0) {
                (odHours * 4).coerceIn(15, 100)
            } else {
                0
            }
            views.setProgressBar(R.id.pb_od, 100, odPct, false)
        } else {
            views.setTextViewText(R.id.tv_attendance_pct, "--%")
            views.setProgressBar(R.id.pb_attendance, 100, 0, false)

            views.setTextViewText(R.id.tv_classes_attended, "--")
            views.setTextViewText(R.id.tv_classes_total, " / --")
            views.setProgressBar(R.id.pb_classes, 100, 0, false)

            views.setTextViewText(R.id.tv_od_hours, "--")
            views.setProgressBar(R.id.pb_od, 100, 0, false)
        }

        // Tap attendance section to open attendance screen
        val attendanceIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("deskly://dashboard/attendance")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val attendancePendingIntent = PendingIntent.getActivity(
            context,
            0,
            attendanceIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_container, attendancePendingIntent)
        views.setOnClickPendingIntent(R.id.section_attendance, attendancePendingIntent)
        views.setOnClickPendingIntent(R.id.col_classes, attendancePendingIntent)

        // Tap OD column to open OD screen
        val odIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("deskly://dashboard/od")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val odPendingIntent = PendingIntent.getActivity(
            context,
            1,
            odIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.col_od, odPendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private data class WidgetData(
        val percentage: Double,
        val formattedPct: String,
        val attended: Int,
        val total: Int,
        val odHours: Int
    )

    private fun loadWidgetData(context: Context): WidgetData? {
        try {
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
                        val formattedPct = json.optString("formattedPct", "${String.format(java.util.Locale.US, "%.1f", pct)}%")
                        val attended = json.optInt("attended", 0)
                        val total = json.optInt("total", 0)
                        val odHours = json.optInt("odHours", json.optInt("od_hours", 0))

                        return WidgetData(pct, formattedPct, attended, total, odHours)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return null
    }
}
