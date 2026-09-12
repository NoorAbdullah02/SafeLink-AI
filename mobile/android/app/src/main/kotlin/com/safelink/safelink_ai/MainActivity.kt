package com.safelink.safelink_ai

import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var channel: MethodChannel? = null
    private fun sharedText(intent: Intent?): String? =
        if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain")
            intent.getStringExtra(Intent.EXTRA_TEXT)?.take(10000)
        else null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "safelink/share")
        channel?.setMethodCallHandler { call, result ->
            if (call.method == "getInitialText") {
                result.success(sharedText(intent))
                intent?.removeExtra(Intent.EXTRA_TEXT)
            } else if (call.method == "dialNumber") {
                val number = call.argument<String>("number")
                if (!number.isNullOrEmpty()) {
                    val dialIntent = Intent(Intent.ACTION_DIAL, android.net.Uri.parse("tel:$number"))
                    dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(dialIntent)
                    result.success(true)
                } else {
                    result.error("INVALID_NUMBER", "Phone number is empty", null)
                }
            } else result.notImplemented()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        sharedText(intent)?.let { channel?.invokeMethod("sharedText", it) }
        intent.removeExtra(Intent.EXTRA_TEXT)
    }
}
