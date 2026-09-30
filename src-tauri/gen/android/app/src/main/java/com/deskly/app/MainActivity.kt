package com.deskly.app

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  companion object {
    private var instance: MainActivity? = null

    @JvmStatic
    fun notifyWidgetUpdate() {
      instance?.let { ctx ->
        AttendanceWidgetProvider.updateAllWidgets(ctx)
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    instance = this
    AttendanceWidgetProvider.updateAllWidgets(this)
  }

  override fun onResume() {
    super.onResume()
    instance = this
    AttendanceWidgetProvider.updateAllWidgets(this)
  }

  override fun onPause() {
    super.onPause()
    AttendanceWidgetProvider.updateAllWidgets(this)
  }

  override fun onDestroy() {
    if (instance == this) {
      instance = null
    }
    super.onDestroy()
  }
}
