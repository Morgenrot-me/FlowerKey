package com.flowerkey.app;

import android.app.PendingIntent;
import android.app.assist.AssistStructure;
import android.content.Intent;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveRequest;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;

import java.util.List;

/**
 * 花钥自动填充服务
 * 检测密码框 → 提取 URL/packageName → 触发 AutofillAuthActivity
 * 若 App 已解锁则直接展示匹配条目，否则要求输入主密码
 */
public class FlowerKeyAutofillService extends AutofillService {

    @Override
    public void onFillRequest(FillRequest request, CancellationSignal cancellationSignal, FillCallback callback) {
        List<FillContext> contexts = request.getFillContexts();
        AssistStructure structure = contexts.get(contexts.size() - 1).getStructure();

        AutofillId passwordFieldId = findPasswordField(structure.getWindowNodeAt(0).getRootViewNode());
        if (passwordFieldId == null) {
            callback.onSuccess(null);
            return;
        }

        String packageName = structure.getActivityComponent().getPackageName();
        // 尝试从 AssistStructure 提取 WebView URL（Chrome/WebView 会填充 webDomain）
        String webDomain = extractWebDomain(structure.getWindowNodeAt(0).getRootViewNode());

        Intent authIntent = new Intent(this, AutofillAuthActivity.class);
        authIntent.putExtra(AutofillAuthActivity.EXTRA_AUTOFILL_ID, passwordFieldId);
        authIntent.putExtra(AutofillAuthActivity.EXTRA_PACKAGE_NAME, packageName);
        if (webDomain != null) authIntent.putExtra(AutofillAuthActivity.EXTRA_WEB_DOMAIN, webDomain);
        authIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        PendingIntent pi = PendingIntent.getActivity(this, packageName.hashCode(), authIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);

        RemoteViews presentation = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_1);
        presentation.setTextViewText(android.R.id.text1, "🔑 使用花钥填充密码");

        Dataset dataset = new Dataset.Builder()
            .setValue(passwordFieldId, AutofillValue.forText(""), presentation)
            .setAuthentication(pi.getIntentSender())
            .build();

        callback.onSuccess(new FillResponse.Builder().addDataset(dataset).build());
    }

    @Override
    public void onSaveRequest(SaveRequest request, SaveCallback callback) {
        callback.onSuccess();
    }

    private AutofillId findPasswordField(AssistStructure.ViewNode node) {
        if (node.getAutofillType() != android.view.View.AUTOFILL_TYPE_NONE) {
            String[] hints = node.getAutofillHints();
            if (hints != null) {
                for (String h : hints) {
                    if (h != null && h.toLowerCase().contains("password")) return node.getAutofillId();
                }
            }
            if ((node.getInputType() & 0x80) != 0) return node.getAutofillId();
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AutofillId found = findPasswordField(node.getChildAt(i));
            if (found != null) return found;
        }
        return null;
    }

    /** 递归提取 WebView 的 webDomain（Chrome/WebView 填充场景） */
    private String extractWebDomain(AssistStructure.ViewNode node) {
        String domain = node.getWebDomain();
        if (domain != null && !domain.isEmpty()) return domain;
        for (int i = 0; i < node.getChildCount(); i++) {
            String found = extractWebDomain(node.getChildAt(i));
            if (found != null) return found;
        }
        return null;
    }
}
