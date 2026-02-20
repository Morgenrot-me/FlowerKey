package com.flowerkey.app;

import android.app.PendingIntent;
import android.app.assist.AssistStructure;
import android.content.Intent;
import android.content.IntentSender;
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
 * 检测密码框 → 触发 AutofillAuthActivity → 用户输入主密码+代号 → 生成密码填充
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

        // 构建触发 AuthActivity 的 IntentSender
        Intent authIntent = new Intent(this, AutofillAuthActivity.class);
        authIntent.putExtra(AutofillAuthActivity.EXTRA_AUTOFILL_ID, passwordFieldId);
        authIntent.putExtra(AutofillAuthActivity.EXTRA_PACKAGE_NAME, packageName);
        authIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        PendingIntent pi = PendingIntent.getActivity(this, 0, authIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);

        RemoteViews presentation = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_1);
        presentation.setTextViewText(android.R.id.text1, "🔑 使用花钥填充密码");

        // 空占位 Dataset，点击后触发认证流程
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
}
