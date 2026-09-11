package com.nova.os;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;

/**
 * قشرة نوفا على أندرويد.
 *
 * النظام نفسه (النواة، النوافذ، الصلاحيات، الملفات) مُحزَّم في أصول التطبيق
 * ويعمل كاملًا بلا شبكة ولا خادم. مهمة هذا الصنف ثلاثة أشياء فقط:
 *
 *  1) تقديم الأصول على أصل https حقيقي عبر WebViewAssetLoader — لا file://.
 *     الفرق ليس تجميليًا: أصل file:// معتم في Chromium الحديث فتتعطّل
 *     IndexedDB، وهي مخزن جلسة نوفا (وحدها تحمل صورًا مستوردة).
 *  2) ربط زرّ الرجوع بنداء نظام: الرجوع في نظام نوافذ يعني إغلاق النافذة
 *     النشطة لا مغادرة التطبيق.
 *  3) وصل منتقي الملفات كي يعمل استيراد ملفات المستخدم الحقيقية.
 *
 * لا شيء هنا يتصل بالشبكة، ولا يُطلب أي إذن أندرويد.
 */
public class MainActivity extends Activity {

    private WebView web;
    private ValueCallback<Uri[]> pendingFiles;
    private static final int PICK_FILE = 1001;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(0xFF07070D);
        window.setNavigationBarColor(0xFF07070D);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setTextZoom(100);
        // النظام يرسم واجهته بنفسه: لا تكبير ولا إعادة تنسيق من المتصفح
        settings.setSupportZoom(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);

        web.setBackgroundColor(0xFF07070D);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                // روابط خارجية تُفتح في المتصفح، ولا تُحمَّل داخل النظام
                if (url.getHost() != null && !"appassets.androidplatform.net".equals(url.getHost())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (Exception ignored) {
                        // لا متصفح: نتجاهل بهدوء بدل أن نُسقط التطبيق
                    }
                    return true;
                }
                return false;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingFiles != null) {
                    pendingFiles.onReceiveValue(null);
                }
                pendingFiles = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK_FILE);
                    return true;
                } catch (Exception e) {
                    pendingFiles = null;
                    return false;
                }
            }
        });

        setContentView(web);
        web.loadUrl("https://appassets.androidplatform.net/assets/nova/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == PICK_FILE && pendingFiles != null) {
            pendingFiles.onReceiveValue(
                    WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingFiles = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null) {
            // الرجوع يُغلق النافذة النشطة عبر نداء نظام مُسجّل، فيُمكن الرجوع عنه.
            // وإن لم تبقَ نافذة، يخرج المستخدم من التطبيق كما يتوقّع.
            web.evaluateJavascript(
                    "(function(){var n=document.querySelectorAll('.nwin').length;"
                            + "if(n>0){window.__novaBack&&window.__novaBack();return 'handled';}"
                            + "return 'exit';})()",
                    value -> {
                        if (value != null && value.contains("exit")) {
                            finish();
                        }
                    });
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
