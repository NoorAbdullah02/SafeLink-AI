package com.safelink.safelink_ai

import android.content.Intent
import android.content.ActivityNotFoundException
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var channel: MethodChannel? = null
    private fun clearSharedIntent(source: Intent?) {
        source?.removeExtra(Intent.EXTRA_TEXT)
        source?.removeExtra(Intent.EXTRA_PROCESS_TEXT)
        source?.clipData = null
        source?.data = null
        source?.action = Intent.ACTION_MAIN
    }
    private fun sharedText(intent: Intent?): String? {
        if (intent == null) return null
        // 1. Process Text context menu action
        if (intent.action == Intent.ACTION_PROCESS_TEXT) {
            val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            if (!text.isNullOrBlank()) return text.take(10000)
        }
        // 2. Standard Android Share Sheet (ACTION_SEND)
        if (intent.action == Intent.ACTION_SEND) {
            val extraText = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
            if (!extraText.isNullOrBlank()) return extraText.take(10000)

            val clipData = intent.clipData
            if (clipData != null && clipData.itemCount > 0) {
                val clipText = clipData.getItemAt(0)?.coerceToText(this)?.toString()
                if (!clipText.isNullOrBlank()) return clipText.take(10000)
            }
        }
        // 3. Direct URL or URI data
        if (intent.action == Intent.ACTION_VIEW) {
            val uriString = intent.dataString
            if (!uriString.isNullOrBlank()) return uriString.take(10000)
        }
        return null
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "safelink/share")
        channel?.setMethodCallHandler { call, result ->
            if (call.method == "getInitialText") {
                val text = sharedText(intent)
                result.success(text)
                clearSharedIntent(intent)
            } else if (call.method == "dialNumber") {
                val number = call.argument<String>("number")
                if (number != null && Regex("^\\+?[0-9]{3,16}$").matches(number)) {
                    val dialIntent = Intent(Intent.ACTION_DIAL, android.net.Uri.parse("tel:$number"))
                    dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    try {
                        startActivity(dialIntent)
                        result.success(true)
                    } catch (_: ActivityNotFoundException) {
                        result.error("NO_DIALER", "No dialer is available", null)
                    } catch (_: SecurityException) {
                        result.error("DIALER_DENIED", "The dialer could not be opened", null)
                    }
                } else {
                    result.error("INVALID_NUMBER", "Phone number is invalid", null)
                }
            } else result.notImplemented()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        sharedText(intent)?.let { text ->
            channel?.invokeMethod("sharedText", text, object : MethodChannel.Result {
                override fun success(result: Any?) {
                    // Keep text until Dart accepts it, including while its engine starts.
                    if (this@MainActivity.intent === intent) clearSharedIntent(intent)
                }
                override fun error(code: String, message: String?, details: Any?) {}
                override fun notImplemented() {}
            })
        }
    }
}
