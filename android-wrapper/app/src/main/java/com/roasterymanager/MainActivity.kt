package com.roasterymanager

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.content.SharedPreferences
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var sharedPreferences: SharedPreferences
    private val PREFS_NAME = "RoasteryManagerPrefs"
    private val KEY_WEB_URL = "web_app_url"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        
        // Initialize WebView programmatically for absolute simplicity
        webView = WebView(this)
        setContentView(webView)
        
        configureWebView()
        
        // Check if user has already configured their SaaS/Glitch URL
        val savedUrl = sharedPreferences.getString(KEY_WEB_URL, null)
        if (savedUrl.isNullOrEmpty()) {
            showUrlConfigDialog()
        } else {
            webView.loadUrl(savedUrl)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val settings: WebSettings = webView.settings
        
        // Crucial configurations for high-end SPA client dashboards
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        
        // Prevent opening default system browser when clicking links
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url != null) {
                    view?.loadUrl(url)
                }
                return true
            }
        }
    }

    /**
     * Show a native dialog prompting the user to enter their custom Glitch/Web URL.
     * This makes the APK universal for any roastery.
     */
    private fun showUrlConfigDialog() {
        val builder = AlertDialog.Builder(this)
        builder.setTitle("Konfigurasi Web App URL")
        builder.setMessage("Masukkan alamat URL aplikasi web Anda (contoh: https://roastery-manager.glitch.me)")
        builder.setCancelable(false)

        val input = EditText(this)
        input.hint = "https://your-roastery.glitch.me"
        val lp = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT
        )
        input.layoutParams = lp
        builder.setView(input)

        builder.setPositiveButton("Hubungkan") { dialog, _ ->
            val url = input.text.toString().trim()
            if (url.startsWith("http://") || url.startsWith("https://")) {
                sharedPreferences.edit().putString(KEY_WEB_URL, url).apply()
                webView.loadUrl(url)
                Toast.makeText(this, "Berhasil menghubungkan ke: $url", Toast.LENGTH_LONG).show()
                dialog.dismiss()
            } else {
                Toast.makeText(this, "URL tidak valid. Harus diawali http:// atau https://", Toast.LENGTH_LONG).show()
                showUrlConfigDialog() // Show again
            }
        }

        builder.show()
    }

    /**
     * Handle back key presses inside the WebView instead of closing the app immediately.
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    /**
     * Clear the saved URL and reset connection.
     * Can be invoked by developer or via custom menu actions.
     */
    fun resetConnectionUrl() {
        sharedPreferences.edit().remove(KEY_WEB_URL).apply()
        Toast.makeText(this, "Koneksi URL berhasil di-reset.", Toast.LENGTH_SHORT).show()
        showUrlConfigDialog()
    }
}
